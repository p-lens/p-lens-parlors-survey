const VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

/** Whether Cloudflare Turnstile vouches for the token the page got; no token is never vouched for, nor is one it could not be asked about. */
export const turnstilePasses = async (secret: string, token: string | undefined, ip: string | undefined, outbound: typeof fetch): Promise<boolean> => {
  if (token === undefined) return false
  const form = new FormData()
  form.append("secret", secret)
  form.append("response", token)
  if (ip !== undefined) form.append("remoteip", ip)
  try {
    const response = await outbound(VERIFY, { method: "POST", body: form })
    if (!response.ok) return false
    const answer: unknown = await response.json()
    return typeof answer === "object" && answer !== null && "success" in answer && answer.success === true
  } catch {
    return false
  }
}
