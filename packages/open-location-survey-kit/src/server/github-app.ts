import { Err, Ok, type Result } from "../core/result"
import type { IssueDraft } from "../outputs/issue"

/** Who the GitHub App is and where it files issues. */
export interface GitHubAppConfig {
  readonly appId: string
  readonly installationId: string
  /** The App's private key as PKCS#8 PEM (`openssl pkcs8 -topk8 -nocrypt` of the key GitHub gives). */
  readonly privateKey: string
  /** owner/name */
  readonly repo: string
}

export type SinkError =
  | { readonly type: "bad-key" }
  | { readonly type: "token-refused"; readonly status: number }
  | { readonly type: "issue-refused"; readonly status: number }
  | { readonly type: "file-refused"; readonly status: number }

/** Where a record's issue goes. */
export type IssueSink = (draft: IssueDraft) => Promise<Result<void, SinkError>>

/** Where lines are set down, one after another at the end of what is there, as one commit under a message. */
export type LineSink = (lines: readonly string[], message: string) => Promise<Result<void, SinkError>>

const API = "https://api.github.com"
const USER_AGENT = "open-location-survey-kit"

const base64url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

const textBytes = (text: string): Uint8Array<ArrayBuffer> => Uint8Array.from(new TextEncoder().encode(text))

const pemBytes = (pem: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "")), (character) => character.charCodeAt(0))

/** The claims of a GitHub App JWT: issued a minute early against clock drift, good for nine minutes. */
export const appClaims = (appId: string, nowSeconds: number) => ({ iat: nowSeconds - 60, exp: nowSeconds + 540, iss: appId })

const importKey = async (pem: string): Promise<CryptoKey | undefined> => {
  try {
    return await crypto.subtle.importKey("pkcs8", pemBytes(pem), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"])
  } catch {
    return undefined
  }
}

const signedJwt = async (key: CryptoKey, claims: object): Promise<string> => {
  const head = base64url(textBytes(JSON.stringify({ alg: "RS256", typ: "JWT" })))
  const body = base64url(textBytes(JSON.stringify(claims)))
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, textBytes(`${head}.${body}`)))
  return `${head}.${body}.${base64url(signature)}`
}

const headers = (authorization: string): Record<string, string> => ({
  Accept: "application/vnd.github+json",
  Authorization: authorization,
  "User-Agent": USER_AGENT,
  "X-GitHub-Api-Version": "2022-11-28",
})

const installationToken = async (config: GitHubAppConfig, outbound: typeof fetch, nowSeconds: number): Promise<Result<string, SinkError>> => {
  const key = await importKey(config.privateKey)
  if (key === undefined) return Err({ type: "bad-key" })
  const jwt = await signedJwt(key, appClaims(config.appId, nowSeconds))
  const response = await outbound(`${API}/app/installations/${config.installationId}/access_tokens`, { method: "POST", headers: headers(`Bearer ${jwt}`) })
  if (!response.ok) return Err({ type: "token-refused", status: response.status })
  const { token } = (await response.json()) as { token: string }
  return Ok(token)
}

/**
 * Issues filed by a GitHub App, which needs only Issues: write on the one
 * repository. Its installation token is fetched fresh for every issue.
 */
export const githubAppSink =
  (config: GitHubAppConfig, outbound: typeof fetch, nowSeconds: () => number): IssueSink =>
  async (draft) => {
    const token = await installationToken(config, outbound, nowSeconds())
    if (!token.ok) return token
    const response = await outbound(`${API}/repos/${config.repo}/issues`, {
      method: "POST",
      headers: { ...headers(`token ${token.value}`), "Content-Type": "application/json" },
      body: JSON.stringify({ title: draft.title, body: draft.body, labels: draft.labels }),
    })
    return response.ok ? Ok(undefined) : Err({ type: "issue-refused", status: response.status })
  }

/** How many bytes are turned into text at a time: a call takes only so many arguments. */
const CHUNK = 0x8000

/** Bytes as base64, however many: GitHub takes a file's content so. */
const base64 = (bytes: Uint8Array): string =>
  btoa(Array.from({ length: Math.ceil(bytes.length / CHUNK) }, (_, chunk) => String.fromCharCode(...bytes.subarray(chunk * CHUNK, (chunk + 1) * CHUNK))).join(""))

/** How many times lines are tried again when someone else's lines got there first. */
const ATTEMPTS = 3

/** A file's text with more lines at its end, each ended. */
const withLines = (text: string, lines: readonly string[]): string => `${text === "" || text.endsWith("\n") ? text : `${text}\n`}${lines.join("\n")}\n`

/**
 * Lines added at the end of a file as it stands. The file is read as it is
 * and written back longer, against the version read; where another writer
 * got in between, GitHub refuses and it is read and written again.
 */
const appended = async (repo: string, path: string, lines: readonly string[], message: string, token: string, outbound: typeof fetch, attempts: number): Promise<Result<void, SinkError>> => {
  const url = `${API}/repos/${repo}/contents/${path}`
  const authorized = headers(`token ${token}`)
  const found = await outbound(url, { headers: authorized })
  if (!found.ok) return Err({ type: "file-refused", status: found.status })
  const { sha } = (await found.json()) as { sha: string }
  const read = await outbound(url, { headers: { ...authorized, Accept: "application/vnd.github.raw+json" } })
  if (!read.ok) return Err({ type: "file-refused", status: read.status })
  const written = await outbound(url, {
    method: "PUT",
    headers: { ...authorized, "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: base64(textBytes(withLines(await read.text(), lines))), sha }),
  })
  if (written.ok) return Ok(undefined)
  return written.status === 409 && attempts > 1 ? appended(repo, path, lines, message, token, outbound, attempts - 1) : Err({ type: "file-refused", status: written.status })
}

/**
 * Lines set down in a file of a repository by a GitHub App, which needs
 * Contents: write there: for what is recorded as it is reported, with
 * nobody reading it first — a log of things seen, not a list someone
 * keeps. Each call is one commit, and whatever publishes the repository
 * publishes it.
 */
export const githubAppLineSink =
  (config: GitHubAppConfig & { readonly path: string }, outbound: typeof fetch, nowSeconds: () => number): LineSink =>
  async (lines, message) => {
    const token = await installationToken(config, outbound, nowSeconds())
    return token.ok ? appended(config.repo, config.path, lines, message, token.value, outbound, ATTEMPTS) : token
  }
