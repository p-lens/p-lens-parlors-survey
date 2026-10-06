import { onCleanup, onMount, type JSX } from "solid-js"

interface TurnstileApi {
  readonly render: (element: HTMLElement, options: { readonly sitekey: string; readonly callback: (token: string) => void; readonly "expired-callback": () => void }) => string
  readonly remove: (widget: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"

const loaded: { script: Promise<TurnstileApi | undefined> | undefined } = { script: undefined }

const turnstileApi = (): Promise<TurnstileApi | undefined> => {
  loaded.script ??= new Promise((resolve) => {
    const script = document.createElement("script")
    script.src = SCRIPT
    script.async = true
    script.onload = () => resolve(window.turnstile)
    script.onerror = () => resolve(undefined)
    document.head.append(script)
  })
  return loaded.script
}

/** Cloudflare Turnstile's challenge, loaded only on a page that names a key. */
export const Turnstile = (props: { readonly siteKey: string; readonly onToken: (token: string | undefined) => void }): JSX.Element => {
  const held: { element: HTMLDivElement | undefined; widget: string | undefined; api: TurnstileApi | undefined } = { element: undefined, widget: undefined, api: undefined }
  onMount(async () => {
    const api = await turnstileApi()
    if (api === undefined || held.element === undefined) return
    held.api = api
    held.widget = api.render(held.element, { sitekey: props.siteKey, callback: (token) => props.onToken(token), "expired-callback": () => props.onToken(undefined) })
  })
  onCleanup(() => {
    if (held.widget !== undefined) held.api?.remove(held.widget)
  })
  return <div ref={(element) => (held.element = element)} />
}
