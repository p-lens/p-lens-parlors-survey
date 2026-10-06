import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs"
import { dirname, join, sep } from "node:path"

import type { Credit, Credits } from "../web/config"

interface Manifest {
  readonly name?: string
  readonly version?: string
  readonly license?: string
  readonly author?: string | { readonly name?: string }
  readonly repository?: string | { readonly url?: string }
  readonly dependencies?: Readonly<Record<string, string>>
  readonly optionalDependencies?: Readonly<Record<string, string>>
}

/** Build tools part of which reaches the browser: Tailwind's base styles are in the stylesheet. */
const SERVED_TOOLS: readonly string[] = ["tailwindcss"]

const manifestIn = (dir: string): Manifest => JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest

/** The licence a package ships, as text; one offered under a choice of licences ships a file for each, and all are shown. */
const licenceTextIn = (dir: string): string | undefined => {
  const named = readdirSync(dir)
    .filter((file) => /^(LICEN[CS]E|COPYING)([-.]|$)/i.test(file))
    .toSorted()
  return named.length === 0 ? undefined : named.map((file) => `${named.length > 1 ? `${file}\n\n` : ""}${readFileSync(join(dir, file), "utf8").trim()}`).join("\n\n")
}

/**
 * Who holds the copyright. The line lives in the licence text, which is where
 * it is to be reproduced from, so the text is read first and the author is a
 * fallback. A year or a (c) tells a notice apart from prose about notices.
 */
export const copyrightIn = (text: string | undefined, author: string | { readonly name?: string } | undefined): string | undefined =>
  text
    ?.split(/\r?\n/)
    .find((line) => /^\s*copyright\b.*(\(c\)|©|\d{4})/i.test(line))
    ?.trim() ?? (typeof author === "string" ? author : author?.name)

/**
 * Where a package's source is kept, as a page to open: the repository its
 * manifest names, whichever of npm's ways of writing one it uses.
 */
export const repositoryPage = (named: string | undefined): string | undefined => {
  if (named === undefined) return undefined
  const short = /^(?:github:)?([\w.-]+\/[\w.-]+)$/.exec(named)
  if (short !== null) return `https://github.com/${short[1]}`
  const hosted = /^(?:git\+)?(?:https?|git|ssh):\/\/(?:[^@/]+@)?([^/:]+)[/:](.+?)(?:\.git)?$/.exec(named) ?? /^[^@/]+@([^/:]+):(.+?)(?:\.git)?$/.exec(named)
  return hosted === null ? undefined : `https://${hosted[1]}/${hosted[2]}`
}

/** Where a dependency resolves to from the directory that asks for it: node_modules, walked upwards. */
const resolveFrom = (from: string, name: string): string | undefined => {
  const candidate = join(from, "node_modules", name)
  if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate)
  const parent = dirname(from)
  return parent === from ? undefined : resolveFrom(parent, name)
}

const requiredBy = (manifest: Manifest): readonly string[] => [...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.optionalDependencies ?? {})]

/** Every package reachable from a directory, by where it is installed; an optional one not installed is not served and does not resolve. */
const gather = (found: ReadonlyMap<string, Manifest>, dir: string): ReadonlyMap<string, Manifest> => {
  if (found.has(dir)) return found
  const manifest = manifestIn(dir)
  return requiredBy(manifest)
    .flatMap((name) => resolveFrom(dir, name) ?? [])
    .reduce(gather, new Map(found).set(dir, manifest))
}

const creditOf = (dir: string, manifest: Manifest): Credit => {
  const text = licenceTextIn(dir)
  const repository = typeof manifest.repository === "string" ? manifest.repository : manifest.repository?.url
  return { name: manifest.name ?? dir, version: manifest.version, license: manifest.license, copyright: copyrightIn(text, manifest.author), repository: repositoryPage(repository), text }
}

const installed = (dir: string): boolean => dir.split(sep).includes("node_modules")

/**
 * What a page has to credit, read from what is installed: every package
 * reachable from what the page at `root` declares it needs, so what is
 * credited is what is served, not what someone remembered to write down. Each
 * is read for the licence it declares, the copyright line its licence text
 * carries, that text in full, which is what the permissive licences ask to
 * be reproduced, and the repository its source is kept in.
 *
 * Tools that only build the page are not reached, except those part of which
 * is served. A package of the survey's own that states no licence is the
 * survey's own code and is left out.
 */
export const collectCredits = (root: string, today: string): Credits => {
  const served = requiredBy(manifestIn(root))
    .flatMap((name) => resolveFrom(root, name) ?? [])
    .reduce(gather, new Map<string, Manifest>())
  const tools = SERVED_TOOLS.flatMap((name) => resolveFrom(root, name) ?? []).map((dir) => [dir, manifestIn(dir)] as const)
  const packages = [...served, ...tools]
    .map(([dir, manifest]) => ({ dir, credit: creditOf(dir, manifest) }))
    .filter(({ dir, credit }) => installed(dir) || credit.license !== undefined || credit.text !== undefined)
    .map(({ credit }) => credit)
    .toSorted((left, right) => left.name.localeCompare(right.name))
  return { collected: today, packages }
}
