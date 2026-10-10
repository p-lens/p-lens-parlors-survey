import type { ListedSubject } from "../core/listed"
import type { Position, Source } from "../core/observation"
import type { AttributeValue, Column, Field, ObservationKind, Row, SurveySchema } from "../core/schema"

/** A row of a table as the form holds it: what was typed in each cell, by its column. */
export type RowDraft = Readonly<Record<string, string>>

/** A field's value as the form holds it: what was typed, a box ticked, or a table's rows. */
export type DraftValue = string | boolean | readonly RowDraft[]

/** How the person says they know, as the form holds it before it is sent. */
export interface SourceDraft {
  readonly kind: Source["kind"]
  readonly url: string
  readonly note: string
}

/** A report while it is being written. */
export interface Draft {
  readonly kind: ObservationKind
  /** The listed thing it concerns; none for a new one. */
  readonly subject: ListedSubject | undefined
  readonly values: Readonly<Record<string, DraftValue>>
  readonly position: Position | undefined
  readonly source: SourceDraft
  readonly observedOn: string
  readonly cc0: boolean
  readonly notCopied: boolean
}

const isRows = (value: AttributeValue): value is readonly Row[] => Array.isArray(value) && value.every((item) => typeof item === "object")

const asDraftValue = (value: AttributeValue | undefined): DraftValue | undefined => {
  if (value === undefined) return undefined
  if (typeof value === "boolean") return value
  if (isRows(value)) return value.map((row) => Object.fromEntries(Object.entries(row).map(([key, cell]) => [key, String(cell)] as const)))
  return Array.isArray(value) ? value.join("、") : String(value)
}

const emptyValue = (field: Field): DraftValue => (field.kind.type === "flag" ? false : field.kind.type === "rows" ? [] : "")

/** A row of the form as it is sent: each cell by its column's kind, an empty cell saying nothing. */
const sentRow = (columns: readonly Column[], row: RowDraft): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    columns.flatMap((column) => {
      const text = (row[column.key] ?? "").trim()
      return text === "" ? [] : [[column.key, column.kind.type === "number" ? Number(text) : text] as const]
    }),
  )

/** A report to start from: a correction begins from what the list says. */
export const draftFor = (schema: SurveySchema, kind: ObservationKind, subject: ListedSubject | undefined, today: string): Draft => ({
  kind,
  subject,
  values: Object.fromEntries(
    schema.fields.map((field) => [field.key, (kind === "amend" ? asDraftValue(subject?.attributes[field.key]) : undefined) ?? emptyValue(field)] as const),
  ),
  position: undefined,
  source: { kind: "on-site", url: "", note: "" },
  observedOn: today,
  cc0: false,
  notCopied: false,
})

export const needsPosition = (draft: Draft): boolean => (draft.kind === "add" || draft.kind === "locate") && draft.position === undefined

/** A form value as the field's kind sends it; blank text sends nothing. */
const sentValue = (field: Field, value: DraftValue | undefined): unknown => {
  if (value === undefined) return undefined
  if (typeof value === "boolean") return value
  if (typeof value !== "string") {
    const rows = field.kind.type === "rows" ? value.map((row) => sentRow(field.kind.type === "rows" ? field.kind.columns : [], row)).filter((row) => Object.keys(row).length > 0) : []
    return rows.length === 0 ? undefined : rows
  }
  const text = value.trim()
  if (text === "") return undefined
  switch (field.kind.type) {
    case "words":
      return text.split(/[,、]/).map((word) => word.trim()).filter((word) => word !== "")
    case "number":
      return Number(text)
    case "text":
    case "kana":
    case "choice":
    case "flag":
    case "rows":
    case "photo":
      return text
  }
}

const attributesOf = (draft: Draft, fields: readonly Field[]): Record<string, unknown> =>
  Object.fromEntries(
    fields.flatMap((field) => {
      const sent = sentValue(field, draft.values[field.key])
      return sent === undefined ? [] : [[field.key, sent] as const]
    }),
  )

/** Only what a correction changes is sent: a field left as the list has it says nothing. */
const changedFields = (schema: SurveySchema, draft: Draft): readonly Field[] =>
  schema.fields.filter((field) => field.amendable && JSON.stringify(asDraftValue(draft.subject?.attributes[field.key])) !== JSON.stringify(draft.values[field.key]))

const subjectRef = (draft: Draft) => ({ id: draft.subject?.id ?? "", name: draft.subject?.name ?? "" })

const observationOf = (schema: SurveySchema, draft: Draft): unknown => {
  switch (draft.kind) {
    case "add":
      return { kind: "add", attributes: attributesOf(draft, schema.fields), position: draft.position }
    case "locate":
      return { kind: "locate", subject: subjectRef(draft), position: draft.position }
    case "gone":
      return { kind: "gone", subject: subjectRef(draft) }
    case "amend":
      return { kind: "amend", subject: subjectRef(draft), attributes: attributesOf(draft, changedFields(schema, draft)) }
  }
}

const sourceOf = (source: SourceDraft): Source => {
  switch (source.kind) {
    case "on-site":
      return { kind: "on-site" }
    case "publication":
      return { kind: "publication", url: source.url.trim() }
    case "other":
      return { kind: "other", note: source.note.trim() }
  }
}

/** The body the server is sent. It is not judged here: the server judges every report and the page shows its answer. */
export const envelopeOf = (schema: SurveySchema, draft: Draft, contributor: string, turnstile: string | undefined): unknown => ({
  submission: { observation: observationOf(schema, draft), provenance: { source: sourceOf(draft.source), observedOn: draft.observedOn, contributor } },
  consent: { cc0: draft.cc0, notCopied: draft.notCopied },
  turnstile,
})

/** The day so many days after another, YYYY-MM-DD: the last day a report may be of, where its survey takes days ahead. */
export const dayAfter = (day: string, days: number): string => new Date(Date.parse(day) + days * 86_400_000).toISOString().slice(0, 10)

/** The day in the device's own time zone, YYYY-MM-DD: the day the person would say they saw it. */
export const localDay = (now: Date): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
