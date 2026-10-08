import { Show, type JSX } from "solid-js"

import type { Words } from "../core/words"
import { Button } from "./controls"

/**
 * What follows a report taken: thanks, where it will shortly be read beside
 * everyone else's, the id it was filed under, and — for a person a caller
 * sent — the way back to it, with what they reported.
 */
export const TakenPanel = (props: {
  readonly words: Words
  readonly id: string
  readonly reportsUrl: string
  readonly onReturn: (() => void) | undefined
  readonly onAnother: () => void
}): JSX.Element => (
  <div class="flex flex-col gap-4">
    <h2 class="text-lg font-bold text-positive">{props.words.ui.takenTitle}</h2>
    <p class="text-sm text-text-secondary">{props.words.ui.takenBody}</p>
    <a class="self-start text-sm font-semibold text-text-primary underline underline-offset-4 hover:text-positive" href={props.reportsUrl} target="_blank" rel="noreferrer">
      {props.words.ui.takenReports} ↗
    </a>
    <p class="text-xs text-text-muted">
      {props.words.ui.takenId} {props.id}
    </p>
    <Show when={props.onReturn}>
      {(back) => (
        <Button tone="primary" onClick={() => back()()}>
          {props.words.ui.returnToCaller}
        </Button>
      )}
    </Show>
    <Button onClick={() => props.onAnother()}>{props.words.ui.another}</Button>
  </div>
)
