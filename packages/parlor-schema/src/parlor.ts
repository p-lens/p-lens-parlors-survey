import { Err, isForbidden, looksLikePlaceholder, Ok, type Attributes, type Problem, type Result, type SurveySchema } from "open-location-survey-kit"

import { PREFECTURES } from "./prefectures"

/** Words a parlor's name is made of that happen to hold a forbidden one: パチンコ holds what it holds. */
const INNOCENT_WORDS = ["ぱちんこ", "ぱちすろ"]

/**
 * What a parlor's name cannot hold, since app.p-lens.jp writes it as it is
 * into an hledger account and commodity: `:` would make a sub-account, two
 * spaces or a tab end an account name, a quote ends the commodity, and `,`,
 * `;` or a line break end a tag, start a comment or end the line.
 */
const UNWRITABLE = /[:",;\n\r\t]| {2}/

/** The shortest name a parlor has: a chain and its branch, like ガイア難波店, are never under four characters. */
const MIN_NAME = 4

const LETTER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{L}]/u

/** The characters a parlor's name is written in, read after NFKC: Japanese, latin, digits, and a few marks. */
const NAME_CHARACTERS = /^[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}ー々a-zA-Z0-9・&'.!\- ]+$/u

/** The characters an address is written in, read after NFKC: Japanese, latin, digits, dashes and spaces. */
const ADDRESS_CHARACTERS = /^[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}ー々a-zA-Z0-9\- ]+$/u

const KANJI = /\p{Script=Han}/gu

/**
 * A street number as Japanese addresses write one: 1-2-3, 1丁目2番3号,
 * 12番地, 3番1号 — not merely a digit somewhere.
 */
const STREET_NUMBER = /[0-9一二三四五六七八九十]+(?:丁目|番地?|号|-[0-9]+)/

const MIN_ADDRESS = 8

const text = (attributes: Attributes, key: string): string | undefined => {
  const value = attributes[key]
  return typeof value === "string" ? value : undefined
}

/**
 * Whether a name reads like a parlor's: a place in kanji — a chain is always
 * named with its branch — no long run of hiragana, and latin only in short,
 * pronounceable words, an initial like the D of D'station aside. Strict on
 * purpose: a real parlor refused can be typed again; a sloppy one kept is
 * everyone's problem.
 */
const nameProblem = (name: string): Problem | undefined => {
  const plain = name.normalize("NFKC")
  if (UNWRITABLE.test(name)) return { field: "name", reason: "unwritable" }
  if ([...name].length < MIN_NAME) return { field: "name", reason: "too-short" }
  if (!LETTER.test(name)) return { field: "name", reason: "no-letters" }
  if (isForbidden(name, INNOCENT_WORDS)) return { field: "name", reason: "forbidden" }
  if (looksLikePlaceholder(name, true)) return { field: "name", reason: "placeholder" }
  if (!NAME_CHARACTERS.test(plain)) return { field: "name", reason: "strange-characters" }
  if ((plain.match(KANJI) ?? []).length < 2) return { field: "name", reason: "no-place" }
  if (/\p{Script=Hiragana}{4}/u.test(plain)) return { field: "name", reason: "placeholder" }
  const latin = plain.match(/[a-zA-Z]+/g) ?? []
  return latin.some((word) => word.length > 12 || (word.length > 2 && !/[aeiouy]/i.test(word))) ? { field: "name", reason: "placeholder" } : undefined
}

const readingProblem = (reading: string): Problem | undefined => {
  if (isForbidden(reading, INNOCENT_WORDS)) return { field: "reading", reason: "forbidden" }
  return looksLikePlaceholder(reading, true) ? { field: "reading", reason: "placeholder" } : undefined
}

const keywordsProblem = (keywords: readonly string[]): Problem | undefined => {
  if (keywords.some((word) => UNWRITABLE.test(word))) return { field: "keywords", reason: "unwritable" }
  if (keywords.some((word) => isForbidden(word, INNOCENT_WORDS))) return { field: "keywords", reason: "forbidden" }
  return keywords.some((word) => looksLikePlaceholder(word, true)) ? { field: "keywords", reason: "placeholder" } : undefined
}

/** The address with the prefecture it begins with taken off, if it begins with one. */
const withoutPrefecture = (address: string): { readonly prefecture: string | undefined; readonly rest: string } => {
  const found = PREFECTURES.find((prefecture) => address.startsWith(prefecture))
  return found === undefined ? { prefecture: undefined, rest: address } : { prefecture: found, rest: address.slice(found.length).trim() }
}

/** Where the municipality ends in an address: a city or a district, or one of Tokyo's wards. */
const municipalityEnd = (address: string, prefecture: string | undefined): number => {
  const city = address.search(/[市郡]/)
  return city !== -1 ? city : prefecture === "東京都" ? address.search(/区/) : -1
}

