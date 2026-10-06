import { createSignal, Show, type JSX } from "solid-js"

import type { Words } from "../core/words"
import { LocateIcon, PlusIcon } from "./controls"

type Locating = { readonly type: "idle" } | { readonly type: "locating" } | { readonly type: "failed" }

/**
 * What floats over the map's bottom-right corner, where a thumb reaches: a
 * button that takes the map to where the person is, and under it a larger one
 * that starts a report of something the list lacks, when the survey takes those.
 */
export const MapButtons = (props: { readonly words: Words; readonly onLocate: () => Promise<boolean>; readonly onAdd: (() => void) | undefined }): JSX.Element => {
  const [locating, setLocating] = createSignal<Locating>({ type: "idle" })
  const locate = async (): Promise<void> => {
    setLocating({ type: "locating" })
    setLocating((await props.onLocate()) ? { type: "idle" } : { type: "failed" })
  }
  const label = (): string => (locating().type === "failed" ? props.words.ui.hereFailed : locating().type === "locating" ? props.words.ui.locating : props.words.ui.here)
  return (
    <div class="absolute bottom-6 right-3 z-10 flex flex-col items-center gap-3">
      <button
        type="button"
        class={`inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface-2 shadow-md transition-colors hover:bg-surface-3 disabled:opacity-60 ${locating().type === "failed" ? "text-negative" : "text-text-primary"}`}
        aria-label={label()}
        title={label()}
        disabled={locating().type === "locating"}
        onClick={() => void locate()}
      >
        <LocateIcon class={`size-5 ${locating().type === "locating" ? "animate-pulse" : ""}`} />
      </button>
      <Show when={props.onAdd}>
        {(add) => (
          <button
            type="button"
            class="inline-flex size-14 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-lg transition-colors hover:bg-accent-hover"
            aria-label={props.words.observations.add}
            title={props.words.observations.add}
            onClick={() => add()()}
          >
            <PlusIcon class="size-7" />
          </button>
        )}
      </Show>
    </div>
  )
}
