import { createSignal, For, Index, Match, Show, Switch, type JSX } from "solid-js"

import { problemText } from "../core/problem-text"
import { columnLabel, type Column, type Problem, type Field } from "../core/schema"
import type { SurveyConfig } from "./config"
import { Button, Check, CloseButton, FieldBox, FieldGroup, inputClass, TextInput } from "./controls"
import { dayAfter, rowAfter, type Draft, type DraftValue, type RowDraft, type SourceDraft } from "./draft"
import { Turnstile } from "./Turnstile"

/** Where a report being written stands: being edited, on its way, or refused with what to fix. */
export type Sending = { readonly type: "editing" } | { readonly type: "sending" } | { readonly type: "failed"; readonly message: string; readonly problems: readonly Problem[] }

const FieldInput = (props: { readonly field: Field; readonly value: DraftValue | undefined; readonly placeholder?: string | undefined; readonly onChange: (value: DraftValue) => void }): JSX.Element => {
  const text = (): string => (typeof props.value === "string" ? props.value : "")
  return (
    <Switch>
      <Match when={props.field.kind.type === "choice" ? props.field.kind : undefined}>
        {(kind) => (
          <select class={inputClass} value={text()} onChange={(event) => props.onChange(event.currentTarget.value)}>
            <option value="">—</option>
            <For each={kind().options}>{(option) => <option value={option}>{option}</option>}</For>
          </select>
        )}
      </Match>
      <Match when={props.field.kind.type === "flag"}>
        <input type="checkbox" class="h-4 w-4 accent-accent" checked={props.value === true} onChange={(event) => props.onChange(event.currentTarget.checked)} />
      </Match>
      <Match when={props.field.kind.type === "number" ? props.field.kind : undefined}>
        {(kind) => <TextInput type="number" inputMode="decimal" min={kind().min} max={kind().max} placeholder={props.placeholder} value={text()} onInput={(event) => props.onChange(event.currentTarget.value)} />}
      </Match>
      <Match when={props.field.kind.type === "text" || props.field.kind.type === "kana" || props.field.kind.type === "words"}>
        <TextInput placeholder={props.placeholder} value={text()} onInput={(event) => props.onChange(event.currentTarget.value)} />
      </Match>
    </Switch>
  )
}

/** A column's label over its cell in one row, with its unit. */
const cellLabel = (column: Column, row: RowDraft): string => `${columnLabel(column, row)}${column.kind.type === "number" && column.kind.unit !== undefined ? `（${column.kind.unit}）` : ""}`

type RowsKind = Extract<Field["kind"], { readonly type: "rows" }>

/** One cell of a row under its label. */
const Cell = (props: { readonly column: Column; readonly row: RowDraft; readonly onChange: (value: string) => void }): JSX.Element => (
  <FieldBox label={cellLabel(props.column, props.row)}>
    <FieldInput field={{ ...props.column, amendable: false }} value={props.row[props.column.key] ?? ""} placeholder={props.column.placeholder} onChange={(value) => props.onChange(typeof value === "string" ? value : "")} />
  </FieldBox>
)

/**
 * A table a person adds rows to. Each row is its columns' cells two
 * abreast, so a row of four is two lines on a phone; the columns few rows
 * need are put away behind a small button each group, brought out by it and
 * put away again, emptied, by the ✕ beside them. A row has nothing to
 * remove it by: one left empty is not sent. One more row is added below
 * until the table holds as many as it may. Rows are kept by where they
 * stand, so typing in a cell rebuilds nothing.
 */
