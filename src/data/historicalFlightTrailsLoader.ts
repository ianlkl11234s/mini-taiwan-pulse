import { withLoading } from '../lib/loadingRegistry';
import { cachedByKey } from '../lib/loaderCache';
import {
  HISTORICAL_FLIGHT_ALL_AIRPORTS,
  type HistoricalFlightAsset,
  type HistoricalFlightCollection,
  type HistoricalFlightCountry,
  type HistoricalFlightManifest,
} from './historicalFlightTrailsTypes';

function baseUrl(): string {
  const configured = String(import.meta.env.VITE_FLIGHT_TRAILS_CDN_BASE ?? '').replace(/\/$/, '');
  if (configured) return configured;
  if (import.meta.env.DEV) return `${import.meta.env.BASE_URL ?? '/'}flight-trails`;
  throw new Error('歷史軌跡尚未設定靜態資料來源');
}
export function historicalFlightAssetPath(path: string): string {
  if (!/^releases\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\.geojson$/.test(path)) {
    throw new Error('歷史軌跡資產路徑不合法');
  }
  return path;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('歷史軌跡資料格式錯誤');
  return value as Record<string, unknown>;
}
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const count = (value: unknown) => Number.isInteger(value) && Number(value) >= 0;
export function parseHistoricalFlightManifest(raw: unknown): HistoricalFlightManifest {
  const m = record(raw);
  if (m.schema !== 'historical-flight-trails-v1' || typeof m.release_id !== 'string'
    || !Array.isArray(m.airports) || !Array.isArray(m.samples)) throw new Error('歷史軌跡目錄版本錯誤');
  const airports = new Set<string>();
  for (const rawAirport of m.airports) {
    const a = record(rawAirport);
    if (!['TW', 'JP'].includes(String(a.country)) || !/^[A-Z0-9]{4}$/.test(String(a.icao))
      || typeof a.name !== 'string' || !Array.isArray(a.center) || a.center.length !== 2
      || !a.center.every(finite) || Math.abs(Number(a.center[0])) > 180 || Math.abs(Number(a.center[1])) > 90
      || a.timezone !== (a.country === 'TW' ? 'Asia/Taipei' : 'Asia/Tokyo')) throw new Error('歷史軌跡機場資料錯誤');
    const key = `${a.country}:${a.icao}`;
    if (airports.has(key)) throw new Error('歷史軌跡機場重複');
    airports.add(key);
  }
  const selectors = new Set<string>();
  for (const rawSample of m.samples) {
    const s = record(rawSample);
    const key = `${s.country}:${s.airport}:${s.date}`;
    if (!airports.has(`${s.country}:${s.airport}`) || selectors.has(key)
      || !/^\d{4}-\d{2}-\d{2}$/.test(String(s.date)) || !['weekday', 'weekend', 'special'].includes(String(s.sample_kind))
      || !['partial', 'unavailable'].includes(String(s.coverage)) || !count(s.flight_count) || !count(s.point_count)
      || typeof s.label !== 'string' || typeof s.note !== 'string') throw new Error('歷史軌跡樣本資料錯誤');
    selectors.add(key);
    if (s.asset === null) {
      if (s.coverage !== 'unavailable' || s.flight_count !== 0 || s.point_count !== 0) throw new Error('歷史軌跡缺值狀態矛盾');
    } else {
      const a = record(s.asset);
      historicalFlightAssetPath(String(a.path));
      if (!count(a.bytes) || Number(a.bytes) < 2 || !/^[a-f0-9]{64}$/.test(String(a.sha256))
        || s.coverage !== 'partial' || Number(s.flight_count) < 1) throw new Error('歷史軌跡資產索引錯誤');
    }
  }
  return raw as HistoricalFlightManifest;
}
export function parseHistoricalFlightCollection(raw: unknown): HistoricalFlightCollection {
  const c = record(raw), meta = record(c.meta);
  if (c.type !== 'FeatureCollection' || !Array.isArray(c.features) || !['TW', 'JP'].includes(String(meta.country))
    || typeof meta.airport !== 'string' || typeof meta.date !== 'string') throw new Error('歷史軌跡幾何格式錯誤');
  const ids = new Set<string>();
  for (const rawFeature of c.features) {
    const f = record(rawFeature), g = record(f.geometry), p = record(f.properties);
    if (f.type !== 'Feature' || g.type !== 'MultiLineString' || !Array.isArray(g.coordinates)
      || !g.coordinates.length || typeof p.flight_id !== 'string' || ids.has(p.flight_id)
      || !Array.isArray(p.roles) || !p.roles.length || p.roles.some(role => !['departure', 'arrival'].includes(String(role)))
      || !['domestic', 'cross_border', 'unknown'].includes(String(p.route_scope))) throw new Error('歷史軌跡航班格式錯誤');
    ids.add(p.flight_id);
    for (const segment of g.coordinates) {
      if (!Array.isArray(segment) || segment.length < 2) throw new Error('歷史軌跡線段不足兩點');
      for (const point of segment) {
        if (!Array.isArray(point) || point.length < 2 || !point.every(finite)
          || Math.abs(Number(point[0])) > 180 || Math.abs(Number(point[1])) > 90) throw new Error('歷史軌跡座標錯誤');
      }
    }
  }
  return raw as HistoricalFlightCollection;
}
async function fetchJson(url: string, expected?: HistoricalFlightAsset): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`歷史軌跡載入失敗 HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (expected) {
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map(value => value.toString(16).padStart(2, '0')).join('');
    if (bytes.byteLength !== expected.bytes || hash !== expected.sha256) throw new Error('歷史軌跡檔案完整性驗證失敗');
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
// A session pins a single manifest; old/new release selectors never mix mid-view.
const manifestCache = cachedByKey(async (base: string) => withLoading('historical-flight-manifest', '歷史飛行軌跡目錄',
  fetchJson(`${base}/manifest.json`).then(parseHistoricalFlightManifest)), Infinity, 1);
const assetCache = cachedByKey(async (key: string) => {
  const { base, asset } = JSON.parse(key) as { base: string; asset: HistoricalFlightAsset };
  return withLoading(`historical-flight:${asset.path}`, '歷史飛行軌跡',
    fetchJson(`${base}/${historicalFlightAssetPath(asset.path)}`, asset).then(parseHistoricalFlightCollection));
}, Infinity, 3);
export function fetchHistoricalFlightManifest(): Promise<HistoricalFlightManifest> { return manifestCache(baseUrl()); }
export function fetchHistoricalFlightAsset(asset: HistoricalFlightAsset): Promise<HistoricalFlightCollection> {
  return assetCache(JSON.stringify({ base: baseUrl(), asset }));
}

export interface HistoricalFlightAllAirportsResult {
  data: HistoricalFlightCollection;
  availableAirportCount: number;
  totalAirportCount: number;
}

/**
 * Joins a country/date's published airport assets for the explicit ALL selector.
 * Assets stay individually cached and verified; this does not introduce a database path.
 */
export async function fetchHistoricalFlightAllAirports(
  manifest: HistoricalFlightManifest,
  country: HistoricalFlightCountry,
  date: string,
): Promise<HistoricalFlightAllAirportsResult | null> {
  const samples = manifest.samples.filter(sample => sample.country === country && sample.date === date && sample.asset);
  const totalAirportCount = manifest.airports.filter(airport => airport.country === country).length;
  if (!samples.length) return null;

  const collections = await Promise.all(samples.map(async sample => {
    const data = await fetchHistoricalFlightAsset(sample.asset!);
    if (data.meta.country !== country || data.meta.airport !== sample.airport || data.meta.date !== date
      || data.features.length !== sample.flight_count) throw new Error('歷史軌跡樣本與目錄不一致');
    return data;
  }));

  const byFlightId = new Map<string, { feature: HistoricalFlightCollection['features'][number]; roles: Set<'departure' | 'arrival'> }>();
  for (const data of collections) {
    for (const feature of data.features) {
      const previous = byFlightId.get(feature.properties.flight_id);
      if (!previous) {
        byFlightId.set(feature.properties.flight_id, { feature, roles: new Set(feature.properties.roles) });
        continue;
      }
      for (const role of feature.properties.roles) previous.roles.add(role);
      if (feature.properties.retained_point_count > previous.feature.properties.retained_point_count) previous.feature = feature;
    }
  }
  const features = [...byFlightId.values()].map(({ feature, roles }) => ({
    ...feature,
    properties: {
      ...feature.properties,
      roles: (['departure', 'arrival'] as const).filter(role => roles.has(role)),
    },
  }));
  return {
    data: {
      type: 'FeatureCollection',
      meta: {
        country,
        airport: HISTORICAL_FLIGHT_ALL_AIRPORTS,
        date,
        timezone: country === 'TW' ? 'Asia/Taipei' : 'Asia/Tokyo',
        coverage: 'partial',
        note: `同一日期可用機場 ${samples.length}/${totalAirportCount}；靜態軌跡為部分涵蓋。`,
      },
      features,
    },
    availableAirportCount: samples.length,
    totalAirportCount,
  };
}
export function clearHistoricalFlightCache() { manifestCache.invalidate(); assetCache.invalidate(); }
