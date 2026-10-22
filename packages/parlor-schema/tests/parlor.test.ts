import { describe, expect, test } from "bun:test"
import { columnLabel, readAttributes, type Column } from "open-location-survey-kit"

import type { Submission, SurveyRecord } from "open-location-survey-kit"

import { brokerProblems, divideReport, observationLines } from "../src/broker"
import { brokerOrder, parlorSchema } from "../src/parlor"

const PARLOR = { name: "マルハン梅田店", reading: "マルハンウメダテン", prefecture: "大阪府", address: "大阪府大阪市北区小松原町4-16", keywords: ["梅田マルハン"] }

const reasons = (sent: Record<string, unknown>, kind: "add" | "amend" = "add"): readonly string[] => {
  const read = readAttributes(parlorSchema, sent, kind)
  return read.ok ? [] : read.error.map((problem) => `${problem.field}:${problem.reason}`)
}

describe("parlorSchema", () => {
  test("takes a parlor, its reading in hiragana and its address without the prefecture", () => {
    expect(readAttributes(parlorSchema, PARLOR, "add")).toEqual({
      ok: true,
      value: { name: "マルハン梅田店", reading: "まるはんうめだてん", prefecture: "大阪府", address: "大阪市北区小松原町4-16", keywords: ["梅田マルハン"] },
    })
  })

  test("wants a chain and its branch: a place in kanji", () => {
    expect(reasons({ ...PARLOR, name: "マルハンです" })).toEqual(["name:no-place"])
  })

  test("refuses names a book cannot write, test input and vulgar words, but not パチンコ", () => {
    expect(reasons({ ...PARLOR, name: "マルハン:梅田店" })).toEqual(["name:unwritable"])
    expect(reasons({ ...PARLOR, name: "テスト梅田店" })).toEqual(["name:placeholder"])
    expect(reasons({ ...PARLOR, name: "うんこ梅田店" })).toEqual(["name:forbidden"])
    expect(reasons({ ...PARLOR, name: "パチンコ大阪本店" })).toEqual([])
  })

  test("wants an address down to the municipality and the street number, in the prefecture chosen", () => {
    expect(reasons({ ...PARLOR, address: "北区小松原町4-16" })).toEqual(["address:no-municipality"])
    expect(reasons({ ...PARLOR, address: "大阪市北区小松原町" })).toEqual(["address:no-number"])
    expect(reasons({ ...PARLOR, address: "兵庫県神戸市中央区三宮町1-1-1" })).toEqual(["address:other-prefecture"])
    expect(reasons({ ...PARLOR, prefecture: "東京都", address: "新宿区歌舞伎町1-2-3" })).toEqual([])
  })

  test("a prefecture is one of the list's", () => {
    expect(reasons({ ...PARLOR, prefecture: "大阪" })).toEqual(["prefecture:not-a-choice"])
  })

  test("a correction may fix the name, reading or search words, never where it is", () => {
    expect(readAttributes(parlorSchema, { reading: "ミリオンツノミネテン", address: "どこか1-1" }, "amend")).toEqual({ ok: true, value: { reading: "みりおんつのみねてん" } })
    expect(reasons({ reading: "あいうえお" }, "amend")).toEqual(["reading:placeholder"])
  })

  test("takes two names as one whatever their widths, case, spaces and marks, as app.p-lens.jp does", () => {
    const same = parlorSchema.sameName ?? (() => false)
    for (const other of ["キコーナ松戸店", "ｷｺｰﾅ 松戸店", "きこーな・松戸店"]) expect([other, same("キコーナ 松戸店", other)]).toEqual([other, true])
    expect(same("P ARK", "Park")).toBe(true)
    expect(same("キコーナ 松戸店", "キコーナ 八柱店")).toBe(false)
    expect(parlorSchema.alsoNamedBy).toEqual(["officialName"])
  })

  test("takes a parlor's corners, each chosen from the corners there are and saying as much as is known, on a new parlor or as a correction", () => {
    const tiers = [{ corner: "4円パチンコ", rental: 250, replayPaidOut: 125, replayDeducted: 133, replayCap: 25000 }, { corner: "1円パチンコ" }, { corner: "20円スロット", rental: 50, replayCap: 5000 }]
    expect(readAttributes(parlorSchema, { ...PARLOR, tiers }, "add")).toMatchObject({ ok: true, value: { tiers } })
    expect(readAttributes(parlorSchema, { tiers }, "amend")).toEqual({ ok: true, value: { tiers } })
  })

  test("refuses corners that do not read as corners: none chosen, one there is not, a count not whole, half a replay, one corner twice", () => {
    expect(reasons({ tiers: [{ rental: 250 }] }, "amend")).toEqual(["tiers:incomplete-row"])
    expect(reasons({ tiers: [{ corner: "40円スロット" }] }, "amend")).toEqual(["tiers:invalid-row"])
    expect(reasons({ tiers: [{ corner: "4円パチンコ", rental: 250.5 }] }, "amend")).toEqual(["tiers:not-whole"])
    expect(reasons({ tiers: [{ corner: "20円スロット", replayCap: 2500.5 }] }, "amend")).toEqual(["tiers:not-whole"])
    expect(reasons({ tiers: [{ corner: "4円パチンコ", replayPaidOut: 125 }] }, "amend")).toEqual(["tiers:replay-half"])
    expect(reasons({ tiers: [{ corner: "4円パチンコ" }, { corner: "4円パチンコ", rental: 250 }] }, "amend")).toEqual(["tiers:repeated-tier"])
  })

  test("sets the corners most parlors have apart from those some have, and those from the rarest", () => {
    const corner = (parlorSchema.fields.find((field) => field.key === "prizes")?.kind as { columns: readonly Column[] }).columns.find((column) => column.key === "corner")
    const kind = corner?.kind.type === "choice" ? corner.kind : undefined
    expect(kind?.breaks?.map((at) => kind.options[at])).toEqual(["2円パチンコ", "0.25円パチンコ"])
  })
  test("writes what ¥1,000 usually rents as a corner is chosen, and calls the count by the corner's game", () => {
    const [corner, rental] = (parlorSchema.fields.find((field) => field.key === "tiers")?.kind as { readonly columns: readonly Column[] }).columns
    expect([corner?.fills?.["4円パチンコ"], corner?.fills?.["1円パチンコ"], corner?.fills?.["20円スロット"], corner?.fills?.["5円スロット"], corner?.fills?.["8円スロット"], corner?.fills?.["6円スロット"], corner?.fills?.["0.5円スロット"], corner?.fills?.["0.2円パチンコ"]]).toEqual([{ rental: "250" }, { rental: "1000" }, { rental: "46" }, { rental: "184" }, { rental: "115" }, { rental: "153" }, { rental: "1840" }, { rental: "5000" }])
    expect(rental === undefined ? [] : [columnLabel(rental, {}), columnLabel(rental, { corner: "4円パチンコ" }), columnLabel(rental, { corner: "20円スロット" })]).toEqual(["貸し数", "貸玉数", "貸メダル数"])
  })

  test("puts the most a corner replays in a day away apart from the replay's fee, and calls it by the corner's game", () => {
    const kind = parlorSchema.fields.find((field) => field.key === "tiers")?.kind as { readonly columns: readonly Column[]; readonly tucks: Readonly<Record<string, unknown>> }
    const cap = kind.columns.find((column) => column.key === "replayCap")
    expect([cap?.tucked, Object.keys(kind.tucks)]).toEqual(["cap", ["replay", "cap"]])
    expect(cap === undefined ? [] : [columnLabel(cap, {}), columnLabel(cap, { corner: "4円パチンコ" }), columnLabel(cap, { corner: "20円スロット" })]).toEqual(["再プレイ上限", "再プレイ上限玉数", "再プレイ上限メダル数"])
  })

  test("starts a prize as 小 for 500円, and writes in what a broker usually pays for 極小, 小, 中 and 大", () => {
    const [name, , , yen] = (parlorSchema.fields.find((field) => field.key === "prizes")?.kind as { readonly columns: readonly Column[] }).columns
    expect([name?.initial, yen?.key, yen?.initial]).toEqual(["小", "yen", "500"])
    expect(name?.fills).toEqual({ 極小: { yen: "100" }, 小: { yen: "500" }, 中: { yen: "1000" }, 大: { yen: "5000" } })
  })

  test("takes a parlor's special prizes a prize of a corner a row: what the parlor takes for each, and what the broker paid, either alone", () => {
    const prizes = [
      { name: "大景品", corner: "4円パチンコ", tokens: 1400, yen: 5000 },
      { name: "小景品", corner: "4円パチンコ", tokens: 140 },
      { name: "小景品", corner: "20円スロット", yen: 500 },
    ]
    expect(readAttributes(parlorSchema, { prizes }, "amend")).toEqual({ ok: true, value: { prizes } })
    expect(reasons({ prizes: [{ name: "大景品", corner: "4円パチンコ" }] }, "amend")).toEqual(["prizes:prize-says-nothing"])
    expect(reasons({ prizes: [{ name: "大景品", corner: "4円パチンコ", tokens: 1400.5 }] }, "amend")).toEqual(["prizes:not-whole"])
    expect(reasons({ prizes: [{ name: "大景品", corner: "4円パチンコ", tokens: 1400 }, { name: "大景品", corner: "4円パチンコ", yen: 5000 }] }, "amend")).toEqual(["prizes:repeated-prize"])
  })

  test("takes a report of a day up to half a year ahead: a change posted before it comes", () => {
    expect(parlorSchema.observedAhead).toBe(183)
  })
})