const RowsInput = (props: { readonly kind: RowsKind; readonly rows: readonly RowDraft[]; readonly addRow: string; readonly onChange: (rows: readonly RowDraft[]) => void }): JSX.Element => {
  const [brought, setBrought] = createSignal<readonly string[]>([])
  const columns = (): readonly Column[] => props.kind.columns
  const setRow = (at: number, changed: RowDraft): void => props.onChange(props.rows.map((row, index) => (index === at ? changed : row)))
  const tuckedIn = (group: string): readonly Column[] => columns().filter((column) => column.tucked === group)
  const out = (at: number, group: string, row: RowDraft): boolean => brought().includes(`${String(at)}:${group}`) || tuckedIn(group).some((column) => (row[column.key] ?? "") !== "")
  const putAway = (at: number, group: string, row: RowDraft): void => {
    setBrought(brought().filter((key) => key !== `${String(at)}:${group}`))
    setRow(at, { ...row, ...Object.fromEntries(tuckedIn(group).map((column) => [column.key, ""] as const)) })
  }
  return (
    <div class="flex flex-col gap-2">
      <Index each={props.rows}>
        {(row, at) => (
          <div class="flex flex-col gap-2 rounded-md border border-border p-2">
            <div class="grid grid-cols-2 gap-2">
              <For each={columns().filter((column) => column.tucked === undefined)}>
                {(column) => <Cell column={column} row={row()} onChange={(value) => setRow(at, rowAfter(columns(), row(), column.key, value))} />}
              </For>
            </div>
            <For each={Object.entries(props.kind.tucks ?? {})}>
              {([group, words]) => (
                <Show
                  when={out(at, group, row())}
                  fallback={
                    <div>
                      <button type="button" class="text-xs text-accent underline underline-offset-2" onClick={() => setBrought([...brought(), `${String(at)}:${group}`])}>
                        {words.add}
                      </button>
                    </div>
                  }
                >
                  <div class="flex items-end gap-1">
                    <div class="grid min-w-0 flex-1 grid-cols-2 gap-2">
                      <For each={tuckedIn(group)}>{(column) => <Cell column={column} row={row()} onChange={(value) => setRow(at, rowAfter(columns(), row(), column.key, value))} />}</For>
                    </div>
                    <CloseButton label={words.away} onClick={() => putAway(at, group, row())} />
                  </div>
                </Show>
              )}
            </For>
          </div>
        )}
      </Index>
      <Show when={props.rows.length < props.kind.maxCount}>
        <div>
          <Button tone="outline" size="compact" onClick={() => props.onChange([...props.rows, {}])}>
            {props.kind.add ?? props.addRow}
          </Button>
        </div>
      </Show>
    </div>
  )
}

/** A field's label as the form shows it: with its unit, and marked when a new thing may leave it out. */
const labelOf = (field: Field, draft: Draft, optional: string): string =>
  `${field.label}${field.kind.type === "number" && field.kind.unit !== undefined ? `（${field.kind.unit}）` : ""}${draft.kind === "add" && !field.required ? optional : ""}`

/** The fields a report asks for: every field for a new thing, the correctable ones for a correction. Photos wait for a place to keep them. */
const fieldsFor = (config: SurveyConfig, draft: Draft): readonly Field[] =>
  config.schema.fields.filter((field) => field.kind.type !== "photo" && (draft.kind === "add" || (draft.kind === "amend" && field.amendable)))

const PositionRow = (props: { readonly config: SurveyConfig; readonly draft: Draft; readonly onPlace: () => void }): JSX.Element => {
  const words = props.config.words
  return (
    <FieldBox label={words.position}>
      <Show
        when={props.draft.position}
        fallback={
          <Button tone="primary" onClick={() => props.onPlace()}>
            {words.ui.placeOnMap}
          </Button>
        }
      >
        {(position) => (
          <div class="flex items-center justify-between gap-2 rounded-md bg-surface-3 px-3 py-2">
            <span class="text-sm text-text-primary">
              {position().latitude.toFixed(6)}, {position().longitude.toFixed(6)}
              <span class="ml-2 text-xs text-text-muted">{position().method === "gps" ? words.gps : words.pin}</span>
            </span>
            <button type="button" class="text-sm text-accent" onClick={() => props.onPlace()}>
              {words.ui.placeAgain}
            </button>
          </div>
        )}
      </Show>
    </FieldBox>
  )
}

const SourceFields = (props: { readonly config: SurveyConfig; readonly source: SourceDraft; readonly onChange: (source: SourceDraft) => void }): JSX.Element => {
  const words = props.config.words
  const options: readonly { readonly kind: SourceDraft["kind"]; readonly label: string }[] = [
    { kind: "on-site", label: words.sources.onSite },
    { kind: "publication", label: words.sources.publication },
    { kind: "other", label: words.sources.other },
  ]
  return (
    <fieldset class="flex flex-col gap-2">
      <legend class="mb-1 text-xs font-semibold text-text-secondary">{words.ui.howKnown}</legend>
      <For each={options}>
        {(option) => (
          <label class="flex items-center gap-2 text-sm text-text-primary">
            <input type="radio" name="source" class="accent-accent" checked={props.source.kind === option.kind} onChange={() => props.onChange({ ...props.source, kind: option.kind })} />
            {option.label}
          </label>
        )}
      </For>
      <Show when={props.source.kind === "publication"}>
        <TextInput type="url" placeholder={words.ui.publicationPlaceholder} value={props.source.url} onInput={(event) => props.onChange({ ...props.source, url: event.currentTarget.value })} />
      </Show>
      <Show when={props.source.kind === "other"}>
        <TextInput placeholder={words.ui.otherPlaceholder} value={props.source.note} onInput={(event) => props.onChange({ ...props.source, note: event.currentTarget.value })} />
      </Show>
      <p class="text-xs text-text-muted">{words.sourceHint}</p>
    </fieldset>
  )
}

