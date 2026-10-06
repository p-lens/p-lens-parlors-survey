import type { ListedSubject } from "./listed"
import type { Observation } from "./observation"
import type { Problem, SurveySchema } from "./schema"

const textOf = (value: unknown): string | undefined => (typeof value === "string" && value.trim() !== "" ? value : undefined)

/** Every name a listed thing is called by: its name, and the other fields its schema says it also goes by. */
const namesOf = (subject: ListedSubject, schema: SurveySchema): readonly string[] => [
  subject.name,
  ...(schema.alsoNamedBy ?? []).flatMap((key) => {
    const name = textOf(subject.attributes[key])
    return name === undefined ? [] : [name]
  }),
]

/** The name a report would give a thing, and the listed thing it is about, if any: only a new thing or a correction names one. */
const namedBy = (observation: Observation, schema: SurveySchema): { readonly name: string; readonly about: string | undefined } | undefined => {
  if (observation.kind !== "add" && observation.kind !== "amend") return undefined
  const name = textOf(observation.attributes[schema.nameField])
  return name === undefined ? undefined : { name, about: observation.kind === "amend" ? observation.subject.id : undefined }
}

/**
 * Why a report cannot be taken beside the list as it stands: it would give a
 * thing a name a listed thing already goes by. Only a survey whose schema
 * says when two names are one is held to this, and a correction is never
 * held against the thing it corrects. A list that could not be read is an
 * empty one, and holds nothing against a report.
 */
export const nameTaken = (observation: Observation, schema: SurveySchema, listed: readonly ListedSubject[]): readonly Problem[] => {
  const same = schema.sameName
  const named = namedBy(observation, schema)
  if (same === undefined || named === undefined) return []
  return listed.some((subject) => subject.id !== named.about && namesOf(subject, schema).some((name) => same(name, named.name))) ? [{ field: schema.nameField, reason: "listed" }] : []
}
