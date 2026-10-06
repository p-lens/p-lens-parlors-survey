import { parlorSchema } from "@p-lens-survey/parlor-schema"
import { GSI_PALE, GSI_PHOTO, GSI_STANDARD, japanese } from "open-location-survey-kit"
import { githubAppSink, surveyWorker, type Challenge } from "open-location-survey-kit/server"

/** Cloudflare's rate limiting binding, as far as it is used here. */
interface RateLimiter {
  readonly limit: (options: { readonly key: string }) => Promise<{ readonly success: boolean }>
}

interface Env {
  readonly GITHUB_REPO: string
  readonly GITHUB_APP_ID: string
  readonly GITHUB_INSTALLATION_ID: string
  /** Where the parlor list's JSONL is published, ending in a slash; unset, a report is judged without the list. */
  readonly LIST_URL?: string
  readonly GITHUB_APP_PRIVATE_KEY?: string
  readonly TURNSTILE_SECRET?: string
  /** `yes` takes reports with no Turnstile check: for developing on one's own machine, never where the world can reach. */
  readonly UNCHALLENGED?: string
  /** How many reports one sender may make in a while; set in wrangler.jsonc. */
  readonly REPORT_LIMITER?: RateLimiter
}

const filled = (value: string | undefined): string | undefined => (value === undefined || value.trim() === "" ? undefined : value)

/** Turnstile where its secret is set; nothing asked only where that was said outright; otherwise undecided, and no report is taken. */
const challengeOf = (env: Env): Challenge | undefined => {
  const secret = filled(env.TURNSTILE_SECRET)
  if (secret !== undefined) return { type: "turnstile", secret }
  return env.UNCHALLENGED === "yes" ? { type: "none" } : undefined
}

/**
 * survey.p-lens.jp's reports, held against the parlor list where it is
 * published, and filed as issues on its repository once the GitHub App is set.
 */
export default surveyWorker<Env>((env) => {
  const privateKey = filled(env.GITHUB_APP_PRIVATE_KEY)
  const listBase = filled(env.LIST_URL)
  const limiter = env.REPORT_LIMITER
  const configured = privateKey !== undefined && [env.GITHUB_REPO, env.GITHUB_APP_ID, env.GITHUB_INSTALLATION_ID].every((value) => filled(value) !== undefined)
  return {
    schema: parlorSchema,
    words: japanese,
    basemaps: [GSI_PALE.id, GSI_STANDARD.id, GSI_PHOTO.id],
    list: listBase === undefined ? undefined : { base: listBase, files: ["parlors.jsonl", "unplaced.jsonl"] },
    sink: configured
      ? githubAppSink({ appId: env.GITHUB_APP_ID, installationId: env.GITHUB_INSTALLATION_ID, privateKey, repo: env.GITHUB_REPO }, fetch, () => Math.floor(Date.now() / 1000))
      : undefined,
    challenge: challengeOf(env),
    limiter: limiter === undefined ? undefined : async (key) => (await limiter.limit({ key })).success,
    outbound: fetch,
  }
})
