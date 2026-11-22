/**
 * 台灣即時快照三層（台灣圖層延伸 B8）：登革熱聚集區（dengueClusters）、航船布告（navNotices）、
 * 大潮與長浪警戒（tideSwellAlerts）的資料來源、色票、標籤與快照狀態 SSOT。
 * 地圖 hook、圖例、popup 三邊共用（development-rules §4a 規則 2）。
 *
 * 資料：collector 寫 R2 固定檔名（ADR-0026 §5「每個人看都一樣的最新快照」），不經 Supabase。
 *   live/tw/dengue_cluster/{latest.geojson,status.json}          疾管署近兩週本土登革熱聚集區（HiCloud VM，每日 15:13）
 *   live/tw/nav_notices/{latest.geojson,status.json}             航港局航船布告（HiCloud VM，每小時 :27，內容變才重寫）
 *   live/tw/cwa_tide_swell_alerts/{latest.geojson,status.json}   氣象署大潮／長浪監測（pulse-host，每小時 :56）
 * 欄位與坑：taipei-gis-analytics docs/topic-research/tw_layer_ext_20261120/b8/layer-plan.md。
 */
import { withLoading } from "../lib/loadingRegistry";
import { IMAGERY_CDN_BASE } from "./imageryManifestLoader";
export * from "./twLiveTypes";

export type TwLiveKey = "dengueClusters" | "navNotices" | "tideSwellAlerts";

const R2_PREFIX: Record<TwLiveKey, string> = {
  dengueClusters: "live/tw/dengue_cluster",
  navNotices: "live/tw/nav_notices",
  tideSwellAlerts: "live/tw/cwa_tide_swell_alerts",
};

/** 前端重抓間隔：上游最快每小時更新、R2 快取 5–10 分鐘，開著時每 10 分鐘重抓（登革熱每日更新，30 分鐘） */
export const TW_LIVE_POLL_MS: Record<TwLiveKey, number> = {
  dengueClusters: 30 * 60_000,
  navNotices: 10 * 60_000,
  tideSwellAlerts: 10 * 60_000,
};

const LOADING_LABEL: Record<TwLiveKey, string> = {
  dengueClusters: "登革熱聚集區",
  navNotices: "航船布告",
  tideSwellAlerts: "大潮與長浪警戒",
};

export function twLiveUrl(key: TwLiveKey, file: "latest.geojson" | "status.json"): string {
  return `${IMAGERY_CDN_BASE}/${R2_PREFIX[key]}/${file}`;
}

export interface TwLiveSnapshot {
  fc: GeoJSON.FeatureCollection;
  status: Record<string, unknown> | null;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

/** 抓 latest＋status（status 失敗不擋圖層，只少了資料時間）；走 loadingRegistry */
export async function fetchTwLiveSnapshot(key: TwLiveKey): Promise<TwLiveSnapshot> {
  return withLoading(`twLive:${key}`, LOADING_LABEL[key], (async () => {
    const [fc, status] = await Promise.all([
      getJson(twLiveUrl(key, "latest.geojson")),
      getJson(twLiveUrl(key, "status.json")).catch(() => null),
    ]);
    const f = fc as GeoJSON.FeatureCollection;
    if (!f || f.type !== "FeatureCollection" || !Array.isArray(f.features)) throw new Error(`${key}: not a FeatureCollection`);
    return { fc: f, status: (status as Record<string, unknown> | null) ?? null };
  })());
}

// ── 圖例用的快照摘要（hook 寫、圖例讀）──────────────────────────────

export interface TwLiveSummary {
  /** 上圖筆數 */
  shown: number;
  /** 資料時間（顯示用字串，已是台北時間 ISO 或 YYYYMMDD） */
  dataTime: string | null;
  /** 其他摘要（依層） */
  extra?: Record<string, number>;
}
const summaries: Partial<Record<TwLiveKey, TwLiveSummary | null>> = {};
const listeners = new Set<() => void>();
export function setTwLiveSummary(key: TwLiveKey, s: TwLiveSummary | null): void {
  summaries[key] = s;
  for (const cb of listeners) cb();
}
export const twLiveSummaryStore = {
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  },
  get(key: TwLiveKey): TwLiveSummary | null {
    return summaries[key] ?? null;
  },
};

// ── 登革熱聚集區 ──────────────────────────────────────────────────

/** status.json 的 snapshot_date（YYYYMMDD）→ YYYY-MM-DD */
export function dengueSnapshotDate(status: Record<string, unknown> | null): string | null {
  const d = typeof status?.snapshot_date === "string" ? status.snapshot_date : null;
  return d && /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : null;
}

/** 低縮放代表點（面太小，z7 看不到）：用來源給的 center_lon／lat，缺就不補 */
export function dengueCenters(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const f of fc.features) {
    const p = f.properties ?? {};
    const lon = Number(p.center_lon);
    const lat = Number(p.center_lat);
    if (p.center_lon == null || p.center_lat == null || !Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    features.push({ type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: p });
  }
  return { type: "FeatureCollection", features };
}

// ── 航船布告 ──────────────────────────────────────────────────────

/** 只留有效期間內：start_at ≤ now，且 end_at 為空（永久）或 ≥ now。缺 start_at 視為已生效。 */
export function navActiveFeatures(fc: GeoJSON.FeatureCollection, nowMs: number): GeoJSON.Feature[] {
  return fc.features.filter((f) => {
    const p = f.properties ?? {};
    const s = typeof p.start_at === "string" ? Date.parse(p.start_at) : NaN;
    const e = typeof p.end_at === "string" ? Date.parse(p.end_at) : NaN;
    if (Number.isFinite(s) && s > nowMs) return false;
    if (Number.isFinite(e) && e < nowMs) return false;
    return f.geometry != null;
  });
}

/**
 * 同類型、同期限、同幾何的布告合成一筆（來源常把同一靶區逐月重發，射擊面最多 39 則疊同一塊，
 * 疊色會糊成實心）。保留最新發布（issued_at）的屬性，另記 dup_count（含自己）與 dup_codes（其餘公告編號，最多 5 個）。
 * 只影響呈現；筆數摘要仍用合併前的數字。
 */
export function navDedupe(features: GeoJSON.Feature[]): GeoJSON.Feature[] {
  const groups = new Map<string, GeoJSON.Feature[]>();
  for (const f of features) {
    const p = f.properties ?? {};
    const k = `${String(p.notice_kind)}|${String(p.lifetime)}|${JSON.stringify(f.geometry)}`;
    const g = groups.get(k);
    if (g) g.push(f);
    else groups.set(k, [f]);
  }
  const out: GeoJSON.Feature[] = [];
  for (const g of groups.values()) {
    if (g.length === 1) { out.push(g[0]!); continue; }
    const sorted = [...g].sort((a, b) => String(b.properties?.issued_at ?? "").localeCompare(String(a.properties?.issued_at ?? "")));
    const head = sorted[0]!;
    const others = [...new Set(sorted.slice(1).map((f) => String(f.properties?.notice_code ?? "")).filter(Boolean))];
    out.push({ ...head, properties: { ...head.properties, dup_count: g.length, dup_codes: others.slice(0, 5).join("、") } });
  }
  return out;
}

/** windows 欄是 JSON 字串 [{from,to}]，壞掉回空陣列 */
export function navWindows(v: unknown): { from: string | null; to: string | null }[] {
  if (typeof v !== "string" || !v) return [];
  try {
    const arr: unknown = JSON.parse(v);
    return Array.isArray(arr) ? (arr as { from: string | null; to: string | null }[]) : [];
  } catch {
    return [];
  }
}

