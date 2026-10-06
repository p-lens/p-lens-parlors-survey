import { Err, Ok, type Result } from "./result"
import { isJson, readAttributes, type Attributes, type ObservationKind, type Problem, type SurveySchema } from "./schema"

/**
 * Where a thing is, and how the person found the spot: the device's GPS, or a
 * pin placed on a named basemap. Only basemaps whose terms let what is placed
 * on them be used freely are offered, so the record says which one it was.
 */
export interface Position {
  readonly latitude: number
  readonly longitude: number
  readonly method: "gps" | "pin"
  /** The basemap a pin was placed on; none for GPS. */
  readonly basemap: string | undefined
}

/** A thing already on the list, as a report names it. */
export interface SubjectRef {
  readonly id: string
  readonly name: string
}

/**
 * What a person reports: a thing missing from the list, where a listed thing
 * is, that a listed thing is gone, or a correction to it. A report states a
 * fact about the world; turning it into map data is left to mappers.
 */
export type Observation =
  | { readonly kind: "add"; readonly attributes: Attributes; readonly position: Position }
  | { readonly kind: "locate"; readonly subject: SubjectRef; readonly position: Position }
  | { readonly kind: "gone"; readonly subject: SubjectRef }
  | { readonly kind: "amend"; readonly subject: SubjectRef; readonly attributes: Attributes }

/**
 * How the person knows. Only first-hand knowledge or what the thing's own
 * operator publishes is taken: never a map service or another database.
 */
export type Source =
  | { readonly kind: "on-site" }
  | { readonly kind: "publication"; readonly url: string }
  | { readonly kind: "other"; readonly note: string }

/** Where a report comes from: how it was learned, when, and by whom as a pseudonym. */
export interface Provenance {
  readonly source: Source
  /** The day the person saw it, YYYY-MM-DD. */
  readonly observedOn: string
  /** A UUID the contributor's device made for itself: a pseudonym, never a person. */
  readonly contributor: string
}

export interface Submission {
  readonly observation: Observation
  readonly provenance: Provenance
}

/** A submission with what is sent beside it and not kept: the consents and a Turnstile token. */
export interface Envelope {
  readonly submission: Submission
  readonly turnstile: string | undefined
}

