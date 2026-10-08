import type { ListedSubject } from "../core/listed"
import type { ObservationKind, SurveySchema } from "../core/schema"

/**
 * Where a person is in the survey, as the address says it. Every screen has
 * one, so the browser's back button, a phone's included, walks back through
 * them and a screen can be linked to.
 */
export type Place =
  | { readonly type: "list" }
  | { readonly type: "map" }
  | { readonly type: "subject"; readonly id: string }
  | { readonly type: "report"; readonly kind: ObservationKind; readonly id: string | undefined }
  | { readonly type: "placing"; readonly kind: ObservationKind; readonly id: string | undefined }
  | { readonly type: "taken"; readonly ref: string }
  | { readonly type: "privacy" }
  | { readonly type: "licenses" }

/** A place with the listed thing it names found: what the screen is drawn from. */
export type Showing =
  | { readonly type: "list" }
  | { readonly type: "map" }
  | { readonly type: "subject"; readonly subject: ListedSubject }
  | { readonly type: "report"; readonly kind: ObservationKind; readonly subject: ListedSubject | undefined }
  | { readonly type: "placing"; readonly kind: ObservationKind; readonly subject: ListedSubject | undefined }
  | { readonly type: "taken"; readonly ref: string }
  | { readonly type: "privacy" }
  | { readonly type: "licenses" }

/** Where a place is looked at: the list beside, the map in the middle, the detail on the far side, or a page laid over them all. */
export type Pane = "side" | "main" | "aux" | "page"

const KINDS: readonly ObservationKind[] = ["add", "locate", "gone", "amend"]

const queryOf = (entries: Readonly<Record<string, string | undefined>>): string =>
  new URLSearchParams(Object.entries(entries).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]]))).toString()

/** Ids go in the query, never the path: a list's ids may hold slashes and colons. */
export const addressOf = (place: Place): string => {
  switch (place.type) {
    case "list":
      return "/"
    case "map":
      return "/map"
    case "subject":
      return `/subject?${queryOf({ id: place.id })}`
    case "report":
      return `/report?${queryOf({ kind: place.kind, id: place.id })}`
    case "placing":
      return `/place?${queryOf({ kind: place.kind, id: place.id })}`
    case "taken":
      return `/taken?${queryOf({ ref: place.ref })}`
    case "privacy":
      return "/privacy"
    case "licenses":
      return "/licenses"
  }
}

/** The place an address names; one that names none is the list. */
export const placeOf = (pathname: string, search: string): Place => {
  const query = new URLSearchParams(search)
  const id = query.get("id") ?? undefined
  const kind = KINDS.find((candidate) => candidate === query.get("kind"))
  const ref = query.get("ref") ?? undefined
  switch (pathname) {
    case "/map":
      return { type: "map" }
    case "/subject":
      return id === undefined ? { type: "list" } : { type: "subject", id }
    case "/report":
      return kind === undefined ? { type: "list" } : { type: "report", kind, id }
    case "/place":
      return kind === undefined ? { type: "list" } : { type: "placing", kind, id }
    case "/taken":
      return ref === undefined ? { type: "list" } : { type: "taken", ref }
    case "/privacy":
      return { type: "privacy" }
    case "/licenses":
      return { type: "licenses" }
    default:
      return { type: "list" }
  }
}

/**
 * What an address asks the list to be searched for as the page opens: an
 * app that sends a person here for one listed thing names it in `?find=`,
 * so the list opens on it. The survey's own addresses carry none.
 */
export const findOf = (search: string): string => new URLSearchParams(search).get("find")?.trim() ?? ""

export const samePlace = (left: Place, right: Place): boolean => addressOf(left) === addressOf(right)

/** Where going back leads when there is no history to go back through, as when a link was opened. */
export const parentOf = (place: Place): Place => {
  switch (place.type) {
    case "list":
    case "map":
    case "subject":
    case "taken":
    case "privacy":
    case "licenses":
      return { type: "list" }
    case "report":
      return place.id === undefined ? { type: "list" } : { type: "subject", id: place.id }
    case "placing":
      return { type: "report", kind: place.kind, id: place.id }
  }
}

export const paneOf = (type: Place["type"]): Pane => {
  switch (type) {
    case "list":
      return "side"
    case "map":
    case "placing":
      return "main"
    case "subject":
    case "report":
    case "taken":
      return "aux"
    case "privacy":
    case "licenses":
      return "page"
  }
}

const reportable = (kind: ObservationKind, id: string | undefined, subjects: ReadonlyMap<string, ListedSubject>, schema: SurveySchema): { readonly subject: ListedSubject | undefined } | undefined => {
  if (!schema.observations.includes(kind)) return undefined
  if (kind === "add") return id === undefined ? { subject: undefined } : undefined
  const subject = id === undefined ? undefined : subjects.get(id)
  return subject === undefined ? undefined : { subject }
}

/**
 * What a place shows, or nothing when the address names a thing the list does
 * not have or a report the survey does not take. Only a new thing or one
 * waiting for a position is placed on the map.
 */
export const showingOf = (place: Place, subjects: ReadonlyMap<string, ListedSubject>, schema: SurveySchema): Showing | undefined => {
  switch (place.type) {
    case "list":
    case "map":
    case "taken":
    case "privacy":
    case "licenses":
      return place
    case "subject": {
      const subject = subjects.get(place.id)
      return subject === undefined ? undefined : { type: "subject", subject }
    }
    case "report": {
      const found = reportable(place.kind, place.id, subjects, schema)
      return found === undefined ? undefined : { type: "report", kind: place.kind, subject: found.subject }
    }
    case "placing": {
      const found = place.kind === "add" || place.kind === "locate" ? reportable(place.kind, place.id, subjects, schema) : undefined
      return found === undefined ? undefined : { type: "placing", kind: place.kind, subject: found.subject }
    }
  }
}
