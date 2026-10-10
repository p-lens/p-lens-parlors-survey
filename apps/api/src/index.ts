import { brokerProblems, brokerSchema, divideReport, observationLines, parlorSchema } from "@p-lens-survey/parlor-schema"
import { GSI_PALE, GSI_PHOTO, GSI_STANDARD, issueOf, japanese } from "open-location-survey-kit"
import { githubAppLineSink, githubAppSink, surveyWorker, type Challenge, type GitHubAppConfig, type RecordSink } from "open-location-survey-kit/server"

/** Cloudflare's rate limiting binding, as far as it is used here. */
interface RateLimiter {
  readonly limit: (options: { readonly key: string }) => Promise<{ readonly success: boolean }>
}

interface Env {
  readonly GITHUB_REPO: string
  readonly GITHUB_APP_ID: string
  readonly GITHUB_INSTALLATION_ID: string
  /** The repository what players saw at brokers is kept in, owner/name, and the GitHub App that writes there — an App of its own, let into that repository alone; any of them unset, a report that says what a broker paid is not taken. */
  readonly GITHUB_BROKERS_REPO?: string
  readonly GITHUB_BROKERS_APP_ID?: string
  readonly GITHUB_BROKERS_INSTALLATION_ID?: string
  readonly GITHUB_BROKERS_APP_PRIVATE_KEY?: string
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

/** Where p-lens-brokers keeps what was seen. */
const OBSERVATIONS_PATH = "data/observations.jsonl"

const nowSeconds = (): number => Math.floor(Date.now() / 1000)

/**
 * Where the broker's part of a report goes in p-lens-brokers. What was
 * seen at a listed parlor is set down in the observations at once, nobody
 * reading it first: it is a record of things seen, and a wrong one is
 * told by reading it among the rest. What was seen at a parlor new to the
 * list has no id to be set down under, and is filed there as an issue.
 */
const brokerSink = (app: GitHubAppConfig): RecordSink => {
  const lines = githubAppLineSink({ ...app, path: OBSERVATIONS_PATH }, fetch, nowSeconds)
  const issues = githubAppSink(app, fetch, nowSeconds)
  return (record) => (record.observation.kind === "amend" ? lines(observationLines(record), `Set down what report ${record.id} saw`) : issues(issueOf(record, brokerSchema, japanese)))
}

/**
 * The App that writes in p-lens-brokers, where everything of it is set. It
 * is not the App that files the parlor list's issues: it may write files,
 * and is let into the one repository where that is wanted.
 */
const brokersAppOf = (env: Env): GitHubAppConfig | undefined => {
  const [repo, appId, installationId, privateKey] = [env.GITHUB_BROKERS_REPO, env.GITHUB_BROKERS_APP_ID, env.GITHUB_BROKERS_INSTALLATION_ID, env.GITHUB_BROKERS_APP_PRIVATE_KEY].map(filled)
  return repo === undefined || appId === undefined || installationId === undefined || privateKey === undefined ? undefined : { repo, appId, installationId, privateKey }
}

/**
 * survey.p-lens.jp's reports, held against the parlor list where it is
 * published, and filed as issues on its repository once the GitHub App is
 * set. What a report says a broker paid is not the parlor's: it is taken
 * out of the issue and kept in p-lens-brokers.
 */
export default surveyWorker<Env>((env) => {
  const privateKey = filled(env.GITHUB_APP_PRIVATE_KEY)
  const listBase = filled(env.LIST_URL)
  const limiter = env.REPORT_LIMITER
  const configured = privateKey !== undefined && [env.GITHUB_REPO, env.GITHUB_APP_ID, env.GITHUB_INSTALLATION_ID].every((value) => filled(value) !== undefined)
  const brokersApp = brokersAppOf(env)
  return {
    schema: parlorSchema,
    words: japanese,
    basemaps: [GSI_PALE.id, GSI_STANDARD.id, GSI_PHOTO.id],
    list: listBase === undefined ? undefined : { base: listBase, files: ["parlors.jsonl", "unplaced.jsonl"] },
    sink: configured ? githubAppSink({ appId: env.GITHUB_APP_ID, installationId: env.GITHUB_INSTALLATION_ID, privateKey, repo: env.GITHUB_REPO }, fetch, nowSeconds) : undefined,
    elsewhere: {
      divide: divideReport,
      sink: brokersApp === undefined ? undefined : brokerSink(brokersApp),
    },
    alsoJudged: brokerProblems,
    challenge: challengeOf(env),
    limiter: limiter === undefined ? undefined : async (key) => (await limiter.limit({ key })).success,
    outbound: fetch,
  }
})
