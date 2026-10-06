const KEY = "open-location-survey-kit:contributor"

const stored = (): string | undefined => {
  try {
    return localStorage.getItem(KEY) ?? undefined
  } catch {
    return undefined
  }
}

const keep = (id: string): void => {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    return
  }
}

/**
 * This device's pseudonym as a contributor: a UUID it makes for itself and
 * keeps, so its reports can be told apart without knowing who sent them.
 * Where the browser keeps nothing, each visit is a new pseudonym.
 */
export const contributorId = (): string => {
  const known = stored()
  if (known !== undefined) return known
  const made = crypto.randomUUID()
  keep(made)
  return made
}
