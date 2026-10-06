import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import { surveyKit } from "open-location-survey-kit/vite"
import solid from "vite-plugin-solid"

import { branding } from "./branding/branding"

/** Where `wrangler dev` serves the API while developing; the built site has it on the same origin. */
const LOCAL_API = "http://localhost:8787"

export default defineConfig({
  server: { port: 8140, strictPort: true, proxy: { "/api": LOCAL_API } },
  preview: { port: 8140, strictPort: true },
  plugins: [solid(), tailwindcss(), surveyKit({ title: branding.title, summary: branding.summary })],
  worker: { format: "es" },
})
