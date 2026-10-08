import { subjectsOfJsonl, type ListedSubject } from "../core/listed"
import { Err, Ok, type Result } from "../core/result"
import type { SurveySchema } from "../core/schema"

/** The list as the page reads it: things with a position for the map, things still waiting for one. */
export interface SurveyList {
  readonly placed: readonly ListedSubject[]
  readonly unplaced: readonly ListedSubject[]
}

export type ListError = { readonly type: "not-configured" } | { readonly type: "unreachable"; readonly file: string }

/** Where the browser keeps the list's files as last read, each with the version its publisher sent it under. */
const KEPT = "open-location-survey-kit:list"

/** The version a publisher sent a file under, where it sent one a page may read. */
const versionOf = (response: Response): string | undefined => response.headers.get("ETag") ?? undefined

/**
 * Whether a file kept from an earlier visit still stands for the published
 * one: both tell a version, and it is the same. A publisher that tells
 * none, or one a page is not let read, is read whole every time.
 */
export const keptStands = (kept: string | undefined, published: string | undefined): boolean => kept !== undefined && kept === published

/** The browser's store of the list's files; none where it has no such store, or refuses it. */
const keptFiles = async (): Promise<Cache | undefined> => {
  try {
    return typeof caches === "undefined" ? undefined : await caches.open(KEPT)
  } catch {
    return undefined
  }
}

const keptIn = async (store: Cache | undefined, url: URL): Promise<Response | undefined> => {
  try {
    return await store?.match(url)
  } catch {
    return undefined
  }
}

/** A file asked for — whole, or its headers alone — or nothing where the network gave no answer. */
const asked = async (url: URL, method: "GET" | "HEAD"): Promise<Response | undefined> => {
  try {
    return await fetch(url, { method })
  } catch {
    return undefined
  }
}

/** A file just read, kept for the next visit where it came with a version to tell it by; a store that refuses it loses nothing but the saving. */
const keep = async (store: Cache | undefined, url: URL, response: Response): Promise<void> => {
  if (store === undefined || versionOf(response) === undefined) return
  try {
    await store.put(url, response.clone())
  } catch {
    return
  }
}

/** Whether the published file is still the one kept: its version alone is asked for, a few hundred bytes. No answer leaves the kept one standing, so the list still opens where there is no network. */
const stillPublished = async (url: URL, kept: Response): Promise<boolean> => {
  const version = versionOf(kept)
  if (version === undefined) return false
  const head = await asked(url, "HEAD")
  return head === undefined || (head.ok && keptStands(version, versionOf(head)))
}

/**
 * One of the list's files as text. A file kept from an earlier visit is
 * read from the browser where the published one's version has not moved,
 * so megabytes are fetched once and again only when they change; where the
 * published one cannot be read at all, the kept one is read rather than
 * nothing.
 */
const fileText = async (base: string, file: string): Promise<Result<string, ListError>> => {
  const url = new URL(file, new URL(base, window.location.href))
  const store = await keptFiles()
  const kept = await keptIn(store, url)
  if (kept !== undefined && (await stillPublished(url, kept))) return Ok(await kept.text())
  const response = await asked(url, "GET")
  if (response === undefined || !response.ok) return kept === undefined ? Err({ type: "unreachable", file }) : Ok(await kept.text())
  await keep(store, url, response)
  return Ok(await response.text())
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