const plainAddress = (address: string): string => address.normalize("NFKC").replace(/[‐-―−ーｰ]/g, (dash) => (dash === "ー" ? dash : "-"))

/** An address down to the street number, in the prefecture chosen, or why not. Kept without the prefecture it may begin with. */
const addressOf = (address: string, prefecture: string | undefined): Result<string, Problem> => {
  const leading = withoutPrefecture(address)
  if (leading.prefecture !== undefined && prefecture !== undefined && leading.prefecture !== prefecture) return Err({ field: "address", reason: "other-prefecture" })
  const plain = plainAddress(leading.rest)
  if ([...plain].length < MIN_ADDRESS) return Err({ field: "address", reason: "too-short" })
  if (!ADDRESS_CHARACTERS.test(plain)) return Err({ field: "address", reason: "strange-characters" })
  if (isForbidden(plain)) return Err({ field: "address", reason: "forbidden" })
  if (looksLikePlaceholder(plain, false)) return Err({ field: "address", reason: "placeholder" })
  const end = municipalityEnd(plain, prefecture)
  if (end === -1) return Err({ field: "address", reason: "no-municipality" })
  return STREET_NUMBER.test(plain.slice(end + 1)) ? Ok(leading.rest) : Err({ field: "address", reason: "no-number" })
}

/**
 * The rules of a parlor beyond each field's kind: a real name with its
 * branch, a reading and search words that are not junk, and an address down
 * to the municipality and the street number, in the prefecture chosen.
 */
export const refineParlor = (attributes: Attributes): Result<Attributes, readonly Problem[]> => {
  const name = text(attributes, "name")
  const reading = text(attributes, "reading")
  const keywords = attributes["keywords"]
  const address = text(attributes, "address")
  const settledAddress = address === undefined ? undefined : addressOf(address, text(attributes, "prefecture"))
  const problems = [
    name === undefined ? undefined : nameProblem(name),
    reading === undefined ? undefined : readingProblem(reading),
    Array.isArray(keywords) ? keywordsProblem(keywords) : undefined,
    settledAddress === undefined || settledAddress.ok ? undefined : settledAddress.error,
  ].filter((problem): problem is Problem => problem !== undefined)
  if (problems.length > 0) return Err(problems)
  return Ok(settledAddress?.ok ? { ...attributes, address: settledAddress.value } : attributes)
}

const nameKey = (name: string): string =>
  name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s'’・.\-&!_]/g, "")
    .replace(/[ァ-ヶ]/g, (character) => String.fromCodePoint((character.codePointAt(0) ?? 0) - 0x60))

/**
 * Whether two names are one name as app.p-lens.jp compares them: widths and
 * case aside, katakana as hiragana, and no spaces or marks. A book there
 * keeps a parlor's savings under its name, so the list keeps one parlor to a
 * name, and this must stay the measure the app and the list's check use.
 */
const sameParlorName = (left: string, right: string): boolean => nameKey(left) === nameKey(right)

/** A pachinko or pachislot parlor, as app.p-lens.jp's parlor list keeps one. */
export const parlorSchema: SurveySchema = {
  id: "parlor",
  noun: "店舗",
  nameField: "name",
  observations: ["add", "locate", "gone", "amend"],
  fields: [
    { key: "name", label: "店名", hint: "チェーン名と支店名まで（例：マルハン梅田店）", kind: { type: "text", maxLength: 30 }, required: true, amendable: true },
    { key: "reading", label: "よみ", hint: "ひらがなで（例：まるはんうめだてん）", kind: { type: "kana", minLength: 3, maxLength: 40 }, required: true, amendable: true },
    { key: "prefecture", label: "都道府県", kind: { type: "choice", options: PREFECTURES }, required: true, amendable: false },
    { key: "address", label: "住所", hint: "市区町村から番地まで（例：大阪市北区小松原町4-16）", kind: { type: "text", maxLength: 80 }, required: true, amendable: false },
    { key: "keywords", label: "検索語", hint: "略称などを読点で区切って（例：Dステ、ディーステ）", kind: { type: "words", maxCount: 10, maxLength: 30 }, required: false, amendable: true },
  ],
  refine: refineParlor,
  sameName: sameParlorName,
  alsoNamedBy: ["officialName"],
  reasons: {
    unwritable: "に使えない文字（: \" , ; や連続した空白）が入っています",
    "no-letters": "に文字が入っていません",
    placeholder: "がテスト入力のように見えます",
    forbidden: "に使えない言葉が入っています",
    "strange-characters": "に使えない記号が入っています",
    "no-place": "には地名や支店名まで入れてください（例：マルハン梅田店）",
    "no-municipality": "に市区町村が入っていません",
    "no-number": "に番地が入っていません",
    "other-prefecture": "の都道府県が選んだものと違います",
    listed: "はすでに一覧にある店舗の名前です。同じ店舗なら一覧から選んで報告し、別の店舗なら支店名まで入れてください",
  },
}
