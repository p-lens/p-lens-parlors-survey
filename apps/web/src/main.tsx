import { parlorSchema } from "@p-lens-survey/parlor-schema"
import { render } from "solid-js/web"
import { GSI_PALE, japanese, type ListedSubject } from "open-location-survey-kit"
import { SurveyApp, type SurveyConfig, type TakenReport } from "open-location-survey-kit/web"
import "open-location-survey-kit/web/theme.css"

import { branding } from "../branding/branding"
import privacy from "../branding/privacy.md?raw"

const text = (subject: ListedSubject, key: string): string => {
  const value = subject.attributes[key]
  return typeof value === "string" ? value : ""
}

const typed = (taken: TakenReport, key: string): string => {
  const value = taken.values[key]
  return typeof value === "string" ? value.trim() : ""
}

/**
 * What app.p-lens.jp is told of a report taken. A parlor reported as new,
 * or placed on the map, is one the app's list will come to have: it goes
 * back with the report's id as its submission, and the name and prefecture
 * the app keeps it under until the list publishes it. A closing or a
 * correction brings the app no parlor, and goes back with nothing.
 */
const answerOf = (taken: TakenReport): Readonly<Record<string, string>> => {
  switch (taken.kind) {
    case "add":
      return { submission: taken.id, name: typed(taken, "name"), prefecture: typed(taken, "prefecture") }
    case "locate":
      return taken.subject === undefined ? {} : { submission: taken.id, name: taken.subject.name, prefecture: text(taken.subject, "prefecture") }
    case "gone":
    case "amend":
      return {}
  }
}

/** The origins named in `VITE_CALLER_ORIGINS`, separated by commas. */
const callerOrigins = (import.meta.env.VITE_CALLER_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin !== "")

const config: SurveyConfig = {
  schema: parlorSchema,
  words: japanese,
  branding: { ...branding, privacy },
  listBase: import.meta.env.VITE_LIST_URL,
  listFiles: ["parlors.jsonl", "unplaced.jsonl"],
  basemap: GSI_PALE,
  start: { latitude: 36.2, longitude: 137.8, zoom: 4.6 },
  groupField: "prefecture",
  summarize: (subject) => `${text(subject, "prefecture")}${text(subject, "address")}`,
  linkOf: (subject) => text(subject, "officialUrl") || undefined,
  turnstileKey: import.meta.env.VITE_TURNSTILE_SITE_KEY || undefined,
  callers: callerOrigins.length === 0 ? undefined : { origins: callerOrigins, note: branding.callerNote, answerOf },
}

const root = document.getElementById("root")
if (root !== null) render(() => <SurveyApp config={config} />, root)
