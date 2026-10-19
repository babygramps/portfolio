// TODO: Potentially write a simple rust crate that generates these from the OpenAPI spec

import { z } from 'zod'

// The API is a Lambda function URL that is only known at deploy time, so the
// deploy workflow publishes it to /scheduling/config.json. Set
// NEXT_PUBLIC_API_URL to point a local build somewhere else.
let apiBase: Promise<URL> | undefined
const getApiBase = () => {
  apiBase ??= process.env.NEXT_PUBLIC_API_URL
    ? Promise.resolve(new URL(process.env.NEXT_PUBLIC_API_URL))
    : fetch('/scheduling/config.json', { cache: 'no-store' })
      .then(res => res.json())
      .then(({ apiUrl }) => new URL(apiUrl))
  apiBase.catch(() => { apiBase = undefined })
  return apiBase
}

// Function URLs come with a trailing slash; keep it so paths are appended
const apiUrl = async (path: string) => new URL(path.replace(/^\//, ''), await getApiBase())

/** Public link to an event, as shared with attendees */
export const eventShareUrl = (eventId: string) => `https://rickrothbart.com/scheduling/event/?id=${encodeURIComponent(eventId)}`
/** Private link that lets the creator edit an event from another device */
export const eventEditUrl = (eventId: string, editKey: string) => `${eventShareUrl(eventId)}&key=${encodeURIComponent(editKey)}`
/** In-app path to an event (basePath is added by next/link and the router) */
export const eventPath = (eventId: string) => `/event/?id=${encodeURIComponent(eventId)}`

export const EventInput = z.object({
  name: z.string().optional(),
  times: z.string().array(),
  timezone: z.string(),
})
export type EventInput = z.infer<typeof EventInput>

export const EventResponse = z.object({
  id: z.string(),
  name: z.string(),
  times: z.string().array(),
  timezone: z.string(),
  created_at: z.number(),
  /** Only returned when the event is created */
  edit_key: z.string().optional(),
})
export type EventResponse = z.infer<typeof EventResponse>

export const PersonInput = z.object({
  availability: z.string().array(),
})
export type PersonInput = z.infer<typeof PersonInput>

export const PersonResponse = z.object({
  name: z.string(),
  availability: z.string().array(),
  created_at: z.number(),
})
export type PersonResponse = z.infer<typeof PersonResponse>

export const StatsResponse = z.object({
  event_count: z.number(),
  person_count: z.number(),
  version: z.string(),
})
export type StatsResponse = z.infer<typeof StatsResponse>

const get = async <S extends z.Schema>(url: string, schema: S, auth?: string): Promise<ReturnType<S['parse']>> => {
  const res = await fetch(await apiUrl(url), {
    headers: {
      ...auth && { Authorization: `Bearer ${auth}` },
    },
  })
    .catch(console.warn)
  if (!res?.ok) throw res
  return schema.parse(await res.json())
}

const post = async <S extends z.Schema>(url: string, schema: S, input: unknown, auth?: string, method = 'POST', headers?: Record<string, string>): Promise<ReturnType<S['parse']>> => {
  const res = await fetch(await apiUrl(url), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...auth && { Authorization: `Bearer ${auth}` },
      ...headers,
    },
    body: JSON.stringify(input),
  })
    .catch(console.warn)
  if (!res?.ok) throw res
  return schema.parse(await res.json())
}

// Get
export const getStats = () => get('/stats', StatsResponse)
export const getEvent = (eventId: string) => get(`/event/${encodeURIComponent(eventId)}`, EventResponse)
export const getPeople = (eventId: string) => get(`/event/${encodeURIComponent(eventId)}/people`, PersonResponse.array())
export const getPerson = (eventId: string, personName: string, password?: string) => get(`/event/${encodeURIComponent(eventId)}/people/${encodeURIComponent(personName)}`, PersonResponse, password && btoa(password))

// Post
export const createEvent = (input: EventInput) => post('/event', EventResponse, EventInput.parse(input))
export const updateEvent = (eventId: string, input: EventInput, editKey: string) => post(`/event/${encodeURIComponent(eventId)}`, EventResponse, EventInput.parse(input), undefined, 'PATCH', { 'X-Edit-Key': editKey })
export const updatePerson = (eventId: string, personName: string, input: PersonInput, password?: string) => post(`/event/${encodeURIComponent(eventId)}/people/${encodeURIComponent(personName)}`, PersonResponse, PersonInput.parse(input), password && btoa(password), 'PATCH')
