import { createMemo, createSignal, createUniqueId, For, Show, type JSX } from "solid-js"

import { inputClass } from "./controls"
import { createDebounced } from "./debounce"
import { narrowOffered } from "./offered"

/** The list under the input: closed, or open with the option the arrow keys are on, if any. */
type Listing = { readonly type: "closed" } | { readonly type: "open"; readonly at: number | undefined }

/**
 * A text input that offers what others have already given: the list under
 * it narrows to what holds the text, and choosing one fills the input.
 * Whatever is typed is the value, chosen or not, so a value the list lacks
 * is typed as into any input. The list follows once the typing has stood
 * still, and text still being composed — kana on its way to kanji — is not
 * looked up until it is settled: the list waits for the word, faded.
 * Choosing by Enter sends no form.
 */
export const OfferedInput = (props: {
  readonly value: string
  readonly offers: readonly string[]
  readonly placeholder?: string | undefined
  readonly onChange: (value: string) => void
}): JSX.Element => {
  const id = createUniqueId()
  const [listing, setListing] = createSignal<Listing>({ type: "closed" })
  const [composing, setComposing] = createSignal(false)
  const settled = createMemo<string>((last) => (composing() ? last : props.value), props.value)
  const sought = createDebounced(settled)
  const shown = createMemo(() => narrowOffered(props.offers, sought()))
  const at = (): number | undefined => {
    const current = listing()
    return current.type === "open" ? current.at : undefined
  }
  const open = (): boolean => listing().type === "open" && shown().length > 0 && !(shown().length === 1 && shown()[0] === props.value)
  const choose = (value: string): void => {
    props.onChange(value)
    setListing({ type: "closed" })
  }
  const move = (step: number): void => {
    const count = shown().length
    if (count === 0) return
    const current = at()
    setListing({ type: "open", at: current === undefined ? (step > 0 ? 0 : count - 1) : (current + step + count) % count })
  }
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.isComposing) return
    const current = at()
    const chosen = current === undefined ? undefined : shown()[current]
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      move(event.key === "ArrowDown" ? 1 : -1)
    } else if (event.key === "Enter" && open() && chosen !== undefined) {
      event.preventDefault()
      choose(chosen)
    } else if (event.key === "Escape" && open()) {
      event.preventDefault()
      setListing({ type: "closed" })
    }
  }
  return (
    <div class="relative">
      <input
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open()}
        aria-controls={id}
        aria-activedescendant={at() === undefined ? undefined : `${id}-${String(at())}`}
        autocomplete="off"
        class={inputClass}
        placeholder={props.placeholder}
        value={props.value}
        onFocus={() => setListing({ type: "open", at: undefined })}
        onBlur={() => setListing({ type: "closed" })}
        onInput={(event) => {
          props.onChange(event.currentTarget.value)
          setListing({ type: "open", at: undefined })
        }}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={() => setComposing(false)}
        onKeyDown={onKeyDown}
      />
      <Show when={open()}>
        <ul
          id={id}
          role="listbox"
          class="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-surface-2 p-1 shadow-lg transition-opacity"
          classList={{ "opacity-40": composing() }}
        >
          <For each={shown()}>
            {(value, index) => (
              <li
                id={`${id}-${String(index())}`}
                role="option"
                aria-selected={at() === index()}
                class="cursor-pointer rounded-sm px-2 py-2 text-sm"
                classList={{ "bg-accent text-accent-contrast": at() === index(), "text-text-secondary": at() !== index() }}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setListing({ type: "open", at: index() })}
                onClick={() => choose(value)}
              >
                {value}
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  )
}
