import type { JSX } from "solid-js"

import type { SurveyConfig } from "./config"
import { CloseButton } from "./controls"

const linkClass = "text-xs text-text-secondary underline hover:text-text-primary"

/**
 * What the survey is, in a few lines, and the way to the rest: its privacy
 * policy, where its list is kept and reports are filed, the licences it stands
 * on, and who runs it.
 */
export const AboutPanel = (props: { readonly config: SurveyConfig; readonly onPrivacy: () => void; readonly onLicenses: () => void; readonly onClose: () => void }): JSX.Element => {
  const words = props.config.words.ui
  return (
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-lg font-bold text-text-primary">{words.about}</h2>
        <CloseButton label={words.close} onClick={props.onClose} />
      </div>
      <p class="text-sm text-text-secondary">{props.config.branding.description}</p>
      <hr class="border-border" />
      <div class="flex flex-col gap-2">
        <div class="flex items-baseline justify-between gap-3">
          <a class={linkClass} href={props.config.branding.operatorUrl} target="_blank" rel="noreferrer">
            {words.operator}
          </a>
          <button type="button" class={linkClass} onClick={() => props.onPrivacy()}>
            {words.privacy}
          </button>
        </div>
        <div class="flex items-baseline justify-between gap-3">
          <a class={linkClass} href={props.config.branding.dataLink.url} target="_blank" rel="noreferrer">
            {props.config.branding.dataLink.label}
          </a>
          <button type="button" class={linkClass} onClick={() => props.onLicenses()}>
            {words.licenses}
          </button>
        </div>
      </div>
    </div>
  )
}
