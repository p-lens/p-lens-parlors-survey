import { createEffect, createMemo, createResource, createSignal, Match, Show, Switch, type JSX } from "solid-js"

import type { ListedSubject } from "../core/listed"
import type { ObservationKind } from "../core/schema"
import type { Words } from "../core/words"
import { AboutPanel } from "./AboutPanel"
import { BrowsePanel } from "./BrowsePanel"
import { answerCaller, answerFor, callerWaiting, rememberCaller } from "./caller"
import { ComposePanel, type Sending } from "./ComposePanel"
import type { SurveyConfig } from "./config"
import { BackIcon, HelpIcon, PanelIcon } from "./controls"
import { contributorId } from "./contributor"
import { draftFor, envelopeOf, localDay, needsPosition, type Draft } from "./draft"
import { readSurveyList, type ListError, type SurveyList } from "./list"
import { MapButtons } from "./MapButtons"
import { LicensesPage, PrivacyPage } from "./DocumentPage"
import { createArrangement } from "./frame/arrangement"
import { SurveyFrame } from "./frame/SurveyFrame"
import { TitleBar } from "./frame/TitleBar"
import { createNavigation, type Navigation } from "./navigation"
import { findOf, paneOf, showingOf, type Place, type Showing } from "./place"
import { PlacingPanel } from "./PlacingPanel"
import { sendReport, type SendError } from "./send"
import { SubjectPanel } from "./SubjectPanel"
import { SurveyMap, type Focus, type MapPoint } from "./SurveyMap"
import { TakenPanel } from "./TakenPanel"

/** A report being written and where its sending stands, kept while the person goes to the map and back. */
interface Work {
  readonly draft: Draft
  readonly sending: Sending
}

/** Below this width there is room for one pane at a time. */
const NARROW_BELOW = 768

/** How close the map goes to a GPS fix: near enough to pick an entrance when placing, the streets around when looking. */
const PLACING_ZOOM = 18
const AROUND_ZOOM = 15

/** A GPS fix counts as where the position came from only while the map still sits on it, to within a few metres. */
const GPS_TOLERANCE_METRES = 3

const EARTH_RADIUS_METRES = 6_371_000

const radians = (degrees: number): number => (degrees * Math.PI) / 180

const metresBetween = (left: MapPoint, right: MapPoint): number => {
  const x = radians(right.longitude - left.longitude) * Math.cos(radians((left.latitude + right.latitude) / 2))
  const y = radians(right.latitude - left.latitude)
  return Math.hypot(x, y) * EARTH_RADIUS_METRES
}

const currentPosition = (): Promise<MapPoint | undefined> =>
  new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(undefined)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (fix) => resolve({ latitude: fix.coords.latitude, longitude: fix.coords.longitude }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 15_000 },
    )
  })

const sendErrorText = (error: SendError, words: Words): string => {
  switch (error.type) {
    case "invalid":
      return words.ui.checkInput
    case "turnstile":
      return words.ui.turnstileFailed
    case "too-many":
      return words.ui.tooMany
    case "unavailable":
      return words.ui.unavailable
    case "offline":
      return words.ui.offline
  }
}

const listErrorText = (error: ListError, words: Words): string => (error.type === "not-configured" ? words.ui.listUnconfigured : words.ui.listUnreachable)

/**
 * The survey on the workbench shell: the list in the side panel, the map as
 * the main content, and the thing chosen or the report being written in the
 * auxiliary panel.
 *
 * Every screen is a place with an address. A wide window shows the panes side
 * by side, with a button in the title bar's corner that folds the list away; a
 * narrow one shows the pane the place is looked at in and nothing else, each
 * taking the window whole, so going on is a navigation, the back button walks
 * back through them, and the corner's button is a back button too. Panes out
 * of sight stay mounted, so the list comes back scrolled where it was left and
 * the map where it was.
 *
 * What the survey is, in a few lines, is not a screen: it is a card that drops
 * from the title bar's far corner over whichever screen is showing, and going
 * anywhere puts it away. It leads to the pages to read.
 *
 * A new thing is reported from the map, so starting one from the list goes by
 * way of it: back from the form is the map, and back again the list.
 */
