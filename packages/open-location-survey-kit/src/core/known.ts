import type { ListedSubject } from "./listed"
import type { Observation } from "./observation"
import type { Problem } from "./schema"

/**
 * Why a report about a listed thing cannot be taken beside the list as it
 * stands: it names a thing the list does not have, or calls one by a name the
 * list does not give it. What a report says it is about is otherwise only
 * what was sent, and would be published as sent. A list that could not be
 * read is an empty one, and holds nothing against a report.
 */
export const subjectUnknown = (observation: Observation, listed: readonly ListedSubject[]): readonly Problem[] => {
  if (observation.kind === "add" || listed.length === 0) return []
  const known = listed.find((subject) => subject.id === observation.subject.id)
  return known !== undefined && known.name === observation.subject.name ? [] : [{ field: "subject", reason: "not-listed" }]
}
