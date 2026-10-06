/*
 * Telling junk from what people mean to say: text typed to get past a form,
 * and words no public record should carry. A schema calls these from its
 * `refine` where its fields are free text; the kit itself judges nothing by them.
 */

/**
 * Words people type to get past a form that no pattern gives away: test
 * data and placeholders. Everything else is inferred from how the text is
 * made, below.
 */
const PLACEHOLDER_WORDS = ["test", "hoge", "fuga", "piyo", "foo", "sample", "dummy", "example", "テスト", "てすと", "ほげ", "ふが", "ぴよ", "ダミー", "サンプル", "適当", "てきとう", "なし", "無し", "不明", "未定"]

/**
 * Words no public record carries: the vulgar, the sexual and the abusive.
 * Kana are written in hiragana here, and text is compared in hiragana, so
 * katakana and half-width forms are caught too. Words that hide inside
 * ordinary ones are left out rather than refuse real names.
 */
const FORBIDDEN_WORDS = [
  "うんこ",
  "うんち",
  "ちんこ",
  "ちんちん",
  "ちんぽ",
  "まんこ",
  "おまんこ",
  "おっぱい",
  "せっくす",
  "えっち",
  "ふぇら",
  "れいぷ",
  "ぺにす",
  "糞",
  "死ね",
  "殺す",
  "殺せ",
  "氏ね",
  "きちがい",
  "基地外",
  "気違い",
  "馬鹿",
  "あほ",
  "阿呆",
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "dick",
  "pussy",
  "porn",
  "nigger",
]

/** Text as forbidden words are looked for in it: widths and case aside, katakana as hiragana, no spaces. */
const asHiragana = (text: string): string =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[\u30a1-\u30f6]/g, (character) => String.fromCodePoint((character.codePointAt(0) ?? 0) - 0x60))

/**
 * Whether text holds a word no public record should: vulgar, sexual or
 * abusive. `innocent` names words of the survey's own domain that happen to
 * hold one — as Scunthorpe does — and are set aside first.
 */
export const isForbidden = (text: string, innocent: readonly string[] = []): boolean => {
  const plain = innocent.reduce((rest, word) => rest.replaceAll(asHiragana(word), " "), asHiragana(text))
  return FORBIDDEN_WORDS.some((word) => plain.includes(asHiragana(word)))
}

/** The QWERTY rows, for telling a run of neighbouring keys from a word. */
const KEY_ROWS = ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm"]

const keyAt = (character: string): readonly [number, number] | undefined => {
  const row = KEY_ROWS.findIndex((keys) => keys.includes(character))
  return row === -1 ? undefined : [row, KEY_ROWS[row]?.indexOf(character) ?? -1]
}

/** Two keys side by side on a keyboard, or the same key. */
const neighbours = (left: string, right: string): boolean => {
  const [a, b] = [keyAt(left), keyAt(right)]
  return a !== undefined && b !== undefined && Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1
}

/** Every stretch of `length` characters in the text. */
const windows = (characters: readonly string[], length: number): readonly (readonly string[])[] =>
  characters.length < length ? [] : characters.slice(0, characters.length - length + 1).map((_, index) => characters.slice(index, index + length))

/** Four or more keys in a row each beside the last: asdf, sdfg, hjkl, qwer, 1qaz. */
const mashed = (characters: readonly string[]): boolean => windows(characters, 4).some((run) => run.slice(1).every((character, index) => neighbours(run[index] ?? "", character)))

/** Four letters climbing or falling by one: abcd, 1234, dcba; or kana by the row of the syllabary: あいうえ. */
const counted = (characters: readonly string[]): boolean =>
  windows(characters, 4).some((run) => {
    const codes = run.map((character) => character.codePointAt(0) ?? 0)
    const steps = codes.slice(1).map((code, index) => code - (codes[index] ?? 0))
    return steps.every((step) => step === steps[0] && (Math.abs(step) === 1 || Math.abs(step) === 2))
  })

/** Four consonants with no vowel between them in latin letters: nothing anyone would call a name. */
const UNPRONOUNCEABLE = /[b-df-hj-np-tv-xz]{4}/

/** The same character three times running, or the same two or three characters three times over. */
const REPEATED = /(.)\1{2}|(..)\2{2}|(...)\3{2}/u

/** Too few different characters for its length to have been written on purpose. */
const monotonous = (characters: readonly string[]): boolean => characters.length >= 6 && new Set(characters).size < characters.length / 2

/**
 * Whether text was typed to get past a form rather than to say something,
 * inferred from how it is made: keys mashed in a row, letters counted off,
 * consonants with no vowel, a character or a pair repeated, too few different
 * characters, or a placeholder word. Digits are judged only where asked: a
 * street number may well be 111 or 1234.
 */
export const looksLikePlaceholder = (text: string, withNumbers: boolean): boolean => {
  const plain = text.normalize("NFKC").toLowerCase().replace(/\s+/g, "")
  const characters = [...(withNumbers ? plain : plain.replace(/[0-9]+/g, ""))]
  const joined = characters.join("")
  return (
    PLACEHOLDER_WORDS.some((word) => plain.includes(word.normalize("NFKC").toLowerCase())) ||
    mashed(characters) ||
    counted(characters) ||
    UNPRONOUNCEABLE.test(joined) ||
    REPEATED.test(joined) ||
    monotonous(characters)
  )
}