/** What the server is told about the survey it judges for, beyond the schema. */
export interface Judging {
  readonly schema: SurveySchema
  /** The basemaps a pin may be placed on, by id. */
  readonly basemaps: readonly string[]
  /** Today, YYYY-MM-DD. */
  readonly today: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const LONGEST_NOTE = 500
const LONGEST_REF = 300
const OLDEST_OBSERVATION_DAYS = 366
const DEGREE_PRECISION = 1e7

const textOf = (value: unknown): string => (typeof value === "string" ? value.trim() : "")

/** Text on one line with nothing unprintable in it: what is published as it was sent has no line break or control character to end a line, a cell or a title with. */
const isOneLine = (text: string): boolean => !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(text)

const roundedDegrees = (value: number): number => Math.round(value * DEGREE_PRECISION) / DEGREE_PRECISION

const isOnEarth = (latitude: number, longitude: number): boolean => Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180

const positionOf = (value: unknown, basemaps: readonly string[]): Result<Position, Problem> => {
  if (!isJson(value)) return Err({ field: "position", reason: "required" })
  const { latitude, longitude, method } = value
  const basemap = textOf(value["basemap"])
  if (typeof latitude !== "number" || typeof longitude !== "number" || !isOnEarth(latitude, longitude)) return Err({ field: "position", reason: "invalid" })
  if (method === "gps") return Ok({ latitude: roundedDegrees(latitude), longitude: roundedDegrees(longitude), method, basemap: undefined })
  if (method === "pin" && basemaps.includes(basemap)) return Ok({ latitude: roundedDegrees(latitude), longitude: roundedDegrees(longitude), method, basemap })
  return Err({ field: "position", reason: method === "pin" ? "basemap" : "invalid" })
}

const subjectOf = (value: unknown): Result<SubjectRef, Problem> => {
  const given = isJson(value) ? value : {}
  const id = textOf(given["id"])
  const name = textOf(given["name"])
  return id !== "" && name !== "" && id.length <= LONGEST_REF && [...name].length <= LONGEST_REF && isOneLine(id) && isOneLine(name) ? Ok({ id, name }) : Err({ field: "subject", reason: "required" })
}

/** A web address as a URL writes it, which leaves no space, line break or mark of its own in it; nothing for what is not one. */
const webAddressOf = (text: string): string | undefined => {
  if (!URL.canParse(text) || text.length > LONGEST_REF) return undefined
  const url = new URL(text)
  return ["https:", "http:"].includes(url.protocol) ? url.href : undefined
}

const sourceOf = (value: unknown): Result<Source, Problem> => {
  if (!isJson(value)) return Err({ field: "source", reason: "required" })
  switch (value["kind"]) {
    case "on-site":
      return Ok({ kind: "on-site" })
    case "publication": {
      const url = webAddressOf(textOf(value["url"]))
      return url === undefined ? Err({ field: "source", reason: "invalid" }) : Ok({ kind: "publication", url })
    }
    case "other": {
      const note = textOf(value["note"])
      return note !== "" && [...note].length <= LONGEST_NOTE && isOneLine(note) ? Ok({ kind: "other", note }) : Err({ field: "source", reason: "invalid" })
    }
    default:
      return Err({ field: "source", reason: "required" })
  }
}

const daysBetween = (earlier: string, later: string): number => (Date.parse(later) - Date.parse(earlier)) / 86_400_000

const observedOnOf = (value: unknown, today: string): Result<string, Problem> => {
  const day = textOf(value)
  if (day === "") return Err({ field: "observedOn", reason: "required" })
  const gap = DAY.test(day) && !Number.isNaN(Date.parse(day)) ? daysBetween(day, today) : Number.NaN
  return gap >= 0 && gap <= OLDEST_OBSERVATION_DAYS ? Ok(day) : Err({ field: "observedOn", reason: "invalid" })
}

const contributorOf = (value: unknown): Result<string, Problem> => (UUID.test(textOf(value)) ? Ok(textOf(value)) : Err({ field: "contributor", reason: "invalid" }))

const failures = (results: readonly Result<unknown, Problem>[]): readonly Problem[] => results.flatMap((result) => (result.ok ? [] : [result.error]))

const kindOf = (value: unknown, schema: SurveySchema): ObservationKind | undefined =>
  schema.observations.find((kind) => kind === value)

const observationOf = (value: unknown, judging: Judging): Result<Observation, readonly Problem[]> => {
  const given = isJson(value) ? value : {}
  const kind = kindOf(given["kind"], judging.schema)
  switch (kind) {
    case "add": {
      const attributes = readAttributes(judging.schema, given["attributes"], "add")
      const position = positionOf(given["position"], judging.basemaps)
      if (attributes.ok && position.ok) return Ok({ kind, attributes: attributes.value, position: position.value })
      return Err([...(attributes.ok ? [] : attributes.error), ...failures([position])])
    }
    case "locate": {
      const subject = subjectOf(given["subject"])
      const position = positionOf(given["position"], judging.basemaps)
      return subject.ok && position.ok ? Ok({ kind, subject: subject.value, position: position.value }) : Err(failures([subject, position]))
    }
    case "gone": {
      const subject = subjectOf(given["subject"])
      return subject.ok ? Ok({ kind, subject: subject.value }) : Err([subject.error])
    }
    case "amend": {
      const subject = subjectOf(given["subject"])
      const attributes = readAttributes(judging.schema, given["attributes"], "amend")
      if (subject.ok && attributes.ok) return Ok({ kind, subject: subject.value, attributes: attributes.value })
      return Err([...failures([subject]), ...(attributes.ok ? [] : attributes.error)])
    }
    case undefined:
      return Err([{ field: "kind", reason: "not-allowed" }])
  }
}

/**
 * A submission as sent, judged whole: every problem, or the submission as the
 * survey takes it. Nothing is taken on trust, and both consents must be given:
 * that the report is CC0, and that it was not copied from a map service or
 * another database.
 */
export const readEnvelope = (body: unknown, judging: Judging): Result<Envelope, readonly Problem[]> => {
  const value = isJson(body) ? body : {}
  const sent = isJson(value["submission"]) ? value["submission"] : {}
  const provenance = isJson(sent["provenance"]) ? sent["provenance"] : {}
  const consent = isJson(value["consent"]) ? value["consent"] : {}
  const observation = observationOf(sent["observation"], judging)
  const source = sourceOf(provenance["source"])
  const observedOn = observedOnOf(provenance["observedOn"], judging.today)
  const contributor = contributorOf(provenance["contributor"])
  const consented = consent["cc0"] === true && consent["notCopied"] === true
  if (observation.ok && source.ok && observedOn.ok && contributor.ok && consented) {
    const turnstile = textOf(value["turnstile"])
    return Ok({
      submission: { observation: observation.value, provenance: { source: source.value, observedOn: observedOn.value, contributor: contributor.value } },
      turnstile: turnstile === "" ? undefined : turnstile,
    })
  }
  return Err([...(observation.ok ? [] : observation.error), ...failures([source, observedOn, contributor]), ...(consented ? [] : [{ field: "consent", reason: "required" }])])
}
