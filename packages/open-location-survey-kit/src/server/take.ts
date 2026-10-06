import { subjectUnknown } from "../core/known"
import { subjectsOfJsonl, type ListedSubject } from "../core/listed"
import { nameTaken } from "../core/namesake"
import { readEnvelope } from "../core/observation"
import { REPORTS_PATH } from "../core/reports-path"
import type { Problem, SurveySchema } from "../core/schema"
import { uuidv7 } from "../core/uuidv7"
import type { Words } from "../core/words"
import { issueOf } from "../outputs/issue"
import { recordOf } from "../outputs/record"
import type { IssueSink, SinkError } from "./github-app"
import { turnstilePasses } from "./turnstile"

/**
 * How a report shows it comes from a person: a Cloudflare Turnstile token
 * checked with this secret, or nothing at all, which is for a survey not open
 * to the world, such as one being developed.
 */
export type Challenge = { readonly type: "turnstile"; readonly secret: string } | { readonly type: "none" }

/** What the server needs to take reports for one survey. */
export interface SurveyServer {
  readonly schema: SurveySchema
  readonly words: Words
  /** The basemaps a pin may be placed on, by id; the page offers the same. */
  readonly basemaps: readonly string[]
  /** Where the list is published, ending in a slash, and its JSONL files; undefined judges a report without the list. */
  readonly list: { readonly base: string; readonly files: readonly string[] } | undefined
  /** Where an accepted report's issue goes; undefined while none is set up. */
  readonly sink: IssueSink | undefined
  /** Undefined while the survey has not said which, and then no report is taken: a server open to anyone's script is never the default. */
  readonly challenge: Challenge | undefined
  /** Whether one more report may be taken from a sender, told apart by the key; undefined sets no limit. */
  readonly limiter: ((key: string) => Promise<boolean>) | undefined
  readonly outbound: typeof fetch
}

/** Why a report was not taken, as the page reads it; the page's words decide how it is said. */
export type Refusal =
  | { readonly type: "invalid"; readonly problems: readonly Problem[] }
  | { readonly type: "not-json" }
  | { readonly type: "too-large" }
  | { readonly type: "too-many" }
  | { readonly type: "turnstile" }
  | { readonly type: "unavailable"; readonly detail: SinkError["type"] | "no-sink" | "no-challenge" }

/** What the page is told of a report taken: the id it was filed under. */
export interface Taken {
  readonly id: string
}

/** The most bytes a report may be; one typed into the form is a fraction of this. */
const LARGEST_BODY = 16_384

const json = (status: number, body: Refusal | Taken): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })

/**
 * A stream's bytes while they stay within a limit, or nothing once they pass
 * it, at which point reading stops: a body is never taken whole to find out
 * that it was too large.
 */
const bytesWithin = async (reader: ReadableStreamDefaultReader<Uint8Array>, limit: number, read: readonly Uint8Array[] = [], size = 0): Promise<readonly Uint8Array[] | undefined> => {
  const next = await reader.read()
  if (next.done) return read
  if (size + next.value.byteLength > limit) {
    await reader.cancel()
    return undefined
  }
  return bytesWithin(reader, limit, [...read, next.value], size + next.value.byteLength)
}

const textOf = (chunks: readonly Uint8Array[]): string => {
  const decoder = new TextDecoder()
  return chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join("") + decoder.decode()
}

/**
 * A request's body as JSON. Only a body sent as JSON is read: a page on
 * another site can make a visitor's browser post plain text here, but not
 * JSON without being let, so asking for it keeps reports to those this
 * survey's own page sends.
 */
const bodyOf = async (request: Request): Promise<{ readonly type: "read"; readonly value: unknown } | { readonly type: "not-json" } | { readonly type: "too-large" }> => {
  if (!(request.headers.get("Content-Type") ?? "").toLowerCase().startsWith("application/json")) return { type: "not-json" }
  if (Number(request.headers.get("Content-Length") ?? "0") > LARGEST_BODY) return { type: "too-large" }
  const chunks = request.body === null ? [] : await bytesWithin(request.body.getReader(), LARGEST_BODY)
  if (chunks === undefined) return { type: "too-large" }
  try {
    return { type: "read", value: JSON.parse(textOf(chunks)) }
  } catch {
    return { type: "not-json" }
  }
}

