import { ALL_PRESETS } from "../map/cameraPresets";

const MAX_QUERY_BYTES = 512;
const MAX_ASSET_BYTES = 3 * 1024 * 1024;
const ASSET_TIMEOUT_MS = 3_000;
const MAX_CANDIDATES = 5;
const LOCAL_ASSETS = [
  { path: "/education/schools.geojson", source: "local_public_school", nameKeys: ["school_name"], addressKeys: ["city", "district", "address"] },
  { path: "/culture/public_libraries_national.geojson", source: "local_public_library", nameKeys: ["name"], addressKeys: ["address"] },
] as const;

export type LocationSource = "coordinate_input" | "camera_preset" | "local_public_school" | "local_public_library";
export type LocationPrecision = "user_provided" | "viewpoint" | "dataset_point";

export interface OfflineLocationCandidate {
  label: string;
  center: [number, number];
  source: LocationSource;
  precision: LocationPrecision;
  matchedOn: "coordinates" | "preset_id" | "preset_name" | "school_name" | "school_address" | "library_name" | "library_address";
}

export interface OfflineLocationResult {
  query: string;
  status: "ok" | "no_match" | "unavailable" | "invalid_input";
  candidates: OfflineLocationCandidate[];
  coverage: readonly string[];
  limitations: readonly string[];
}

type LocalPoint = { label: string; addresses: string[]; center: [number, number]; source: "local_public_school" | "local_public_library" };

function normalized(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("zh-TW").replace(/臺/g, "台").replace(/\[\d{3}\]/gu, "").replace(/[\s,，、.-]+/gu, "").trim();
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function boundedText(value: string, maxBytes: number): string {
  let result = "";
  for (const character of value) {
    if (utf8Bytes(result + character) > maxBytes) break;
    result += character;
  }
  return result;
}

function combineChunks(chunks: readonly Uint8Array[]): Uint8Array {
  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const combined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
  return combined;
}

function validCenter(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number"
    && Number.isFinite(value[0]) && Number.isFinite(value[1]) && value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90;
}

function coordinateCandidate(query: string): OfflineLocationCandidate | undefined {
  const match = /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,，]\s*(-?\d{1,2}(?:\.\d+)?)\s*$/u.exec(query);
  if (!match) return undefined;
  const center: [number, number] = [Number(match[1]), Number(match[2])];
  if (!validCenter(center)) return undefined;
  return { label: `${center[0]}, ${center[1]}`, center, source: "coordinate_input", precision: "user_provided", matchedOn: "coordinates" };
}

async function readAsset(asset: typeof LOCAL_ASSETS[number]): Promise<LocalPoint[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASSET_TIMEOUT_MS);
  try {
    const response = await fetch(asset.path, { signal: controller.signal, credentials: "same-origin" });
    const declared = response.headers.get("content-length");
    if (!response.ok || (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > MAX_ASSET_BYTES))) throw new Error("LOCAL_ASSET_UNAVAILABLE");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("LOCAL_ASSET_UNAVAILABLE");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > MAX_ASSET_BYTES) throw new Error("LOCAL_ASSET_UNAVAILABLE");
        chunks.push(next.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const json: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(combineChunks(chunks)));
    if (!json || typeof json !== "object" || !Array.isArray((json as { features?: unknown }).features)) throw new Error("LOCAL_ASSET_UNAVAILABLE");
    return (json as { features: unknown[] }).features.flatMap((feature): LocalPoint[] => {
      if (!feature || typeof feature !== "object") return [];
      const item = feature as { geometry?: { type?: unknown; coordinates?: unknown }; properties?: Record<string, unknown> };
      if (item.geometry?.type !== "Point" || !validCenter(item.geometry.coordinates) || !item.properties) return [];
      const name = asset.nameKeys.map(key => item.properties?.[key]).find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();
      if (!name) return [];
      const addressParts = asset.addressKeys.map(key => item.properties?.[key]).filter((value): value is string => typeof value === "string" && value.trim().length > 0);
      const directAddress = item.properties.address;
      const addresses = [...new Set([addressParts.join(""), typeof directAddress === "string" ? directAddress : ""])].filter(Boolean);
      return [{ label: name, addresses, center: [item.geometry.coordinates[0], item.geometry.coordinates[1]], source: asset.source }];
    });
  } catch {
    throw new Error("LOCAL_ASSET_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

function baseResult(query: string, status: OfflineLocationResult["status"], candidates: OfflineLocationCandidate[]): OfflineLocationResult {
  return {
    query,
    status,
    // Five bounded labels plus the bounded query keep this bridge payload far below 24 KiB.
    candidates: candidates.slice(0, MAX_CANDIDATES).map(candidate => ({ ...candidate, label: boundedText(candidate.label, 256) })),
    coverage: ["直接輸入的經緯度", "內建相機預設", "本機公開學校與公共圖書館 Point GeoJSON"],
    limitations: ["這不是全台門牌或家戶地址資料庫。", "僅比對既有 Point 的完整名稱或完整地址；不會以鄉鎮中心替代未知門牌。", "本機資料讀取失敗時會回報 unavailable，不會把失敗誤稱為 no_match。"],
  };
}

/** Resolves only fixed, same-origin public assets. The query is never sent to a remote geocoder. */
export async function resolveOfflineLocation(query: string): Promise<OfflineLocationResult> {
  if (typeof query !== "string" || utf8Bytes(query) > MAX_QUERY_BYTES || query.trim() === "") return baseResult(typeof query === "string" ? query : "", "invalid_input", []);
  const coordinate = coordinateCandidate(query);
  if (coordinate) return baseResult(query, "ok", [coordinate]);
  const needle = normalized(query);
  const presetMatches = ALL_PRESETS.flatMap((preset): OfflineLocationCandidate[] => {
    if (!validCenter(preset.center)) return [];
    if (normalized(preset.id) === needle) return [{ label: preset.name, center: preset.center, source: "camera_preset", precision: "viewpoint", matchedOn: "preset_id" }];
    return normalized(preset.name) === needle ? [{ label: preset.name, center: preset.center, source: "camera_preset", precision: "viewpoint", matchedOn: "preset_name" }] : [];
  });
  if (presetMatches.length) return baseResult(query, "ok", presetMatches);

  const loaded = await Promise.allSettled(LOCAL_ASSETS.map(readAsset));
  const points = loaded.flatMap(item => item.status === "fulfilled" ? item.value : []);
  const matches = points.flatMap((point): OfflineLocationCandidate[] => {
    const isName = normalized(point.label) === needle;
    const isAddress = point.addresses.some(address => normalized(address) === needle);
    if (!isName && !isAddress) return [];
    return [{ label: point.label, center: point.center, source: point.source, precision: "dataset_point", matchedOn: point.source === "local_public_school" ? (isName ? "school_name" : "school_address") : (isName ? "library_name" : "library_address") }];
  }).sort((a, b) => a.label.localeCompare(b.label, "zh-TW"));
  if (matches.length) return baseResult(query, "ok", matches);
  return baseResult(query, loaded.some(item => item.status === "rejected") ? "unavailable" : "no_match", []);
}
