# p-lens-parlors-survey

> **この日本語版が原本です。** [English](README.md) は翻訳で、内容が食い違うときは日本語版に従います。

survey.p-lens.jp（P-Lens P店調査）：パチンコ・パチスロ店舗の一覧を誰でも検索でき、一覧への報告を受け付けるサイトです。店舗一覧にない店舗、一覧に座標がまだない店舗がどこにあるか、閉店した店舗、直すべき店名や読みを受け付けます。

[open-location-survey-kit](packages/open-location-survey-kit) に店舗のスキーマを与えたものです。キットは事実を一次情報として、出どころとともに、CC0 で集め、報告ひとつひとつを店舗一覧のリポジトリの GitHub issue として起票します。メンテナが確認して一覧に取り込み、一覧は ODbL のもとで公開されます。

```text
packages/open-location-survey-kit/  分野を持たない調査ツール（MIT）
packages/parlor-schema/             店舗とは何か：その項目と規則
apps/web/                           ページ：店舗のスキーマを与えた SurveyApp
apps/web/branding/                  この調査の名前、説明、運営元、プライバシーポリシー、アイコン
apps/api/                           Worker：店舗のスキーマと GitHub App の起票先を与えた surveyWorker
```

## Fork して自分の調査にする

キットは分野を知りません。AED でも、建機のレンタル店でも、自動販売機でも、このリポジトリを Fork して次のものを入れ替えれば、同じ画面の自分の調査になります（地図は地理院タイルなので、いまは日本の中に限ります）。

| 入れ替えるもの | 場所 |
|---|---|
| 何を調べるか：項目と規則 | `packages/parlor-schema/`（自分のスキーマに置き換える） |
| 調査の名前、説明、検索エンジン向けの説明、運営元、データの置き場所、一覧の出典表記 | `apps/web/branding/branding.ts` |
| プライバシーポリシー（Markdown） | `apps/web/branding/privacy.md` |
| ブラウザのタブに出るアイコン | `apps/web/branding/favicon.svg` |
| スキーマの渡し方、一覧のファイル名、地図の初期位置、一覧の 1 行に出すもの | `apps/web/src/main.tsx` |
| AI 向けの案内 | `apps/web/public/llms.txt` |
| 一覧の公開場所、Turnstile の鍵 | `apps/web/.env.local`、`apps/api/wrangler.jsonc` |
| ページが読み込んでよい相手（一覧や地図を別の場所から読むなら `connect-src` に足す） | `apps/web/public/_headers` |
| 起票先のリポジトリと GitHub App | `apps/api/wrangler.jsonc` |

画面の言葉を変えたいときは、`japanese` を広げて一部だけ差し替えた `Words` を渡します。配色は `open-location-survey-kit/web/theme.css` のトークンを上書きします。オープンソースライセンスのページは、ビルドのたびにインストールされているものから集め直すので、手で書くものはありません。

## 動かす

```sh
bun install
bun run test
bun run check

cp apps/web/.env.example apps/web/.env.local
bun --cwd=apps/web run dev-list <dataset.jsonl>   # 一覧の手元の写しを public/list/ に置く
bun run dev                  # ページ（:8140）
bun run dev:api              # Worker（:8787、wrangler dev）。/api として中継される
```

Worker は、報告が人から来たことをどう確かめるかが決まるまで、報告を受け付けません。手元で試すときは `apps/api/.dev.vars` に `UNCHALLENGED=yes` と書くと、確かめずに受け付けます。世の中から届く場所では決して使わないでください。

## 読み込む店舗一覧

`VITE_LIST_URL` から読みます。

```jsonl
parlors.jsonl    {"id", "name", "reading", "keywords"?, "prefecture", "address", "lat", "lon"}   配置済み。app.p-lens.jp が読むのと同じもの
unplaced.jsonl   {"id", "name", "reading", "prefecture", "address"?, "officialUrl"?}           座標がまだない店舗
```

## 同じ名前の店舗は受け付けない

app.p-lens.jp は店舗の貯玉をその名前で帳簿に持つので、店舗一覧は 1 つの名前に 1 店舗だけを載せます。そのため、一覧にすでにある名前での新しい店舗の報告と、ほかの店舗の名前への店名の訂正は断ります。同じ店舗なら一覧から選んで報告し、別の店舗なら支店名まで入れて報告してもらいます。

名前は、アプリと一覧のチェックと同じ比べ方（全角半角・大文字小文字・空白・記号の違いを除き、カタカナはひらがなとして）で、配置済みか未配置かを問わず、一覧の `name` と `officialName` に照らします。一覧を読めないときは報告を止めません。報告はどれもメンテナが目を通すからです。

## デプロイ

ひとつの Cloudflare Worker が、ビルドしたページを静的アセットとして配り、`/api/*` も受け持ちます。`main` に入ったものが、そのまま survey.p-lens.jp に出ます。Cloudflare がこのリポジトリを見ていて、`main` が進むたびにテストとビルドをして公開します。

