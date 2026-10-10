import { describe, expect, test } from "bun:test"

import { Ok } from "../src/core/result"
import { uuidv7 } from "../src/core/uuidv7"
import { japanese } from "../src/core/words"
import type { IssueDraft } from "../src/outputs/issue"
import type { SurveyRecord } from "../src/outputs/record"
import { githubAppLineSink, githubAppSink } from "../src/server/github-app"
import { surveyWorker, takeReport, type SurveyServer } from "../src/server/take"
import { ADD, aedSchema, envelope, namedOnceSchema } from "./fixtures"

const NOW = new Date("2026-10-05T09:00:00Z")
const RANDOM = new Uint8Array(16).fill(7)

const post = (body: unknown, headers: Record<string, string> = { "Content-Type": "application/json" }): Request =>
  new Request("https://survey.example/api/reports", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) })

const GONE = { kind: "gone", subject: { id: "a", name: "梅田駅 中央改札" } }

const publishing = (lines: readonly unknown[]): typeof fetch =>
  (async (input: string | URL | Request) => (String(input) === "https://list.example/placed.jsonl" ? new Response(lines.map((line) => JSON.stringify(line)).join("\n")) : new Response("", { status: 404 }))) as typeof fetch

const LISTED = { base: "https://list.example/", files: ["placed.jsonl"] }

const serverWith = (filed: IssueDraft[], overrides: Partial<SurveyServer> = {}): SurveyServer => ({
  schema: aedSchema,
  words: japanese,
  basemaps: ["gsi-pale"],
  list: undefined,
  sink: async (draft) => {
    filed.push(draft)
    return Ok(undefined)
  },
  elsewhere: undefined,
  alsoJudged: undefined,
  challenge: { type: "none" },
  limiter: undefined,
  outbound: fetch,
  ...overrides,
})

