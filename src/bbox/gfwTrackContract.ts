export interface GfwTrackProperties {
  vessel_id: string;
  mmsi: string | null;
  ship_name: string | null;
  start_at: string;
  end_at: string;
  point_count: number;
  segment_index: number;
  approximate: boolean;
  source_dataset: string;
}

export type GfwTrackFeature = GeoJSON.Feature<GeoJSON.LineString, GfwTrackProperties>;

export interface GfwTrackMetadata {
  bbox?: [number, number, number, number];
  date_start?: string;
  date_end?: string;
  generated_at?: string;
  row_count?: number;
  vessel_count?: number;
  segment_count?: number;
  displayed_segment_count?: number;
}

export interface ParsedGfwTracks {
  collection: GeoJSON.FeatureCollection<GeoJSON.LineString, GfwTrackProperties>;
  endpoints: GeoJSON.FeatureCollection<GeoJSON.Point, GfwTrackProperties & { endpoint: "start" | "end" }>;
  metadata: GfwTrackMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteCoordinate(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length >= 2
    && typeof value[0] === "number"
    && Number.isFinite(value[0])
    && typeof value[1] === "number"
    && Number.isFinite(value[1]);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`GFW track 缺少 ${field}`);
  }
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error(`GFW track ${field} 格式錯誤`);
  return value;
}

function nonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`GFW track ${field} 格式錯誤`);
  }
  return value;
}

function parseFeature(value: unknown): GfwTrackFeature {
  if (!isRecord(value) || value.type !== "Feature" || !isRecord(value.geometry)) {
    throw new Error("GFW track feature 格式錯誤");
  }
  if (value.geometry.type !== "LineString" || !Array.isArray(value.geometry.coordinates)) {
    throw new Error("GFW track geometry 必須是 LineString");
  }
  const coordinates = value.geometry.coordinates;
  if (coordinates.length < 2 || !coordinates.every(isFiniteCoordinate)) {
    throw new Error("GFW track LineString 至少需要兩個有效座標");
  }
  if (!isRecord(value.properties)) throw new Error("GFW track properties 格式錯誤");
  const properties = value.properties;
  const pointCount = nonNegativeInteger(properties.point_count, "point_count");
  if (pointCount < 2) throw new Error("GFW track point_count 必須至少為 2");
  if (pointCount !== coordinates.length) throw new Error("GFW track point_count 與座標數不符");
  if (typeof properties.approximate !== "boolean") {
    throw new Error("GFW track approximate 格式錯誤");
  }

  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates: coordinates as GeoJSON.Position[] },
    properties: {
      vessel_id: requiredString(properties.vessel_id, "vessel_id"),
      mmsi: nullableString(properties.mmsi, "mmsi"),
      ship_name: nullableString(properties.ship_name, "ship_name"),
      start_at: requiredString(properties.start_at, "start_at"),
      end_at: requiredString(properties.end_at, "end_at"),
      point_count: pointCount,
      segment_index: nonNegativeInteger(properties.segment_index, "segment_index"),
      approximate: properties.approximate,
      source_dataset: requiredString(properties.source_dataset, "source_dataset"),
    },
  };
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function parseMetadata(value: unknown): GfwTrackMetadata {
  if (!isRecord(value)) return {};
  const rawBbox = value.bbox;
  const bbox = Array.isArray(rawBbox)
    && rawBbox.length === 4
    && rawBbox.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))
    ? rawBbox as [number, number, number, number]
    : undefined;

  return {
    bbox,
    date_start: typeof value.date_start === "string" ? value.date_start : undefined,
    date_end: typeof value.date_end === "string"
      ? value.date_end
      : typeof value.date_end_inclusive === "string"
        ? value.date_end_inclusive
        : undefined,
    generated_at: typeof value.generated_at === "string" ? value.generated_at : undefined,
    row_count: optionalNumber(value.row_count),
    vessel_count: optionalNumber(value.vessel_count),
    segment_count: optionalNumber(value.segment_count),
    displayed_segment_count: optionalNumber(value.displayed_segment_count),
  };
}

export function parseGfwTrackCollection(input: unknown): ParsedGfwTracks {
  if (!isRecord(input) || input.type !== "FeatureCollection" || !Array.isArray(input.features)) {
    throw new Error("GFW POC 資料不是有效的 FeatureCollection");
  }

  const features = input.features.map(parseFeature);
  const endpoints: ParsedGfwTracks["endpoints"]["features"] = [];
  for (const feature of features) {
    const coordinates = feature.geometry.coordinates;
    endpoints.push(
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: coordinates[0]! },
        properties: { ...feature.properties, endpoint: "start" },
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: coordinates[coordinates.length - 1]! },
        properties: { ...feature.properties, endpoint: "end" },
      },
    );
  }

  return {
    collection: { type: "FeatureCollection", features },
    endpoints: { type: "FeatureCollection", features: endpoints },
    metadata: parseMetadata(input.metadata),
  };
}
