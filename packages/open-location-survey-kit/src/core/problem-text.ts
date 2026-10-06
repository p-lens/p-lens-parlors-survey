import type { Problem, SurveySchema } from "./schema"
import type { Words } from "./words"

/** A problem in words: a whole sentence where one is written, else the field's label or the part's name, then why — the schema's words before the kit's. */
export const problemText = (problem: Problem, schema: SurveySchema, words: Words): string => {
  const sentence = words.sentences[`${problem.field}:${problem.reason}`]
  if (sentence !== undefined) return sentence
  const label = schema.fields.find((field) => field.key === problem.field)?.label ?? words.parts[problem.field] ?? problem.field
  const reason = schema.reasons?.[problem.reason] ?? words.reasons[problem.reason] ?? words.reasons["invalid"] ?? ""
  return `${label}${reason}`
}
