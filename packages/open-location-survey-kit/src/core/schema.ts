import { Err, Ok, type Result } from "./result"

/** A value a person gives for a field. */
export type AttributeValue = string | number | boolean | readonly string[]

/** What a person says about a thing, field by field. */
export type Attributes = Readonly<Record<string, AttributeValue>>

/**
 * What kind of value a field takes. `kana` is a reading in hiragana, katakana
 * folded into it. `photo` can be declared, but no photo is taken until the kit
 * has somewhere to keep one: a submission carrying one is refused.
 */
export type FieldKind =
  | { readonly type: "text"; readonly maxLength: number; readonly minLength?: number }
  | { readonly type: "kana"; readonly maxLength: number; readonly minLength?: number }
  | { readonly type: "choice"; readonly options: readonly string[] }
  | { readonly type: "words"; readonly maxCount: number; readonly maxLength: number }
  | { readonly type: "number"; readonly min?: number; readonly max?: number; readonly unit?: string }
  | { readonly type: "flag" }
  | { readonly type: "photo" }

export interface Field {
  readonly key: string
  readonly label: string
  readonly hint?: string
  readonly kind: FieldKind
  /** Whether a new thing must have it. */
  readonly required: boolean
  /** Whether a person may correct it on a listed thing. */
  readonly amendable: boolean
}

/** Why something a person sent cannot be taken. `field` is a field's key or a part of the submission. */
export interface Problem {
  readonly field: string
  readonly reason: string
}

/** The kinds of report a survey takes about the things it surveys. */
export type ObservationKind = "add" | "locate" | "gone" | "amend"

/**
 * What a survey collects: the fields of one kind of thing, which reports it
 * takes, and the rules of its domain. The kit knows nothing of shops, AEDs
 * or road signs; a schema is all that tells them apart.
 */
export interface SurveySchema {
  /** A short id, used in labels and records: `aed`, `toilet`. */
  readonly id: string
  /** What one of them is called, for headings: AED, トイレ. */
  readonly noun: string
  readonly fields: readonly Field[]
  readonly observations: readonly ObservationKind[]
  /** The field a thing is called by. */
  readonly nameField: string
  /** Rules beyond each field's kind, run once every field has the kind it should; may settle values too. */
  readonly refine?: (attributes: Attributes, kind: "add" | "amend") => Result<Attributes, readonly Problem[]>
  /** Words for the reasons `refine` gives, keyed by reason. */
  readonly reasons?: Readonly<Record<string, string>>
  /**
   * When two names are one name, for a survey whose things go by one name
   * each: a new thing, or a correction, under a name a listed thing already
   * goes by is then refused. Left out, names may repeat.
   */
  readonly sameName?: (left: string, right: string) => boolean
  /** Other fields of a listed thing that also name it, compared as its name is. */
  readonly alsoNamedBy?: readonly string[]
}

type Json = Readonly<Record<string, unknown>>

export const isJson = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value)

/** Text as a reading is kept: widths settled, katakana as hiragana, no spaces. */
export const kanaOf = (text: string): string =>
  text
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[ァ-ヶ]/g, (character) => String.fromCodePoint((character.codePointAt(0) ?? 0) - 0x60))

const settledText = (value: unknown): string => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "")

const lengthOf = (text: string): number => [...text].length

const isEmpty = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0)

const lengthProblem = (key: string, text: string, minLength: number | undefined, maxLength: number): Problem | undefined => {
  if (lengthOf(text) > maxLength) return { field: key, reason: "too-long" }
  return minLength !== undefined && lengthOf(text) < minLength ? { field: key, reason: "too-short" } : undefined
}

/** One field's value as sent, read by its kind, or why it is not one. Empty values are handled before this. */
const valueOf = (field: Field, sent: unknown): Result<AttributeValue, Problem> => {
  const { key, kind } = field
  switch (kind.type) {
    case "text": {
      const text = settledText(sent)
      const problem = lengthProblem(key, text, kind.minLength, kind.maxLength)
      return problem === undefined ? Ok(text) : Err(problem)
    }
    case "kana": {
      const kana = kanaOf(typeof sent === "string" ? sent : "")
      if (!/^[ぁ-ゖー]+$/.test(kana)) return Err({ field: key, reason: "not-kana" })
      const problem = lengthProblem(key, kana, kind.minLength, kind.maxLength)
      return problem === undefined ? Ok(kana) : Err(problem)
    }
    case "choice": {
      const choice = settledText(sent)
      return kind.options.includes(choice) ? Ok(choice) : Err({ field: key, reason: "not-a-choice" })
    }
    case "words": {
      const words = Array.isArray(sent) ? [...new Set(sent.map(settledText).filter((word) => word !== ""))] : []
      if (words.length > kind.maxCount) return Err({ field: key, reason: "too-many" })
      return words.some((word) => lengthOf(word) > kind.maxLength) ? Err({ field: key, reason: "too-long" }) : Ok(words)
    }
    case "number": {
      const number = typeof sent === "number" ? sent : Number.NaN
      if (!Number.isFinite(number)) return Err({ field: key, reason: "invalid" })
      return (kind.min !== undefined && number < kind.min) || (kind.max !== undefined && number > kind.max) ? Err({ field: key, reason: "out-of-range" }) : Ok(number)
    }
    case "flag":
      return typeof sent === "boolean" ? Ok(sent) : Err({ field: key, reason: "invalid" })
    case "photo":
      return Err({ field: key, reason: "unsupported" })
  }
}

/**
 * Attributes as sent, read field by field against the schema, then by its
 * domain rules: every problem, or the attributes as the survey keeps them.
 * A new thing needs its required fields; a correction needs at least one
 * correctable field and takes nothing else. Unknown keys are dropped.
 */
export const readAttributes = (schema: SurveySchema, sent: unknown, kind: "add" | "amend"): Result<Attributes, readonly Problem[]> => {
  const given = isJson(sent) ? sent : {}
  const fields = kind === "add" ? schema.fields : schema.fields.filter((field) => field.amendable)
  const read = fields.map((field) => ({ field, sent: given[field.key] }))
  const missing: readonly Problem[] = kind === "add" ? read.filter(({ field, sent }) => field.required && isEmpty(sent)).map(({ field }) => ({ field: field.key, reason: "required" })) : []
  const present = read.filter(({ sent }) => !isEmpty(sent))
  if (kind === "amend" && present.length === 0) return Err([{ field: "attributes", reason: "required" }])
  const values = present.map(({ field, sent }) => ({ field, value: valueOf(field, sent) }))
  const problems = [...missing, ...values.flatMap(({ value }) => (value.ok ? [] : [value.error]))]
  if (problems.length > 0) return Err(problems)
  const attributes: Attributes = Object.fromEntries(values.flatMap(({ field, value }) => (value.ok ? [[field.key, value.value] as const] : [])))
  return schema.refine === undefined ? Ok(attributes) : schema.refine(attributes, kind)
}
