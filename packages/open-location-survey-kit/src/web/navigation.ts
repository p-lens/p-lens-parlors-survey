import { createSignal, onCleanup, type Accessor } from "solid-js"

import { addressOf, parentOf, placeOf, samePlace, type Place } from "./place"

export interface Navigation {
  readonly place: Accessor<Place>
  /** Go to a place. Going to where one just came from is going back, so the history does not grow by walking to and fro. */
  readonly go: (place: Place) => void
  /** Put a place where this one is, when this one should not be come back to. */
  readonly replace: (place: Place) => void
  /** Go back through the history, or to the place above this one when the history starts here. */
  readonly back: () => void
}

const stepOf = (state: unknown): number => (typeof state === "object" && state !== null && "step" in state && typeof state.step === "number" ? state.step : 0)

const here = (): Place => placeOf(window.location.pathname, window.location.search)

/**
 * The place the address names, kept in the browser's history so its back
 * button, a phone's included, walks back through the screens.
 *
 * Each entry carries how many steps into the survey it is, which says whether
 * there is anything of the survey's to go back to; the places walked through
 * are remembered beside it for as long as the page lives. Called inside a
 * reactive owner, which removes the listener when it goes.
 */
export const createNavigation = (): Navigation => {
  const held: { step: number; trail: (Place | undefined)[] } = { step: stepOf(window.history.state), trail: [] }
  const [place, setPlace] = createSignal<Place>(here())
  held.trail[held.step] = place()

  const follow = (event: PopStateEvent): void => {
    held.step = stepOf(event.state)
    held.trail[held.step] = here()
    setPlace(here())
  }
  window.addEventListener("popstate", follow)
  onCleanup(() => window.removeEventListener("popstate", follow))

  const replace = (to: Place): void => {
    window.history.replaceState({ step: held.step }, "", addressOf(to))
    held.trail[held.step] = to
    setPlace(to)
  }

  const go = (to: Place): void => {
    if (samePlace(to, place())) return
    const before = held.step > 0 ? held.trail[held.step - 1] : undefined
    if (before !== undefined && samePlace(to, before)) {
      window.history.back()
      return
    }
    held.step += 1
    held.trail.length = held.step
    held.trail[held.step] = to
    window.history.pushState({ step: held.step }, "", addressOf(to))
    setPlace(to)
  }

  const back = (): void => {
    if (held.step > 0) window.history.back()
    else replace(parentOf(place()))
  }

  return { place, go, replace, back }
}
