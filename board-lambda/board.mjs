// BBQ cook-clock shared board — tiny CRUD over one DynamoDB table.
// GET  -> full board state { checks: {taskId: bool}, schedule: {shiftId: [names]} }
// POST -> apply one op, returns the new full state:
//   { op: 'check',  id, value }        task checkbox
//   { op: 'signup', shiftId, name }    add name to a shift (atomic set add)
//   { op: 'drop',   shiftId, name }    remove name from a shift
//   { op: 'reset-checks' }             clear all checkboxes
//   { op: 'timer-start', id, label, seconds }   shared kitchen timer (counts down)
//   { op: 'watch-start', id, label }            shared stopwatch (counts up)
//   { op: 'timer-pause', id }                   freeze a timer or stopwatch
//   { op: 'timer-resume', id }                  shift its anchor and unfreeze
//   { op: 'timer-clear', id }                   remove a timer or stopwatch
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb'

const TABLE = process.env.TABLE_NAME || 'rick-bbq-board'
const PK = 'board'

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
})

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

async function getState() {
  const out = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :p',
      ExpressionAttributeValues: { ':p': PK },
    }),
  )
  const checks = {}
  const schedule = {}
  const timers = {}
  for (const item of out.Items || []) {
    if (item.sk.startsWith('check#')) checks[item.sk.slice(6)] = !!item.v
    else if (item.sk.startsWith('shift#')) schedule[item.sk.slice(6)] = [...(item.names || [])].sort()
    else if (item.sk.startsWith('timer#'))
      // a stopwatch has startedAt and no endsAt; JSON drops the undefined keys
      timers[item.sk.slice(6)] = {
        label: item.label,
        endsAt: item.endsAt,
        total: item.total,
        startedAt: item.startedAt,
        pausedAt: item.pausedAt,
        createdAt: item.createdAt,
      }
  }
  return { checks, schedule, timers }
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method
  if (method === 'GET') return json(200, await getState())
  if (method !== 'POST') return json(405, { error: 'method not allowed' })

  let op
  try {
    op = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'bad json' })
  }

  try {
    // value must be an explicit boolean — a missing value coerced to false
    // would silently uncheck the task instead of surfacing the client bug
    if (op.op === 'check' && typeof op.id === 'string' && typeof op.value === 'boolean') {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { pk: PK, sk: `check#${op.id.slice(0, 64)}` },
          UpdateExpression: 'SET #v = :v',
          ExpressionAttributeNames: { '#v': 'v' },
          ExpressionAttributeValues: { ':v': !!op.value },
        }),
      )
    } else if (op.op === 'signup' && op.shiftId && op.name) {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { pk: PK, sk: `shift#${String(op.shiftId).slice(0, 64)}` },
          UpdateExpression: 'ADD #n :n',
          ExpressionAttributeNames: { '#n': 'names' },
          ExpressionAttributeValues: { ':n': new Set([String(op.name).slice(0, 64)]) },
        }),
      )
    } else if (op.op === 'drop' && op.shiftId && op.name) {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { pk: PK, sk: `shift#${String(op.shiftId).slice(0, 64)}` },
          UpdateExpression: 'DELETE #n :n',
          ExpressionAttributeNames: { '#n': 'names' },
          ExpressionAttributeValues: { ':n': new Set([String(op.name).slice(0, 64)]) },
        }),
      )
    } else if (
      op.op === 'timer-start' &&
      typeof op.id === 'string' &&
      Number.isFinite(op.seconds) &&
      op.seconds > 0 &&
      op.seconds <= 86400
    ) {
      // server computes endsAt so a device with a skewed clock can't poison
      // the countdown for everyone else
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { pk: PK, sk: `timer#${op.id.slice(0, 64)}` },
          UpdateExpression: 'SET #l = :l, #e = :e, #t = :t, #c = :c',
          ExpressionAttributeNames: {
            '#l': 'label',
            '#e': 'endsAt',
            '#t': 'total',
            '#c': 'createdAt',
          },
          ExpressionAttributeValues: {
            ':l': String(op.label || 'TIMER').slice(0, 64),
            ':e': Date.now() + Math.round(op.seconds) * 1000,
            ':t': Math.round(op.seconds),
            ':c': Date.now(),
          },
        }),
      )
    } else if (op.op === 'watch-start' && typeof op.id === 'string') {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { pk: PK, sk: `timer#${op.id.slice(0, 64)}` },
          UpdateExpression: 'SET #l = :l, #s = :s, #c = :c',
          ExpressionAttributeNames: { '#l': 'label', '#s': 'startedAt', '#c': 'createdAt' },
          ExpressionAttributeValues: {
            ':l': String(op.label || 'STOPWATCH').slice(0, 64),
            ':s': Date.now(),
            ':c': Date.now(),
          },
        }),
      )
    } else if (op.op === 'timer-pause' && typeof op.id === 'string') {
      // condition: item must exist (no phantom rows) and not already be
      // paused (a second concurrent pause must not move the freeze point)
      try {
        await ddb.send(
          new UpdateCommand({
            TableName: TABLE,
            Key: { pk: PK, sk: `timer#${op.id.slice(0, 64)}` },
            UpdateExpression: 'SET #p = :p',
            ConditionExpression: 'attribute_exists(sk) AND attribute_not_exists(#p)',
            ExpressionAttributeNames: { '#p': 'pausedAt' },
            ExpressionAttributeValues: { ':p': Date.now() },
          }),
        )
      } catch (e) {
        if (e.name !== 'ConditionalCheckFailedException') throw e
      }
    } else if (op.op === 'timer-resume' && typeof op.id === 'string') {
      const { timers } = await getState()
      const t = timers[op.id.slice(0, 64)]
      if (t && t.pausedAt != null) {
        const upd =
          t.endsAt != null
            ? // timer: push the deadline out by however long it sat paused
              { expr: 'SET #a = :a REMOVE #p', name: 'endsAt', val: Date.now() + (t.endsAt - t.pausedAt) }
            : // stopwatch: slide the start forward so elapsed stays frozen
              { expr: 'SET #a = :a REMOVE #p', name: 'startedAt', val: Date.now() - (t.pausedAt - t.startedAt) }
        await ddb.send(
          new UpdateCommand({
            TableName: TABLE,
            Key: { pk: PK, sk: `timer#${op.id.slice(0, 64)}` },
            UpdateExpression: upd.expr,
            ExpressionAttributeNames: { '#a': upd.name, '#p': 'pausedAt' },
            ExpressionAttributeValues: { ':a': upd.val },
          }),
        )
      }
    } else if (op.op === 'timer-clear' && typeof op.id === 'string') {
      // delete via BatchWrite — the role grants BatchWriteItem (used by
      // reset-checks) but not DeleteItem
      await ddb.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE]: [
              { DeleteRequest: { Key: { pk: PK, sk: `timer#${op.id.slice(0, 64)}` } } },
            ],
          },
        }),
      )
    } else if (op.op === 'reset-checks') {
      const { checks } = await getState()
      const ids = Object.keys(checks)
      while (ids.length) {
        const batch = ids.splice(0, 25).map((id) => ({
          DeleteRequest: { Key: { pk: PK, sk: `check#${id}` } },
        }))
        await ddb.send(new BatchWriteCommand({ RequestItems: { [TABLE]: batch } }))
      }
    } else {
      return json(400, { error: 'bad op' })
    }
    return json(200, await getState())
  } catch (e) {
    console.error(e)
    return json(500, { error: 'board error' })
  }
}
