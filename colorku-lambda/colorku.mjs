// Colorku shared board — one saved working board persisted in DynamoDB.
// A single global board (like the BBQ cook-clock), discovered by the frontend
// via /colorku/config.json and read/written over this Lambda's Function URL.
//
//   GET  -> the saved board doc, or {} if none has been saved yet
//   POST -> validate the posted board and overwrite the single doc; returns it
//
// Only { seed, difficultyKey, entries, pencil, revealed } is stored — the
// puzzle itself is regenerated deterministically from the seed on the client,
// so the stored item is a few hundred bytes.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

const TABLE = process.env.TABLE_NAME || 'rick-colorku-board'
const PK = 'board'
const SK = 'state'
const DIFFS = new Set(['easy', 'medium', 'hard', 'expert'])

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
})

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

// Coerce an untrusted board into a clean, bounded shape, or null if unusable.
// entries: 81 ints in 0..9 (0 = empty). pencil: 81 arrays of distinct ints 1..9.
function clean(doc) {
  if (!doc || typeof doc !== 'object') return null
  if (!DIFFS.has(doc.difficultyKey)) return null
  if (!Number.isFinite(doc.seed)) return null
  if (!Array.isArray(doc.entries) || doc.entries.length !== 81) return null
  if (!Array.isArray(doc.pencil) || doc.pencil.length !== 81) return null
  const entries = doc.entries.map((v) => (Number.isInteger(v) && v >= 0 && v <= 9 ? v : 0))
  const pencil = doc.pencil.map((arr) =>
    Array.isArray(arr)
      ? [...new Set(arr.filter((d) => Number.isInteger(d) && d >= 1 && d <= 9))].sort((a, b) => a - b)
      : [],
  )
  return { seed: doc.seed >>> 0, difficultyKey: doc.difficultyKey, revealed: !!doc.revealed, entries, pencil }
}

export const handler = async (event) => {
  const method = event.requestContext?.http?.method

  if (method === 'GET') {
    try {
      const out = await ddb.send(new GetCommand({ TableName: TABLE, Key: { pk: PK, sk: SK } }))
      return json(200, out.Item?.doc || {})
    } catch (e) {
      console.error(e)
      return json(500, { error: 'load error' })
    }
  }

  if (method !== 'POST') return json(405, { error: 'method not allowed' })

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'bad json' })
  }

  const doc = clean(body)
  if (!doc) return json(400, { error: 'bad board' })

  const stored = { ...doc, updatedAt: Date.now() }
  try {
    await ddb.send(new PutCommand({ TableName: TABLE, Item: { pk: PK, sk: SK, doc: stored } }))
    return json(200, stored)
  } catch (e) {
    console.error(e)
    return json(500, { error: 'save error' })
  }
}
