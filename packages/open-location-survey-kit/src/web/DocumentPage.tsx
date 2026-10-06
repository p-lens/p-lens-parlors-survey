/// <reference path="./assets.d.ts" />
import { createResource, For, Show, type JSX } from "solid-js"

import type { Words } from "../core/words"
import type { Credit, SurveyConfig } from "./config"
import { BackIcon } from "./controls"
import { TitleBar } from "./frame/TitleBar"
import { blocksOfMarkdown, type Block, type Inline } from "./markdown"

/**
 * A page to read, laid over the survey rather than in one of its panes: the
 * frame's own title bar with the way back and the page's title, and the text
 * in a column narrow enough to read. The survey stays as it was underneath.
 */
const DocumentPage = (props: { readonly title: string; readonly backLabel: string; readonly onBack: () => void; readonly children: JSX.Element }): JSX.Element => (
  <div class="fixed inset-0 z-40 flex flex-col bg-surface-2 text-text-primary">
    <TitleBar
      left={
        <>
          <button
            type="button"
            class="inline-flex size-7 items-center justify-center rounded text-text-muted hover:bg-surface-3 hover:text-text-primary"
            aria-label={props.backLabel}
            title={props.backLabel}
            onClick={() => props.onBack()}
          >
            <BackIcon class="size-5" />
          </button>
          <h1 class="px-1 text-sm font-bold text-text-primary">{props.title}</h1>
        </>
      }
    />
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-6">{props.children}</div>
    </div>
  </div>
)

const Section = (props: { readonly heading: string; readonly children: JSX.Element }): JSX.Element => (
  <section class="flex flex-col gap-2">
    <h2 class="text-base font-bold">{props.heading}</h2>
    {props.children}
  </section>
)

const InlineRun = (props: { readonly inline: Inline }): JSX.Element => {
  const inline = props.inline
  switch (inline.type) {
    case "text":
      return <>{inline.text}</>
    case "strong":
      return <strong class="font-semibold text-text-primary">{inline.text}</strong>
    case "link":
      return (
        <a class="text-accent underline" href={inline.url} target="_blank" rel="noreferrer">
          {inline.text}
        </a>
      )
  }
}

const Inlines = (props: { readonly inlines: readonly Inline[] }): JSX.Element => <For each={props.inlines}>{(inline) => <InlineRun inline={inline} />}</For>

const HEADING_CLASS: Readonly<Record<1 | 2 | 3, string>> = { 1: "text-lg font-bold", 2: "mt-3 text-base font-bold", 3: "mt-1 text-sm font-bold" }

const BlockView = (props: { readonly block: Block }): JSX.Element => {
  const block = props.block
  switch (block.type) {
    case "heading":
      return (
        <h2 class={HEADING_CLASS[block.level]}>
          <Inlines inlines={block.inlines} />
        </h2>
      )
    case "paragraph":
      return (
        <p class="text-sm leading-relaxed text-text-secondary">
          <Inlines inlines={block.inlines} />
        </p>
      )
    case "list":
      return (
        <ul class="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-text-secondary">
          <For each={block.items}>
            {(item) => (
              <li>
                <Inlines inlines={item} />
              </li>
            )}
          </For>
        </ul>
      )
  }
}

/** The survey's privacy policy, as the survey wrote it. */
export const PrivacyPage = (props: { readonly config: SurveyConfig; readonly onBack: () => void }): JSX.Element => (
  <DocumentPage title={props.config.words.ui.privacy} backLabel={props.config.words.ui.back} onBack={props.onBack}>
    <div class="flex flex-col gap-2">
      <For each={blocksOfMarkdown(props.config.branding.privacy)}>{(block) => <BlockView block={block} />}</For>
    </div>
  </DocumentPage>
)

/**
 * One credited package, with what has to be reproduced in view: its name,
 * which leads to its repository, its version, the licence it declares and its
 * copyright notice. Only the licence
 * in full is folded away, since dozens of them unfolded is a page nobody reads.
 */
const CreditEntry = (props: { readonly credit: Credit; readonly words: Words }): JSX.Element => (
  <li class="flex flex-col gap-1 py-2 text-xs">
    <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <Show when={props.credit.repository} fallback={<span class="text-sm font-semibold text-text-primary">{props.credit.name}</span>}>
        {(repository) => (
          <a class="text-sm font-semibold text-text-primary underline underline-offset-2" href={repository()} target="_blank" rel="noreferrer">
            {props.credit.name}
          </a>
        )}
      </Show>
      <Show when={props.credit.version}>{(version) => <span class="font-mono text-[11px] text-text-muted">{version()}</span>}</Show>
      <span class="text-text-secondary">{props.credit.license ?? props.words.ui.licenseUnstated}</span>
    </div>
    <Show when={props.credit.copyright}>{(line) => <p class="text-text-secondary">{line()}</p>}</Show>
    <Show when={props.credit.text}>
      {(text) => (
        <details class="self-stretch">
          <summary class="cursor-pointer text-text-muted hover:text-text-primary">{props.words.ui.licenseText}</summary>
          <pre class="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-surface-3 p-2 text-[11px] leading-snug text-text-secondary">{text()}</pre>
        </details>
      )}
    </Show>
  </li>
)

/**
 * Whose work the survey stands on: the map and the list with the terms they
 * come under, and every piece of software served with the page, each with its
 * notice and its licence in full.
 */
export const LicensesPage = (props: { readonly config: SurveyConfig; readonly onBack: () => void }): JSX.Element => {
  const [credits] = createResource(async () => (await import("virtual:open-location-survey-kit/credits")).default)
  const words = props.config.words
  return (
    <DocumentPage title={words.ui.licenses} backLabel={words.ui.back} onBack={props.onBack}>
      <Section heading={words.ui.mapAndData}>
        <ul class="flex flex-col gap-1 text-sm text-text-secondary [&_a]:text-accent [&_a]:underline">
          <li innerHTML={props.config.basemap.attribution} />
          <li innerHTML={props.config.branding.listAttribution} />
        </ul>
      </Section>
      <Show when={credits()} fallback={<p class="text-sm text-text-muted">{words.ui.creditsLoading}</p>}>
        {(loaded) => (
          <Section heading={`${words.ui.software}（${loaded().packages.length}）`}>
            <ul class="flex flex-col divide-y divide-border border-y border-border">
              <For each={loaded().packages}>{(credit) => <CreditEntry credit={credit} words={words} />}</For>
            </ul>
            <p class="text-xs text-text-muted">
              {words.ui.creditsCollected} {loaded().collected}
            </p>
          </Section>
        )}
      </Show>
    </DocumentPage>
  )
}
