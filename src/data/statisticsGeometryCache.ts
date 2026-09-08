export interface StatisticsGeometryManifest {
  resource: string;
  sha256: string;
  code_scheme: string;
  /** Delivery-only source property; normalized to area_code after SHA verification. */
  code_property?: string;
  name_property?: string;
  boundary_version: string;
  level: string;
}

export interface StatisticsBoundaryGeometry {
  features: readonly GeoJSON.Feature[];
  byteLength: number;
}

interface CacheEntry {
  promise: Promise<StatisticsBoundaryGeometry>;
}

const DEFAULT_MAX_ENTRIES = 8;
// Large boundaries may be useful to a concurrent caller, but should not occupy a
// long-lived browser session cache by themselves.
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

function cacheKey(manifest: StatisticsGeometryManifest): string {
  return JSON.stringify([manifest.resource, manifest.sha256, manifest.boundary_version, manifest.level, manifest.code_scheme, manifest.code_property, manifest.name_property]);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function freezeBoundary(features: GeoJSON.Feature[]): readonly GeoJSON.Feature[] {
  return deepFreeze(features);
}

/** Immutable, SHA-verified raw boundaries only. Statistics values are joined by callers. */
export class StatisticsGeometryCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    private readonly maxEntries = DEFAULT_MAX_ENTRIES,
    private readonly maxBytes = DEFAULT_MAX_BYTES,
  ) {}

  load(manifest: StatisticsGeometryManifest, fetcher: () => Promise<ArrayBuffer>): Promise<StatisticsBoundaryGeometry> {
    const key = cacheKey(manifest);
    const hit = this.entries.get(key);
    if (hit) {
      this.entries.delete(key);
      this.entries.set(key, hit);
      return hit.promise;
    }

    let entry: CacheEntry;
    const promise = fetcher()
      .then(async bytes => {
        const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
          .map(n => n.toString(16).padStart(2, '0')).join('');
        if (digest !== manifest.sha256) throw new Error('邊界檔案版本校驗失敗');
        const geometry = JSON.parse(new TextDecoder().decode(bytes)) as GeoJSON.FeatureCollection;
        if (geometry.type !== 'FeatureCollection' || !Array.isArray(geometry.features)) throw new Error('邊界格式不符');

        const codes = new Set<string>();
        const codeProperty = manifest.code_property ?? 'area_code';
        const features = geometry.features.map(feature => {
          const code = feature.properties?.[codeProperty];
          if (typeof code !== 'string' || codes.has(code) || !feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
            throw new Error('參考邊界代碼或幾何錯誤');
          }
          codes.add(code);
          return { ...feature, properties: { ...feature.properties, area_code: code, ...(manifest.name_property ? { area_name: feature.properties?.[manifest.name_property] } : {}) } };
        });
        return { features: freezeBoundary(features), byteLength: bytes.byteLength };
      });
    entry = { promise };
    this.entries.set(key, entry);
    // Bound cache bookkeeping even while downloads are pending. Eviction does not
    // cancel promises still owned by callers; completed evicted work cannot reinsert itself.
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    promise.then(
      boundary => {
        if (this.entries.get(key) !== entry) return;
        if (boundary.byteLength > this.maxBytes) {
          this.entries.delete(key);
          return;
        }
        while (this.entries.size > this.maxEntries) {
          const oldest = this.entries.keys().next().value;
          if (oldest === undefined) break;
          this.entries.delete(oldest);
        }
      },
      () => { if (this.entries.get(key) === entry) this.entries.delete(key); },
    );
    return promise;
  }

  clear(): void { this.entries.clear(); }
  get size(): number { return this.entries.size; }
}

export const statisticsGeometryCache = new StatisticsGeometryCache();

/** A caller may stop waiting without aborting the shared immutable-boundary fetch. */
export function waitForGeometry<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(
      value => { signal.removeEventListener('abort', abort); resolve(value); },
      error => { signal.removeEventListener('abort', abort); reject(error); },
    );
  });
}
