import type { JSX } from "solid-js"

/**
 * The short bar across the top of the frame, and of a page laid over it: what
 * leads the way on the left, what is beside the point on the right.
 */
export const TitleBar = (props: { readonly left: JSX.Element; readonly right?: JSX.Element }): JSX.Element => (
  <div class="relative flex h-8 shrink-0 items-center justify-between gap-1 border-b border-border bg-surface-1 px-1.5 text-[13px]">
    <div class="flex min-w-0 items-center gap-1">{props.left}</div>
    <div class="flex shrink-0 items-center gap-0.5">{props.right}</div>
  </div>
)
