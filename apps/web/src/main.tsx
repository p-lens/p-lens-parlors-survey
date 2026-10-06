import { parlorSchema } from "@p-lens-survey/parlor-schema"
import { render } from "solid-js/web"
import { GSI_PALE, japanese, type ListedSubject } from "open-location-survey-kit"
import { SurveyApp, type SurveyConfig } from "open-location-survey-kit/web"
import "open-location-survey-kit/web/theme.css"

import { branding } from "../branding/branding"
import privacy from "../branding/privacy.md?raw"

const text = (subject: ListedSubject, key: string): string => {
  const value = subject.attributes[key]
  return typeof value === "string" ? value : ""
}

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
}

const root = document.getElementById("root")
if (root !== null) render(() => <SurveyApp config={config} />, root)