const fileText = async (url: string, outbound: typeof fetch): Promise<string> => {
  try {
    const response = await outbound(url)
    return response.ok ? await response.text() : ""
  } catch {
    return ""
  }
}

/**
 * The list as it stands, read to hold a report against: that the thing it is
 * about is listed, and that it gives no thing a listed thing's name. A file
 * that cannot be read is an empty one: the list being away must not stop
 * reports, and a maintainer reads every issue before it is merged.
 */
const listedFor = async (server: SurveyServer): Promise<readonly ListedSubject[]> => {
  const list = server.list
  if (list === undefined) return []
  const texts = await Promise.all(list.files.map((file) => fileText(new URL(file, list.base).href, server.outbound)))
  return subjectsOfJsonl(texts.join("\n"), server.schema)
}

const challengePassed = async (challenge: Challenge, token: string | undefined, request: Request, outbound: typeof fetch): Promise<boolean> => {
  switch (challenge.type) {
    case "none":
      return true
    case "turnstile":
      return turnstilePasses(challenge.secret, token, request.headers.get("CF-Connecting-IP") ?? undefined, outbound)
  }
}

/** Who sent a request, as far as senders can be told apart: the address Cloudflare saw it come from, and one key for all it saw none for. */
const senderOf = (request: Request): string => request.headers.get("CF-Connecting-IP") ?? "unknown"

/**
 * Take a report: count it against its sender's limit, judge it whole, ask
 * that it comes from a person, hold it against the list, and file it as an
 * issue. Nothing is stored here; the issue is the record.
 *
 * The limit is asked first, before anything is read, since what it guards is
 * the work that follows: the list read from where it is published and an
 * issue filed in public, for every report.
 */
export const takeReport = async (request: Request, server: SurveyServer, now: Date, random: Uint8Array): Promise<Response> => {
  if (server.limiter !== undefined && !(await server.limiter(senderOf(request)))) return json(429, { type: "too-many" })
  const body = await bodyOf(request)
  if (body.type !== "read") return json(body.type === "too-large" ? 413 : 415, body)
  const read = readEnvelope(body.value, { schema: server.schema, basemaps: server.basemaps, today: now.toISOString().slice(0, 10) })
  if (!read.ok) return json(422, { type: "invalid", problems: read.error })
  if (server.challenge === undefined) return json(503, { type: "unavailable", detail: "no-challenge" })
  if (!(await challengePassed(server.challenge, read.value.turnstile, request, server.outbound))) return json(403, { type: "turnstile" })
  const observation = read.value.submission.observation
  const listed = await listedFor(server)
  const problems = [...subjectUnknown(observation, listed), ...nameTaken(observation, server.schema, listed)]
  if (problems.length > 0) return json(422, { type: "invalid", problems })
  if (server.sink === undefined) return json(503, { type: "unavailable", detail: "no-sink" })
  const record = recordOf(uuidv7(now.getTime(), random), server.schema.id, now.toISOString(), read.value.submission)
  const filed = await server.sink(issueOf(record, server.schema, server.words))
  return filed.ok ? json(201, { id: record.id }) : json(503, { type: "unavailable", detail: filed.error.type })
}

/**
 * A Worker that takes reports at `REPORTS_PATH` and leaves every other path
 * to the static assets in front of it. The survey says how to build its
 * server from the Worker's environment.
 */
export const surveyWorker = <Env>(serverOf: (env: Env) => SurveyServer) => ({
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname !== REPORTS_PATH) return new Response("Not found", { status: 404 })
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } })
    return takeReport(request, serverOf(env), new Date(), crypto.getRandomValues(new Uint8Array(16)))
  },
})
