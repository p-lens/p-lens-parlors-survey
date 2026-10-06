import { createMemo, createSignal, type Accessor } from "solid-js"

/** Which side of the window the resized pane sits on: one on the left grows as its handle is dragged right, one on the right as it is dragged left. */
export type PaneSide = "left" | "right"

/** A pane's width in pixels: where it starts, and how far it may be dragged. */
export interface PaneWidth {
  readonly initial: number
  readonly min: number
  readonly max: number
}

/**
 * Keep a size within its bounds. A minimum above the maximum yields to the
 * maximum, because a pane wider than the window puts its own far edge, and
 * whatever sits on it, out of reach.
 */
export const clampSize = (value: number, min: number, max: number): number => Math.max(Math.min(min, max), Math.min(max, value))

export interface Resizable {
  readonly size: Accessor<number>
  readonly onHandlePointerDown: (event: PointerEvent) => void
}

/**
 * Hold a width in pixels and resize it within its bounds as a pointer drags
 * the handle on the pane's inner edge.
 *
 * Listeners live on the window only while dragging. A drag the browser
 * cancels is undone rather than kept: a handle near the edge of the screen is
 * where a phone's back gesture starts, and the system takes the pointer
 * partway through with `pointercancel`, so what moved was never a drag.
 */
export const createResizable = (width: PaneWidth, side: PaneSide): Resizable => {
  const [wanted, setWanted] = createSignal(width.initial)
  const growth = side === "left" ? 1 : -1
  const clamp = (value: number): number => clampSize(value, width.min, width.max)
  const size = createMemo(() => clamp(wanted()))

  const onHandlePointerDown = (event: PointerEvent): void => {
    event.preventDefault()
    const start = event.clientX
    const startSize = size()
    const before = wanted()
    const onMove = (moved: PointerEvent): void => {
      setWanted(clamp(startSize + (moved.clientX - start) * growth))
    }
    const release = (): void => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", release)
      window.removeEventListener("pointercancel", cancel)
      document.body.style.removeProperty("cursor")
      document.body.style.removeProperty("user-select")
    }
    const cancel = (): void => {
      setWanted(before)
      release()
    }
    document.body.style.setProperty("cursor", "col-resize")
    document.body.style.setProperty("user-select", "none")
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", release)
    window.addEventListener("pointercancel", cancel)
  }

  return { size, onHandlePointerDown }
}
