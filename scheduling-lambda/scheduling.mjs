// Crab Fit API for /scheduling — a port of the upstream Rust API
// (github.com/GRA0007/crab.fit, api/src/routes) onto one DynamoDB table so it
// runs as a Lambda function URL like the site's other backends.
//
// GET   /stats
// POST  /event                              { name?, times, timezone }
// GET   /event/:id
// GET   /event/:id/people
// GET   /event/:id/people/:name             login, or sign up if new
// PATCH /event/:id/people/:name             { availability }
//
// Items: pk=event#<id> sk=meta              the event
//        pk=event#<id> sk=person#<name>     one person (name lowercased)
//        pk=stats      sk=stats             event_count, person_count
import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import punycode from 'node:punycode'
import { promisify } from 'node:util'
import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'

const TABLE = process.env.TABLE_NAME || 'rick-scheduling'
const VERSION = '3.0.0'

// Upstream has no explicit limits; these keep any one event well under
// DynamoDB's 400 KB item size.
const MAX_NAME = 100
const MAX_TIMES = 5000

const adjectives = JSON.parse(readFileSync(new URL('./adjectives.json', import.meta.url)))
const crabs = JSON.parse(readFileSync(new URL('./crabs.json', import.meta.url)))

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
})

const scryptAsync = promisify(scrypt)

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})
const error = (statusCode, message) => json(statusCode, { error: message })

const nowSeconds = () => Math.floor(Date.now() / 1000)
const pick = list => list[randomInt(list.length)]
const isStringArray = (v, max) => Array.isArray(v) && v.length <= max && v.every(x => typeof x === 'string' && x.length <= 20)

// Same shape as upstream's generate_name / generate_id / encode_name
const generateName = () => `${pick(adjectives)} ${pick(crabs)} Crab`
const encodeName = name => {
  let pc
  try { pc = punycode.encode(name.trim().toLowerCase()) } catch { pc = '' }
  return pc.trim().replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-')
}
const generateId = name => {
  let id = encodeName(name)
  if (!id.replace(/-/g, '')) id = encodeName(generateName())
  return `${id}-${randomInt(100000, 1000000)}`
}

// Upstream uses bcrypt; scrypt is built into Node so the zip stays dependency free
const hashPassword = async raw => {
  const salt = randomBytes(16)
  const hash = await scryptAsync(raw, salt, 32)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}
const verifyPassword = async (person, raw) => {
  // A person who didn't set a password can log in with or without one
  if (!person.password_hash) return true
  const [, salt, expected] = person.password_hash.split('$')
  const actual = await scryptAsync(raw ?? '', Buffer.from(salt, 'base64'), 32)
  return timingSafeEqual(actual, Buffer.from(expected, 'base64'))
}

// Authorization: Bearer <base64 password>
const parsePassword = headers => {
  const auth = headers?.authorization
  if (!auth?.toLowerCase().startsWith('bearer ')) return undefined
  return Buffer.from(auth.slice(7).trim(), 'base64').toString('utf8')
}

const eventResponse = e => ({ id: e.id, name: e.name, times: e.times, timezone: e.timezone, created_at: e.created_at })
const personResponse = p => ({ name: p.name, availability: p.availability ?? [], created_at: p.created_at })

const incrementStat = field => ddb.send(new UpdateCommand({
  TableName: TABLE,
  Key: { pk: 'stats', sk: 'stats' },
  UpdateExpression: 'ADD #f :one',
  ExpressionAttributeNames: { '#f': field },
  ExpressionAttributeValues: { ':one': 1 },
}))

const getEvent = async id => (await ddb.send(new GetCommand({
  TableName: TABLE,
  Key: { pk: `event#${id}`, sk: 'meta' },
}))).Item

// Returns undefined if the event doesn't exist
const getPeople = async id => {
  const items = []
  let ExclusiveStartKey
  do {
    const out = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :p',
      ExpressionAttributeValues: { ':p': `event#${id}` },
      ExclusiveStartKey,
    }))
    items.push(...(out.Items ?? []))
    ExclusiveStartKey = out.LastEvaluatedKey
  } while (ExclusiveStartKey)
  if (!items.some(i => i.sk === 'meta')) return undefined
  return items.filter(i => i.sk.startsWith('person#'))
}

const personKey = (id, name) => ({ pk: `event#${id}`, sk: `person#${name.toLowerCase()}` })

