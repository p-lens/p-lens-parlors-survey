import type { Attributes, AttributeValue, Problem, Row, Submission, SurveyRecord, SurveySchema } from "open-location-survey-kit"

import { BROKER, PRIZES } from "./parlor"

/**
 * What a player saw special prizes come to at a broker, where it cannot be
 * set down at once: at a parlor new to the list, which has no id to set it
 * down under. It is filed as an issue in p-lens-brokers, by the parlor's
 * name, to be set down once the list has the parlor.
 */
export const brokerSchema: SurveySchema = {
  id: "broker",
  noun: "交換所での観測",
  nameField: "name",
  observations: ["add", "amend"],
  fields: [{ key: "name", label: "店名", kind: { type: "text", maxLength: 30 }, required: true, amendable: false }, PRIZES, BROKER],
}

const isRows = (value: AttributeValue | undefined): value is readonly Row[] => Array.isArray(value) && value.every((item) => typeof item === "object")

/** A prize's row as the parlor's side keeps it: without what the broker paid. */
const withoutYen = (row: Row): Row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "yen"))

/** Attributes without the keys named, and without a table left with no row. */
const without = (attributes: Attributes, keys: readonly string[]): Attributes =>
  Object.fromEntries(Object.entries(attributes).filter(([key, value]) => !keys.includes(key) && !(Array.isArray(value) && value.length === 0)))

/**
 * A parlor's report divided between its two keepers. What a broker paid —
 * the rows of its prizes that say a sum, and the broker's name — goes to
 * p-lens-brokers; everything the parlor itself posts stays, its prizes
 * with what they take and no yen, so no sum is filed with the parlor. A
 * report that says no sum is the parlor's whole; one that says nothing
 * else is the broker's whole.
 */
export const divideReport = (submission: Submission): { readonly there: Submission | undefined; readonly here: Submission | undefined } => {
  const observation = submission.observation
  if (observation.kind !== "add" && observation.kind !== "amend") return { there: undefined, here: submission }
  const prizes = observation.attributes["prizes"]
  const paid = isRows(prizes) ? prizes.filter((row) => row["yen"] !== undefined) : []
  if (paid.length === 0) return { there: undefined, here: submission }
  const taken = isRows(prizes) ? prizes.filter((row) => row["tokens"] !== undefined).map(withoutYen) : []
  const kept = without({ ...observation.attributes, prizes: taken }, ["broker"])
  const seen: Attributes = without({ prizes: paid, broker: observation.attributes["broker"] ?? "" }, observation.attributes["broker"] === undefined ? ["broker"] : [])
  return observation.kind === "add"
    ? {
        here: { ...submission, observation: { ...observation, attributes: kept } },
        there: { ...submission, observation: { ...observation, attributes: { name: observation.attributes["name"] ?? "", ...seen } } },
      }
    : {
        here: Object.keys(kept).length === 0 ? undefined : { ...submission, observation: { ...observation, attributes: kept } },
        there: { ...submission, observation: { ...observation, attributes: seen } },
      }
}

/** What a broker is called where a report names none. */
const UNNAMED_BROKER = "交換所"

/** The games as p-lens-brokers writes them, by what the form calls them. */
const GAMES: Readonly<Record<string, string>> = { パチンコ: "pachinko", パチスロ: "pachislot" }

/** One thing seen, as a line of p-lens-brokers' observations: its fields in the order its README gives them. */
const lineOf = (record: SurveyRecord, parlor: string, broker: string, row: Row): string =>
  JSON.stringify({
    parlor,
    observedOn: record.provenance.observedOn,
    broker,
    game: GAMES[String(row["game"])],
    tier: `${String(row["rate"])}円`,
    prize: row["name"],
    tokens: row["tokens"],
    yen: row["yen"],
    submission: record.id,
    observer: record.provenance.contributor,
  })

/**
 * The broker's part of a report as lines of p-lens-brokers'
 * `observations.jsonl`, a line a prize that was paid for: where, on which
 * day, at which corner, what the parlor took for the prize and what the
 * broker paid, under the report's id and the observer's pseudonym. None
 * for a part about a parlor the list does not have yet.
 */
export const observationLines = (record: SurveyRecord): readonly string[] => {
  const observation = record.observation
  if (observation.kind !== "amend") return []
  const prizes = observation.attributes["prizes"]
  const broker = observation.attributes["broker"]
  return (isRows(prizes) ? prizes : []).map((row) => lineOf(record, observation.subject.id, typeof broker === "string" ? broker : UNNAMED_BROKER, row))
}

/** How far past the server's today a day seen may be: the day where the observer stands may be a day ahead of UTC. */
const DAYS_AHEAD_OF_UTC = 1

const paidFor = (submission: Submission): boolean => {
  const observation = submission.observation
  const prizes = observation.kind === "add" || observation.kind === "amend" ? observation.attributes["prizes"] : undefined
  return isRows(prizes) && prizes.some((row) => row["yen"] !== undefined)
}

/**
 * What is wrong with a report that says what a broker paid, beyond its
 * fields: it is a thing seen, so it was learned on site and on a day
 * already come. A parlor's own rates may be reported from its site, or of
 * a day ahead when a change is posted; a sum received may not.
 */
export const brokerProblems = (submission: Submission, today: string): readonly Problem[] => {
  if (!paidFor(submission)) return []
  const ahead = (Date.parse(submission.provenance.observedOn) - Date.parse(today)) / 86_400_000
  return [
    ...(submission.provenance.source.kind === "on-site" ? [] : [{ field: "source", reason: "not-seen" }]),
    ...(ahead > DAYS_AHEAD_OF_UTC ? [{ field: "observedOn", reason: "seen-ahead" }] : []),
  ]
}
