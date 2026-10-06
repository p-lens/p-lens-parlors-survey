import type { Plugin } from "vite"

import { collectCredits } from "./credits"

/** The module the licences page asks for, and the name Vite keeps it under. */
const CREDITS = "virtual:open-location-survey-kit/credits"
const RESOLVED = `\0${CREDITS}`

/**
 * What a survey page built with Vite needs beside its own plugins.
 *
 * The page's name and what search engines are told of it are written into
 * its HTML, so they are said once, where the survey says who it is. The
 * licences of everything served with the page are collected from what is
 * installed each time it is built, and handed to the licences page as a
 * module of its own, so nobody carries them who does not open that page.
 */
export const surveyKit = (page: { readonly title: string; readonly summary: string }): Plugin => {
  const held: { root: string } = { root: process.cwd() }
  return {
    name: "open-location-survey-kit",
    configResolved: (config) => {
      held.root = config.root
    },
    transformIndexHtml: () => [
      { tag: "title", children: page.title, injectTo: "head" },
      { tag: "meta", attrs: { name: "description", content: page.summary }, injectTo: "head" },
    ],
    resolveId: (id) => (id === CREDITS ? RESOLVED : undefined),
    load: (id) => (id === RESOLVED ? `export default ${JSON.stringify(collectCredits(held.root, new Date().toISOString().slice(0, 10)))}` : undefined),
  }
}