describe("takeReport", () => {
  test("files a valid report as an issue and answers its id", async () => {
    const filed: IssueDraft[] = []
    const response = await takeReport(post(envelope(ADD)), serverWith(filed), NOW, RANDOM)
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ id: uuidv7(NOW.getTime(), RANDOM) })
    expect(filed.map((draft) => draft.title)).toEqual(["[新規] 梅田駅 中央改札"])
  })

  test("files nothing for a report that is not valid, and says why", async () => {
    const filed: IssueDraft[] = []
    const response = await takeReport(post(envelope(ADD, {}, { cc0: true })), serverWith(filed), NOW, RANDOM)
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ type: "invalid", problems: [{ field: "consent", reason: "required" }] })
    expect(filed).toEqual([])
  })

  test("refuses a body that is not JSON, or not sent as JSON", async () => {
    expect((await takeReport(post("{"), serverWith([]), NOW, RANDOM)).status).toBe(415)
    const filed: IssueDraft[] = []
    expect((await takeReport(post(envelope(ADD), { "Content-Type": "text/plain" }), serverWith(filed), NOW, RANDOM)).status).toBe(415)
    expect(filed).toEqual([])
  })

  test("refuses a body too large, in bytes, without reading it whole", async () => {
    expect((await takeReport(post("x".repeat(20_000)), serverWith([]), NOW, RANDOM)).status).toBe(413)
    expect((await takeReport(post("あ".repeat(6_000)), serverWith([]), NOW, RANDOM)).status).toBe(413)
    const read: number[] = []
    const endless = new ReadableStream<Uint8Array>({
      pull: (controller) => {
        read.push(1)
        controller.enqueue(new Uint8Array(4_096))
      },
    })
    const request = new Request("https://survey.example/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: endless, duplex: "half" } as RequestInit)
    expect((await takeReport(request, serverWith([]), NOW, RANDOM)).status).toBe(413)
    expect(read.length).toBeLessThan(10)
  })

  test("takes no more from a sender than its limit lets it, and reads nothing of what is over", async () => {
    const filed: IssueDraft[] = []
    const asked: string[] = []
    const server = serverWith(filed, {
      limiter: async (key) => {
        asked.push(key)
        return asked.length <= 1
      },
    })
    const from = (ip: string): Request => post(envelope(ADD), { "Content-Type": "application/json", "CF-Connecting-IP": ip })
    expect((await takeReport(from("203.0.113.7"), server, NOW, RANDOM)).status).toBe(201)
    const over = await takeReport(from("203.0.113.7"), server, NOW, RANDOM)
    expect(over.status).toBe(429)
    expect(await over.json()).toEqual({ type: "too-many" })
    expect(asked).toEqual(["203.0.113.7", "203.0.113.7"])
    expect(filed.length).toBe(1)
  })

  test("takes no report until the survey has said how one shows it comes from a person", async () => {
    const filed: IssueDraft[] = []
    const response = await takeReport(post(envelope(ADD)), serverWith(filed, { challenge: undefined }), NOW, RANDOM)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ type: "unavailable", detail: "no-challenge" })
    expect(filed).toEqual([])
  })

  test("refuses a report about a thing the list does not have, or under a name the list does not give it", async () => {
    const filed: IssueDraft[] = []
    const server = serverWith(filed, { list: LISTED, outbound: publishing([{ id: "a", name: "梅田駅 中央改札" }]) })
    expect((await takeReport(post(envelope(GONE)), server, NOW, RANDOM)).status).toBe(201)
    for (const subject of [{ id: "nowhere", name: "梅田駅 中央改札" }, { id: "a", name: "@someone" }]) {
      const response = await takeReport(post(envelope({ kind: "gone", subject })), server, NOW, RANDOM)
      expect(response.status).toBe(422)
      expect(await response.json()).toEqual({ type: "invalid", problems: [{ field: "subject", reason: "not-listed" }] })
    }
    expect(filed.length).toBe(1)
  })

  test("hands a part of a report elsewhere where its survey keeps that part apart, both parts under the one id", async () => {
    const here: IssueDraft[] = []
    const there: SurveyRecord[] = []
    const elsewhere: SurveyServer["elsewhere"] = {
      sink: async (record) => {
        there.push(record)
        return Ok(undefined)
      },
      divide: (submission) =>
        submission.observation.kind === "add"
          ? { here: { ...submission, observation: { ...submission.observation, attributes: { name: "ここ" } } }, there: { ...submission, observation: { ...submission.observation, attributes: { name: "あちら" } } } }
          : { here: undefined, there: submission },
    }
    const response = await takeReport(post(envelope(ADD)), serverWith(here, { elsewhere }), NOW, RANDOM)
    const id = uuidv7(NOW.getTime(), RANDOM)
    expect([response.status, here.map((draft) => draft.title), there.map((record) => [record.id, record.observation.kind === "add" && record.observation.attributes["name"]])]).toEqual([201, ["[新規] ここ"], [[id, "あちら"]]])
    expect(here[0]?.body.includes(id)).toBe(true)
    const none: IssueDraft[] = []
    expect((await takeReport(post(envelope(GONE)), serverWith(none, { elsewhere }), NOW, RANDOM)).status).toBe(201)
    expect([none.length, there.length]).toEqual([0, 2])
  })

  test("takes no report with a part for a place not set up, and files none of it", async () => {
    const here: IssueDraft[] = []
    const response = await takeReport(post(envelope(ADD)), serverWith(here, { elsewhere: { sink: undefined, divide: (submission) => ({ here: submission, there: submission }) } }), NOW, RANDOM)
    expect([response.status, here.length]).toEqual([503, 0])
  })

  test("holds a report to the survey's rules that take the whole of it, and files nothing of one that breaks them", async () => {
    const filed: IssueDraft[] = []
    const alsoJudged: SurveyServer["alsoJudged"] = (submission, today) => (submission.provenance.observedOn === today ? [] : [{ field: "observedOn", reason: "not-today" }])
    const response = await takeReport(post(envelope(ADD)), serverWith(filed, { alsoJudged }), NOW, RANDOM)
    expect([response.status, await response.json(), filed.length]).toEqual([422, { type: "invalid", problems: [{ field: "observedOn", reason: "not-today" }] }, 0])
  })

  test("says it is unavailable while no sink is set up", async () => {
    const response = await takeReport(post(envelope(ADD)), serverWith([], { sink: undefined }), NOW, RANDOM)
    expect(response.status).toBe(503)
  })

  test("refuses a new thing under a listed thing's name, in a survey whose things go by one name each", async () => {
    const filed: IssueDraft[] = []
    const published = (async (input: string | URL | Request) =>
      String(input) === "https://list.example/placed.jsonl" ? new Response(JSON.stringify({ id: "a", name: "梅田駅中央改札", lat: 34.7, lon: 135.5 })) : new Response("", { status: 404 })) as typeof fetch
    const server = serverWith(filed, { schema: namedOnceSchema, list: { base: "https://list.example/", files: ["placed.jsonl", "waiting.jsonl"] }, outbound: published })
    const response = await takeReport(post(envelope(ADD)), server, NOW, RANDOM)
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ type: "invalid", problems: [{ field: "name", reason: "listed" }] })
    expect(filed).toEqual([])
  })

  test("takes a report when the list cannot be read", async () => {
    const filed: IssueDraft[] = []
    const away = (async () => {
      throw new TypeError("fetch failed")
    }) as unknown as typeof fetch
    const server = serverWith(filed, { schema: namedOnceSchema, list: { base: "https://list.example/", files: ["placed.jsonl"] }, outbound: away })
    expect((await takeReport(post(envelope(ADD)), server, NOW, RANDOM)).status).toBe(201)
    expect(filed.length).toBe(1)
  })

  test("needs a Turnstile token where Turnstile is the challenge, and takes none it cannot ask about", async () => {
    const challenge = { type: "turnstile", secret: "secret" } as const
    expect((await takeReport(post(envelope(ADD)), serverWith([], { challenge }), NOW, RANDOM)).status).toBe(403)
    const away = (async () => {
      throw new TypeError("fetch failed")
    }) as unknown as typeof fetch
    expect((await takeReport(post({ ...envelope(ADD), turnstile: "token" }), serverWith([], { challenge, outbound: away }), NOW, RANDOM)).status).toBe(403)
    const vouching = (async () => new Response(JSON.stringify({ success: true }))) as unknown as typeof fetch
    expect((await takeReport(post({ ...envelope(ADD), turnstile: "token" }), serverWith([], { challenge, outbound: vouching }), NOW, RANDOM)).status).toBe(201)
  })
})

