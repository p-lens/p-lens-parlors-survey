import { describe, expect, test } from "bun:test"

import { subjectUnknown } from "../src/core/known"
import { subjectsOfJsonl, type ListedSubject } from "../src/core/listed"
import { nameTaken } from "../src/core/namesake"
import { readEnvelope } from "../src/core/observation"
import { problemText } from "../src/core/problem-text"
import { readAttributes } from "../src/core/schema"
import { japanese } from "../src/core/words"
import { ADD, aedSchema, envelope, JUDGING, namedOnceSchema } from "./fixtures"

describe("readAttributes", () => {
  test("reads each field by its kind: text settled, kana in hiragana, words deduplicated", () => {
    const read = readAttributes(aedSchema, ADD.attributes, "add")
    expect(read).toEqual({ ok: true, value: { name: "梅田駅 中央改札", reading: "うめだえき", access: "24時間", floor: -1, indoor: true, tags: ["改札横"] } })
  })

  test("needs the required fields of a new thing", () => {
    const read = readAttributes(aedSchema, { name: "梅田駅" }, "add")
    expect(read).toEqual({ ok: false, error: [{ field: "access", reason: "required" }] })
  })

  test("refuses values that are not of their field's kind", () => {
    const read = readAttributes(aedSchema, { name: "x", reading: "ume da 1", access: "夜だけ", floor: 500, tags: ["a", "b", "c", "d"] }, "add")
    expect(read.ok ? [] : read.error.map((problem) => `${problem.field}:${problem.reason}`)).toEqual(["name:too-short", "reading:not-kana", "access:not-a-choice", "floor:out-of-range", "tags:too-many"])
  })

  test("takes no photo until the kit has somewhere to keep one", () => {
    const read = readAttributes(aedSchema, { ...ADD.attributes, photo: "data:image/png;base64,AAAA" }, "add")
    expect(read).toEqual({ ok: false, error: [{ field: "photo", reason: "unsupported" }] })
  })

  test("a correction takes only correctable fields, and needs one", () => {
    expect(readAttributes(aedSchema, { access: "営業時間内", indoor: false }, "amend")).toEqual({ ok: true, value: { access: "営業時間内" } })
    expect(readAttributes(aedSchema, { indoor: false }, "amend")).toEqual({ ok: false, error: [{ field: "attributes", reason: "required" }] })
  })

  test("runs the schema's own rules last, which may settle values", () => {
    const strict = { ...aedSchema, refine: () => ({ ok: false as const, error: [{ field: "name", reason: "no-station" }] }) }
    expect(readAttributes(strict, ADD.attributes, "add")).toEqual({ ok: false, error: [{ field: "name", reason: "no-station" }] })
  })
})

describe("readEnvelope", () => {
  test("takes a new thing with its position rounded and the basemap it was pinned on", () => {
    const read = readEnvelope(envelope(ADD), JUDGING)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(read.value.submission.observation).toMatchObject({ kind: "add", position: { latitude: 34.7041235, longitude: 135.4981, method: "pin", basemap: "gsi-pale" } })
  })

  test("refuses a pin placed on a basemap the survey does not offer", () => {
    const read = readEnvelope(envelope({ ...ADD, position: { ...ADD.position, basemap: "google" } }), JUDGING)
    expect(read).toEqual({ ok: false, error: [{ field: "position", reason: "basemap" }] })
  })

  test("takes a GPS position without a basemap", () => {
    const read = readEnvelope(envelope({ ...ADD, position: { latitude: 34.7, longitude: 135.5, method: "gps", basemap: "anything" } }), JUDGING)
    expect(read.ok && read.value.submission.observation.kind === "add" ? read.value.submission.observation.position.basemap : "missing").toBeUndefined()
  })

  test("needs both consents", () => {
    for (const consent of [{ cc0: true }, { notCopied: true }, null]) {
      const read = readEnvelope(envelope(ADD, {}, consent), JUDGING)
      expect(read.ok ? [] : read.error).toContainEqual({ field: "consent", reason: "required" })
    }
  })

  test("refuses a kind the survey does not take", () => {
    const read = readEnvelope(envelope({ kind: "gone", subject: { id: "1", name: "x" } }), { ...JUDGING, schema: { ...aedSchema, observations: ["add"] } })
    expect(read).toEqual({ ok: false, error: [{ field: "kind", reason: "not-allowed" }] })
  })

  test("takes the operator's own publication only as a web address", () => {
    expect(readEnvelope(envelope(ADD, { source: { kind: "publication", url: "https://example.org/aed" } }), JUDGING).ok).toBe(true)
    expect(readEnvelope(envelope(ADD, { source: { kind: "publication", url: "javascript:alert(1)" } }), JUDGING).ok).toBe(false)
    const written = readEnvelope(envelope(ADD, { source: { kind: "publication", url: "https://example.org/a b?q=x y<z>" } }), JUDGING)
    expect(written.ok && written.value.submission.provenance.source).toEqual({ kind: "publication", url: "https://example.org/a%20b?q=x%20y%3Cz%3E" })
  })

  test("takes an observation from the last year, not the future", () => {
    expect(readEnvelope(envelope(ADD, { observedOn: "2026-10-05" }), JUDGING).ok).toBe(true)
    for (const observedOn of ["2026-10-06", "2025-09-01", "2026-02-30x"]) expect(readEnvelope(envelope(ADD, { observedOn }), JUDGING).ok).toBe(false)
  })

  test("refuses a contributor that is not a UUID", () => {
    expect(readEnvelope(envelope(ADD, { contributor: "alice" }), JUDGING).ok).toBe(false)
  })

  test("reports every problem of a sloppy report at once", () => {
    const read = readEnvelope({ submission: { observation: { kind: "add", attributes: {} }, provenance: {} } }, JUDGING)
    expect(read.ok ? [] : read.error.map((problem) => problem.field)).toEqual(["name", "access", "position", "source", "observedOn", "contributor", "consent"])
  })
})