/**
 * The form a report is written in, whatever it reports: the fields its kind
 * needs, a position when it places something, how it was learned, the day,
 * and the two consents.
 */
export const ComposePanel = (props: {
  readonly config: SurveyConfig
  readonly draft: Draft
  readonly sending: Sending
  readonly today: string
  readonly onChange: (draft: Draft) => void
  readonly onPlace: () => void
  readonly onTurnstile: (token: string | undefined) => void
  readonly onSend: () => void
}): JSX.Element => {
  const words = props.config.words
  const set = (patch: Partial<Draft>): void => props.onChange({ ...props.draft, ...patch })
  const setValue = (key: string, value: DraftValue): void => set({ values: { ...props.draft.values, [key]: value } })
  return (
    <form
      class="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        props.onSend()
      }}
    >
      <div>
        <h2 class="text-lg font-bold text-text-primary">{words.observations[props.draft.kind]}</h2>
        <Show when={props.draft.subject}>{(subject) => <p class="text-sm text-text-secondary">{subject().name}</p>}</Show>
      </div>

      <For each={fieldsFor(props.config, props.draft)}>
        {(field) => (
          <Show
            when={field.kind.type === "rows" ? field.kind : undefined}
            fallback={
              <FieldBox label={labelOf(field, props.draft, words.ui.optional)} hint={field.hint}>
                <FieldInput field={field} value={props.draft.values[field.key]} onChange={(value) => setValue(field.key, value)} />
              </FieldBox>
            }
          >
            {(kind) => (
              <FieldGroup label={labelOf(field, props.draft, words.ui.optional)} hint={field.hint}>
                <RowsInput kind={kind()} rows={((value) => (typeof value === "object" ? value : []))(props.draft.values[field.key])} addRow={words.ui.addRow} onChange={(rows) => setValue(field.key, rows)} />
              </FieldGroup>
            )}
          </Show>
        )}
      </For>

      <Show when={props.draft.kind === "add" || props.draft.kind === "locate"}>
        <PositionRow config={props.config} draft={props.draft} onPlace={props.onPlace} />
      </Show>
      <Show when={props.draft.kind === "gone"}>
        <p class="text-sm text-text-secondary">{words.ui.goneGuide}</p>
      </Show>

      <SourceFields config={props.config} source={props.draft.source} onChange={(source) => set({ source })} />

      <FieldBox label={words.observedOn}>
        <TextInput type="date" max={dayAfter(props.today, props.config.schema.observedAhead ?? 0)} value={props.draft.observedOn} onInput={(event) => set({ observedOn: event.currentTarget.value })} />
      </FieldBox>

      <div class="flex flex-col gap-2 rounded-md border border-border p-3">
        <Check checked={props.draft.cc0} onChange={(cc0) => set({ cc0 })}>
          {words.consentCc0}
        </Check>
        <Check checked={props.draft.notCopied} onChange={(notCopied) => set({ notCopied })}>
          {words.consentNotCopied}
        </Check>
      </div>

      <Show when={props.config.turnstileKey}>{(key) => <Turnstile siteKey={key()} onToken={props.onTurnstile} />}</Show>

      <Show when={props.sending.type === "failed" ? props.sending : undefined}>
        {(failed) => (
          <div class="rounded-md bg-surface-3 px-3 py-2 text-sm text-negative" role="alert">
            <p class="font-semibold">{failed().message}</p>
            <ul class="mt-1 list-disc pl-5">
              <For each={failed().problems}>{(problem) => <li>{problemText(problem, props.config.schema, words)}</li>}</For>
            </ul>
          </div>
        )}
      </Show>

      <Button type="submit" tone="primary" disabled={props.sending.type === "sending"}>
        {props.sending.type === "sending" ? words.ui.sending : words.ui.send}
      </Button>
    </form>
  )
}