const SEEN: Submission["provenance"] = { source: { kind: "on-site" }, observedOn: "2026-10-11", contributor: "0192f0a0-1234-7abc-8def-0123456789ab" }

const SUBJECT = { id: "osm:way/1", name: "マルハン梅田店" }

const PRIZES = [
  { name: "小景品", corner: "4円パチンコ", tokens: 280, yen: 1000 },
  { name: "大景品", corner: "4円パチンコ", tokens: 1400 },
  { name: "小景品", corner: "20円スロット", yen: 500 },
]

const amending = (attributes: Record<string, unknown>): Submission => ({ observation: { kind: "amend", subject: SUBJECT, attributes: attributes as never }, provenance: SEEN })

describe("a parlor's report divided between the parlor and the broker", () => {
  test("keeps with the parlor what it takes for each prize and no yen, and gives the broker the rows that say a sum, with its name", () => {
    const { here, there } = divideReport(amending({ reading: "まるはんうめだてん", prizes: PRIZES, broker: "大阪景品センター" }))
    expect(here?.observation).toEqual({
      kind: "amend",
      subject: SUBJECT,
      attributes: { reading: "まるはんうめだてん", prizes: [{ name: "小景品", corner: "4円パチンコ", tokens: 280 }, { name: "大景品", corner: "4円パチンコ", tokens: 1400 }] },
    } as never)
    expect(there?.observation).toEqual({ kind: "amend", subject: SUBJECT, attributes: { prizes: [PRIZES[0], PRIZES[2]], broker: "大阪景品センター" } } as never)
  })

  test("is the parlor's whole where it says no sum, and the broker's whole where it says nothing else", () => {
    const posted = amending({ prizes: [PRIZES[1]] })
    expect(divideReport(posted)).toEqual({ here: posted, there: undefined })
    const paid = divideReport(amending({ prizes: [PRIZES[2]] }))
    expect([paid.here, paid.there?.observation.kind === "amend" && paid.there.observation.attributes]).toEqual([undefined, { prizes: [PRIZES[2]] }] as never)
  })

  test("gives the broker its name alone where the report names it and says no sum", () => {
    const { here, there } = divideReport(amending({ prizes: [PRIZES[1]], broker: "大阪景品センター" }))
    expect(here?.observation).toEqual({ kind: "amend", subject: SUBJECT, attributes: { prizes: [PRIZES[1]] } } as never)
    expect(there?.observation).toEqual({ kind: "amend", subject: SUBJECT, attributes: { broker: "大阪景品センター" } } as never)
    const named = divideReport(amending({ broker: "大阪景品センター" }))
    expect([named.here, named.there?.observation.kind === "amend" && named.there.observation.attributes]).toEqual([undefined, { broker: "大阪景品センター" }] as never)
  })

  test("names a new parlor to the broker by its name, with where it was placed", () => {
    const position = { latitude: 34.7, longitude: 135.5, method: "gps" as const, basemap: undefined }
    const { here, there } = divideReport({ observation: { kind: "add", attributes: { name: "新規店梅田", prizes: [PRIZES[0]] } as never, position }, provenance: SEEN })
    expect(here?.observation).toEqual({ kind: "add", attributes: { name: "新規店梅田", prizes: [{ name: "小景品", corner: "4円パチンコ", tokens: 280 }] }, position } as never)
    expect(there?.observation).toEqual({ kind: "add", attributes: { name: "新規店梅田", prizes: [PRIZES[0]] }, position } as never)
  })
})

