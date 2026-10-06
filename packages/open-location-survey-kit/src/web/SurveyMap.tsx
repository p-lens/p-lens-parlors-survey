import type { FeatureCollection } from "geojson"
import { AttributionControl, MapLibreMap, NavigationControl, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent, type StyleSpecification } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
import { createEffect, onCleanup, onMount, Show, type JSX } from "solid-js"

import type { Basemap } from "../core/basemaps"
import type { ListedSubject } from "../core/listed"

export interface MapPoint {
  readonly latitude: number
  readonly longitude: number
}

/** Where the map should go, with a stamp so asking for the same place twice still moves it. */
export interface Focus {
  readonly point: MapPoint
  readonly zoom: number
  readonly stamp: number
}

/**
 * MapLibre 6 draws in a worker it loads from a file of its own, which a
 * bundler cannot follow; the worker is bundled here and its address handed over.
 */
setWorkerUrl(workerUrl)

const styleOf = (basemap: Basemap, attribution: string): StyleSpecification => ({
  version: 8,
  sources: { base: { type: "raster", tiles: [basemap.tiles], tileSize: 256, maxzoom: basemap.maxZoom, attribution: `${basemap.attribution} | ${attribution}` } },
  layers: [{ id: "base", type: "raster", source: "base" }],
})

const token = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const featuresOf = (subjects: readonly ListedSubject[]): FeatureCollection => ({
  type: "FeatureCollection",
  features: subjects.flatMap((subject) =>
    subject.position === undefined
      ? []
      : [{ type: "Feature", properties: { id: subject.id }, geometry: { type: "Point", coordinates: [subject.position.longitude, subject.position.latitude] } }],
  ),
})

const addSubjectLayers = (map: MapLibreMap, subjects: readonly ListedSubject[], selectedId: string): void => {
  map.addSource("subjects", { type: "geojson", data: featuresOf(subjects) })
  map.addLayer({
    id: "subjects",
    type: "circle",
    source: "subjects",
    paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 12, 6, 16, 9], "circle-color": token("--pin"), "circle-stroke-width": 1, "circle-stroke-color": token("--pin-outline") },
  })
  map.addLayer({
    id: "subjects-selected",
    type: "circle",
    source: "subjects",
    filter: ["==", ["get", "id"], selectedId],
    paint: { "circle-radius": 10, "circle-color": token("--pin-selected"), "circle-stroke-width": 2, "circle-stroke-color": token("--pin-outline") },
  })
}

/**
 * Folds the attribution down to its icon. MapLibre does this itself when the
 * map is dragged but not when it is zoomed, and offers no call for it, so the
 * class it shows the text by is taken off.
 */
const foldAttribution = (map: MapLibreMap): void => map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show")

/** The crosshair a position is placed under: the map moves, the point stays in the middle. */
const Crosshair = (): JSX.Element => (
  <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
    <div class="relative h-10 w-10">
      <div class="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-negative" />
      <div class="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-negative" />
      <div class="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-negative bg-surface-2" />
    </div>
  </div>
)

/** The map of listed things on a free basemap, which takes a position under its crosshair while placing. */
export const SurveyMap = (props: {
  readonly basemap: Basemap
  /** HTML naming where the listed things come from, shown beside the basemap's. */
  readonly attribution: string
  readonly start: Focus
  readonly subjects: readonly ListedSubject[]
  readonly selectedId: string | undefined
  readonly placing: boolean
  readonly focus: Focus | undefined
  readonly onSelect: (id: string) => void
  readonly onCenter: (point: MapPoint) => void
}): JSX.Element => {
  const held: { map: MapLibreMap | undefined; container: HTMLDivElement | undefined; watcher: ResizeObserver | undefined } = { map: undefined, container: undefined, watcher: undefined }

  onMount(() => {
    if (held.container === undefined) return
    const map = new MapLibreMap({
      container: held.container,
      style: styleOf(props.basemap, props.attribution),
      center: [props.start.point.longitude, props.start.point.latitude],
      zoom: props.start.zoom,
      maxZoom: props.basemap.maxZoom,
      attributionControl: false,
    })
    map.addControl(new AttributionControl({ compact: true }), "bottom-left")
    map.addControl(new NavigationControl({ showCompass: false }), "top-right")
    map.on("load", () => addSubjectLayers(map, props.subjects, props.selectedId ?? ""))
    map.on("click", "subjects", (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.["id"]
      if (typeof id === "string") props.onSelect(id)
    })
    map.on("mouseenter", "subjects", () => map.getCanvas().style.setProperty("cursor", "pointer"))
    map.on("mouseleave", "subjects", () => map.getCanvas().style.removeProperty("cursor"))
    map.on("zoomstart", () => foldAttribution(map))
    map.on("move", () => {
      const center = map.getCenter()
      props.onCenter({ latitude: center.lat, longitude: center.lng })
    })
    held.watcher = new ResizeObserver(() => map.resize())
    held.watcher.observe(held.container)
    held.map = map
  })

  createEffect(() => {
    const data = featuresOf(props.subjects)
    const source = held.map?.getSource("subjects") as GeoJSONSource | undefined
    source?.setData(data)
  })

  createEffect(() => {
    const id = props.selectedId ?? ""
    if (held.map?.getLayer("subjects-selected") !== undefined) held.map.setFilter("subjects-selected", ["==", ["get", "id"], id])
  })

  createEffect(() => {
    const focus = props.focus
    if (focus !== undefined) held.map?.flyTo({ center: [focus.point.longitude, focus.point.latitude], zoom: focus.zoom, speed: 1.6 })
  })

  onCleanup(() => {
    held.watcher?.disconnect()
    held.map?.remove()
  })

  return (
    <div class="relative h-full w-full">
      <div ref={(element) => (held.container = element)} class="h-full w-full" />
      <Show when={props.placing}>
        <Crosshair />
      </Show>
    </div>
  )
}