describe("what a report names", () => {
  const about = (subject: unknown, provenance: Record<string, unknown> = {}) => readEnvelope(envelope({ kind: "gone", subject }, provenance), JUDGING)

  test("is on one line, with nothing unprintable in it", () => {
    expect(about({ id: "node/1", name: "旧庁舎" }).ok).toBe(true)
    expect(about({ id: "node/1", name: "旧庁舎\n@someone" }).ok).toBe(false)
    expect(about({ id: "node/1\u0000", name: "旧庁舎" }).ok).toBe(false)
    expect(about({ id: "node/1", name: "旧庁舎" }, { source: { kind: "other", note: "貼り紙\u2028あり" } }).ok).toBe(false)
    expect(about({ id: "node/1", name: "旧庁舎" }, { source: { kind: "other", note: "貼り紙あり" } }).ok).toBe(true)
  })
})

describe("subjectUnknown", () => {
  const listed = [{ id: "node/1", name: "旧庁舎", position: undefined, attributes: { name: "旧庁舎" } }]
  const gone = (id: string, name: string) => ({ kind: "gone" as const, subject: { id, name } })

  test("holds nothing against a report about a listed thing under its listed name", () => {
    expect(subjectUnknown(gone("node/1", "旧庁舎"), listed)).toEqual([])
  })

  test("refuses a thing the list does not have, and a listed thing under another name", () => {
    expect(subjectUnknown(gone("node/9", "旧庁舎"), listed)).toEqual([{ field: "subject", reason: "not-listed" }])
    expect(subjectUnknown(gone("node/1", "新庁舎"), listed)).toEqual([{ field: "subject", reason: "not-listed" }])
  })

  test("holds nothing against a report when the list could not be read", () => {
    expect(subjectUnknown(gone("node/9", "どこか"), [])).toEqual([])
  })
})

describe("problemText", () => {
  test("names the field by its label and the reason in the schema's words before the kit's", () => {
    const schema = { ...aedSchema, reasons: { "no-station": "に駅名を入れてください" } }
    expect(problemText({ field: "name", reason: "no-station" }, schema, japanese)).toBe("設置場所に駅名を入れてください")
    expect(problemText({ field: "consent", reason: "required" }, schema, japanese)).toBe("2つの同意にチェックを入れてください")
    expect(problemText({ field: "access", reason: "required" }, schema, japanese)).toBe("利用できる時間を入力してください")
  })
})

describe("subjectsOfJsonl", () => {
  test("reads things with and without a position, passing over lines that are not things", () => {
    const text = ['{"id":"a","name":"梅田駅","lat":34.7,"lon":135.5,"access":"24時間"}', "not json", '{"id":"b","name":"新大阪駅"}', '{"id":"c"}', '{"id":"a","name":"重複"}'].join("\n")
    const subjects = subjectsOfJsonl(text, aedSchema)
    expect(subjects.map((subject) => [subject.id, subject.name, subject.position === undefined])).toEqual([
      ["a", "梅田駅", false],
      ["b", "新大阪駅", true],
    ])
    expect(subjects[0]?.attributes).toEqual({ name: "梅田駅", access: "24時間" })
  })
})

describe("nameTaken", () => {
  const listed: readonly ListedSubject[] = [
    { id: "a", name: "梅田駅 中央改札", position: undefined, attributes: {} },
    { id: "b", name: "難波駅 北改札", position: undefined, attributes: { formerName: "難波駅 改札" } },
  ]
  const position = { latitude: 34.7, longitude: 135.5, method: "gps" as const, basemap: undefined }
  const add = (name: string) => ({ kind: "add" as const, attributes: { name }, position })
  const amend = (id: string, attributes: Record<string, string>) => ({ kind: "amend" as const, subject: { id, name: "x" }, attributes })
  const taken = [{ field: "name", reason: "listed" }]

  test("refuses a new thing under a name a listed thing goes by, by its name or another field that names it", () => {
    expect(nameTaken(add("梅田駅中央改札"), namedOnceSchema, listed)).toEqual(taken)
    expect(nameTaken(add("難波駅 改札"), namedOnceSchema, listed)).toEqual(taken)
    expect(nameTaken(add("梅田駅 東改札"), namedOnceSchema, listed)).toEqual([])
  })

  test("refuses a correction to another listed thing's name, never to its own", () => {
    expect(nameTaken(amend("b", { name: "梅田駅 中央改札" }), namedOnceSchema, listed)).toEqual(taken)
    expect(nameTaken(amend("a", { name: "梅田駅中央改札" }), namedOnceSchema, listed)).toEqual([])
    expect(nameTaken(amend("b", { reading: "なんば" }), namedOnceSchema, listed)).toEqual([])
  })

  test("holds nothing against a report about where a thing is or that it is gone, nor in a survey whose names may repeat", () => {
    expect(nameTaken({ kind: "locate", subject: { id: "a", name: "梅田駅 中央改札" }, position }, namedOnceSchema, listed)).toEqual([])
    expect(nameTaken({ kind: "gone", subject: { id: "a", name: "梅田駅 中央改札" } }, namedOnceSchema, listed)).toEqual([])
    expect(nameTaken(add("梅田駅 中央改札"), aedSchema, listed)).toEqual([])
  })
})
