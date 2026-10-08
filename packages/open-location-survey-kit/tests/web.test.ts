import { describe, expect, test } from "bun:test"

import type { ListedSubject } from "../src/core/listed"
import { readEnvelope } from "../src/core/observation"
import { draftFor, envelopeOf, localDay, needsPosition } from "../src/web/draft"
import { copyrightIn, repositoryPage } from "../src/vite/credits"
import { clampSize } from "../src/web/frame/resize"
import { blocksOfMarkdown } from "../src/web/markdown"
import { answeredAddress, callerAddress, returnAddressOf } from "../src/web/caller"
import { keptStands } from "../src/web/list"
import { addressOf, findOf, paneOf, parentOf, placeOf, showingOf, type Place } from "../src/web/place"
import { comparable, searchSubjects } from "../src/web/search"
import { aedSchema, CONTRIBUTOR, JUDGING } from "./fixtures"

const subject = (id: string, name: string, attributes: Record<string, string | readonly string[]> = {}, position?: { latitude: number; longitude: number }): ListedSubject => ({
  id,
  name,
  position,
  attributes: { name, ...attributes },
})

describe("searchSubjects", () => {
  const subjects = [subject("1", "梅田駅 中央改札", { reading: "うめだえき" }), subject("2", "西梅田駅", { reading: "にしうめだえき" }), subject("3", "市役所", { tags: ["ロビー"] })]

  test("finds by any text field, readings in katakana or half-width, beginnings first", () => {
    expect(searchSubjects(subjects, aedSchema, "ｳﾒﾀﾞ").map((found) => found.id)).toEqual(["1", "2"])
    expect(searchSubjects(subjects, aedSchema, "ろびー").map((found) => found.id)).toEqual(["3"])
    expect(searchSubjects(subjects, aedSchema, " ")).toEqual([])
  })

  test("sets widths, case, spaces and marks aside", () => {
    expect(comparable("Ｄ’ステーション 梅田")).toBe(comparable("d'すてしょん梅田"))
  })
})

describe("drafts", () => {
  test("a new thing and a placing need a position; a disappearance does not", () => {
    expect(needsPosition(draftFor(aedSchema, "add", undefined, "2026-10-05"))).toBe(true)
    expect(needsPosition(draftFor(aedSchema, "gone", subject("1", "x"), "2026-10-05"))).toBe(false)
  })

  test("a new thing's draft becomes a report the server takes", () => {
    const draft = {
      ...draftFor(aedSchema, "add", undefined, "2026-10-04"),
      values: { name: "梅田駅 中央改札", reading: "", access: "24時間", floor: "-1", indoor: true, tags: "改札横、エレベーター前", photo: "" },
      position: { latitude: 34.7, longitude: 135.5, method: "pin" as const, basemap: "gsi-pale" },
      cc0: true,
      notCopied: true,
    }
    const read = readEnvelope(envelopeOf(aedSchema, draft, CONTRIBUTOR, undefined), JUDGING)
    expect(read.ok && read.value.submission.observation.kind === "add" ? read.value.submission.observation.attributes : undefined).toEqual({
      name: "梅田駅 中央改札",
      access: "24時間",
      floor: -1,
      indoor: true,
      tags: ["改札横", "エレベーター前"],
    })
  })

  test("a correction starts from the list and sends only what changed", () => {
    const listed = subject("node/1", "梅田駅", { access: "24時間", tags: ["改札横"] })
    const draft = { ...draftFor(aedSchema, "amend", listed, "2026-10-04"), cc0: true, notCopied: true }
    expect(draft.values["access"]).toBe("24時間")
    const changed = { ...draft, values: { ...draft.values, access: "営業時間内" } }
    const read = readEnvelope(envelopeOf(aedSchema, changed, CONTRIBUTOR, undefined), JUDGING)
    expect(read.ok ? read.value.submission.observation : undefined).toEqual({ kind: "amend", subject: { id: "node/1", name: "梅田駅" }, attributes: { access: "営業時間内" } })
  })

  test("the day is the device's own", () => {
    expect(localDay(new Date(2026, 9, 5, 23, 59))).toBe("2026-10-05")
  })
})

