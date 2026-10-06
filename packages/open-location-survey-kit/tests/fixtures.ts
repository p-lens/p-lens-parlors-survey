import type { SurveySchema } from "../src/core/schema"

/** A survey of AEDs, unrelated to any app on purpose: the kit must not lean on one. */
export const aedSchema: SurveySchema = {
  id: "aed",
  noun: "AED",
  nameField: "name",
  observations: ["add", "locate", "gone", "amend"],
  fields: [
    { key: "name", label: "設置場所", kind: { type: "text", maxLength: 40, minLength: 2 }, required: true, amendable: true },
    { key: "reading", label: "よみ", kind: { type: "kana", maxLength: 40 }, required: false, amendable: true },
    { key: "access", label: "利用できる時間", kind: { type: "choice", options: ["24時間", "営業時間内"] }, required: true, amendable: true },
    { key: "floor", label: "階", kind: { type: "number", min: -5, max: 100 }, required: false, amendable: true },
    { key: "indoor", label: "屋内", kind: { type: "flag" }, required: false, amendable: false },
    { key: "tags", label: "目印", kind: { type: "words", maxCount: 3, maxLength: 10 }, required: false, amendable: true },
    { key: "photo", label: "写真", kind: { type: "photo" }, required: false, amendable: false },
  ],
}

export const CONTRIBUTOR = "0192f0a0-1234-7abc-8def-0123456789ab"

export const TODAY = "2026-10-05"

export const envelope = (observation: unknown, provenance: Record<string, unknown> = {}, consent: unknown = { cc0: true, notCopied: true }) => ({
  submission: { observation, provenance: { source: { kind: "on-site" }, observedOn: "2026-10-04", contributor: CONTRIBUTOR, ...provenance } },
  consent,
})

export const ADD = {
  kind: "add",
  attributes: { name: "梅田駅 中央改札", reading: "ウメダエキ", access: "24時間", floor: -1, indoor: true, tags: ["改札横", " 改札横 ", ""] },
  position: { latitude: 34.70412345678, longitude: 135.4981, method: "pin", basemap: "gsi-pale" },
}

/** A survey whose things go by one name each, spaces aside. */
export const namedOnceSchema: SurveySchema = { ...aedSchema, sameName: (left, right) => left.replace(/\s/g, "") === right.replace(/\s/g, ""), alsoNamedBy: ["formerName"] }

export const JUDGING = { schema: aedSchema, basemaps: ["gsi-pale"], today: TODAY }
