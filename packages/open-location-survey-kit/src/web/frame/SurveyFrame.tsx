import { Show, type JSX } from "solid-js"

import { CloseButton } from "../controls"
import type { Arrangement } from "./arrangement"
import { createResizable, type PaneWidth } from "./resize"
import { Splitter } from "./Splitter"

/** The widths of the list and the detail beside the map, and how far each may be dragged. */
const SIDE_WIDTH: PaneWidth = { initial: 360, min: 280, max: 520 }
const AUX_WIDTH: PaneWidth = { initial: 420, min: 320, max: 600 }

/**
 * The frame a survey is laid out in: a title bar, and under it a list on one
 * side, the map in the middle and the detail of what is chosen on the other.
 * It owns the geometry and nothing else; what is in each pane, and which
 * panes are open, is the survey's to say.
 *
 * A wide window shows the open panes side by side, their inner borders dragged
 * to resize them. A narrow one is not the same layout squeezed: the map keeps
 * the whole window and an open pane is laid over it whole, so the map is never
 * resized by walking between panes and comes back as it was left. A closed
 * pane stays mounted either way, so a list comes back scrolled where it was.
 *
 * Widths are not animated: every change of the map's width clears its drawing
 * buffer, which reads as flickering for the length of an animation.
 *
 * Its height is one screen with the safe-area insets subtracted, since 100dvh
 * laid over a body that already avoids the insets pushes the bottom of the
 * page off-screen by exactly that much.
 */
export const SurveyFrame = (props: {
  readonly arrangement: Arrangement
  readonly titles: JSX.Element
  readonly side: JSX.Element
  readonly sideOpen: boolean
  readonly aux: JSX.Element
  readonly auxOpen: boolean
  readonly onAuxClose: () => void
  /** What the detail's close button is called. */
  readonly closeLabel: string
  readonly children: JSX.Element
}): JSX.Element => {
  const side = createResizable(SIDE_WIDTH, "left")
  const aux = createResizable(AUX_WIDTH, "right")
  const wide = (): boolean => props.arrangement === "wide"
  const paneClass = (): string => (wide() ? "flex shrink-0" : "absolute inset-0 z-20 flex")
  return (
    <div class="flex flex-col overflow-hidden bg-surface-2 text-text-primary" style={{ height: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))" }}>
      {props.titles}
      <div class="relative flex min-h-0 flex-1">
        <div class={paneClass()} style={{ display: props.sideOpen ? undefined : "none" }}>
          <aside class={`flex min-w-0 flex-col bg-surface-1 ${wide() ? "shrink-0" : "flex-1"}`} style={{ width: wide() ? `${side.size()}px` : undefined }}>
            <div class="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">{props.side}</div>
          </aside>
          <Show when={wide()}>
            <Splitter onPointerDown={side.onHandlePointerDown} />
          </Show>
        </div>
        <main class="min-w-0 flex-1 overflow-hidden bg-surface-2">{props.children}</main>
        <div class={paneClass()} style={{ display: props.auxOpen ? undefined : "none" }}>
          <Show when={wide()}>
            <Splitter onPointerDown={aux.onHandlePointerDown} />
          </Show>
          <aside class={`flex min-w-0 flex-col bg-surface-1 ${wide() ? "shrink-0" : "flex-1"}`} style={{ width: wide() ? `${aux.size()}px` : undefined }}>
            <div class="flex h-9 shrink-0 items-center justify-end px-2">
              <CloseButton label={props.closeLabel} onClick={props.onAuxClose} />
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto">{props.aux}</div>
          </aside>
        </div>
      </div>
    </div>
  )
}
