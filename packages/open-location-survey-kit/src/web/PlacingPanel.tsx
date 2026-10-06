import { createSignal, Show, type JSX } from "solid-js"

import type { Words } from "../core/words"
import { Button, CloseButton } from "./controls"

type Locating = { readonly type: "idle" } | { readonly type: "locating" } | { readonly type: "failed" }

/** What floats over the map's corner while a position is placed under its crosshair, kept low so the map it is placed on stays in sight on a phone. */
export const PlacingPanel = (props: { readonly words: Words; readonly onLocate: () => Promise<boolean>; readonly onDecide: () => void; readonly onClose: () => void }): JSX.Element => {
  const [locating, setLocating] = createSignal<Locating>({ type: "idle" })
  const locate = async (): Promise<void> => {
    setLocating({ type: "locating" })
    setLocating((await props.onLocate()) ? { type: "idle" } : { type: "failed" })
  }
  const words = props.words.ui
  return (
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-sm font-bold text-text-primary">{words.placeTitle}</h2>
        <CloseButton label={words.close} onClick={props.onClose} />
      </div>
      <p class="text-xs text-text-secondary">{words.placeGuide}</p>
      <Show when={locating().type === "failed"}>
        <p class="text-xs text-negative">{words.gpsFailed}</p>
      </Show>
      <div class="flex gap-2">
        <Button size="compact" class="min-w-0 flex-1 truncate" onClick={() => void locate()} disabled={locating().type === "locating"}>
          {locating().type === "locating" ? words.locating : words.useGps}
        </Button>
        <Button tone="primary" size="compact" class="min-w-0 flex-1 truncate" onClick={() => props.onDecide()}>
          {words.placeHere}
        </Button>
      </div>
    </div>
  )
}
