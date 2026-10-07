import type { ListedSubject } from "../core/listed"
import type { ObservationKind } from "../core/schema"
import type { DraftValue } from "./draft"

/** A report taken, as the page that sent the person here is told of it: its id, what it reported, and what was typed. */
export interface TakenReport {
  readonly id: string
  readonly kind: ObservationKind
  /** The listed thing it concerns; none for a new one. */
  readonly subject: ListedSubject | undefined
  readonly values: Readonly<Record<string, DraftValue>>
}

/**
 * The pages a person may be sent here from, to be taken back to once a
 * report of theirs is taken: an app that needs something the list lacks
 * sends them with `?return=` and its own address, and gets the report's id
 * back in that address's query.
 */
export interface Callers {
  /**
   * The origins a person is taken back to. A return address anywhere else
   * is passed over, so a link a stranger made sends nobody where it says.
   */
  readonly origins: readonly string[]
  /** What a report taken adds to the return address's query; nothing for a report the caller has no use for. */
  readonly answerOf: (taken: TakenReport) => Readonly<Record<string, string>>
}

/** An address as it is gone back to, if it is a page of one of the origins; nothing otherwise. */
export const callerAddress = (address: string | undefined, origins: readonly string[]): string | undefined => {
  if (address === undefined) return undefined
  try {
    const url = new URL(address)
    return (url.protocol === "https:" || url.protocol === "http:") && origins.includes(url.origin) ? url.href : undefined
  } catch {
    return undefined
  }
}

/** The return address an address's query names, if it names one a person may be taken back to. */
export const returnAddressOf = (search: string, origins: readonly string[]): string | undefined => callerAddress(new URLSearchParams(search).get("return") ?? undefined, origins)

/** A caller's address with an answer in its query, beside whatever the caller put there itself. */
export const answeredAddress = (caller: string, answer: Readonly<Record<string, string>>): string => {
  const url = new URL(caller)
  Object.entries(answer).forEach(([key, value]) => url.searchParams.set(key, value))
  return url.href
}

const CALLER = "open-location-survey-kit:caller"
const ANSWER = "open-location-survey-kit:answer:"

const stored = (key: string): string | undefined => {
  try {
    return sessionStorage.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}

const keep = (key: string, value: string): void => {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    return
  }
}

/**
 * Remember, for as long as the tab lives, the caller the address names. The
 * survey's own addresses carry no `return`, so it is read once, as the page
 * opens, and kept beside the page rather than in its address.
 */
export const rememberCaller = (search: string, callers: Callers): void => {
  const caller = returnAddressOf(search, callers.origins)
  if (caller !== undefined) keep(CALLER, caller)
}

/**
 * Keep the address a report taken is gone back with, if a caller is waiting
 * for one: found again by the report's id, so the page that thanks the
 * person still leads back after it is reloaded.
 */
export const answerCaller = (callers: Callers, taken: TakenReport): void => {
  const caller = callerAddress(stored(CALLER), callers.origins)
  if (caller !== undefined) keep(`${ANSWER}${taken.id}`, answeredAddress(caller, callers.answerOf(taken)))
}

/** Where a report taken leads back to; nothing when nobody sent the person. */
export const answerFor = (ref: string, callers: Callers): string | undefined => callerAddress(stored(`${ANSWER}${ref}`), callers.origins)
