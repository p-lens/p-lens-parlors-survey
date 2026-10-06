import type { ObservationKind } from "./schema"

/**
 * Every word the kit puts in front of people or into an issue. A survey may
 * pass its own; the schema's nouns and field labels fill the blanks. Nothing
 * else in the kit holds a sentence.
 */
export interface Words {
  readonly observations: Readonly<Record<ObservationKind, string>>
  /** Short labels for issue titles and record tables. */
  readonly observationTags: Readonly<Record<ObservationKind, string>>
  readonly sources: { readonly onSite: string; readonly publication: string; readonly other: string }
  readonly sourceHint: string
  readonly position: string
  readonly gps: string
  readonly pin: string
  readonly observedOn: string
  readonly source: string
  readonly subject: string
  readonly consentCc0: string
  readonly consentNotCopied: string
  readonly consentStatement: string
  readonly osmNoteHeading: string
  readonly reasons: Readonly<Record<string, string>>
  /** Whole sentences for a part and reason that read badly put together, keyed `part:reason`. */
  readonly sentences: Readonly<Record<string, string>>
  readonly parts: Readonly<Record<string, string>>
  readonly ui: {
    readonly search: string
    readonly notFound: string
    readonly waiting: string
    readonly noneWaiting: string
    readonly unplaced: string
    readonly back: string
    readonly close: string
    readonly add: string
    readonly toggleList: string
    readonly about: string
    readonly privacy: string
    readonly licenses: string
    readonly operator: string
    readonly mapAndData: string
    readonly software: string
    readonly licenseText: string
    readonly licenseUnstated: string
    readonly creditsLoading: string
    readonly creditsCollected: string
    readonly showOnMap: string
    readonly here: string
    readonly filter: string
    readonly clearFilter: string
    /** Follows the group field's label where no group is chosen yet. */
    readonly chooseGroup: string
    readonly hereFailed: string
    readonly placeTitle: string
    readonly placeGuide: string
    readonly useGps: string
    readonly locating: string
    readonly gpsFailed: string
    readonly placeHere: string
    readonly placeOnMap: string
    readonly placeAgain: string
    readonly howKnown: string
    readonly publicationPlaceholder: string
    readonly otherPlaceholder: string
    readonly send: string
    readonly sending: string
    readonly checkInput: string
    readonly turnstileFailed: string
    readonly tooMany: string
    readonly unavailable: string
    readonly offline: string
    readonly listUnconfigured: string
    readonly listUnreachable: string
    readonly listLoading: string
    readonly takenTitle: string
    readonly takenBody: string
    readonly takenId: string
    readonly another: string
    readonly goneGuide: string
    readonly officialPage: string
    readonly noPositionYet: string
    readonly optional: string
  }
}

export const japanese: Words = {
  observations: { add: "載っていないものを登録", locate: "座標を知らせる", gone: "なくなったことを知らせる", amend: "内容を直す" },
  observationTags: { add: "新規", locate: "座標", gone: "消滅", amend: "修正" },
  sources: { onSite: "現地で確認した", publication: "運営者の公式サイトで確認した", other: "その他" },
  sourceHint: "Google マップなどの地図サービスや、ほかのサイト・データベースは出典にできません。",
  position: "座標",
  gps: "端末の GPS",
  pin: "地図でピン",
  observedOn: "確認した日",
  source: "出典",
  subject: "対象",
  consentCc0: "この投稿を CC0 で提供し、公開データや OpenStreetMap に使われることに同意します",
  consentNotCopied: "地図サービスや他のサイトやデータベースから写していないことに同意しています。",
  consentStatement: "投稿者は CC0 で提供することと、地図サービスや他のサイトやデータベースから写していないことに同意しています。",
  osmNoteHeading: "OpenStreetMap のメモ用",
  reasons: {
    required: "を入力してください",
    invalid: "が正しくありません",
    "too-long": "が長すぎます",
    "too-short": "が短すぎます",
    "too-many": "が多すぎます",
    "not-kana": "はひらがなで入力してください",
    "not-a-choice": "を選び直してください",
    "out-of-range": "が範囲の外です",
    unsupported: "はまだ受け付けていません",
    "not-allowed": "は受け付けていません",
    listed: "は一覧にすでにあります。一覧から選んで報告してください",
    "not-listed": "が一覧に見つかりません。一覧から選び直してください",
  },
  sentences: {
    "consent:required": "2つの同意にチェックを入れてください",
    "position:required": "地図で座標を決めてください",
    "position:basemap": "座標は表示されている地図の上で決めてください",
    "attributes:required": "直したい内容を入力してください",
    "observedOn:invalid": "確認した日は今日から1年以内の日付にしてください",
    "source:invalid": "出典の内容を確かめてください（公式サイトは http から始まるアドレス）",
  },
  parts: {
    kind: "種類",
    subject: "対象",
    attributes: "直す内容",
    position: "座標",
    source: "出典",
    observedOn: "確認した日",
    contributor: "端末",
    consent: "同意",
  },
  ui: {
    search: "名前・よみで探す",
    notFound: "見つかりませんでした。載っていなければ「新規登録」から知らせてください。",
    waiting: "座標が未確認",
    noneWaiting: "座標が未確認のものはありません。",
    unplaced: "座標未確認",
    back: "戻る",
    close: "閉じる",
    add: "新規登録",
    toggleList: "一覧を開閉する",
    about: "このアプリについて",
    privacy: "プライバシーポリシー",
    licenses: "オープンソースライセンス",
    operator: "運営元",
    mapAndData: "地図とデータ",
    software: "ソフトウェア",
    licenseText: "ライセンス全文",
    licenseUnstated: "ライセンスの記載なし",
    creditsLoading: "読み込んでいます…",
    creditsCollected: "収集日",
    showOnMap: "地図で見る",
    here: "現在地を見る",
    filter: "絞り込む",
    clearFilter: "解除",
    chooseGroup: "を選択",
    hereFailed: "現在地がわかりませんでした。位置情報の許可を確かめてください。",
    placeTitle: "座標を決める",
    placeGuide: "地図を動かして、真ん中の十字を入口に合わせてください。その場にいるなら「現在地を使う」が便利です。",
    useGps: "現在地を使う",
    locating: "現在地を調べています…",
    gpsFailed: "現在地がわかりませんでした。位置情報の許可を確かめるか、地図を動かして決めてください。",
    placeHere: "ここに決める",
    placeOnMap: "地図で座標を決める",
    placeAgain: "やり直す",
    howKnown: "どうやって知りましたか",
    publicationPlaceholder: "https://（運営者の公式ページ）",
    otherPlaceholder: "例：自分で前を通って確かめた",
    send: "送信する",
    sending: "送信中…",
    checkInput: "入力を確かめてください",
    turnstileFailed: "確認に失敗しました。もう一度お試しください",
    tooMany: "送信が続いています。少し待ってからお試しください",
    unavailable: "いま受け付けられません。時間をおいてお試しください",
    offline: "通信できませんでした。電波のよいところでお試しください",
    listUnconfigured: "一覧の場所が設定されていません",
    listUnreachable: "一覧を読み込めませんでした",
    listLoading: "一覧を読み込んでいます…",
    takenTitle: "受け付けました",
    takenBody: "ありがとうございます。内容を確かめてから公開データに反映します。",
    takenId: "受付番号",
    another: "続けて知らせる",
    goneGuide: "なくなったこと（閉鎖の貼り紙、看板の撤去、別のものになっている など）を確かめたら知らせてください。",
    officialPage: "運営者の公式ページ",
    noPositionYet: "まだ地図上の座標がわかっていません。",
    optional: "（任意）",
  },
}