describe("surveyWorker", () => {
  const worker = surveyWorker(() => serverWith([]))

  test("takes reports only by POST at its path", async () => {
    expect((await worker.fetch(new Request("https://survey.example/api/reports"), {})).status).toBe(405)
    expect((await worker.fetch(new Request("https://survey.example/elsewhere", { method: "POST" }), {})).status).toBe(404)
  })
})

const pemOf = (bytes: ArrayBuffer): string =>
  `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/(.{64})/g, "$1\n")}\n-----END PRIVATE KEY-----`

describe("githubAppSink", () => {
  test("signs as the App, takes an installation token, and files the issue with it", async () => {
    const pair = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"])) as CryptoKeyPair
    const privateKey = pemOf((await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer)
    const calls: { url: string; authorization: string; body: string }[] = []
    const outbound = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, authorization: new Headers(init?.headers).get("Authorization") ?? "", body: String(init?.body ?? "") })
      return url.endsWith("/access_tokens") ? new Response(JSON.stringify({ token: "t0ken" }), { status: 201 }) : new Response(JSON.stringify({ number: 1 }), { status: 201 })
    }) as typeof fetch
    const sink = githubAppSink({ appId: "1", installationId: "2", privateKey, repo: "owner/list" }, outbound, () => 1_791_000_000)
    expect(await sink({ title: "t", body: "b", labels: ["survey"] })).toEqual({ ok: true, value: undefined })
    expect(calls.map((call) => call.url)).toEqual(["https://api.github.com/app/installations/2/access_tokens", "https://api.github.com/repos/owner/list/issues"])
    expect(calls[0]?.authorization).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/)
    expect(calls[1]?.authorization).toBe("token t0ken")
    expect(JSON.parse(calls[1]?.body ?? "{}")).toEqual({ title: "t", body: "b", labels: ["survey"] })
  })

  test("says so when the key cannot be read", async () => {
    const sink = githubAppSink({ appId: "1", installationId: "2", privateKey: "not a key", repo: "owner/list" }, fetch, () => 0)
    expect(await sink({ title: "t", body: "b", labels: [] })).toEqual({ ok: false, error: { type: "bad-key" } })
  })
})

describe("githubAppLineSink", () => {
  const keyed = async (): Promise<string> => {
    const pair = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"])) as CryptoKeyPair
    return pemOf((await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer)
  }

  /** A repository with one file, refusing so many writes as if another writer had got in first. */
  const repository = (file: { text: string; version: number }, conflicts: { left: number }): typeof fetch =>
    (async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).endsWith("/access_tokens")) return new Response(JSON.stringify({ token: "t0ken" }), { status: 201 })
      if (String(input) !== "https://api.github.com/repos/owner/log/contents/data/seen.jsonl") return new Response("", { status: 404 })
      if (init?.method !== "PUT") return new Headers(init?.headers).get("Accept") === "application/vnd.github.raw+json" ? new Response(file.text) : new Response(JSON.stringify({ sha: `v${String(file.version)}` }))
      const sent = JSON.parse(String(init.body)) as { content: string; sha: string; message: string }
      if (conflicts.left > 0 || sent.sha !== `v${String(file.version)}`) {
        conflicts.left -= 1
        return new Response("", { status: 409 })
      }
      file.text = new TextDecoder().decode(Uint8Array.from(atob(sent.content), (character) => character.charCodeAt(0)))
      file.version += 1
      return new Response(JSON.stringify({ commit: { message: sent.message } }))
    }) as typeof fetch

  test("sets lines down at the end of the file as it stands, in whatever script, each ended", async () => {
    const file = { text: '{"seen":"前"}', version: 1 }
    const sink = githubAppLineSink({ appId: "1", installationId: "2", privateKey: await keyed(), repo: "owner/log", path: "data/seen.jsonl" }, repository(file, { left: 0 }), () => 1_791_000_000)
    expect(await sink(['{"seen":"小景品"}', '{"seen":"大景品"}'], "seen")).toEqual({ ok: true, value: undefined })
    expect(file.text).toBe('{"seen":"前"}\n{"seen":"小景品"}\n{"seen":"大景品"}\n')
  })

  test("reads and writes again where another writer got in first, and gives up after a few tries", async () => {
    const privateKey = await keyed()
    const file = { text: "", version: 1 }
    const sink = (conflicts: number) => githubAppLineSink({ appId: "1", installationId: "2", privateKey, repo: "owner/log", path: "data/seen.jsonl" }, repository(file, { left: conflicts }), () => 1_791_000_000)
    expect(await sink(2)(["a"], "seen")).toEqual({ ok: true, value: undefined })
    expect(file.text).toBe("a\n")
    expect(await sink(3)(["b"], "seen")).toEqual({ ok: false, error: { type: "file-refused", status: 409 } })
    expect(file.text).toBe("a\n")
  })
})