describe("places", () => {
  const listed = subject("node/1", "市役所")
  const subjects = new Map([[listed.id, listed]])
  const read = (address: string): Place => {
    const url = new URL(address, "https://survey.example")
    return placeOf(url.pathname, url.search)
  }

  test("every place has an address that reads back as itself, ids with slashes included", () => {
    const places: readonly Place[] = [
      { type: "list" },
      { type: "map" },
      { type: "subject", id: "osm:way/1" },
      { type: "report", kind: "add", id: undefined },
      { type: "report", kind: "amend", id: "osm:way/1" },
      { type: "placing", kind: "locate", id: "osm:way/1" },
      { type: "taken", ref: "42" },
      { type: "privacy" },
      { type: "licenses" },
    ]
    for (const place of places) expect(read(addressOf(place))).toEqual(place)
  })

  test("an address that names no place is the list", () => {
    expect(read("/nowhere")).toEqual({ type: "list" })
    expect(read("/subject")).toEqual({ type: "list" })
    expect(read("/report?kind=repaint")).toEqual({ type: "list" })
  })

  test("the list is beside, the map and placing in the middle, a thing and its report on the far side", () => {
    expect(paneOf("list")).toBe("side")
    expect(paneOf("map")).toBe("main")
    expect(paneOf("placing")).toBe("main")
    expect(paneOf("subject")).toBe("aux")
    expect(paneOf("report")).toBe("aux")
    expect(paneOf("privacy")).toBe("page")
  })

  test("going back with no history leads one step up", () => {
    expect(parentOf({ type: "placing", kind: "add", id: undefined })).toEqual({ type: "report", kind: "add", id: undefined })
    expect(parentOf({ type: "report", kind: "amend", id: "node/1" })).toEqual({ type: "subject", id: "node/1" })
    expect(parentOf({ type: "report", kind: "add", id: undefined })).toEqual({ type: "list" })
    expect(parentOf({ type: "subject", id: "node/1" })).toEqual({ type: "list" })
  })

  test("a place shows the listed thing it names", () => {
    expect(showingOf({ type: "subject", id: "node/1" }, subjects, aedSchema)).toEqual({ type: "subject", subject: listed })
    expect(showingOf({ type: "report", kind: "amend", id: "node/1" }, subjects, aedSchema)).toEqual({ type: "report", kind: "amend", subject: listed })
    expect(showingOf({ type: "report", kind: "add", id: undefined }, subjects, aedSchema)).toEqual({ type: "report", kind: "add", subject: undefined })
  })

  test("a place naming a thing the list lacks, or a report that makes no sense, shows nothing", () => {
    expect(showingOf({ type: "subject", id: "node/9" }, subjects, aedSchema)).toBeUndefined()
    expect(showingOf({ type: "report", kind: "amend", id: undefined }, subjects, aedSchema)).toBeUndefined()
    expect(showingOf({ type: "report", kind: "add", id: "node/1" }, subjects, aedSchema)).toBeUndefined()
    expect(showingOf({ type: "placing", kind: "amend", id: "node/1" }, subjects, aedSchema)).toBeUndefined()
  })
})

describe("a file of the list kept from an earlier visit", () => {
  test("stands for the published one only where both tell the same version", () => {
    expect(keptStands('"a1"', '"a1"')).toBe(true)
    expect(keptStands('"a1"', '"b2"')).toBe(false)
    expect(keptStands('"a1"', undefined)).toBe(false)
    expect(keptStands(undefined, undefined)).toBe(false)
  })
})

describe("what an address asks the list to be searched for", () => {
  test("is what `find` names, and nothing where it names none", () => {
    expect(findOf("?find=%E3%82%AC%E3%82%A4%E3%82%A2%20%E9%9B%A3%E6%B3%A2%E5%BA%97&return=https%3A%2F%2Fapp.test%2F")).toBe("ガイア 難波店")
    expect(findOf("?find=%20%20")).toBe("")
    expect(findOf("")).toBe("")
  })
})

describe("the frame's panes", () => {
  test("a width is kept within its bounds, a minimum above the maximum yielding to it", () => {
    expect(clampSize(100, 200, 360)).toBe(200)
    expect(clampSize(500, 200, 360)).toBe(360)
    expect(clampSize(250, 200, 360)).toBe(250)
    expect(clampSize(300, 400, 320)).toBe(320)
  })
})

