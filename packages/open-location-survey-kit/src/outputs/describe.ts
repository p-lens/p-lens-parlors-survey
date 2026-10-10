import type { Observation, Position, Source } from "../core/observation"
import type { Attributes, AttributeValue, Field, Row, SurveySchema } from "../core/schema"
import type { Words } from "../core/words"
import type { SurveyRecord } from "./record"

/** A label and a value, the unit every text output is written from. */
export type Line = readonly [string, string]

const isRows = (value: AttributeValue): value is readonly Row[] => Array.isArray(value) && value.every((item) => typeof item === "object")

export const valueText = (value: AttributeValue): string => (isRows(value) ? JSON.stringify(value) : Array.isArray(value) ? value.join("、") : String(value))

/** A row as a person reads it: each cell it has under its column's label, in the columns' order. */
const rowText = (row: Row, field: Field): string =>
  (field.kind.type === "rows" ? field.kind.columns : []).flatMap((column) => (row[column.key] === undefined ? [] : [`${column.label} ${String(row[column.key])}`])).join("・")

/** A field's value as a person reads it; a table's rows one after another, each by its columns' labels. */
const fieldText = (field: Field, value: AttributeValue): string => (isRows(value) ? value.map((row) => rowText(row, field)).join(" ／ ") : valueText(value))

export const attributeLines = (attributes: Attributes, schema: SurveySchema): readonly Line[] =>
  schema.fields.flatMap((field) => {
    const value = attributes[field.key]
    return value === undefined ? [] : [[field.label, fieldText(field, value)] as const]
  })

export const positionText = (position: Position, words: Words): string =>
  `${position.latitude}, ${position.longitude}（${position.method === "gps" ? words.gps : `${words.pin}・${position.basemap ?? ""}`}）`

export const sourceText = (source: Source, words: Words): string => {
  switch (source.kind) {
    case "on-site":
      return words.sources.onSite
    case "publication":
      return `${words.sources.publication} ${source.url}`
    case "other":
      return `${words.sources.other}：${source.note}`
  }
}

/** What a report is about, in a few words: the new thing's name, or the listed thing it names. */
export const subjectName = (observation: Observation, schema: SurveySchema): string => {
  switch (observation.kind) {
    case "add":
      return valueText(observation.attributes[schema.nameField] ?? "")
    case "locate":
    case "gone":
    case "amend":
      return observation.subject.name
  }
}

const observationLines = (observation: Observation, schema: SurveySchema, words: Words): readonly Line[] => {
  switch (observation.kind) {
    case "add":
      return [...attributeLines(observation.attributes, schema), [words.position, positionText(observation.position, words)]]
    case "locate":
      return [[words.subject, `${observation.subject.name}（${observation.subject.id}）`], [words.position, positionText(observation.position, words)]]
    case "gone":
      return [[words.subject, `${observation.subject.name}（${observation.subject.id}）`]]
    case "amend":
      return [[words.subject, `${observation.subject.name}（${observation.subject.id}）`], ...attributeLines(observation.attributes, schema)]
  }
}

/** A record as lines a person reads: what was observed, then where it comes from. */
export const recordLines = (record: SurveyRecord, schema: SurveySchema, words: Words): readonly Line[] => [
  ...observationLines(record.observation, schema, words),
  [words.source, sourceText(record.provenance.source, words)],
  [words.observedOn, record.provenance.observedOn],
]
