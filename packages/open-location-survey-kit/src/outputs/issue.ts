import type { SurveySchema } from "../core/schema"
import type { Words } from "../core/words"
import { recordLines, subjectName } from "./describe"
import { featureOf } from "./geojson"
import { osmNoteOf } from "./osm-note"
import type { SurveyRecord } from "./record"

/** A GitHub issue as filed for a record. */
export interface IssueDraft {
  readonly title: string
  readonly body: string
  readonly labels: readonly string[]
}

/** The longest title an issue is given; GitHub takes 256 characters. */
const LONGEST_TITLE = 200

const longestRun = (text: string): number => Math.max(0, ...[...text.matchAll(/`+/g)].map((run) => run[0].length))

/**
 * A value as a table cell that shows it and does nothing else. What a person
 * typed is published in a public issue, where a name is a mention that
 * notifies someone, a bracket a link, an angle bracket HTML and a pipe the end
 * of the cell. Inside a code span none of that is read: the text is shown as
 * it was sent, and can be copied as it was sent. The span's backticks outnumber
 * any in the text, so the text cannot close it.
 */
const cell = (text: string): string => {
  const fence = "`".repeat(longestRun(text) + 1)
  return `${fence} ${text.replace(/\|/g, "｜").replace(/\s+/g, " ")} ${fence}`
}

/** A block of code whose fence outnumbers any run of backticks inside it, so nothing in the text can close it and go on as Markdown. */
const fenced = (language: string, text: string): readonly string[] => {
  const fence = "`".repeat(Math.max(3, longestRun(text) + 1))
  return [fence + language, text, fence]
}

/** A title on one line and no longer than an issue's may be. */
const titleOf = (text: string): string => [...text.replace(/\s+/g, " ").trim()].slice(0, LONGEST_TITLE).join("")

/**
 * The issue a record is filed as: a table to review at a glance, the text of
 * an OpenStreetMap note, and the record as GeoJSON for whatever merges it.
 * Labels are the survey's own words; every value is something a person sent,
 * and is written where it can only be shown.
 * Labelled by survey and kind, so a repository can hold several surveys.
 */
export const issueOf = (record: SurveyRecord, schema: SurveySchema, words: Words): IssueDraft => ({
  title: titleOf(`[${words.observationTags[record.observation.kind]}] ${subjectName(record.observation, schema)}`),
  body: [
    `\`${record.id}\``,
    "",
    "| | |",
    "|---|---|",
    ...recordLines(record, schema, words).map(([label, value]) => `| ${label} | ${cell(value)} |`),
    "",
    words.consentStatement,
    "",
    "<details>",
    `<summary>${words.osmNoteHeading}</summary>`,
    "",
    ...fenced("text", osmNoteOf(record, schema, words)),
    "",
    "</details>",
    "",
    ...fenced("geojson", JSON.stringify(featureOf(record), null, 2)),
  ].join("\n"),
  labels: ["survey", schema.id, record.observation.kind],
})
