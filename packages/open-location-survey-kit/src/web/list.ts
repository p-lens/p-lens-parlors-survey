import { subjectsOfJsonl, type ListedSubject } from "../core/listed"
import { Err, Ok, type Result } from "../core/result"
import type { SurveySchema } from "../core/schema"

/** The list as the page reads it: things with a position for the map, things still waiting for one. */
export interface SurveyList {
  readonly placed: readonly ListedSubject[]
  readonly unplaced: readonly ListedSubject[]
}

export type ListError = { readonly type: "not-configured" } | { readonly type: "unreachable"; readonly file: string }

const fileText = async (base: string, file: string): Promise<Result<string, ListError>> => {
  try {
    const response = await fetch(new URL(file, new URL(base, window.location.href)))
    return response.ok ? Ok(await response.text()) : Err({ type: "unreachable", file })
  } catch {
    return Err({ type: "unreachable", file })
  }
}

/**
 * The list's files, read and merged, split into placed and unplaced. The
 * first file must be there; a later one not published yet reads as empty.
 */
export const readSurveyList = async (base: string | undefined, files: readonly string[], schema: SurveySchema): Promise<Result<SurveyList, ListError>> => {
  if (base === undefined || base.trim() === "" || files.length === 0) return Err({ type: "not-configured" })
  const texts = await Promise.all(files.map((file) => fileText(base, file)))
  const first = texts[0]
  if (first !== undefined && !first.ok) return first
  const subjects = subjectsOfJsonl(texts.map((text) => (text.ok ? text.value : "")).join("\n"), schema)
  return Ok({ placed: subjects.filter((subject) => subject.position !== undefined), unplaced: subjects.filter((subject) => subject.position === undefined) })
}
