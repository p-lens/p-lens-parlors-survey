import { describe, expect, test } from "bun:test"

import { japanese } from "../src/core/words"
import { featureOf } from "../src/outputs/geojson"
import { issueOf } from "../src/outputs/issue"
import { osmNoteOf } from "../src/outputs/osm-note"
import { recordOf, type SurveyRecord } from "../src/outputs/record"
import { aedSchema, CONTRIBUTOR } from "./fixtures"

const provenance = { source: { kind: "on-site" as const }, observedOn: "2026-10-04", contributor: CONTRIBUTOR }

const added: SurveyRecord = recordOf("0192f0a0-0000-7000-8000-000000000001", "aed", "2026-10-05T09:00:00.000Z", {
  observation: { kind: "add", attributes: { name: "梅田駅 中央改札", access: "24時間", tags: ["改札横"] }, position: { latitude: 34.7041235, longitude: 135.4981, method: "pin", basemap: "gsi-pale" } },
  provenance,
})

const gone: SurveyRecord = recordOf("0192f0a0-0000-7000-8000-000000000002", "aed", "2026-10-05T09:00:00.000Z", {
  observation: { kind: "gone", subject: { id: "node/1", name: "旧庁舎" } },
  provenance: { ...provenance, source: { kind: "other", note: "撤去の|貼り紙\nあり" } },
})

describe("recordOf", () => {
  test("gives every record the CC0 licence", () => {
    expect(added.license).toBe("CC0-1.0")
  })
})

describe("featureOf", () => {
  test("puts a placed thing at its point, longitude first, with the whole record as properties", () => {
    const feature = featureOf(added)
    expect(feature.geometry).toEqual({ type: "Point", coordinates: [135.4981, 34.7041235] })
    expect(feature.id).toBe(added.id)
    expect(feature.properties).toMatchObject({ survey: "aed", license: "CC0-1.0", provenance })
  })

  test("leaves a report that places nothing without geometry", () => {
    expect(featureOf(gone).geometry).toBeNull()
  })
})

describe("osmNoteOf", () => {
  test("states the facts and where they came from, in plain lines", () => {
    expect(osmNoteOf(added, aedSchema, japanese)).toBe(
      ["AED：新規 梅田駅 中央改札", "設置場所：梅田駅 中央改札", "利用できる時間：24時間", "目印：改札横", "座標：34.7041235, 135.4981（地図でピン・gsi-pale）", "出典：現地で確認した", "確認した日：2026-10-04", `CC0-1.0 / ${added.id}`].join("\n"),
    )
  })
})

describe("issueOf", () => {
  test("is titled by kind and name and labelled by survey and kind", () => {
    const issue = issueOf(added, aedSchema, japanese)
    expect(issue.title).toBe("[新規] 梅田駅 中央改札")
    expect(issue.labels).toEqual(["survey", "aed", "add"])
  })

  test("carries the consent, the OSM note text and the record as GeoJSON", () => {
    const issue = issueOf(added, aedSchema, japanese)
    expect(issue.body).toContain(japanese.consentStatement)
    expect(issue.body).toContain(osmNoteOf(added, aedSchema, japanese))
    const geojson = issue.body.split("```json\n")[1]?.split("\n```")[0] ?? ""
    expect(JSON.parse(geojson)).toEqual(JSON.parse(JSON.stringify(featureOf(added))))
  })

  test("draws a map with the streets around a placed thing in view, and none for a report that places nothing", () => {
    const map = JSON.parse(issueOf(added, aedSchema, japanese).body.split("```geojson\n")[1]?.split("\n```")[0] ?? "{}") as { features: { geometry: { type: string; coordinates: unknown } }[] }
    expect(map.features[0]?.geometry).toEqual({ type: "Point", coordinates: [135.4981, 34.7041235] })
    expect(map.features[1]?.geometry.type).toBe("LineString")
    const ring = map.features[1]?.geometry.coordinates as [number, number][]
    expect(ring[0]).toEqual(ring[ring.length - 1] as [number, number])
    const metres = ring.map(([longitude, latitude]) => Math.hypot((longitude - 135.4981) * 111_320 * Math.cos((34.7041235 * Math.PI) / 180), (latitude - 34.7041235) * 111_320))
    expect(Math.min(...metres)).toBeGreaterThan(299)
    expect(Math.max(...metres)).toBeLessThan(301)
    expect(issueOf(gone, aedSchema, japanese).body).not.toContain("```geojson")
  })

  test("keeps what was typed from breaking the table", () => {
    expect(issueOf(gone, aedSchema, japanese).body).toContain("| 出典 | ` その他：撤去の｜貼り紙 あり ` |")
  })

  test("writes what was sent where it can only be shown: no mention, link or markup of its own, and no way out of a block", () => {
    const hostile = "x ``` </details> @someone <img src=x> [here](https://elsewhere.example) #1"
    const record = recordOf("0192f0a0-0000-7000-8000-000000000003", "aed", "2026-10-05T09:00:00.000Z", {
      observation: { kind: "gone", subject: { id: "node/1", name: hostile } },
      provenance: { ...provenance, source: { kind: "other", note: hostile } },
    })
    const issue = issueOf(record, aedSchema, japanese)
    const lines = issue.body.split("\n")
    const outside = lines.reduce<{ readonly open: string | undefined; readonly kept: readonly string[] }>(
      (state, line) => {
        const fence = /^(`{3,})/.exec(line)?.[1]
        if (state.open === undefined) return fence === undefined ? { open: undefined, kept: [...state.kept, line] } : { open: fence, kept: state.kept }
        return line === state.open ? { open: undefined, kept: state.kept } : state
      },
      { open: undefined, kept: [] },
    )
    expect(outside.open).toBeUndefined()
    const shown = outside.kept.join("\n").replace(/(`+) .*? \1/g, "")
    expect(shown).not.toContain("@someone")
    expect(shown).not.toContain("<img")
    expect(shown).not.toContain("elsewhere.example")
    expect(lines.filter((line) => line === "</details>").length).toBe(1)
    expect(issue.body).toContain("| 対象 | ```` x ``` </details> @someone")
  })

  test("gives an issue a title on one line, no longer than GitHub takes", () => {
    const record = recordOf("0192f0a0-0000-7000-8000-000000000004", "aed", "2026-10-05T09:00:00.000Z", { observation: { kind: "gone", subject: { id: "node/1", name: `長い${"名".repeat(400)}` } }, provenance })
    const title = issueOf(record, aedSchema, japanese).title
    expect([...title].length).toBe(200)
    expect(title).not.toMatch(/\s{2}|\n/)
  })
})
