import { createSignal, onCleanup, type Accessor } from "solid-js"

/** Whether the window has room for the panes side by side, or for one at a time. */
export type Arrangement = "wide" | "narrow"

/**
 * Follows the window and says which arrangement it calls for. It asks how
 * wide the window is, never what kind of device it is, so a desktop window
 * dragged thin behaves as a phone does. Called inside a reactive owner, which
 * removes the listener when it goes.
 */
export const createArrangement = (narrowBelow: number): Accessor<Arrangement> => {
  const query = window.matchMedia(`(width < ${narrowBelow}px)`)
  const [arrangement, setArrangement] = createSignal<Arrangement>(query.matches ? "narrow" : "wide")
  const follow = (event: MediaQueryListEvent): void => {
    setArrangement(event.matches ? "narrow" : "wide")
  }
  query.addEventListener("change", follow)
  onCleanup(() => query.removeEventListener("change", follow))
  return arrangement
}
