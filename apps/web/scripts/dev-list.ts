/**
 * Writes a local copy of the parlor list into public/list/ for development,
 * from a parlors dataset JSONL (the one built from OpenStreetMap and the
 * operators' own lists). Parlors with a position go to parlors.jsonl, the rest
 * to unplaced.jsonl. The published list is the parlor list repository's job;
 * this copy is never committed.
 *
 *   bun scripts/dev-list.ts <dataset.jsonl>
 */
import { mkdir } from "node:fs/promises"
import { join } from "node:path"

interface DatasetRow {
  readonly osm: string | null
  readonly lat: number | null
  readonly lon: number | null
  readonly name: string | null
  readonly reading: string | null
  readonly prefecture: string | null
  readonly address: string | null
  readonly officialUrl: string | null
}

const source = process.argv[2]
if (source === undefined) {
  console.error("usage: bun scripts/dev-list.ts <dataset.jsonl>")
  process.exit(1)
}

const listed = (row: DatasetRow) => ({
  id: row.osm ?? `official:${row.officialUrl ?? ""}`,
  name: row.name,
  reading: row.reading ?? "",
  prefecture: row.prefecture,
  address: row.address ?? undefined,
  officialUrl: row.officialUrl ?? undefined,
  ...(row.lat === null || row.lon === null ? {} : { lat: row.lat, lon: row.lon }),
})

const rows = (await Bun.file(source).text())
  .split("\n")
  .filter((line) => line.trim() !== "")
  .map((line) => JSON.parse(line) as DatasetRow)
  .filter((row) => row.name !== null && row.prefecture !== null)

const out = join(import.meta.dir, "..", "public", "list")
await mkdir(out, { recursive: true })
const lines = (selected: readonly DatasetRow[]): string => selected.map((row) => JSON.stringify(listed(row))).join("\n") + "\n"
const placed = rows.filter((row) => row.lat !== null)
const unplaced = rows.filter((row) => row.lat === null)
await Bun.write(join(out, "parlors.jsonl"), lines(placed))
await Bun.write(join(out, "unplaced.jsonl"), lines(unplaced))
console.log(`parlors.jsonl ${placed.length}, unplaced.jsonl ${unplaced.length}`)
