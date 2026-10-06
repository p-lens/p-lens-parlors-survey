import { isJson, type Attributes, type AttributeValue, type SurveySchema } from "./schema"

/**
 * A thing the list already knows, as a survey reads it: its id, its name,
 * where it is if that is known, and whatever else the list says of it.
 */
export interface ListedSubject {
  readonly id: string
  readonly name: string
  readonly position: { readonly latitude: number; readonly longitude: number } | undefined
  readonly attributes: Attributes
}

const jsonOf = (line: string): unknown => {
  try {
    return JSON.parse(line)
  } catch {
    return undefined
  }
}

const isAttributeValue = (value: unknown): value is AttributeValue =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean" || (Array.isArray(value) && value.every((item) => typeof item === "string"))

const isOnEarth = (latitude: unknown, longitude: unknown): latitude is number =>
  typeof latitude === "number" && typeof longitude === "number" && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180

const subjectOf = (line: string, nameField: string): ListedSubject | undefined => {
  const value = jsonOf(line)
  if (!isJson(value)) return undefined
  const { id, lat, lon, ...rest } = value
  const name = rest[nameField]
  if (typeof id !== "string" || id.trim() === "" || typeof name !== "string" || name.trim() === "") return undefined
  return {
    id: id.trim(),
    name: name.trim(),
    position: isOnEarth(lat, lon) && typeof lon === "number" ? { latitude: lat, longitude: lon } : undefined,
    attributes: Object.fromEntries(Object.entries(rest).filter((entry): entry is [string, AttributeValue] => isAttributeValue(entry[1]))),
  }
}

/**
 * The things a JSONL file lists, one a line: `{"id", "lat"?, "lon"?, …}` with
 * the schema's name field among the rest. A line that is not one is passed
 * over rather than refuse the rest, and a thing listed twice is kept once.
 */
export const subjectsOfJsonl = (text: string, schema: SurveySchema): readonly ListedSubject[] => {
  const subjects = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => subjectOf(line, schema.nameField))
    .filter((subject): subject is ListedSubject => subject !== undefined)
  const firstIndex = new Map(subjects.map((subject, index) => [subject.id, index] as const).toReversed())
  return subjects.filter((subject, index) => firstIndex.get(subject.id) === index)
}