const Survey = (props: { readonly config: SurveyConfig; readonly list: SurveyList; readonly navigation: Navigation; readonly find: string }): JSX.Element => {
  const { config, navigation } = props
  const arrangement = createArrangement(NARROW_BELOW)
  const [work, setWork] = createSignal<Work | undefined>()
  const [focus, setFocus] = createSignal<Focus | undefined>()
  const [marked, setMarked] = createSignal<string | undefined>()
  const [side, setSide] = createSignal<"shown" | "folded">("shown")
  const [card, setCard] = createSignal<"closed" | "open">("closed")
  const [turnstile, setTurnstile] = createSignal<string | undefined>()
  const [query, setQuery] = createSignal(props.find)
  const held: { center: MapPoint; gps: MapPoint | undefined } = { center: { latitude: config.start.latitude, longitude: config.start.longitude }, gps: undefined }
  const today = localDay(new Date())
  const subjects = createMemo(() => new Map([...props.list.placed, ...props.list.unplaced].map((subject) => [subject.id, subject] as const)))
  const named = createMemo(() => showingOf(navigation.place(), subjects(), config.schema))
  const showing = (): Showing => named() ?? { type: "list" }

  const when = <T extends Showing["type"]>(type: T): Extract<Showing, { readonly type: T }> | undefined => {
    const current = showing()
    return current.type === type ? (current as Extract<Showing, { readonly type: T }>) : undefined
  }

  const composing = createMemo((): Work | undefined => {
    const current = showing()
    if (current.type !== "report" && current.type !== "placing") return undefined
    const kept = work()
    return kept !== undefined && kept.draft.kind === current.kind && kept.draft.subject?.id === current.subject?.id
      ? kept
      : { draft: draftFor(config.schema, current.kind, current.subject, today), sending: { type: "editing" } }
  })

  const about = createMemo((): ListedSubject | undefined => {
    const current = showing()
    return "subject" in current ? current.subject : undefined
  })

  createEffect(() => {
    if (named() === undefined) navigation.replace({ type: "list" })
  })

  createEffect(() => {
    navigation.place()
    setCard("closed")
  })

  createEffect(() => {
    const subject = about()
    if (subject === undefined) return
    setMarked(subject.id)
    if (subject.position !== undefined) setFocus({ point: subject.position, zoom: 17, stamp: Date.now() })
  })

  const wide = (): boolean => arrangement() === "wide"
  const sideOpen = (): boolean => (wide() ? side() === "shown" : paneOf(showing().type) === "side")
  const auxOpen = (): boolean => paneOf(showing().type) === "aux" || (wide() && showing().type === "placing")

  const reportPlace = (draft: Draft): Place => ({ type: "report", kind: draft.kind, id: draft.subject?.id })

  const report = (kind: ObservationKind, subject: ListedSubject | undefined): void => {
    navigation.go({ type: "report", kind, id: subject?.id })
  }

  const addFromList = (): void => {
    navigation.go({ type: "map" })
    report("add", undefined)
  }

  const locate = async (zoom: number): Promise<boolean> => {
    const point = await currentPosition()
    if (point === undefined) return false
    held.gps = point
    setFocus({ point, zoom, stamp: Date.now() })
    return true
  }

  const lookAround = async (): Promise<boolean> => {
    const located = await locate(AROUND_ZOOM)
    if (located) navigation.go({ type: "map" })
    return located
  }

  const decide = (draft: Draft): void => {
    const center = held.center
    const byGps = held.gps !== undefined && metresBetween(held.gps, center) <= GPS_TOLERANCE_METRES
    const position = byGps
      ? { latitude: center.latitude, longitude: center.longitude, method: "gps" as const, basemap: undefined }
      : { latitude: center.latitude, longitude: center.longitude, method: "pin" as const, basemap: config.basemap.id }
    setWork({ draft: { ...draft, position }, sending: { type: "editing" } })
    navigation.go(reportPlace(draft))
  }

  const send = async (draft: Draft): Promise<void> => {
    if (needsPosition(draft)) {
      navigation.go({ type: "placing", kind: draft.kind, id: draft.subject?.id })
      return
    }
    setWork({ draft, sending: { type: "sending" } })
    const taken = await sendReport(envelopeOf(config.schema, draft, contributorId(), turnstile()))
    if (!taken.ok) {
      setWork({ draft, sending: { type: "failed", message: sendErrorText(taken.error, config.words), problems: taken.error.type === "invalid" ? taken.error.problems : [] } })
      return
    }
    if (config.callers !== undefined) answerCaller(config.callers, { id: taken.value, kind: draft.kind, subject: draft.subject, values: draft.values })
    const current = showing()
    setWork(undefined)
    if (current.type === "report" && current.kind === draft.kind && current.subject?.id === draft.subject?.id) navigation.replace({ type: "taken", ref: taken.value })
  }

  const wayBack = (ref: string): (() => void) | undefined => {
    const address = config.callers === undefined ? undefined : answerFor(ref, config.callers)
    return address === undefined ? undefined : () => window.location.assign(address)
  }

  const corner = (): { readonly label: string; readonly icon: JSX.Element; readonly press: () => void } | undefined => {
    if (wide()) return { label: config.words.ui.toggleList, icon: <PanelIcon class="size-4" />, press: () => setSide((was) => (was === "shown" ? "folded" : "shown")) }
    return showing().type === "list" ? undefined : { label: config.words.ui.back, icon: <BackIcon class="size-5" />, press: navigation.back }
  }

  return (
    <SurveyFrame
      arrangement={arrangement()}
      sideOpen={sideOpen()}
      auxOpen={auxOpen()}
      onAuxClose={navigation.back}
      closeLabel={config.words.ui.close}
      titles={
        <TitleBar
          left={
            <>
              <Show when={corner()}>
                {(button) => (
                  <button
                    type="button"
                    class="inline-flex size-7 items-center justify-center rounded text-text-muted hover:bg-surface-3 hover:text-text-primary"
                    aria-label={button().label}
                    title={button().label}
                    onClick={() => button().press()}
                  >
                    {button().icon}
                  </button>
                )}
              </Show>
              <span class="px-1 text-sm font-bold text-text-primary">{config.branding.title}</span>
            </>
          }
          right={
            <>
              <button
                type="button"
                class="inline-flex size-7 items-center justify-center rounded text-text-muted hover:bg-surface-3 hover:text-text-primary"
                aria-label={config.words.ui.about}
                aria-expanded={card() === "open"}
                title={config.words.ui.about}
                onClick={() => setCard((was) => (was === "open" ? "closed" : "open"))}
              >
                <HelpIcon class="size-5" />
              </button>
              <Show when={card() === "open"}>
                <div class="fixed inset-0 z-20" onClick={() => setCard("closed")} />
                <div class="absolute right-2 top-full z-30 mt-1 max-h-[calc(100dvh-3.5rem)] w-80 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl border border-border bg-surface-1 p-4 shadow-lg">
                  <AboutPanel config={config} onPrivacy={() => navigation.go({ type: "privacy" })} onLicenses={() => navigation.go({ type: "licenses" })} onClose={() => setCard("closed")} />
                </div>
              </Show>
            </>
          }
        />
      }
      side={
        <div class="h-full p-4">
          <BrowsePanel
            config={config}
            list={props.list}
            callerNote={config.callers !== undefined && callerWaiting(config.callers) ? config.callers.note : undefined}
            query={query()}
            onQuery={setQuery}
            onPick={(subject) => navigation.go({ type: "subject", id: subject.id })}
            onAdd={config.schema.observations.includes("add") ? addFromList : undefined}
            onLocate={lookAround}
          />
        </div>
      }
      aux={
        <div class="px-4 pb-4">
          <Switch>
            <Match when={when("subject")}>
              {(current) => (
                <SubjectPanel
                  config={config}
                  subject={current().subject}
                  onReport={(kind) => report(kind, current().subject)}
                  onShowMap={!wide() && current().subject.position !== undefined ? () => navigation.go({ type: "map" }) : undefined}
                />
              )}
            </Match>
            <Match when={composing()}>
              {(current) => (
                <ComposePanel
                  config={config}
                  draft={current().draft}
                  sending={current().sending}
                  today={today}
                  onChange={(draft) => setWork({ draft, sending: current().sending.type === "sending" ? current().sending : { type: "editing" } })}
                  onPlace={() => navigation.go({ type: "placing", kind: current().draft.kind, id: current().draft.subject?.id })}
                  onTurnstile={setTurnstile}
                  onSend={() => void send(current().draft)}
                />
              )}
            </Match>
            <Match when={when("taken")}>{(current) => <TakenPanel words={config.words} id={current().ref} reportsUrl={config.branding.reportsUrl} onReturn={wayBack(current().ref)} onAnother={navigation.back} />}</Match>
          </Switch>
        </div>
      }
    >
      <div class="relative h-full">
        <SurveyMap
          basemap={config.basemap}
          attribution={config.branding.listAttribution}
          start={{ point: config.start, zoom: config.start.zoom, stamp: 0 }}
          subjects={props.list.placed}
          selectedId={marked()}
          placing={showing().type === "placing"}
          focus={focus()}
          onSelect={(id) => {
            if (showing().type !== "placing") navigation.go({ type: "subject", id })
          }}
          onCenter={(point) => (held.center = point)}
        />
        <Show
          when={showing().type === "placing" ? composing() : undefined}
          fallback={<MapButtons words={config.words} onLocate={() => locate(AROUND_ZOOM)} onAdd={config.schema.observations.includes("add") ? () => report("add", undefined) : undefined} />}
        >
          {(current) => (
            <div class="absolute bottom-3 right-3 z-10 w-80 max-w-[calc(100%-1.5rem)] rounded-xl border border-border bg-surface-1 px-2.5 pb-2.5 pt-1.5 shadow-lg">
              <PlacingPanel words={config.words} onLocate={() => locate(PLACING_ZOOM)} onDecide={() => decide(current().draft)} onClose={navigation.back} />
            </div>
          )}
        </Show>
      </div>
    </SurveyFrame>
  )
}

