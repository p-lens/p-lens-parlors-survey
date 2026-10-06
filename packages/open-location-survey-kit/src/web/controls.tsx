import { splitProps, type JSX } from "solid-js"

type ButtonTone = "primary" | "secondary" | "danger" | "outline"

const TONES: Readonly<Record<ButtonTone, string>> = {
  primary: "bg-accent text-accent-contrast hover:bg-accent-hover",
  secondary: "bg-surface-3 text-text-primary hover:bg-surface-0",
  danger: "bg-surface-3 text-negative hover:bg-surface-0",
  outline: "border border-accent text-accent hover:bg-surface-3",
}

/** How much room a button takes: the form's own, or less where it sits over the map and every row it takes is map hidden. */
type ButtonSize = "regular" | "compact"

const SIZES: Readonly<Record<ButtonSize, string>> = {
  regular: "px-4 py-2.5",
  compact: "px-2 py-2",
}

export const Button = (props: JSX.ButtonHTMLAttributes<HTMLButtonElement> & { readonly tone?: ButtonTone; readonly size?: ButtonSize }): JSX.Element => {
  const [own, rest] = splitProps(props, ["tone", "size", "class"])
  return (
    <button
      type="button"
      {...rest}
      class={`rounded-md text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${SIZES[own.size ?? "regular"]} ${TONES[own.tone ?? "secondary"]} ${own.class ?? ""}`}
    />
  )
}

/** A window with its side panel marked off: the sign for putting the list away and bringing it back. */
export const PanelIcon = (props: { readonly class?: string }): JSX.Element => (
  <svg class={`shrink-0 ${props.class ?? ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18" />
  </svg>
)

/** A chevron pointing back the way one came. */
export const BackIcon = (props: { readonly class?: string }): JSX.Element => (
  <svg class={`shrink-0 ${props.class ?? ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="m15 18-6-6 6-6" />
  </svg>
)

/** A magnifying glass: the sign for a box that searches. */
export const SearchIcon = (props: { readonly class?: string }): JSX.Element => (
  <svg class={`shrink-0 ${props.class ?? ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

/** A question mark in a ring: the sign for what something is and whose it is. */
export const HelpIcon = (props: { readonly class?: string }): JSX.Element => (
  <svg class={`shrink-0 ${props.class ?? ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </svg>
)

/** A funnel: the sign for narrowing a list down, filled while it is narrowed. */
export const FilterIcon = (props: { readonly class?: string; readonly filled: boolean }): JSX.Element => (
  <svg class={`shrink-0 ${props.class ?? ""}`} viewBox="0 0 24 24" fill={props.filled ? "currentColor" : "none"} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
  </svg>
)

/** A sight closed on a point: the sign for going to where the person is. */
export const LocateIcon = (props: { readonly class?: string }): JSX.Element => (
  <svg class={`shrink-0 ${props.class ?? ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
)

export const PlusIcon = (props: { readonly class?: string }): JSX.Element => (
  <svg class={`shrink-0 ${props.class ?? ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

/** A ✕ in the corner of what it puts away. */
export const CloseButton = (props: { readonly label: string; readonly onClick: () => void }): JSX.Element => (
  <button
    type="button"
    class="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
    aria-label={props.label}
    title={props.label}
    onClick={() => props.onClick()}
  >
    <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  </button>
)

export const FieldBox = (props: { readonly label: string; readonly hint?: string | undefined; readonly children: JSX.Element }): JSX.Element => (
  <label class="flex flex-col gap-1">
    <span class="text-xs font-semibold text-text-secondary">{props.label}</span>
    {props.children}
    {props.hint === undefined ? null : <span class="text-xs text-text-muted">{props.hint}</span>}
  </label>
)

export const inputClass = "w-full rounded-md border border-border bg-surface-input px-3 py-2 text-base text-text-primary placeholder:text-text-muted"

export const TextInput = (props: JSX.InputHTMLAttributes<HTMLInputElement>): JSX.Element => {
  const [own, rest] = splitProps(props, ["class"])
  return <input {...rest} class={`${inputClass} ${own.class ?? ""}`} />
}

export const Check = (props: { readonly checked: boolean; readonly onChange: (checked: boolean) => void; readonly children: JSX.Element }): JSX.Element => (
  <label class="flex items-start gap-2 text-sm text-text-primary">
    <input type="checkbox" class="mt-1 h-4 w-4 shrink-0 accent-accent" checked={props.checked} onChange={(event) => props.onChange(event.currentTarget.checked)} />
    <span>{props.children}</span>
  </label>
)
