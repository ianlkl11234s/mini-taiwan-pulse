import type { StyleSpecification } from "maplibre-gl";
import type { FeatureCollection, LineString } from "geojson";

/** Offline coordinate reference, not a street/boundary dataset. No provider I/O. */
export function coordinateCanvas(): StyleSpecification {
  const grid: FeatureCollection<LineString> = { type: "FeatureCollection", features: [] };
  for (let i = 0; i <= 20; i++) {
    const offset = i * 0.01;
    grid.features.push(
      { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[121.45 + offset, 24.95], [121.45 + offset, 25.15]] } },
      { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[121.45, 24.95 + offset], [121.65, 24.95 + offset]] } },
    );
  }
  return { version: 8, sources: { grid: { type: "geojson", data: grid } }, layers: [
    { id: "paper", type: "background", paint: { "background-color": "#e8e7df" } },
    { id: "coordinates", type: "line", source: "grid", paint: { "line-color": "#bdc8c0", "line-width": 0.6, "line-opacity": 0.65 } },
  ] };
}
