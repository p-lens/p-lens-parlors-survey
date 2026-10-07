# open-location-survey-kit

> **この日本語版が原本です。** [English](README.md) は翻訳で、内容が食い違うときは日本語版に従います。

調査の道具であって、地図の編集ツールではありません。

世の中には、地図に載っていないことを知っている人がいます。新しく開いた店、改札の横の AED、橋の下の高さ制限、地図とは違う場所にある入口。open-location-survey-kit は、そうした事実を、知っている本人から集めます。一次情報として、出どころとともに、CC0 で。そして地図データを保守する人たちに手渡します。OpenStreetMap を編集することはなく、誰かにタグを書かせることもありません。

```text
現地にいる人                → 事実、座標、出どころ、日付
open-location-survey-kit    → 審査し、仮名のまま、CC0 で、GitHub の issue として起票
メンテナ                    → 確認して、オープンなデータセットに取り込む
マッパー                    → OpenStreetMap に入れるかどうか、どう入れるかを決める
```

仕事をこう分けることで、現地を知っている人は、地図の描き方を覚えなくても貢献できます。どの事実も、誰が、いつ、どうやって確かめたのかをたどれます。

## 守っていること

- **一次情報だけ。** 出どころは必須です。現地で見た、そのものの運営者自身の公表、またはメモ。地図サービスやほかのデータベースは、出どころになりません。
- **自由に使える地図だけ。** 座標は、端末の GPS か、利用条件がそれを許す地図（地理院タイルが組み込まれています）に置いたピンから取ります。どちらだったかは記録に残ります。Google マップなどのプロプライエタリな地図は、決して出しません。
- **毎回の同意。** どの報告にも、CC0 であることと、地図サービスやほかのデータベースから写していないことへの同意が付きます。
- **仮名のまま。** 投稿者は、端末が自分で作った UUID です。
- **何も保存しない。** サーバーは報告を審査して起票するだけです。記録は issue です。

## 調査はスキーマである

キットは分野を知りません。調査は、項目と規則を宣言します。

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
  refine: (attributes) => ({ ok: true, value: attributes }), // 分野の規則。なくてもよい
}
```

項目の種類：`text`、`kana`（読み。ひらがなで持つ）、`choice`、`words`、`number`、`flag`、`photo`。`photo` は宣言だけできます。キットに写真の置き場所ができるまで、写真の付いた報告は断ります。

報告の種類：`add`（一覧にないもの）、`locate`（一覧にあるものの座標）、`gone`（一覧にあるものがなくなった）、`amend`（訂正）。

`isForbidden` と `looksLikePlaceholder` は、スキーマの `refine` が自由記述のゴミを断るのに使えます。

ひとつの名前にひとつだけ、という調査は `sameName` で 2 つの名前が同じかどうかを言い、一覧にあるものをほかの項目でも呼ぶなら `alsoNamedBy` で挙げます。サーバーは一覧を読み、一覧にすでにある名前での新しいもの、または訂正を断ります。

## サーバー

```ts
import { GSI_PALE, japanese } from "open-location-survey-kit"
import { githubAppSink, surveyWorker } from "open-location-survey-kit/server"

export default surveyWorker((env) => ({
  schema: aedSchema,
  words: japanese,
  basemaps: [GSI_PALE.id],
  list: { base: "https://list.example/", files: ["aeds.jsonl"] }, // 報告を照らす一覧。なければ undefined
  sink: githubAppSink({ appId, installationId, privateKey, repo }, fetch, () => Math.floor(Date.now() / 1000)),
  challenge: { type: "turnstile", secret: env.TURNSTILE_SECRET }, // undefined だと報告をひとつも受け付けない
  limiter: async (key) => (await env.REPORT_LIMITER.limit({ key })).success, // undefined だと回数を限らない
  outbound: fetch,
}))
```

Cloudflare Worker（または `fetch(Request)` を持つもの）が、`POST /api/reports` で報告を受け取ります。受け付けた報告はひとつずつ issue になり、`survey`、スキーマの id、報告の種類のラベルが付きます。issue には、確認のための表、OpenStreetMap のメモの文面、GeoJSON の Feature としての記録が入ります。

報告はどれも公開されるので、サーバーは慎重に扱います。まず報告の来たアドレスで `limiter` にたずね、JSON として送られた 16KB までの本文だけを読みます。報告が人から来たことをどう確かめるかを `challenge` が言うまで、報告は受け付けません。Cloudflare Turnstile のトークンか、世の中に開いていない調査のための `{ type: "none" }` です。一覧にあるものについての報告は、一覧にあるものを、一覧の名前で指していなければなりません。そして issue の中では、人が送った値はすべてコードとして書かれます。誰かへの通知にも、リンクにも、マークアップにもなりません。改行の入った名前やメモは断ります。

## ページ

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
        callers: undefined,
      }}
    />
  ),
  root,
)
```

