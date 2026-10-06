/**
 * A raster basemap a pin may be placed on. Only basemaps whose terms let what
 * is traced or placed on them be published freely belong here: Google Maps and
 * other proprietary maps never do.
 */
export interface Basemap {
  readonly id: string
  readonly tiles: string
  readonly maxZoom: number
  /** HTML, as MapLibre shows attributions. */
  readonly attribution: string
}

const GSI_ATTRIBUTION = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">出典：国土地理院</a>'

/** 地理院タイル 淡色地図: Japan, light, good under pins. */
export const GSI_PALE: Basemap = { id: "gsi-pale", tiles: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", maxZoom: 18, attribution: GSI_ATTRIBUTION }

/** 地理院タイル 標準地図. */
export const GSI_STANDARD: Basemap = { id: "gsi-std", tiles: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png", maxZoom: 18, attribution: GSI_ATTRIBUTION }

/** 地理院タイル 全国最新写真（シームレス）: aerial photographs, for finding an entrance. */
export const GSI_PHOTO: Basemap = { id: "gsi-photo", tiles: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg", maxZoom: 18, attribution: GSI_ATTRIBUTION }
