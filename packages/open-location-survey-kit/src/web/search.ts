import type { ListedSubject } from "../core/listed"
import type { SurveySchema } from "../core/schema"

/** Text as it is searched: widths and case aside, katakana as hiragana, no spaces or marks. */
export const comparable = (text: string): string =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (character) => String.fromCodePoint((character.codePointAt(0) ?? 0) - 0x60))
    .replace(/[\s・'’&.!\-－―ー]/g, "")

const LONGEST_ANSWER = 60

/** The words a thing is found by: its name and every text, reading or word field the schema declares. */
const searchedTexts = (subject: ListedSubject, schema: SurveySchema): readonly string[] => [
  subject.name,
  ...schema.fields
    .filter((field) => field.kind.type === "text" || field.kind.type === "kana" || field.kind.type === "words")
    .flatMap((field) => {
      const value = subject.attributes[field.key]
      return typeof value === "string" ? [value] : Array.isArray(value) ? value : []
    }),
]

/**
 * The things whose words hold the query, those with a word beginning with it
 * first. An empty query finds nothing: a list is browsed on the map instead.
 */
export const searchSubjects = (subjects: readonly ListedSubject[], schema: SurveySchema, query: string): readonly ListedSubject[] => {
  const wanted = comparable(query)
  if (wanted === "") return []
  return subjects
    .flatMap((subject) => {
      const texts = searchedTexts(subject, schema).map(comparable)
      if (texts.some((text) => text.startsWith(wanted))) return [{ subject, rank: 0 }]
      return texts.some((text) => text.includes(wanted)) ? [{ subject, rank: 1 }] : []
    })
    .toSorted((left, right) => left.rank - right.rank || left.subject.name.localeCompare(right.subject.name, "ja"))
    .slice(0, LONGEST_ANSWER)
    .map((entry) => entry.subject)
}
