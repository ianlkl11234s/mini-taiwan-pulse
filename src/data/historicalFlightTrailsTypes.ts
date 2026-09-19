export type HistoricalFlightCountry = 'TW' | 'JP';
/** Selector value for the country-wide, date-specific static trail view. */
export const HISTORICAL_FLIGHT_ALL_AIRPORTS = 'ALL' as const;
export const HISTORICAL_FLIGHT_COLORS = ['#4d99ff', '#ffffff'] as const;
export interface HistoricalFlightAsset { path: string; bytes: number; sha256: string }
export interface HistoricalFlightAirport {
  icao: string; iata: string; name: string; country: HistoricalFlightCountry;
  timezone: string; center: [number, number];
}
export interface HistoricalFlightSample {
  country: HistoricalFlightCountry; airport: string; date: string;
  sample_kind: 'weekday' | 'weekend' | 'special'; label: string;
  asset: HistoricalFlightAsset | null; flight_count: number; point_count: number;
  coverage: 'partial' | 'unavailable'; note: string;
}
export interface HistoricalFlightManifest {
  schema: 'historical-flight-trails-v1'; release_id: string; generated_at: string;
  source: string; license_status: string;
  airports: HistoricalFlightAirport[]; samples: HistoricalFlightSample[];
}
export interface HistoricalFlightProperties {
  flight_id: string; callsign: string | null; flight_number: string | null;
  operator: string | null; aircraft_type: string | null;
  origin_icao: string | null; origin_iata: string | null;
  dest_icao: string | null; dest_iata: string | null;
  dep_time: number | null; arr_time: number | null;
  observed_start: number | null; observed_end: number | null;
  roles: ('departure' | 'arrival')[];
  route_scope: 'domestic' | 'cross_border' | 'unknown';
  gap_count: number; invalid_point_count: number; non_monotonic_count: number;
  source_point_count: number; retained_point_count: number;
}
export interface HistoricalFlightCollection extends GeoJSON.FeatureCollection<GeoJSON.MultiLineString, HistoricalFlightProperties> {
  meta: { country: HistoricalFlightCountry; airport: string; date: string; timezone: string; coverage: string; note: string };
}
export interface HistoricalFlightParams {
  airport: string; date: string; opacity: number; width: number; altitudeScale?: number;
  direction: 'all' | 'departure' | 'arrival';
  routeScope: 'all' | 'domestic' | 'cross_border' | 'unknown';
}
