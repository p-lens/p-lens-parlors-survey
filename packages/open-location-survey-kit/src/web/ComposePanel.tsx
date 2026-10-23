import { createEffect, createSignal, For, Index, Match, on, Show, Switch, type JSX } from "solid-js"

import type { Source } from "../core/observation"
import { problemText } from "../core/problem-text"
import { columnLabel, type Column, type Problem, type Field } from "../core/schema"
import type { SurveyConfig } from "./config"
import { Button, Check, CloseButton, FieldBox, FieldGroup, inputClass, TextInput } from "./controls"
import { OfferedInput } from "./OfferedInput"
import type { Offers } from "./offered"
import { createDebounced } from "./debounce"
import { dayAfter, emptyValue, listedValue, newRow, rowAfter, rowSettled, type Draft, type DraftValue, type RowDraft } from "./draft"
import { Turnstile } from "./Turnstile"

/** Where a report being written stands: being edited, on its way, or refused with what to fix. */
export type Sending = { readonly type: "editing" } | { readonly type: "sending" } | { readonly type: "failed"; readonly message: string; readonly problems: readonly Problem[] }

/** The line drawn among a choice's options: an option that cannot be chosen, since a line itself shows in no phone's picker. */
const OPTION_BREAK = "──────"

const FieldInput = (props: {
  readonly field: Field
  readonly value: DraftValue | undefined
  readonly placeholder?: string | undefined
  /** What others have already given for it, offered as it is typed. */
  readonly offers?: readonly string[] | undefined
  readonly onChange: (value: DraftValue) => void
}): JSX.Element => {
  const text = (): string => (typeof props.value === "string" ? props.value : "")
  return (
    <Switch>
      <Match when={props.field.kind.type === "choice" ? props.field.kind : undefined}>
        {(kind) => (
          <select class={inputClass} value={text()} onChange={(event) => props.onChange(event.currentTarget.value)}>
            <option value="">—</option>
            <For each={kind().options}>
              {(option, at) => (
                <>
                  <Show when={kind().breaks?.includes(at())}>
                    <option disabled>{OPTION_BREAK}</option>
                  </Show>
                  <option value={option}>{option}</option>
                </>
              )}
            </For>
          </select>
        )}
      </Match>
      <Match when={props.field.kind.type === "flag"}>
        <input type="checkbox" class="h-4 w-4 accent-accent" checked={props.value === true} onChange={(event) => props.onChange(event.currentTarget.checked)} />
      </Match>
      <Match when={props.field.kind.type === "number" ? props.field.kind : undefined}>
        {(kind) => <TextInput type="number" inputMode="decimal" min={kind().min} max={kind().max} placeholder={props.placeholder} value={text()} onInput={(event) => props.onChange(event.currentTarget.value)} />}
      </Match>
      <Match when={props.field.kind.type === "text" && props.offers !== undefined && props.offers.length > 0 ? props.offers : undefined}>
        {(offers) => <OfferedInput value={text()} offers={offers()} placeholder={props.placeholder} onChange={props.onChange} />}
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

/** One cell of a row under its label. A text that fills other cells says when what it holds has stood still. */
const Cell = (props: { readonly column: Column; readonly row: RowDraft; readonly onChange: (value: string) => void; readonly onSettled: () => void }): JSX.Element => {
  if (props.column.kind.type === "text" && props.column.fills !== undefined) {
    const settled = createDebounced(() => props.row[props.column.key] ?? "")
    createEffect(on(settled, () => props.onSettled(), { defer: true }))
  }
  return (
    <FieldBox label={cellLabel(props.column, props.row)}>
      <FieldInput field={{ ...props.column, amendable: false }} value={props.row[props.column.key] ?? ""} placeholder={props.column.placeholder} onChange={(value) => props.onChange(typeof value === "string" ? value : "")} />
    </FieldBox>
  )
}

/**
 * A table a person adds rows to. Each row is its columns' cells two
 * abreast, so a row of four is two lines on a phone; the columns few rows
 * need are put away behind a small button each group, brought out by it and
 * put away again, emptied, by the ✕ beside them. A row added holds its
 * columns' initial values. A row has nothing to remove it by: one left
 * empty, or holding only what it was added with, is not sent. One more row is added below
 * until the table holds as many as it may; what is put away beside the
 * table is brought out from the far end of that line. Rows are kept by
 * where they stand, so typing in a cell rebuilds nothing.
 */
const RowsInput = (props: {
  readonly kind: RowsKind
  readonly rows: readonly RowDraft[]
  readonly addRow: string
  readonly aside: JSX.Element
  readonly onChange: (rows: readonly RowDraft[]) => void
}): JSX.Element => {
  const [brought, setBrought] = createSignal<readonly string[]>([])
  const columns = (): readonly Column[] => props.kind.columns
  const setRow = (at: number, changed: RowDraft): void => props.onChange(props.rows.map((row, index) => (index === at ? changed : row)))
  const settle = (at: number, row: RowDraft, key: string): void => {
    const settled = rowSettled(columns(), row, key)
    if (settled !== row) setRow(at, settled)
  }
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
                {(column) => <Cell column={column} row={row()} onChange={(value) => setRow(at, rowAfter(columns(), row(), column.key, value))} onSettled={() => settle(at, row(), column.key)} />}
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
                      <For each={tuckedIn(group)}>{(column) => <Cell column={column} row={row()} onChange={(value) => setRow(at, rowAfter(columns(), row(), column.key, value))} onSettled={() => settle(at, row(), column.key)} />}</For>
                    </div>
                    <CloseButton label={words.away} onClick={() => putAway(at, group, row())} />
                  </div>
                </Show>
              )}
            </For>
          </div>
        )}
      </Index>
      <div class="flex flex-wrap items-center gap-2">
        <Show when={props.rows.length < props.kind.maxCount}>
          <Button tone="outline" size="compact" onClick={() => props.onChange([...props.rows, newRow(columns())])}>
            {props.kind.add ?? props.addRow}
          </Button>
        </Show>
        <div class="ml-auto flex gap-2">{props.aside}</div>
      </div>
    </div>
  )
}

