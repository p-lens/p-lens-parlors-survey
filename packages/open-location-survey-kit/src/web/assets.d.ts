declare module "*?worker&url" {
  const url: string
  export default url
}

declare module "*.css"

declare module "virtual:open-location-survey-kit/credits" {
  const credits: import("./config").Credits
  export default credits
}