describe("credits", () => {
  test("the copyright is the notice in the licence text, the author where it has none", () => {
    expect(copyrightIn("MIT License\n\nCopyright (c) 2026 Someone\n\nPermission is hereby granted", "Author")).toBe("Copyright (c) 2026 Someone")
    expect(copyrightIn("Licensed under the Apache License. The copyright holder grants", { name: "Author" })).toBe("Author")
    expect(copyrightIn(undefined, undefined)).toBeUndefined()
  })

  test("a repository is a page to open, however the manifest writes it", () => {
    expect(repositoryPage("git+https://github.com/maplibre/maplibre-gl-js.git")).toBe("https://github.com/maplibre/maplibre-gl-js")
    expect(repositoryPage("git://github.com/mapbox/earcut.git")).toBe("https://github.com/mapbox/earcut")
    expect(repositoryPage("git@github.com:solidjs/solid.git")).toBe("https://github.com/solidjs/solid")
    expect(repositoryPage("github:mourner/kdbush")).toBe("https://github.com/mourner/kdbush")
    expect(repositoryPage("mourner/tinyqueue")).toBe("https://github.com/mourner/tinyqueue")
    expect(repositoryPage(undefined)).toBeUndefined()
  })
})

describe("blocksOfMarkdown", () => {
  test("reads headings, paragraphs and lists, joining a paragraph's lines", () => {
    expect(blocksOfMarkdown("# 方針\n\n一行目\n二行目\n\n## 保存するもの\n\n- ひとつ\n- ふたつ\n")).toEqual([
      { type: "heading", level: 1, inlines: [{ type: "text", text: "方針" }] },
      { type: "paragraph", inlines: [{ type: "text", text: "一行目二行目" }] },
      { type: "heading", level: 2, inlines: [{ type: "text", text: "保存するもの" }] },
      { type: "list", items: [[{ type: "text", text: "ひとつ" }], [{ type: "text", text: "ふたつ" }]] },
    ])
  })

  test("a heading need not be set apart from what follows it", () => {
    expect(blocksOfMarkdown("## 見出し\n本文").map((block) => block.type)).toEqual(["heading", "paragraph"])
  })

  test("reads strong text and links, and leaves out comments", () => {
    expect(blocksOfMarkdown("<!-- 編集する人へ -->\n\n**必ず**[一覧](https://list.example/)を見る")).toEqual([
      { type: "paragraph", inlines: [{ type: "strong", text: "必ず" }, { type: "link", text: "一覧", url: "https://list.example/" }, { type: "text", text: "を見る" }] },
    ])
  })

  test("a link to anything but a page or a mail address stays text, and HTML is not passed through", () => {
    expect(blocksOfMarkdown("[押す](javascript:alert(1))<b>x</b>")).toEqual([{ type: "paragraph", inlines: [{ type: "text", text: "[押す](javascript:alert(1))<b>x</b>" }] }])
  })
})

describe("callers", () => {
  const origins = ["https://app.example", "http://localhost:8136"]
  const naming = (address: string): string => `?${new URLSearchParams({ return: address }).toString()}`

  test("a return address is taken from the query when it is a page of an origin named", () => {
    expect(returnAddressOf(naming("https://app.example/back?game=a"), origins)).toBe("https://app.example/back?game=a")
    expect(returnAddressOf(naming("http://localhost:8136/back"), origins)).toBe("http://localhost:8136/back")
    expect(returnAddressOf("?kind=add", origins)).toBeUndefined()
  })

  test("a return address anywhere else is passed over", () => {
    const elsewhere = [
      "https://evil.example/back",
      "https://app.example.evil.example/back",
      "https://app.example@evil.example/back",
      "http://app.example/back",
      "https://app.example:8443/back",
      "//app.example/back",
      "/back",
      "javascript:alert(1)",
      "data:text/html,x",
      "",
    ]
    elsewhere.forEach((address) => expect(returnAddressOf(naming(address), origins)).toBeUndefined())
    expect(returnAddressOf(naming("https://app.example/back"), [])).toBeUndefined()
  })

  test("an address kept is held to the origins again when it is read back", () => {
    expect(callerAddress("https://app.example/back", origins)).toBe("https://app.example/back")
    expect(callerAddress("https://evil.example/back", origins)).toBeUndefined()
    expect(callerAddress(undefined, origins)).toBeUndefined()
  })

  test("an answer goes into the query beside what the caller put there", () => {
    const answered = new URL(answeredAddress("https://app.example/back?game=a", { report: "0199-x", name: "梅田駅 中央改札 & 東" }))
    expect(`${answered.origin}${answered.pathname}`).toBe("https://app.example/back")
    expect(Object.fromEntries(answered.searchParams)).toEqual({ game: "a", report: "0199-x", name: "梅田駅 中央改札 & 東" })
  })

  test("an answer of nothing goes back as the caller's address was", () => {
    expect(answeredAddress("https://app.example/back?game=a", {})).toBe("https://app.example/back?game=a")
  })
})
