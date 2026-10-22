/**
 * A corner a parlor may have: its game at a rate, as its board says it. A
 * report chooses its corners from these and types no rate, so a corner is
 * the same corner whoever reports it.
 */
export interface Corner {
  /** What the form calls it: `4円パチンコ`, `20円スロット`. */
  readonly label: string
  /** The game as the published lists write it. */
  readonly game: "pachinko" | "pachislot"
  /** The rate as the published lists write it: `4円`, `0.5円`. */
  readonly tier: string
  /** What ¥1,000 usually rents there, in balls or medals (`RENTED_FOR`). A corner that rents otherwise says so in its own report. */
  readonly rental: number
}

/**
 * What a corner's rate is turned over against for what ¥1,000 usually
 * rents there: ¥1,000 at pachinko, and at pachislot the 46 medals 20円
 * rents for ¥1,000 — the rate turned over less 8% — as most parlors rent
 * medals. A rate this does not divide names its rental itself.
 */
const RENTED_FOR: Readonly<Record<Corner["game"], number>> = { pachinko: 1000, pachislot: 920 }

const cornerOf = (game: Corner["game"], rate: number, rental = RENTED_FOR[game] / rate): Corner => ({
  label: `${String(rate)}円${game === "pachinko" ? "パチンコ" : "スロット"}`,
  game,
  tier: `${String(rate)}円`,
  rental,
})

/** The corners a report may choose, by how many parlors have them: the four most have, those some have, and those few have. */
export const CORNER_GROUPS: readonly (readonly Corner[])[] = [
  [cornerOf("pachinko", 4), cornerOf("pachinko", 1), cornerOf("pachislot", 20), cornerOf("pachislot", 5)],
  [cornerOf("pachinko", 2), cornerOf("pachinko", 0.5), cornerOf("pachislot", 10), cornerOf("pachislot", 8), cornerOf("pachislot", 6, 153), cornerOf("pachislot", 2), cornerOf("pachislot", 1)],
  [cornerOf("pachinko", 0.25), cornerOf("pachinko", 0.2), cornerOf("pachislot", 0.5)],
]

/** The corners a report may choose, the commonest first. */
export const CORNERS: readonly Corner[] = CORNER_GROUPS.flat()

/** Where one group of corners ends and the next begins, by its first corner's place among them all. */
export const CORNER_BREAKS: readonly number[] = CORNER_GROUPS.slice(0, -1).map((_, at) => CORNER_GROUPS.slice(0, at + 1).flat().length)

/** The corner a row of a report chose, by what the form calls it. */
export const cornerCalled = (label: unknown): Corner | undefined => CORNERS.find((corner) => corner.label === label)

/** Words by corner, one for each game: what a count is called in a row of that corner. */
export const wordsByCorner = (words: Readonly<Record<Corner["game"], string>>): Readonly<Record<string, string>> => Object.fromEntries(CORNERS.map((corner) => [corner.label, words[corner.game]] as const))
