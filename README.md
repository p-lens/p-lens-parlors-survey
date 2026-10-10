# p-lens-parlors-survey

> **日本語版が原本です。** [README.ja.md](README.ja.md) is the original; this English text is a translation, and where the two differ the Japanese holds.

survey.p-lens.jp: where people tell P-Lens (Pレンズ) about pachinko and
pachislot parlors — one missing from the parlor list, where one the list has no
position for stands, one that has closed, or a name or reading to
correct.
A report may also say, where the reporter knows them, a parlor's corners and
their rates — what it rents at and replays at — its special prizes, each kind
with the balls or medals the parlor takes for it and what the broker
(特殊景品交換所, the booth that buys special prizes) paid the reporter for it,
and the broker's name. It is one report, published apart: the corners, and
what each prize takes, in the parlor list's `tiers.jsonl`; and what the prizes
came to at the broker, which is not the parlor, in a repository of its own,
[p-lens-brokers](https://github.com/p-lens/p-lens-brokers) — not as a rate,
but as a thing a player saw happen on a day.

It is [open-location-survey-kit](packages/open-location-survey-kit) given a
parlor schema. The kit collects facts first-hand, with provenance, under CC0,
and files each report as a GitHub issue on the parlor list's repository;
maintainers review and merge them into the list, which is published under
the ODbL.

```text
packages/open-location-survey-kit/  the domain-free survey tool (MIT)
packages/parlor-schema/             what a parlor is: its fields and rules
apps/web/                           the page: SurveyApp with the parlor schema
apps/web/branding/                  this survey's name, description, operator, privacy policy and icon
apps/api/                           the Worker: surveyWorker with the parlor schema and a GitHub App sink
```

## Forking it into a survey of your own

The kit knows no domain. AEDs, plant-hire depots, vending machines: fork this
repository, replace the following, and the same page is your survey (the map
is 地理院タイル, so within Japan for now).

| Replace | Where |
|---|---|
| What is surveyed: its fields and rules | `packages/parlor-schema/` (put your own schema in its place) |
| The survey's name, description, summary for search engines, operator, where the data is kept, the list's attribution | `apps/web/branding/branding.ts` |
| The privacy policy (Markdown) | `apps/web/branding/privacy.md` |
| The icon in the browser's tab | `apps/web/branding/favicon.svg` |
| How the schema is passed, the list's file names, where the map opens, what a row of the list shows | `apps/web/src/main.tsx` |
| The guide for language models | `apps/web/public/llms.txt` |
| Where the list is published, the Turnstile key, the origins a person is taken back to | `apps/web/.env.local`, `apps/api/wrangler.jsonc` |
| Where the page may load from (add to `connect-src` if the list or the map comes from elsewhere) | `apps/web/public/_headers` |
| The repository issues are filed in, and the GitHub App | `apps/api/wrangler.jsonc` |

To change the page's words, pass a `Words` that spreads `japanese` and replaces
some. Colours are the tokens in `open-location-survey-kit/web/theme.css`,
overridden. The open-source licences page is collected again from what is
installed at every build, so none of it is written by hand.

## Running it

```sh
bun install
bun run test
bun run check

cp apps/web/.env.example apps/web/.env.local
bun --cwd=apps/web run dev-list <dataset.jsonl>   # a local copy of the list in public/list/
bun run dev                  # the page on :8140
bun run dev:api              # the Worker on :8787 (wrangler dev), proxied as /api
```

The Worker takes no report until it is decided how one shows it comes from a
person. To try it on your own machine, put `UNCHALLENGED=yes` in
`apps/api/.dev.vars` and it takes them unasked. Never use that where the world
can reach it.

## The parlor list it reads

From `VITE_LIST_URL`:

```jsonl
parlors.jsonl    {"id", "name", "reading", "keywords"?, "prefecture", "address", "lat", "lon"}   placed, as app.p-lens.jp reads it
unplaced.jsonl   {"id", "name", "reading", "prefecture", "address"?, "officialUrl"?}           no position yet
```

## Sent from app.p-lens.jp, and back

A person starting a play at a parlor the app's list lacks is sent here with
`?return=` and the app's own address. Once their report is taken, the screen
that thanks them leads back with what the app keeps the parlor by until the
list has it:

```text
/parlors/submitted?game=…&submission=<the report's id>&name=<the parlor>&prefecture=<its prefecture>
```

A person who chose a parlor the list has not yet placed on the map is sent
here with `?find=` and the parlor's name as well, so the list opens searched
for it and its position can be reported.

A parlor reported as new goes back as it was typed; one given its position,
as the list names it. The id is the one the issue is filed under, and the
one a maintainer writes in the parlor's `submissions` when the report is
merged — which is how the app comes to know the parlor it kept is listed. A
closing or a correction brings the app no parlor and goes back with nothing
added. Only the origins in `VITE_CALLER_ORIGINS` are gone back to.

## One parlor to a name

app.p-lens.jp keeps a parlor's savings in a book under its name, so the parlor
list keeps one parlor to a name. A report of a new parlor under a name the
list already has, or a correction of a name to another parlor's, is refused:
the same parlor is to be chosen from the list and reported on, another
reported with its branch.

Names are compared as the app and the list's check compare them — widths,
case, spaces and marks aside, katakana as hiragana — against a listed
parlor's `name` and `officialName`, placed or not. A list that cannot be read
stops no report, since a maintainer reads every one.

## Deploying

One Cloudflare Worker serves the built page as static assets and `/api/*`.
What is on `main` is what survey.p-lens.jp serves: Cloudflare watches this
repository, and each time `main` moves it tests, builds and publishes.

```text
Cloudflare's settings (Workers > connect this repository)
  build command     bun install && bun run test && bun run check
  deploy command    bun run deploy
  build variable    BUN_VERSION=1.4.2
```

`BUN_VERSION` is the Bun that wrote `bun.lock`, or a newer one. The Bun
Cloudflare comes with may be too old to read `bun.lock`, and the build stops.

The parlor list is published at parlors.p-lens.jp by
[p-lens-parlors](https://github.com/p-lens/p-lens-parlors), and the page reads
it each time it is opened. When the list changes, nothing here is deployed
again.

### The first time

Publish the parlor list first: the page and the server that takes reports
both read it.

**1. Make the GitHub App that files the issues**

A report becomes an issue under the App's name (`name[bot]`), not a person's.
The App can read and write issues on the parlor list's repository and nothing
else.

1. As the account that holds the parlor list, open
   <https://github.com/settings/apps/new>.
2. Give it a **GitHub App name** (one nobody on GitHub has taken) and
   `https://survey.p-lens.jp` as its **Homepage URL**.
3. Untick **Active** under **Webhook**.
4. Under **Repository permissions**, set **Issues** to **Read and write**.
   Leave the rest.
5. Leave **Where can this GitHub App be installed?** at **Only on this
   account**, and **Create GitHub App**.
6. Note the **App ID** on the page that follows.
7. Further down that page, **Generate a private key**. A `.pem` file is
   downloaded. It is a secret, and never goes into a repository.
8. From **Install App** on the left, install it with **Only select
   repositories**, choosing the parlor list's repository alone.
9. The number in the address afterwards,
   `https://github.com/settings/installations/number`, is the installation id.

The App ID and the installation id are not secrets. They go in
`apps/api/wrangler.jsonc` as `GITHUB_APP_ID` and `GITHUB_INSTALLATION_ID`.

Make the labels `survey`, `parlor`, `add`, `locate`, `gone` and `amend` on the
parlor list's repository.

**2. Make a Cloudflare Turnstile site**

In Turnstile on Cloudflare's dashboard, make a widget for `survey.p-lens.jp`.
Its site key goes in `apps/web/.env.production` as `VITE_TURNSTILE_SITE_KEY`
(it is not a secret). Its secret key goes in next.

**3. Put the secrets in**

```sh
openssl pkcs8 -topk8 -nocrypt -in the-downloaded-key.pem -out app.pkcs8.pem
cd apps/api
bunx wrangler secret put GITHUB_APP_PRIVATE_KEY < ../../app.pkcs8.pem
bunx wrangler secret put TURNSTILE_SECRET
```

Then delete both `.pem` files.

**4. Get it onto `main`**

With those values written, what goes onto `main` is published by Cloudflare.
Left empty, `LIST_URL` in `apps/api/wrangler.jsonc` has reports judged without
the list.

### What to check once it is out

- The search works, and parlors are on the map.
- Answers carry the headers in `apps/web/public/_headers`
  (`curl -I https://survey.p-lens.jp/`).
- A report sent files an issue on the parlor list's repository, under the
  App's name.
- Too many sent in a row are refused.

The GitHub App needs only **Issues: Read and write** on the parlor list's
repository.

## What guards the taking of reports

Every report becomes a public issue, so the server:

- **requires Cloudflare Turnstile.** Until `TURNSTILE_SECRET` is set, not one
  report is taken.
- **limits each sender.** Ten a minute from one address (`ratelimits` in
  `wrangler.jsonc`).
- **holds a report about a listed thing against the list.** An id the list
  does not have, or a name other than the list's, is refused.
- **writes what was sent where it can only be shown.** In an issue every value
  sent is written as code: it is no mention (`@name`), no link and no HTML. A
  name or a note with a line break or a control character is refused.
- **reads only a body sent as JSON, of 16KB at most.**

The page loads nothing from anywhere but its own files, Turnstile, the map's
tiles and the list, as `apps/web/public/_headers` says.

## Licence

[MIT](LICENSE).

Map tiles: 出典：国土地理院. Parlor data © OpenStreetMap contributors (ODbL).
