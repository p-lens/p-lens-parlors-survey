import type { Basemap } from "../core/basemaps"
import type { ListedSubject } from "../core/listed"
import type { SurveySchema } from "../core/schema"
import type { Words } from "../core/words"
import type { Callers } from "./caller"

/**
 * What makes a survey this survey and nobody else's: its name, what it says
 * of itself, whose it is, and the terms it sets. Everything here is the
 * survey's to write, and all a fork has to replace to be its own.
 */
export interface SurveyBranding {
  /** The survey's name, in its title bar. */
  readonly title: string
  /** What the survey is for and what it takes, in a sentence or two above the list. */
  readonly description: string
  /** The survey's privacy policy, in Markdown: what it takes, keeps and publishes. */
  readonly privacy: string
  /** The page of whoever runs the survey. */
  readonly operatorUrl: string
  /** Where the list is kept and reports are filed, named as the survey calls it. */
  readonly dataLink: { readonly label: string; readonly url: string }
  /** Where the reports taken are filed for anyone to read: the page a person is pointed to once theirs is taken. */
  readonly reportsUrl: string
  /** HTML naming where the list comes from and under what licence, shown on the map. */
  readonly listAttribution: string
}

/** A piece of software the page is made of, as it declares itself: the notice and the licence that are to be reproduced. */
export interface Credit {
  readonly name: string
  readonly version: string | undefined
  /** As the package declares it, which is not always an SPDX identifier. */
  readonly license: string | undefined
  readonly copyright: string | undefined
  /** The page of the repository its source is kept in. */
  readonly repository: string | undefined
  /** The licence as the package ships it; none when it ships none. */
  readonly text: string | undefined
}

/** Everything the page credits, and the day it was collected: what the kit's Vite plugin gathers when the page is built. */
export interface Credits {
  readonly collected: string
  readonly packages: readonly Credit[]
}

/** Everything a survey page is made of besides the kit itself. */
export interface SurveyConfig {
  readonly schema: SurveySchema
  readonly words: Words
  readonly branding: SurveyBranding
  /** Where the list's files are published, ending in a slash. */
  readonly listBase: string | undefined
  /** The list's JSONL files, read and merged in order. */
  readonly listFiles: readonly string[]
  readonly basemap: Basemap
  /** Where the map opens. */
  readonly start: { readonly latitude: number; readonly longitude: number; readonly zoom: number }
  /** A choice field things waiting for a position are browsed by, such as a region. */
  readonly groupField: string | undefined
  /** One line under a listed thing's name, such as its address. */
  readonly summarize: (subject: ListedSubject) => string
  /** The page its operator publishes about it, if the list knows one. */
  readonly linkOf: (subject: ListedSubject) => string | undefined
  /** A Cloudflare Turnstile site key; none shows no challenge. */
  readonly turnstileKey: string | undefined
  /** The pages a person may be sent here from and taken back to with what they reported; none takes nobody anywhere. */
  readonly callers: Callers | undefined
}
