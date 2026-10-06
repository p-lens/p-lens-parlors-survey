/**
 * What makes this survey this survey: its name, what it says of itself, whose
 * it is. A fork that surveys something else replaces what is in this folder,
 * and the schema, and is its own.
 *
 * Kept free of anything a browser needs, since the build reads it too, for
 * the page's title and what search engines are told.
 */
export const branding = {
  /** The survey's name: its title bar, and the page's title. */
  title: "P-Lens P店調査",
  /** What the survey is for and what it takes, in a sentence or two above the list. */
  description: "誰でも検索できる、パチンコ・パチスロ店舗のオープンデータ（ODbL）です。載っていない店舗や座標、閉店、店名や読みの誤りを知らせると、公開の issue として起票され、確認のうえ一覧に反映されます。",
  /** What search engines are told the page is; not shown on the page. */
  summary: "パチンコ・パチスロ店舗を誰でも検索できます。全国の店舗をオープンデータとして地図と一覧で公開しています。",
  /** The page of whoever runs the survey. */
  operatorUrl: "https://app.p-lens.jp/",
  /** Where the list is kept and reports are filed, named as the survey calls it. */
  dataLink: { label: "店舗データ", url: "https://github.com/p-lens/p-lens-parlors" },
  /** HTML naming where the list comes from and under what licence, shown on the map. */
  listAttribution: '店舗 © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> (ODbL)',
}
