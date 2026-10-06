import type { JSX } from "solid-js"

/**
 * The border between a pane and the map, dragged to resize the pane. It looks
 * like a 1px line, but its hit area spills over on both sides so it is easy
 * to take hold of. `onPointerDown` comes from createResizable.
 */
export const Splitter = (props: { readonly onPointerDown: (event: PointerEvent) => void }): JSX.Element => (
  <div role="separator" aria-orientation="vertical" class="group relative z-10 w-px shrink-0 cursor-col-resize bg-border" onPointerDown={(event) => props.onPointerDown(event)}>
    <div class="absolute inset-y-0 -left-1 -right-1 transition-colors group-hover:bg-accent/40" />
  </div>
)