Solid、MapLibre 6、Tailwind 4 で、Vite でビルドします。ページは一覧を JSONL（`{"id", "lat"?, "lon"?, …}`）として読み、座標のあるものを地図に出し、残りを座標待ちとして並べ、全部を検索でき、スキーマが受け付ける報告をすべて出します。

`branding` は、その調査をその調査にするものすべてです。名前、自分についての説明、Markdown で書いたプライバシーポリシー（見出し、段落、`-` の箇条書き、`**強調**`、リンク。HTML は通しません）、運営元、データの置き場所、一覧の出典表記。画面の言葉は `Words` です。`japanese` を渡すか、広げて一部を差し替えます。配色は `theme.css` のトークンです。

### 枠

ページは、タイトルバーの下に 3 つのペインを持つ枠に並びます。片側に一覧、真ん中に地図、反対側に選んだものや書きかけの報告。広いウィンドウでは横に並び、境目を引いて幅を変えられます。狭いウィンドウでは地図が全面のままで、開いたペインがその上に 1 枚ずつ重なります。

どの画面にもアドレスがあります。だからブラウザの戻るボタン（スマホのものも）で順に戻れますし、画面にリンクを張れます。

| アドレス | 画面 |
|---|---|
| `/` | 一覧と検索 |
| `/map` | 地図 |
| `/subject?id=…` | 一覧にあるもの |
| `/report?kind=…&id=…` | 書きかけの報告（`kind=add` には id がない） |
| `/place?kind=…&id=…` | 地図で座標を決める |
| `/taken?ref=…` | 受け付けた報告 |
| `/privacy`、`/licenses` | 読み物のページ |

配信する側は、このどれに対してもページを返す必要があります（シングルページアプリケーションのフォールバック）。ページはオリジンの直下から配られる前提です。

### 呼び出し元

一覧にないものを必要とするよそのページは、人をここへ送り、何が報告されたかを受け取れます。自分のアドレスを `return` に入れて調査を開きます（`https://survey.example/?return=https%3A%2F%2Fapp.example%2Fback`）。その人の報告が受け付けられると、お礼の画面に戻り道が出て、報告の答えをクエリに足したそのアドレスへ戻ります。

```ts
callers: {
  origins: ["https://app.example"],
  answerOf: (taken) => ({ report: taken.id }),
}
```

人を戻す先は `origins` のオリジンだけです。それ以外を指す `return` は無視するので、見知らぬ人の作ったリンクの言うままに人を送る道にはなりません。`answerOf` は調査の側が書きます。報告の ID、種類、対象の一覧項目、入力された値が渡され、返したものが、呼び出し元が自分で付けたクエリの横に足されます。呼び出し元はタブが生きている間だけ覚えておき、調査自身のアドレスには載せず、サーバにも送りません。`callers` が undefined なら、誰もどこにも戻しません。

### Vite プラグイン

```ts
import { surveyKit } from "open-location-survey-kit/vite"

export default defineConfig({ plugins: [solid(), tailwindcss(), surveyKit({ title, summary })] })
```

ページのタイトルと、検索エンジンに伝える説明を HTML に書き込みます。そして `/licenses` に出すものを集めます。ページが必要だと宣言しているものから `node_modules` をたどり、ページと一緒に配られるパッケージをすべて見つけ、それぞれが宣言するライセンス、著作権表示、ライセンスの全文、リポジトリを読みます。このページに手で書くものはありません。プラグインは TypeScript なので、Vite は Bun の上で動かします（`bun --bun vite`）。

## 出力

`issueOf`、`featureOf`（GeoJSON）、`osmNoteOf` は、`SurveyRecord` を、メンテナとマッパーが読むものに変えます。ただの関数なので、ほかの起票先にも使えます。

## ライセンス

MIT。枠のペインとその幅の変え方は、choai.dev のシェルから派生したものです。
