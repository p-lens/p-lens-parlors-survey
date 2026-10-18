import { Err, Ok, type Result } from "../core/result"
import { isJson } from "../core/schema"
import { fileText, type ListError } from "./list"
import { comparable } from "./search"

/**
 * Where the values a text field offers come from: the texts another
 * dataset's JSONL file holds under one key — the names others have
 * already given, say — so a person picks one rather than types it again,
 * and may still type one it lacks.
 */
export interface OfferedSource {
  /** Where the file is published, ending in a slash. */
  readonly base: string | undefined
  readonly file: string
  readonly key: string
  /** The order they are offered in; left out, as Japanese sorts them. */
  readonly order?: (left: string, right: string) => number
}

/** What each field offers, by its key. */
export type Offers = Readonly<Record<string, readonly string[]>>

const MOST_OFFERED = 20

const byJapanese = (left: string, right: string): number => left.localeCompare(right, "ja")

/** Every text a JSONL file holds under the key, once each, trimmed; lines that are not JSON, and values that are not text, are passed over. */
export const valuesOfJsonl = (text: string, key: string): readonly string[] => [
  ...new Set(
    text.split("\n").flatMap((line) => {
      try {
        const parsed: unknown = JSON.parse(line)
        const value = isJson(parsed) ? parsed[key] : undefined
        return typeof value === "string" && value.trim() !== "" ? [value.trim()] : []
      } catch {
        return []
      }
    }),
  ),
]

/** The values one source offers, in its order. */
export const readOffered = async (source: OfferedSource): Promise<Result<readonly string[], ListError>> => {
  if (source.base === undefined || source.base.trim() === "") return Err({ type: "not-configured" })
  const text = await fileText(source.base, source.file)
  return text.ok ? Ok(valuesOfJsonl(text.value, source.key).toSorted(source.order ?? byJapanese)) : text
}

/** What every field offers. A source that cannot be read offers nothing: its field is then typed into as any other. */
export const readOffers = async (sources: Readonly<Record<string, OfferedSource>>): Promise<Offers> =>
  Object.fromEntries(await Promise.all(Object.entries(sources).map(async ([key, source]) => [key, ((read) => (read.ok ? read.value : []))(await readOffered(source))] as const)))

/**
 * The values offered for what is typed, in the order given, those
 * beginning with it ahead of those only holding it. Nothing typed offers
 * the first of them.
 */
export const narrowOffered = (values: readonly string[], typed: string): readonly string[] => {
  const wanted = comparable(typed)
  if (wanted === "") return values.slice(0, MOST_OFFERED)
  const held = values.filter((value) => comparable(value).includes(wanted))
  return [...held.filter((value) => comparable(value).startsWith(wanted)), ...held.filter((value) => !comparable(value).startsWith(wanted))].slice(0, MOST_OFFERED)
}