/** A field's label as the form shows it: with its unit, and marked when a new thing may leave it out. */
const labelOf = (field: Field, draft: Draft, optional: string): string =>
  `${field.label}${field.kind.type === "number" && field.kind.unit !== undefined ? `（${field.kind.unit}）` : ""}${draft.kind === "add" && !field.required ? optional : ""}`

/** Whether a field's value as the form holds it says anything. */
const filled = (value: DraftValue | undefined): boolean => (typeof value === "string" ? value !== "" : value === true || (Array.isArray(value) && value.length > 0))

/**
 * A table with the fields put away beside it: each brought out by its
 * button facing the table's own, or shown already where it holds
 * something, under the table, and put away again, emptied, by the small
 * ✕ at the end of its label's line.
 */
const TableWithBeside = (props: {
  readonly field: Field
  readonly kind: RowsKind
  readonly beside: readonly Field[]
  readonly draft: Draft
  readonly words: SurveyConfig["words"]
  readonly offers: Offers
  readonly setValue: (key: string, value: DraftValue) => void
}): JSX.Element => {
  const [brought, setBrought] = createSignal<readonly string[]>([])
  const out = (field: Field): boolean => brought().includes(field.key) || filled(props.draft.values[field.key])
  const putAway = (field: Field): void => {
    setBrought(brought().filter((key) => key !== field.key))
    props.setValue(field.key, emptyValue(field))
  }
  return (
    <FieldGroup label={labelOf(props.field, props.draft, props.words.ui.optional)} hint={props.field.hint}>
      <div class="flex flex-col gap-2">
      <RowsInput
        kind={props.kind}
        rows={((value) => (typeof value === "object" ? value : []))(props.draft.values[props.field.key])}
        addRow={props.words.ui.addRow}
        aside={
          <For each={props.beside.filter((field) => !out(field))}>
            {(field) => (
              <Button tone="outline" size="compact" onClick={() => setBrought([...brought(), field.key])}>
                {field.tuckedBeside?.add}
              </Button>
            )}
          </For>
        }
        onChange={(rows) => props.setValue(props.field.key, rows)}
      />
      <For each={props.beside.filter(out)}>
        {(field) => (
          <div class="flex flex-col gap-1" role="group" aria-label={labelOf(field, props.draft, props.words.ui.optional)}>
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-semibold text-text-secondary">{labelOf(field, props.draft, props.words.ui.optional)}</span>
              <CloseButton label={field.tuckedBeside?.away ?? ""} size="small" onClick={() => putAway(field)} />
            </div>
            <FieldInput field={field} value={props.draft.values[field.key]} offers={props.offers[field.key]} onChange={(value) => props.setValue(field.key, value)} />
            <Show when={field.hint}>{(hint) => <span class="text-xs text-text-muted">{hint()}</span>}</Show>
          </div>
        )}
      </For>
      </div>
    </FieldGroup>
  )
}

/** The fields a report asks for: every field for a new thing, the correctable ones for a correction. Photos wait for a place to keep them. */
const fieldsFor = (config: SurveyConfig, draft: Draft): readonly Field[] =>
  config.schema.fields.filter((field) => field.kind.type !== "photo" && (draft.kind === "add" || (draft.kind === "amend" && field.amendable)))

