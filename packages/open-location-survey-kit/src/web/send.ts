import { Err, Ok, type Result } from "../core/result"
import { REPORTS_PATH } from "../core/reports-path"
import { isJson, type Problem } from "../core/schema"

/** Why a report was not taken, as the page tells it. */
export type SendError =
  | { readonly type: "invalid"; readonly problems: readonly Problem[] }
  | { readonly type: "turnstile" }
  | { readonly type: "too-many" }
  | { readonly type: "unavailable" }
  | { readonly type: "offline" }

const answerOf = async (response: Response): Promise<unknown> => {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

const refusalOf = (answer: unknown): SendError => {
  if (!isJson(answer)) return { type: "unavailable" }
  if (answer["type"] === "invalid" && Array.isArray(answer["problems"])) return { type: "invalid", problems: answer["problems"] as readonly Problem[] }
  if (answer["type"] === "turnstile") return { type: "turnstile" }
  return answer["type"] === "too-many" ? { type: "too-many" } : { type: "unavailable" }
}

/** Send a report; the answer is the id it was filed under. */
export const sendReport = async (envelope: unknown): Promise<Result<string, SendError>> => {
  try {
    const response = await fetch(REPORTS_PATH, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(envelope) })
    const answer = await answerOf(response)
    if (!response.ok) return Err(refusalOf(answer))
    const id = isJson(answer) ? answer["id"] : undefined
    return typeof id === "string" && id !== "" ? Ok(id) : Err({ type: "unavailable" })
  } catch {
    return Err({ type: "offline" })
  }
}
