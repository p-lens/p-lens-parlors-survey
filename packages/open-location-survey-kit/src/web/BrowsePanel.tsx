import { createMemo, createSignal, For, Show, type JSX } from "solid-js"

import type { ListedSubject } from "../core/listed"
import type { SurveyConfig } from "./config"
import { Button, FilterIcon, inputClass, SearchIcon, TextInput } from "./controls"
import type { SurveyList } from "./list"
import { searchSubjects } from "./search"

const LONGEST_WAITING = 200

type Locating = { readonly type: "idle" } | { readonly type: "locating" } | { readonly type: "failed" }

const SubjectRow = (props: { readonly subject: ListedSubject; readonly config: SurveyConfig; readonly onPick: (subject: ListedSubject) => void }): JSX.Element => (
  <li>
    <button type="button" class="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-surface-3" onClick={() => props.onPick(props.subject)}>
      <span class="flex w-full items-center gap-2">
        <span class="truncate text-sm font-semibold text-text-primary">{props.subject.name}</span>
        <Show when={props.subject.position === undefined}>
          <span class="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold text-warning">{props.config.words.ui.unplaced}</span>
        </Show>
      </span>
      <span class="w-full truncate text-xs text-text-muted">{props.config.summarize(props.subject)}</span>
    </button>
  </li>
)

/** The choice field a survey's list is narrowed by, if it names one. */
const groupField = (config: SurveyConfig): { readonly label: string; readonly options: readonly string[] } | undefined => {
  const field = config.schema.fields.find((candidate) => candidate.key === config.groupField)
  return field?.kind.type === "choice" ? { label: field.label, options: field.kind.options } : undefined
}

/**
 * Where a survey starts: what it is for — or, for a person a caller sent,
 * what reporting here does for where they came from — a way to the map around the person
 * and a new report, then search every listed thing, or go through those still
 * waiting for a position. A survey that names a group field has a filter
 * beside the search, which narrows both to one group.
 */
export const BrowsePanel = (props: {
  readonly config: SurveyConfig
  readonly list: SurveyList
  /** What a person a caller sent reads above the list, in place of what the survey says of itself; none when nobody sent them. */
  readonly callerNote: string | undefined
  /** What the search holds: kept above the panel, so it is still there when the list is come back to. */
  readonly query: string
  readonly onQuery: (query: string) => void
  readonly onPick: (subject: ListedSubject) => void
  readonly onAdd: (() => void) | undefined
  /** Shows the map where the person is; false when the device would not say. */
  readonly onLocate: () => Promise<boolean>
}): JSX.Element => {
  const [locating, setLocating] = createSignal<Locating>({ type: "idle" })
  const locate = async (): Promise<void> => {
    setLocating({ type: "locating" })
    setLocating((await props.onLocate()) ? { type: "idle" } : { type: "failed" })
  }
  const grouping = groupField(props.config)
  const query = (): string => props.query
  const [filter, setFilter] = createSignal<"closed" | "open">("closed")
  const [group, setGroup] = createSignal<string | undefined>()
  const inGroup = (subject: ListedSubject): boolean => group() === undefined || subject.attributes[props.config.groupField ?? ""] === group()
  const found = createMemo(() => searchSubjects([...props.list.placed, ...props.list.unplaced].filter(inGroup), props.config.schema, query()))
  const waiting = createMemo(() => props.list.unplaced.filter(inGroup))
  const words = props.config.words.ui

  return (
    <div class="flex h-full flex-col gap-3">
      <p class="text-sm text-text-secondary">{props.callerNote ?? props.config.branding.description}</p>
      <div class="flex gap-2">
        <Button class="min-w-0 flex-1" onClick={() => void locate()} disabled={locating().type === "locating"}>
          {locating().type === "locating" ? words.locating : words.here}
        </Button>
        <Show when={props.onAdd}>
          {(add) => (
            <Button tone="primary" class="min-w-0 flex-1" title={props.config.words.observations.add} onClick={() => add()()}>
              ＋ {words.add}
            </Button>
          )}
        </Show>
      </div>
      <Show when={locating().type === "failed"}>
        <p class="text-sm text-negative">{words.hereFailed}</p>
      </Show>
      <hr class="border-border" />
      <div class="flex gap-2">
        <label class="relative min-w-0 flex-1">
          <SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <TextInput type="search" class="pl-9" placeholder={words.search} value={query()} onInput={(event) => props.onQuery(event.currentTarget.value)} />
        </label>
        <Show when={grouping}>
          <button
            type="button"
            class={`relative inline-flex aspect-square shrink-0 items-center justify-center self-stretch rounded-md transition-colors hover:bg-surface-3 hover:text-text-primary ${
              group() === undefined ? "text-text-muted" : "text-text-primary"
            } ${filter() === "open" ? "bg-surface-3" : ""}`}
            aria-label={words.filter}
            aria-expanded={filter() === "open"}
            title={words.filter}
            onClick={() => setFilter((was) => (was === "open" ? "closed" : "open"))}
          >
            <FilterIcon class="size-5" filled={group() !== undefined} />
            <Show when={group() !== undefined}>
              <span class="absolute right-1.5 top-1.5 size-2 rounded-full bg-text-primary ring-2 ring-surface-1" aria-hidden="true" />
            </Show>
          </button>
        </Show>
      </div>
      <Show when={filter() === "open" ? grouping : undefined}>
        {(field) => (
          <div class="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3">
            <div class="flex items-center justify-between gap-2">
              <span class="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <FilterIcon class="size-3.5" filled={false} />
                {words.filter}
              </span>
              <Show when={group() !== undefined}>
                <button type="button" class="rounded px-1.5 py-0.5 text-xs font-semibold text-text-secondary hover:bg-surface-3 hover:text-text-primary" onClick={() => setGroup(undefined)}>
                  {words.clearFilter}
                </button>
              </Show>
            </div>
            <label class="flex items-center gap-3">
              <span class="shrink-0 text-sm text-text-primary">{field().label}</span>
              <select class={`${inputClass} min-w-0 flex-1 py-1.5`} value={group() ?? ""} onChange={(event) => setGroup(event.currentTarget.value === "" ? undefined : event.currentTarget.value)}>
                <option value="">
                  {field().label}
                  {words.chooseGroup}
                </option>
                <For each={field().options}>{(option) => <option value={option}>{option}</option>}</For>
              </select>
            </label>
          </div>
        )}
      </Show>
      <Show
        when={query().trim() !== ""}
        fallback={
          <Show when={props.list.unplaced.length > 0}>
            <div class="flex min-h-0 flex-1 flex-col gap-2">
              <div class="flex items-center gap-2">
                <span class="shrink-0 text-xs font-semibold text-text-secondary">{words.waiting}</span>
                <span class="shrink-0 text-xs text-text-muted">{waiting().length}</span>
              </div>
              <Show when={waiting().length > 0} fallback={<p class="px-3 text-sm text-text-muted">{words.noneWaiting}</p>}>
                <ul class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                  <For each={waiting().slice(0, LONGEST_WAITING)}>{(subject) => <SubjectRow subject={subject} config={props.config} onPick={props.onPick} />}</For>
                </ul>
              </Show>
            </div>
          </Show>
        }
      >
        <Show when={found().length > 0} fallback={<p class="px-3 text-sm text-text-muted">{words.notFound}</p>}>
          <ul class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <For each={found()}>{(subject) => <SubjectRow subject={subject} config={props.config} onPick={props.onPick} />}</For>
          </ul>
        </Show>
      </Show>
    </div>
  )
}
