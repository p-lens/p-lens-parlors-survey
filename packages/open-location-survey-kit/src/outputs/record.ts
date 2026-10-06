import type { Observation, Provenance, Submission } from "../core/observation"

/**
 * A report as it is published: the submission with its id, when it was taken,
 * which survey it belongs to, and the licence it is given under. Everything an
 * output writes comes from a record.
 */
export interface SurveyRecord {
  readonly id: string
  readonly survey: string
  readonly takenAt: string
  readonly license: "CC0-1.0"
  readonly observation: Observation
  readonly provenance: Provenance
}

export const recordOf = (id: string, survey: string, takenAt: string, submission: Submission): SurveyRecord => ({
  id,
  survey,
  takenAt,
  license: "CC0-1.0",
  observation: submission.observation,
  provenance: submission.provenance,
})