describe("what was seen at a broker, as lines of the observations", () => {
  const record = (submission: Submission): SurveyRecord => ({ id: "0192f0a0-0000-7000-8000-000000000001", survey: "parlor", takenAt: "2026-10-11T09:00:00.000Z", license: "CC0-1.0", ...submission })

  test("is a line a prize paid for, under the report's id and the observer's pseudonym, its corner as the lists write one, and no broker where none is named", () => {
    const there = divideReport(amending({ prizes: PRIZES })).there as Submission
    expect(observationLines(record(there)).map((line) => JSON.parse(line) as unknown)).toEqual([
      { parlor: "osm:way/1", observedOn: "2026-10-11", game: "pachinko", tier: "4円", prize: "小景品", tokens: 280, yen: 1000, submission: "0192f0a0-0000-7000-8000-000000000001", observer: SEEN.contributor },
      { parlor: "osm:way/1", observedOn: "2026-10-11", game: "pachislot", tier: "20円", prize: "小景品", yen: 500, submission: "0192f0a0-0000-7000-8000-000000000001", observer: SEEN.contributor },
    ])
  })
  test("keeps the broker's name where the report gives one", () => {
    const there = divideReport(amending({ prizes: [PRIZES[0]], broker: "大阪景品センター" })).there as Submission
    expect(observationLines(record(there)).map((line) => (JSON.parse(line) as { broker: string }).broker)).toEqual(["大阪景品センター"])
  })

  test("is one line of the name alone where the report names the broker and says no sum", () => {
    const there = divideReport(amending({ broker: "大阪景品センター" })).there as Submission
    expect(observationLines(record(there)).map((line) => JSON.parse(line) as unknown)).toEqual([
      { parlor: "osm:way/1", observedOn: "2026-10-11", broker: "大阪景品センター", submission: "0192f0a0-0000-7000-8000-000000000001", observer: SEEN.contributor },
    ])
  })

  test("is none for a parlor the list does not have yet", () => {
    const position = { latitude: 34.7, longitude: 135.5, method: "gps" as const, basemap: undefined }
    expect(observationLines(record({ observation: { kind: "add", attributes: { name: "新規店梅田", prizes: [PRIZES[0]] } as never, position }, provenance: SEEN }))).toEqual([])
  })
})

