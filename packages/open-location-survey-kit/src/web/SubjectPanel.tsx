import { For, Show, type JSX } from "solid-js"

import type { ListedSubject } from "../core/listed"
import type { ObservationKind } from "../core/schema"
import type { SurveyConfig } from "./config"
import { Button } from "./controls"

/** The reports a listed thing can take, in the order offered: placing first while it has no position. */
const offered = (config: SurveyConfig, subject: ListedSubject): readonly ObservationKind[] =>
  (["locate", "amend", "gone"] as const).filter((kind) => config.schema.observations.includes(kind) && (kind !== "locate" || subject.position === undefined))

/** A link as the list gives it, only when it is a web address: the list is read from elsewhere, and a link is followed by whoever presses it. */
const webAddressOf = (link: string | undefined): string | undefined => (link !== undefined && /^https?:\/\//i.test(link) ? link : undefined)

/** A listed thing, and what can be told about it. */
export const SubjectPanel = (props: {
  readonly config: SurveyConfig
  readonly subject: ListedSubject
  readonly onReport: (kind: ObservationKind) => void
  /** Shows it on the map, where the map is a screen of its own and the thing has a position. */
  readonly onShowMap: (() => void) | undefined
}): JSX.Element => {
  const words = props.config.words
  return (
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <h2 class="text-lg font-bold text-text-primary">{props.subject.name}</h2>
        <p class="text-sm text-text-secondary">{props.config.summarize(props.subject)}</p>
        <Show when={webAddressOf(props.config.linkOf(props.subject))}>
          {(url) => (
            <a class="text-sm text-accent underline" href={url()} target="_blank" rel="noreferrer">
              {words.ui.officialPage}
            </a>
          )}
        </Show>
        <Show when={props.subject.position === undefined}>
          <p class="mt-1 rounded-md bg-surface-3 px-3 py-2 text-sm text-warning">{words.ui.noPositionYet}</p>
        </Show>
      </div>
      <Show when={props.onShowMap}>
        {(showMap) => (
          <Button tone="outline" onClick={() => showMap()()}>
            {words.ui.showOnMap}
          </Button>
        )}
      </Show>
      <div class="flex flex-col gap-2">
        <For each={offered(props.config, props.subject)}>
          {(kind) => (
            <Button tone={kind === "locate" ? "primary" : kind === "gone" ? "danger" : "secondary"} onClick={() => props.onReport(kind)}>
              {words.observations[kind]}
            </Button>
          )}
        </For>
      </div>
    </div>
  )
}
