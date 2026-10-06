# open-location-survey-kit

> **日本語版が原本です。** [README.ja.md](README.ja.md) is the original; this English text is a translation, and where the two differ the Japanese holds.

A survey tool, not a map editor.

People know things about the world that maps lack: a shop that opened, an
AED by the ticket gates, a height limit under a bridge, an entrance that is
not where the map puts it. open-location-survey-kit collects those facts from whoever
knows them — first-hand, with where they came from, under CC0 — and hands
them to people who maintain map data. It never edits OpenStreetMap and never
asks anyone to write a tag.

```text
someone on the spot     → a fact, a position, a source, a date
open-location-survey-kit              → judged, pseudonymous, CC0, filed as a GitHub issue
maintainers             → review, merge into an open dataset
mappers                 → decide whether and how it goes into OpenStreetMap
```

Splitting the work this way lets people who know the ground contribute
without learning to map, and keeps every fact traceable to who saw it, when,
and how.

## What it holds to

- **First-hand only.** A source is required: seen on site, the thing's own
  operator's publication, or a note. Map services and other databases are
  never a source.
- **Free basemaps only.** A position comes from the device's GPS or a pin on a
  basemap whose terms allow it (地理院タイル are built in); the record names
  which. Google Maps and other proprietary maps are never offered.
- **Consent, every time.** Each report carries agreement that it is CC0 and
  that nothing was copied from a map service or another database.
- **Pseudonymous.** A contributor is a UUID the device makes for itself.
- **Nothing stored.** The server judges a report and files it; the issue is
  the record.

## A survey is a schema

The kit knows no domain. A survey declares its fields and rules:

```ts
import type { SurveySchema } from "open-location-survey-kit"

export const aedSchema: SurveySchema = {
  id: "aed",
  noun: "AED",
  nameField: "name",
  observations: ["add", "locate", "gone", "amend"],
  fields: [
    { key: "name", label: "設置場所", kind: { type: "text", maxLength: 40 }, required: true, amendable: true },
    { key: "access", label: "利用できる時間", kind: { type: "choice", options: ["24時間", "営業時間内"] }, required: true, amendable: true },
    { key: "floor", label: "階", kind: { type: "number", min: -5, max: 100 }, required: false, amendable: true },
  ],
  refine: (attributes) => ({ ok: true, value: attributes }), // domain rules, optional
}
```

Field kinds: `text`, `kana` (a reading, kept in hiragana), `choice`, `words`,
`number`, `flag`, and `photo` — declarable now, refused until the kit has
somewhere to keep photos.

Reports: `add` (a thing missing from the list), `locate` (where a listed thing
is), `gone` (a listed thing no longer there), `amend` (a correction).

`isForbidden` and `looksLikePlaceholder` help a schema's `refine` turn away
junk in free text.

A survey whose things go by one name each gives `sameName`, saying when two
names are one, and `alsoNamedBy` for other fields that name a listed thing.
The server then reads the list and refuses a new thing, or a correction,
under a name a listed thing already goes by.

## Server

```ts
import { GSI_PALE, japanese } from "open-location-survey-kit"
import { githubAppSink, surveyWorker } from "open-location-survey-kit/server"

export default surveyWorker((env) => ({
  schema: aedSchema,
  words: japanese,
  basemaps: [GSI_PALE.id],
  list: { base: "https://list.example/", files: ["aeds.jsonl"] }, // what reports are held against; undefined for none
  sink: githubAppSink({ appId, installationId, privateKey, repo }, fetch, () => Math.floor(Date.now() / 1000)),
  challenge: { type: "turnstile", secret: env.TURNSTILE_SECRET }, // undefined takes no report at all
  limiter: async (key) => (await env.REPORT_LIMITER.limit({ key })).success, // undefined sets no limit
  outbound: fetch,
}))
```

A Cloudflare Worker (or anything with `fetch(Request)`) takes reports at
`POST /api/reports`. Each accepted report becomes an issue labelled `survey`,
the schema's id and the report's kind, holding a table for review, the text of
an OpenStreetMap note, and the record as a GeoJSON Feature.

Every report is published, so the server is careful with it. It asks the
limiter first, by the address the report came from, and reads only a body sent
as JSON of 16KB at most. It takes no report until `challenge` says how one
shows it comes from a person: a Cloudflare Turnstile token, or
`{ type: "none" }` for a survey not open to the world. A report about a listed
thing must name one the list has, by the name the list gives it. And in the
issue every value a person sent is written as code, where it is no mention, no
link and no markup; a name or a note with a line break in it is refused.

## Page

```tsx
import { GSI_PALE, japanese } from "open-location-survey-kit"
import { SurveyApp } from "open-location-survey-kit/web"
import "open-location-survey-kit/web/theme.css"

render(
  () => (
    <SurveyApp
      config={{
        schema: aedSchema,
        words: japanese,
        branding: { title, description, privacy, operatorUrl, dataLink, listAttribution },
        listBase: "https://list.example/",
        listFiles: ["aeds.jsonl"],
        basemap: GSI_PALE,
        start: { latitude: 36.2, longitude: 137.8, zoom: 4.6 },
        groupField: undefined,
        summarize: (subject) => String(subject.attributes["address"] ?? ""),
        linkOf: () => undefined,
        turnstileKey: undefined,
      }}
    />
  ),
  root,
)
```

Solid, MapLibre 6 and Tailwind 4, built with Vite. The page reads the list as
JSONL (`{"id", "lat"?, "lon"?, …}`), shows placed things on the map and the
rest as waiting for a position, searches them all, and offers every report the
schema takes.

`branding` is everything that makes a survey its own: its name, what it says
of itself, its privacy policy as Markdown (headings, paragraphs, `-` lists,
`**strong**`, links; no HTML is passed through), who runs it, where its data
is kept, and the list's attribution. Its words are a `Words`; pass `japanese`,
or spread it and replace some. Its colours are the tokens in `theme.css`.

### The frame

The page is laid out in a frame of three panes under a title bar: the list on
one side, the map in the middle, and the thing chosen or the report being
written on the other. A wide window shows them side by side, their borders
dragged to resize; a narrow one keeps the map whole and lays the open pane
over it, one at a time.

Every screen has an address, so the browser's back button, a phone's included,
walks back through them and a screen can be linked to:

| Address | Screen |
|---|---|
| `/` | the list and the search |
| `/map` | the map |
| `/subject?id=…` | a listed thing |
| `/report?kind=…&id=…` | a report being written (`kind=add` has no id) |
| `/place?kind=…&id=…` | the map, placing a position |
| `/taken?ref=…` | a report taken |
| `/privacy`, `/licenses` | the pages to read |

The host must answer every one of these with the page (a single-page
application's fallback), and the page is served from the root of its origin.

### The Vite plugin

```ts
import { surveyKit } from "open-location-survey-kit/vite"

export default defineConfig({ plugins: [solid(), tailwindcss(), surveyKit({ title, summary })] })
```

It writes the page's title and what search engines are told of it into the
HTML, and collects what `/licenses` shows: every package served with the page,
found by walking `node_modules` out from what the page declares it needs, each
with the licence it declares, its copyright notice, its licence in full and
its repository. Nothing on that page is written by hand. The plugin is
TypeScript, so Vite runs under Bun (`bun --bun vite`).

## Outputs

`issueOf`, `featureOf` (GeoJSON) and `osmNoteOf` turn a `SurveyRecord` into
what maintainers and mappers read. They are plain functions; use them for
other sinks too.

## Licence

MIT. The frame's panes and their resizing are derived from choai.dev's shell.