describe("a report that says what a broker paid", () => {
  test("was seen on site, on a day already come; a parlor's own rates may be of a day ahead or from its site", () => {
    const paid = amending({ prizes: [PRIZES[0]] })
    expect(brokerProblems(paid, "2026-10-11")).toEqual([])
    expect(brokerProblems({ ...paid, provenance: { ...SEEN, observedOn: "2026-10-12" } }, "2026-10-11")).toEqual([])
    expect(brokerProblems({ ...paid, provenance: { ...SEEN, observedOn: "2026-11-01", source: { kind: "publication", url: "https://example.jp/" } } }, "2026-10-11")).toEqual([
      { field: "source", reason: "not-seen" },
      { field: "observedOn", reason: "seen-ahead" },
    ])
    expect(brokerProblems({ ...amending({ prizes: [PRIZES[1]] }), provenance: { ...SEEN, observedOn: "2026-11-01" } }, "2026-10-11")).toEqual([])
  })
  test("holds a broker's name alone to the same: seen on site, on a day already come", () => {
    expect(brokerProblems({ ...amending({ broker: "大阪景品センター" }), provenance: { ...SEEN, source: { kind: "publication", url: "https://example.jp/" } } }, "2026-10-11")).toEqual([{ field: "source", reason: "not-seen" }])
  })
  test("leaves out a broker's name of spaces or marks alone, neither refusing it nor keeping it", () => {
    const refined = parlorSchema.refine?.({ prizes: [PRIZES[0]], broker: "、 " } as never, "amend")
    expect(refined?.ok ? refined.value : undefined).toEqual({ prizes: [PRIZES[0]] } as never)
    expect(reasons({ broker: "、" }, "amend")).toEqual(["attributes:required"])
  })
  test("names the broker with a sum received or without", () => {
    expect(reasons({ prizes: [PRIZES[1]], broker: "大阪景品センター" }, "amend")).toEqual([])
    expect(reasons({ broker: "大阪景品センター" }, "amend")).toEqual([])
  })
})


describe("the order brokers' names are offered in", () => {
  test("puts a name opening with its legal form in brackets first", () => {
    expect(["関西三本珈琲(株)", "(一社)全国流通商適正化協会", "（株）東西", "あおば"].toSorted(brokerOrder)).toEqual(["(一社)全国流通商適正化協会", "（株）東西", "あおば", "関西三本珈琲(株)"])
  })
})
