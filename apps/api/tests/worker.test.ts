import { describe, expect, test } from "bun:test"

import worker from "../src/index"

const UNCONFIGURED = { GITHUB_REPO: "", GITHUB_APP_ID: "", GITHUB_INSTALLATION_ID: "" }

const report = (attributes: Record<string, unknown>) =>
  new Request("https://survey.p-lens.jp/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      submission: {
        observation: { kind: "add", attributes, position: { latitude: 34.7041, longitude: 135.5011, method: "pin", basemap: "gsi-pale" } },
        provenance: { source: { kind: "on-site" }, observedOn: new Date().toISOString().slice(0, 10), contributor: "0192f0a0-1234-7abc-8def-0123456789ab" },
      },
      consent: { cc0: true, notCopied: true },
    }),
  })

const PARLOR = { name: "マルハン梅田店", reading: "まるはんうめだてん", prefecture: "大阪府", address: "大阪市北区小松原町4-16" }

describe("survey.p-lens.jp's worker", () => {
  test("judges a report by the parlor schema", async () => {
    const response = await worker.fetch(report({ ...PARLOR, address: "大阪市北区小松原町" }), UNCONFIGURED)
    expect(response.status).toBe(422)
    expect((await response.json()) as unknown).toEqual({ type: "invalid", problems: [{ field: "address", reason: "no-number" }] })
  })

  test("takes no report until Turnstile is set, unless it is told outright to ask nothing", async () => {
    const undecided = await worker.fetch(report(PARLOR), UNCONFIGURED)
    expect(undecided.status).toBe(503)
    expect((await undecided.json()) as unknown).toEqual({ type: "unavailable", detail: "no-challenge" })
    const developing = await worker.fetch(report(PARLOR), { ...UNCONFIGURED, UNCHALLENGED: "yes" })
    expect((await developing.json()) as unknown).toEqual({ type: "unavailable", detail: "no-sink" })
  })

  test("refuses a report without a Turnstile token once the secret is set", async () => {
    const response = await worker.fetch(report(PARLOR), { ...UNCONFIGURED, TURNSTILE_SECRET: "secret" })
    expect(response.status).toBe(403)
  })

  test("stops a sender over its limit", async () => {
    const response = await worker.fetch(report(PARLOR), { ...UNCONFIGURED, REPORT_LIMITER: { limit: async () => ({ success: false }) } })
    expect(response.status).toBe(429)
  })
})
