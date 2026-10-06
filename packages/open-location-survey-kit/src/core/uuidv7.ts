const hex = (bytes: Uint8Array): string => [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")

/**
 * A UUIDv7 from a time and sixteen random bytes: the time in its first 48
 * bits, so ids sort in the order they were made.
 */
export const uuidv7 = (now: number, random: Uint8Array): string => {
  const bytes = Uint8Array.from(random.slice(0, 16))
  const time = BigInt(now)
  bytes.set([40n, 32n, 24n, 16n, 8n, 0n].map((shift) => Number((time >> shift) & 0xffn)), 0)
  bytes[6] = 0x70 | ((bytes[6] ?? 0) & 0x0f)
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f)
  const text = hex(bytes)
  return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`
}
