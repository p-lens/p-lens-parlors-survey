import { describe, expect, test } from "bun:test"
import { readAttributes } from "open-location-survey-kit"

import { parlorSchema } from "../src/parlor"

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

  test("takes a parlor's corners by rate, each saying as much as is known, on a new parlor or as a correction", () => {
    const tiers = [
      { game: "パチンコ", rate: 4, rental: 250, replayPaidOut: 125, replayDeducted: 133 },
      { game: "パチンコ", rate: 1 },
      { game: "パチスロ", rate: 20, rental: 50 },
    ]
    expect(readAttributes(parlorSchema, { ...PARLOR, tiers }, "add")).toMatchObject({ ok: true, value: { tiers } })
    expect(readAttributes(parlorSchema, { tiers, broker: " 大阪景品センター " }, "amend")).toEqual({ ok: true, value: { tiers, broker: "大阪景品センター" } })
  })

  test("refuses corners that do not read as corners: no game or rate, a count not whole, half a replay, one corner twice", () => {
    expect(reasons({ tiers: [{ rate: 4 }] }, "amend")).toEqual(["tiers:incomplete-row"])
    expect(reasons({ tiers: [{ game: "アレンジボール", rate: 4 }] }, "amend")).toEqual(["tiers:invalid-row"])
    expect(reasons({ tiers: [{ game: "パチンコ", rate: 4, rental: 250.5 }] }, "amend")).toEqual(["tiers:not-whole"])
    expect(reasons({ tiers: [{ game: "パチンコ", rate: 4, replayPaidOut: 125 }] }, "amend")).toEqual(["tiers:replay-half"])
    expect(reasons({ tiers: [{ game: "パチンコ", rate: 4 }, { game: "パチンコ", rate: 4, rental: 250 }] }, "amend")).toEqual(["tiers:repeated-tier"])
  })

  test("takes a parlor's special prizes a corner and a prize a row: what the parlor takes for each, and what the broker paid, either alone", () => {
    const prizes = [
      { game: "パチンコ", rate: 4, name: "大景品", tokens: 1400, yen: 5000 },
      { game: "パチンコ", rate: 4, name: "小景品", tokens: 140 },
      { game: "パチスロ", rate: 20, name: "小景品", yen: 500 },
    ]
    expect(readAttributes(parlorSchema, { prizes }, "amend")).toEqual({ ok: true, value: { prizes } })
    expect(reasons({ prizes: [{ game: "パチンコ", rate: 4, name: "大景品" }] }, "amend")).toEqual(["prizes:prize-says-nothing"])
    expect(reasons({ prizes: [{ game: "パチンコ", rate: 4, name: "大景品", tokens: 1400.5 }] }, "amend")).toEqual(["prizes:not-whole"])
    expect(reasons({ prizes: [{ game: "パチンコ", rate: 4, name: "大景品", tokens: 1400 }, { game: "パチンコ", rate: 4, name: "大景品", yen: 5000 }] }, "amend")).toEqual(["prizes:repeated-prize"])
  })

  test("takes a report of a day up to half a year ahead: a change posted before it comes", () => {
    expect(parlorSchema.observedAhead).toBe(183)
  })
})
