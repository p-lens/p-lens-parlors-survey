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
  /** What ¥1,000 usually rents there, in balls or medals: the rate turned over. A corner that rents otherwise says so in its own report. */
  readonly rental: number
}

const SUMMED_FOR = 1000

const cornerOf = (game: Corner["game"], rate: number): Corner => ({
  label: `${String(rate)}円${game === "pachinko" ? "パチンコ" : "スロット"}`,
  game,
  tier: `${String(rate)}円`,
  rental: SUMMED_FOR / rate,
})

/** The corners a report may choose, the commonest first: most parlors have the first four and few have the last. */
export const CORNERS: readonly Corner[] = [
  cornerOf("pachinko", 4),
  cornerOf("pachinko", 1),
  cornerOf("pachislot", 20),
  cornerOf("pachislot", 5),
  cornerOf("pachinko", 2),
  cornerOf("pachinko", 0.5),
  cornerOf("pachislot", 10),
  cornerOf("pachislot", 2),
  cornerOf("pachislot", 1),
  cornerOf("pachinko", 0.25),
  cornerOf("pachinko", 0.2),
  cornerOf("pachislot", 0.5),
]

/** The corner a row of a report chose, by what the form calls it. */
export const cornerCalled = (label: unknown): Corner | undefined => CORNERS.find((corner) => corner.label === label)

/** Words by corner, one for each game: what a count is called in a row of that corner. */
export const wordsByCorner = (words: Readonly<Record<Corner["game"], string>>): Readonly<Record<string, string>> => Object.fromEntries(CORNERS.map((corner) => [corner.label, words[corner.game]] as const))