async function getStats() {
  const stats = (await ddb.send(new GetCommand({ TableName: TABLE, Key: { pk: 'stats', sk: 'stats' } }))).Item
  return json(200, { event_count: stats?.event_count ?? 0, person_count: stats?.person_count ?? 0, version: VERSION })
}

async function createEvent(input) {
  if (!input || !isStringArray(input.times, MAX_TIMES) || typeof input.timezone !== 'string' || input.timezone.length > 100) {
    return error(422, 'Invalid input provided')
  }
  if (input.name != null && typeof input.name !== 'string') return error(422, 'Invalid input provided')

  const name = input.name?.trim() ? input.name.trim().slice(0, MAX_NAME) : generateName()
  const now = nowSeconds()

  // Claim a fresh id; the condition stops two creates landing on the same one
  for (;;) {
    const event = { id: generateId(name), name, times: input.times, timezone: input.timezone, created_at: now, visited_at: now }
    try {
      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: { pk: `event#${event.id}`, sk: 'meta', ...event },
        ConditionExpression: 'attribute_not_exists(pk)',
      }))
      await incrementStat('event_count')
      return json(201, eventResponse(event))
    } catch (e) {
      if (!(e instanceof ConditionalCheckFailedException)) throw e
    }
  }
}

async function getPerson(id, name, password) {
  const people = await getPeople(id)
  if (!people) return error(404, 'Not found')

  const existing = people.find(p => p.name.toLowerCase() === name.toLowerCase())
  if (existing) {
    return await verifyPassword(existing, password)
      ? json(200, personResponse(existing))
      : error(401, 'Not authorized')
  }

  // Sign up
  if (!name.trim() || name.length > MAX_NAME) return error(422, 'Invalid input provided')
  const person = {
    name,
    password_hash: password != null ? await hashPassword(password) : undefined,
    created_at: nowSeconds(),
    availability: [],
  }
  try {
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: { ...personKey(id, name), ...person },
      ConditionExpression: 'attribute_not_exists(pk)',
    }))
  } catch (e) {
    // Someone signed up with this name in the meantime; make them log in
    if (e instanceof ConditionalCheckFailedException) return getPerson(id, name, password)
    throw e
  }
  await incrementStat('person_count')
  return json(200, personResponse(person))
}

async function updatePerson(id, name, password, input) {
  if (!input || !isStringArray(input.availability, MAX_TIMES)) return error(422, 'Invalid input provided')

  const people = await getPeople(id)
  if (!people) return error(404, 'Not found')
  const existing = people.find(p => p.name.toLowerCase() === name.toLowerCase())
  if (!existing) return error(404, 'Not found')
  if (!await verifyPassword(existing, password)) return error(401, 'Not authorized')

  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: personKey(id, existing.name),
    UpdateExpression: 'SET availability = :a',
    ExpressionAttributeValues: { ':a': input.availability },
  }))
  return json(200, personResponse({ ...existing, availability: input.availability }))
}

export async function route(method, path, headers, body) {
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  let input
  if (body) {
    try { input = JSON.parse(body) } catch { return error(415, 'Unsupported input format') }
  }

  if (method === 'GET' && parts.length === 1 && parts[0] === 'stats') return getStats()
  if (parts[0] !== 'event') return error(404, 'Not found')

  if (method === 'POST' && parts.length === 1) return createEvent(input)

  const [, id, sub, name] = parts
  if (method === 'GET' && parts.length === 2) {
    const event = await getEvent(id)
    if (!event) return error(404, 'Not found')
    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { pk: `event#${id}`, sk: 'meta' },
      UpdateExpression: 'SET visited_at = :now',
      ExpressionAttributeValues: { ':now': nowSeconds() },
    }))
    return json(200, eventResponse(event))
  }
  if (sub !== 'people') return error(404, 'Not found')
  if (method === 'GET' && parts.length === 3) {
    const people = await getPeople(id)
    if (!people) return error(404, 'Not found')
    return json(200, people.filter(p => p.availability?.length).map(personResponse))
  }
  if (parts.length === 4) {
    const password = parsePassword(headers)
    if (method === 'GET') return getPerson(id, name, password)
    if (method === 'PATCH') return updatePerson(id, name, password, input)
  }
  return error(404, 'Not found')
}

export const handler = async event => {
  const method = event.requestContext?.http?.method ?? 'GET'
  const body = event.body && event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body
  try {
    return await route(method, event.rawPath ?? '/', event.headers, body)
  } catch (e) {
    console.error(e)
    return error(500, 'Internal error')
  }
}
