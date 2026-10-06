import type { Feature, Point } from "geojson"

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
