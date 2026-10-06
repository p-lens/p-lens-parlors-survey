import type { Feature, FeatureCollection, Point } from "geojson"

import type { SurveyRecord } from "./record"

/**
 * A record as a GeoJSON Feature: a point where the report put the thing, or
 * no geometry when it names a listed thing without placing it. Properties
 * carry the whole record, its licence and provenance included.
 */
export const featureOf = (record: SurveyRecord): Feature<Point | null> => {
  const position = record.observation.kind === "add" || record.observation.kind === "locate" ? record.observation.position : undefined
  return {
    type: "Feature",
    id: record.id,
    geometry: position === undefined ? null : { type: "Point", coordinates: [position.longitude, position.latitude] },
    properties: { ...record },
  }
}

/** How far around a position its surroundings are shown, in metres: far enough for the streets that lead to it. */
const SURROUNDINGS_METRES = 300

/** How many straight pieces the ring around a position is drawn in: enough to read as a circle. */
const RING_PIECES = 48

const METRES_PER_DEGREE = 111_320

/** Degrees to as many places as tell a metre apart, so the ring is not written longer than it is drawn. */
const rounded = (degrees: number): number => Math.round(degrees * 1e6) / 1e6

/**
 * A position with its surroundings, for a map a person looks at: the point,
 * and a ring around it. A map fitted to a single point goes as close as it
 * can, where there is nothing to tell the place by; the ring gives it the
 * streets around to fit to instead. It is a line and not an area, so it
 * covers nothing of the map under it, and it cannot be hidden: GitHub draws
 * what it is given in its own colours. Nothing for a record that places
 * nothing.
 *
 * This is for the eye. The record itself is `featureOf`.
 */
export const surroundingsOf = (record: SurveyRecord): FeatureCollection | undefined => {
  const position = record.observation.kind === "add" || record.observation.kind === "locate" ? record.observation.position : undefined
  if (position === undefined) return undefined
  const north = SURROUNDINGS_METRES / METRES_PER_DEGREE
  const east = north / Math.cos((position.latitude * Math.PI) / 180)
  const ring = Array.from({ length: RING_PIECES + 1 }, (_, piece): [number, number] => {
    const angle = (2 * Math.PI * piece) / RING_PIECES
    return [rounded(position.longitude + Math.cos(angle) * east), rounded(position.latitude + Math.sin(angle) * north)]
  })
  return {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [position.longitude, position.latitude] }, properties: {} },
      { type: "Feature", geometry: { type: "LineString", coordinates: ring }, properties: {} },
    ],
  }
}