```text
Cloudflare の設定（Workers ＞ このリポジトリを接続）
  ビルドの命令      bun install && bun run test && bun run check
  デプロイの命令    bun run deploy
  ビルドの変数      BUN_VERSION=1.4.2
```

`BUN_VERSION` は、`bun.lock` を書いた Bun と同じか新しい版にします。Cloudflare に元から入っている Bun が古いと、`bun.lock` を読めずに止まります。

店舗一覧は [p-lens-parlors](https://github.com/p-lens/p-lens-parlors) が parlors.p-lens.jp に公開していて、ページは開くたびにそれを読みます。一覧が変わっても、こちらを入れ直す必要はありません。

### はじめて出すとき

先に店舗一覧を公開しておきます。ページも、報告を受けるサーバーも、それを読むからです。

**1. issue を建てる GitHub App を作る**

報告は、人ではなく App の名義（`名前[bot]`）で issue になります。App は店舗一覧のリポジトリの issue を読み書きできるだけで、ほかには何もできません。

1. 店舗一覧を持つアカウントで <https://github.com/settings/apps/new> を開く
2. **GitHub App name** に名前（GitHub 全体でまだ使われていないもの）、**Homepage URL** に `https://survey.p-lens.jp` を入れる
3. **Webhook** の **Active** のチェックを外す
4. **Repository permissions** の **Issues** を **Read and write** にする。ほかは触らない
5. **Where can this GitHub App be installed?** は **Only on this account** のまま、**Create GitHub App**
6. できたページの **App ID** を控える
7. 同じページの下の **Generate a private key** を押す。`.pem` のファイルが落ちてくる。これは秘密で、リポジトリには決して入れない
8. 左の **Install App** から、**Only select repositories** で店舗一覧のリポジトリだけを選んで入れる
9. 入れたあとのアドレス `https://github.com/settings/installations/数字` の数字が、インストールの ID

App ID とインストールの ID は秘密ではありません。`apps/api/wrangler.jsonc` の `GITHUB_APP_ID` と `GITHUB_INSTALLATION_ID` に書きます。

店舗一覧のリポジトリには、ラベル `survey`、`parlor`、`add`、`locate`、`gone`、`amend` を作っておきます。

**2. Cloudflare Turnstile のサイトを作る**

Cloudflare のダッシュボードの Turnstile で、`survey.p-lens.jp` のウィジェットを作ります。サイトキーは `apps/web/.env.production` の `VITE_TURNSTILE_SITE_KEY` に書きます（秘密ではありません）。シークレットキーは次で入れます。

**3. 秘密の値を入れる**

```sh
openssl pkcs8 -topk8 -nocrypt -in ダウンロードした鍵.pem -out app.pkcs8.pem
cd apps/api
bunx wrangler secret put GITHUB_APP_PRIVATE_KEY < ../../app.pkcs8.pem
bunx wrangler secret put TURNSTILE_SECRET
```

入れ終わったら、2 つの `.pem` は消します。

**4. `main` に入れる**

ここまでの値を書いたものを `main` に入れると、Cloudflare が公開します。`apps/api/wrangler.jsonc` の `LIST_URL` が空のままだと、報告は一覧に照らさずに審査されます。

### 出したあとに確かめること

- 検索ができ、地図に店舗が出る
- 応答に `apps/web/public/_headers` のヘッダーが付いている（`curl -I https://survey.p-lens.jp/`）
- 報告をひとつ送ると、店舗一覧のリポジトリに App の名義で issue が建つ
- 続けて送りすぎると断られる

GitHub App に必要な権限は、店舗一覧のリポジトリの **Issues: Read and write** だけです。

## 報告の受付を守るもの

報告はどれも、公開の issue になります。だからサーバーは次のことをします。

- **Cloudflare Turnstile が必須です。** `TURNSTILE_SECRET` が入るまで、報告はひとつも受け付けません。
- **送り主ごとに回数を限ります。** 同じアドレスからは 1 分に 10 件まで（`wrangler.jsonc` の `ratelimits`）。
- **一覧にあるものについての報告は、一覧に照らします。** 一覧にない id、一覧と違う名前での報告は断ります。
- **送られた文字は、見せるだけの場所に書きます。** issue の中で、送られた値はすべてコードとして書かれます。誰かへの通知（`@名前`）にも、リンクにも、HTML にもなりません。改行や制御文字の入った名前やメモは断ります。
- **JSON として送られた、16KB までの本文だけを読みます。**

ページは `apps/web/public/_headers` のとおり、自分のファイル、Turnstile、地図タイル、一覧のほかからは何も読み込みません。

## ライセンス

[MIT](LICENSE)。

地図タイル：出典：国土地理院。店舗データ © OpenStreetMap contributors (ODbL)。
