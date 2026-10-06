/** A run of text within a block: plain, strong, or a link. */
export type Inline = { readonly type: "text"; readonly text: string } | { readonly type: "strong"; readonly text: string } | { readonly type: "link"; readonly text: string; readonly url: string }

/** A block of a document: a heading, a paragraph, or a list of items. */
export type Block =
  | { readonly type: "heading"; readonly level: 1 | 2 | 3; readonly inlines: readonly Inline[] }
  | { readonly type: "paragraph"; readonly inlines: readonly Inline[] }
  | { readonly type: "list"; readonly items: readonly (readonly Inline[])[] }

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g

/** Only addresses a page may safely link to; anything else is left as the text it was written as. */
const linkable = (url: string): boolean => /^(https?:\/\/|mailto:|\/)/.test(url)

/** Runs of plain text that ended up side by side, as one run. */
const joined = (inlines: readonly Inline[]): readonly Inline[] =>
  inlines.reduce<readonly Inline[]>((runs, inline) => {
    const last = runs[runs.length - 1]
    return last?.type === "text" && inline.type === "text" ? [...runs.slice(0, -1), { type: "text", text: last.text + inline.text }] : [...runs, inline]
  }, [])

const inlinesOf = (text: string): readonly Inline[] => {
  const found = [...text.matchAll(INLINE)]
  const ends = [0, ...found.map((match) => match.index + match[0].length)]
  const runs = found.flatMap((match, at): readonly Inline[] => {
    const run: Inline =
      match[1] !== undefined
        ? { type: "strong", text: match[1] }
        : match[2] !== undefined && match[3] !== undefined && linkable(match[3])
          ? { type: "link", text: match[2], url: match[3] }
          : { type: "text", text: match[0] }
    return [{ type: "text", text: text.slice(ends[at], match.index) }, run]
  })
  return joined([...runs, { type: "text" as const, text: text.slice(ends[ends.length - 1]) }].filter((inline) => inline.text !== ""))
}

const headingOf = (line: string): Block | undefined => {
  const marked = /^(#{1,3})\s+(.+)$/.exec(line)
  if (marked === null || marked[1] === undefined || marked[2] === undefined) return undefined
  return { type: "heading", level: marked[1].length as 1 | 2 | 3, inlines: inlinesOf(marked[2]) }
}

const blockOf = (lines: readonly string[]): readonly Block[] => {
  const first = lines[0]
  if (first === undefined) return []
  const heading = headingOf(first)
  if (heading !== undefined) return [heading, ...blockOf(lines.slice(1))]
  if (lines.every((line) => /^[-*]\s+/.test(line))) return [{ type: "list", items: lines.map((line) => inlinesOf(line.replace(/^[-*]\s+/, ""))) }]
  return [{ type: "paragraph", inlines: inlinesOf(lines.join("")) }]
}

/**
 * A document written in the small part of Markdown a policy needs, as blocks
 * to draw: `#` to `###` headings, paragraphs set apart by a blank line, `-`
 * lists, `**strong**` and `[links](https://…)`. Comments (`<!-- -->`) are
 * notes to whoever edits the file and are left out. Lines of one paragraph
 * are joined as they are, since Japanese puts no space between them.
 *
 * Nothing else is Markdown here: no HTML is passed through, so what is drawn
 * is only ever what these blocks say.
 */
export const blocksOfMarkdown = (source: string): readonly Block[] =>
  source
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/\r?\n\s*\r?\n/)
    .map((chunk) => chunk.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== ""))
    .flatMap(blockOf)