/**
 * A whole survey page: its list read, then the map and the panels. The pages
 * to read are laid over it and do not wait for the list, so the policy can be
 * read where the list cannot be reached.
 */
export const SurveyApp = (props: { readonly config: SurveyConfig }): JSX.Element => {
  if (props.config.callers !== undefined) rememberCaller(window.location.search, props.config.callers)
  const find = findOf(window.location.search)
  const navigation = createNavigation()
  const [list] = createResource(() => readSurveyList(props.config.listBase, props.config.listFiles, props.config.schema))
  const loaded = (): SurveyList | undefined => {
    const read = list()
    return read?.ok ? read.value : undefined
  }
  const failed = (): ListError | undefined => {
    const read = list()
    return read !== undefined && !read.ok ? read.error : undefined
  }
  return (
    <>
      <Switch fallback={<p class="p-6 text-sm text-text-secondary">{props.config.words.ui.listLoading}</p>}>
        <Match when={loaded()}>{(value) => <Survey config={props.config} list={value()} navigation={navigation} find={find} />}</Match>
        <Match when={failed()}>{(error) => <p class="p-6 text-sm text-negative">{listErrorText(error(), props.config.words)}</p>}</Match>
      </Switch>
      <Switch>
        <Match when={navigation.place().type === "privacy"}>
          <PrivacyPage config={props.config} onBack={navigation.back} />
        </Match>
        <Match when={navigation.place().type === "licenses"}>
          <LicensesPage config={props.config} onBack={navigation.back} />
        </Match>
      </Switch>
    </>
  )
}
