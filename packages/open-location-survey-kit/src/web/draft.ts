import type { ListedSubject } from "../core/listed"
import type { Position, Source } from "../core/observation"
import type { AttributeValue, Column, Field, ObservationKind, Row, SurveySchema } from "../core/schema"

/** A row of a table as the form holds it: what was typed in each cell, by its column. */
export type RowDraft = Readonly<Record<string, string>>

/** A field's value as the form holds it: what was typed, a box ticked, or a table's rows. */
export type DraftValue = string | boolean | readonly RowDraft[]

/** A report while it is being written. */
export interface Draft {
  readonly kind: ObservationKind
  /** The listed thing it concerns; none for a new one. */
  readonly subject: ListedSubject | undefined
  readonly values: Readonly<Record<string, DraftValue>>
  readonly position: Position | undefined
  readonly source: Source
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

/** A field's value as the form holds it before anything is typed. */
export const emptyValue = (field: Field): DraftValue => (field.kind.type === "flag" ? false : field.kind.type === "rows" ? [] : "")

/**
 * A row after one of its cells was changed. A choice that fills other
 * cells writes them: the usual value for what was chosen, into a cell left
 * empty or still holding what the choice before wrote — never over what a
 * person typed. Choosing nothing takes back what the choice had written.
 * A text writes nothing yet (`rowSettled`).
 */
export const rowAfter = (columns: readonly Column[], row: RowDraft, key: string, value: string): RowDraft => {
  const column = columns.find((each) => each.key === key)
  const fills = column?.kind.type === "choice" ? column.fills : undefined
  if (fills === undefined) return { ...row, [key]: value }
  const before = fills[row[key] ?? ""] ?? {}
  const after = fills[value] ?? {}
  const written = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((cell) => (row[cell] ?? "") === "" || row[cell] === before[cell])
  return { ...row, [key]: value, ...Object.fromEntries(written.map((cell) => [cell, after[cell] ?? ""] as const)) }
}

/**
 * A row once the text in one of its cells has stood still. A text that
 * fills other cells writes the usual value for what it holds into a cell
 * left empty or holding what some value of the text writes there — never
 * over what a person typed. A text it has nothing for leaves the row as it
 * is.
 */
export const rowSettled = (columns: readonly Column[], row: RowDraft, key: string): RowDraft => {
  const fills = columns.find((column) => column.key === key && column.kind.type === "text")?.fills
  const after = fills?.[row[key] ?? ""]
  if (fills === undefined || after === undefined) return row
  const written = Object.keys(after).filter((cell) => (row[cell] ?? "") === "" || Object.values(fills).some((fill) => fill[cell] === row[cell]))
  return written.every((cell) => row[cell] === after[cell]) ? row : { ...row, ...Object.fromEntries(written.map((cell) => [cell, after[cell] ?? ""] as const)) }
}

/** A row as it is added to a table: each cell that has one holding its column's initial value. */
export const newRow = (columns: readonly Column[]): RowDraft => Object.fromEntries(columns.flatMap((column) => (column.initial === undefined ? [] : [[column.key, column.initial] as const])))

/** Whether a row holds no more than it was added with: nothing typed, or only what its columns start with. */
const untouched = (columns: readonly Column[], row: RowDraft): boolean => columns.every((column) => (row[column.key] ?? "").trim() === (column.initial ?? ""))

/** A row of the form as it is sent: each cell by its column's kind, an empty cell saying nothing. */
const sentRow = (columns: readonly Column[], row: RowDraft): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    columns.flatMap((column) => {
      const text = (row[column.key] ?? "").trim()
      return text === "" ? [] : [[column.key, column.kind.type === "number" ? Number(text) : text] as const]
    }),
  )

/** A field's value as the list has it on the thing a report concerns, as the form holds it. */
export const listedValue = (draft: Draft, field: Field): DraftValue => asDraftValue(draft.subject?.attributes[field.key]) ?? emptyValue(field)

/** A report to start from: a correction begins from what the list says. */
export const draftFor = (schema: SurveySchema, kind: ObservationKind, subject: ListedSubject | undefined, today: string): Draft => ({
  kind,
  subject,
  values: Object.fromEntries(
    schema.fields.map((field) => [field.key, (kind === "amend" ? asDraftValue(subject?.attributes[field.key]) : undefined) ?? emptyValue(field)] as const),
  ),
  position: undefined,
  source: { kind: "on-site" },
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
    const columns = field.kind.type === "rows" ? field.kind.columns : []
    const rows = value.filter((row) => !untouched(columns, row)).map((row) => sentRow(columns, row))
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

/** The body the server is sent. It is not judged here: the server judges every report and the page shows its answer. */
export const envelopeOf = (schema: SurveySchema, draft: Draft, contributor: string, turnstile: string | undefined): unknown => ({
  submission: { observation: observationOf(schema, draft), provenance: { source: draft.source, observedOn: draft.observedOn, contributor } },
  consent: { cc0: draft.cc0, notCopied: draft.notCopied },
  turnstile,
})

/** The day so many days after another, YYYY-MM-DD: the last day a report may be of, where its survey takes days ahead. */
export const dayAfter = (day: string, days: number): string => new Date(Date.parse(day) + days * 86_400_000).toISOString().slice(0, 10)

/** The day in the device's own time zone, YYYY-MM-DD: the day the person would say they saw it. */
export const localDay = (now: Date): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
