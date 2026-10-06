import type { SurveySchema } from "../core/schema"
import type { Words } from "../core/words"
import { recordLines, subjectName } from "./describe"
import type { SurveyRecord } from "./record"

/**
 * A record as the text of an OpenStreetMap note: plain facts a mapper can act
 * on, with where they came from. The kit writes the text and never posts it;
 * whether and how anything goes into OpenStreetMap is a mapper's call.
 */
export const osmNoteOf = (record: SurveyRecord, schema: SurveySchema, words: Words): string =>
  [
    `${schema.noun}：${words.observationTags[record.observation.kind]} ${subjectName(record.observation, schema)}`,
    ...recordLines(record, schema, words).map(([label, value]) => `${label}：${value}`),
    `CC0-1.0 / ${record.id}`,
  ].join("\n")