/** The correctable fields a correction asks for only when asked to, kept apart from the rest of its form. */
const askedFields = (config: SurveyConfig, draft: Draft): readonly Field[] =>
  draft.kind === "amend" ? fieldsFor(config, draft).filter((field) => field.askedInCorrection !== undefined) : []

/** The fields in the order the form shows them: those asked for only when asked to come after the last that is not a table. */
const formFields = (config: SurveyConfig, draft: Draft): readonly Field[] => {
  const asked = askedFields(config, draft)
  const rest = fieldsFor(config, draft).filter((field) => field.tuckedBeside === undefined && !asked.includes(field))
  const at = rest.findLastIndex((field) => field.kind.type !== "rows") + 1
  return [...rest.slice(0, at), ...asked, ...rest.slice(at)]
}

/** A field's value as the list has it, where it is text to show. */
const listedText = (draft: Draft, field: Field): string | undefined => {
  const value = listedValue(draft, field)
  return typeof value === "string" && value !== "" ? value : undefined
}

/**
 * A field a correction asks for only when asked to: the button at the right
 * that brings it out, or the field, shown already where it holds something
 * else than the list, with the small ✕ that puts it back as the list has it.
 */
const AskedField = (props: {
  readonly field: Field
  readonly draft: Draft
  readonly offers: Offers
  readonly setValue: (key: string, value: DraftValue) => void
}): JSX.Element => {
  const [asked, setAsked] = createSignal(false)
  const out = (): boolean => asked() || JSON.stringify(props.draft.values[props.field.key]) !== JSON.stringify(listedValue(props.draft, props.field))
  const putBack = (): void => {
    setAsked(false)
    props.setValue(props.field.key, listedValue(props.draft, props.field))
  }
  return (
    <Show
      when={out()}
      fallback={
        <div class="flex justify-end">
          <Button tone="outline" size="compact" onClick={() => setAsked(true)}>
            {props.field.askedInCorrection?.ask}
          </Button>
        </div>
      }
    >
      <div class="flex flex-col gap-1" role="group" aria-label={props.field.label}>
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-semibold text-text-secondary">{props.field.label}</span>
          <CloseButton label={props.field.askedInCorrection?.away ?? ""} size="small" onClick={putBack} />
        </div>
        <FieldInput field={props.field} value={props.draft.values[props.field.key]} offers={props.offers[props.field.key]} onChange={(value) => props.setValue(props.field.key, value)} />
        <Show when={props.field.hint}>{(hint) => <span class="text-xs text-text-muted">{hint()}</span>}</Show>
      </div>
    </Show>
  )
}

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

const SourceFields = (props: { readonly config: SurveyConfig; readonly source: Source; readonly onChange: (source: Source) => void }): JSX.Element => {
  const words = props.config.words
  const options: readonly { readonly source: Source; readonly label: string }[] = [
    { source: { kind: "on-site" }, label: words.sources.onSite },
    { source: { kind: "publication" }, label: words.sources.publication },
    { source: { kind: "other" }, label: words.sources.other },
  ]
  return (
    <fieldset class="flex flex-col gap-2">
      <legend class="mb-1 text-xs font-semibold text-text-secondary">{words.ui.howKnown}</legend>
      <For each={options}>
        {(option) => (
          <label class="flex items-center gap-2 text-sm text-text-primary">
            <input type="radio" name="source" class="accent-accent" checked={props.source.kind === option.source.kind} onChange={() => props.onChange(option.source)} />
            {option.label}
          </label>
        )}
      </For>
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
  /** What each field offers, as far as it has been read. */
  readonly offers: Offers
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
        <For each={askedFields(props.config, props.draft)}>{(field) => <Show when={listedText(props.draft, field)}>{(text) => <p class="text-sm text-text-secondary">{text()}</p>}</Show>}</For>
      </div>

      <For each={formFields(props.config, props.draft)}>
        {(field) => (
          <Show
            when={field.askedInCorrection === undefined || props.draft.kind !== "amend"}
            fallback={<AskedField field={field} draft={props.draft} offers={props.offers} setValue={setValue} />}
          >
            <Show
              when={field.kind.type === "rows" ? field.kind : undefined}
              fallback={
                <FieldBox label={labelOf(field, props.draft, words.ui.optional)} hint={field.hint}>
                  <FieldInput field={field} value={props.draft.values[field.key]} offers={props.offers[field.key]} onChange={(value) => setValue(field.key, value)} />
                </FieldBox>
              }
            >
              {(kind) => (
                <TableWithBeside
                  field={field}
                  kind={kind()}
                  beside={fieldsFor(props.config, props.draft).filter((other) => other.tuckedBeside?.field === field.key)}
                  draft={props.draft}
                  words={words}
                  offers={props.offers}
                  setValue={setValue}
                />
              )}
            </Show>
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
