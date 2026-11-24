import { fetchOwnerJson } from "../lib/ownerData";
import { geometryInteriorPoint } from "../map/interiorPoint";
import type { OwnerDataAssetName } from "./ownerDataAssets";
import { siteStudyColor, type SiteStudyData, type SiteStudyLegendItem, type SiteStudyMeta, type SiteStudyPart } from "./siteStudyMTypes";

/**
 * 設施研究 M（站主限定）載入器：兩支 owner-data 私人檔（coral-private sidecar 驗站主後回 Range）。
 *
 * 檔案是 GeoJSON FeatureCollection，另帶頂層 `meta.legend`。**類別名稱、顏色、筆數與 popup 文字全部來自檔案**，
 * 程式不寫任何類別值：填色讀 feature 的 `color`，圖例讀 `meta.legend`，popup 讀 `*_label` 欄位。
 *
 * - 主資料（sites）：圖層一開就讀。
 * - 參考資料（overlays）：參數「參考資料」開啟才讀。
 * - 面另外產生一個落在面內的代表點（`_rep: 1`），供拉遠時顯示（面在全國縮放下小到看不見）。
 * - 撤權（登出、換帳號）時 clearSiteStudyMCache() 清快取與圖例資料（hook 以 registerOwnerGateReset 註冊）。
 */

export const SITE_STUDY_M_ASSETS: Readonly<Record<SiteStudyPart, OwnerDataAssetName>> = {
  sites: "study-m-sites",
  overlays: "study-m-overlays",
};

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** 頂層 meta 是外部資料：逐欄檢查後才進畫面，形狀不對的圖例列直接略過。 */
export function parseSiteStudyMeta(raw: unknown): SiteStudyMeta {
  const meta = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const legend = (Array.isArray(meta.legend) ? meta.legend : []).flatMap((row): SiteStudyLegendItem[] => {
    const r = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
    const label = text(r.label);
    if (!label) return [];
    return [{ key: text(r.key) || label, label, color: siteStudyColor(r.color), count: typeof r.count === "number" && Number.isFinite(r.count) ? r.count : null }];
  });
  return { title: text(meta.title), built: text(meta.built), note: text(meta.note), legend };
}

/**
 * 加上 `_part`（主資料／參考資料）與正規化後的 `color`；面另外產生代表點（`_rep: 1`，properties 與原面相同）。
 * 沒有幾何的 feature 略過（不合成座標）。
 */
export function prepareSiteStudyFeatures(fc: GeoJSON.FeatureCollection, part: SiteStudyPart): GeoJSON.Feature[] {
  const out: GeoJSON.Feature[] = [];
  for (const f of Array.isArray(fc?.features) ? fc.features : []) {
    if (!f?.geometry) continue;
    const properties = { ...(f.properties ?? {}), color: siteStudyColor(f.properties?.color), _part: part };
    out.push({ type: "Feature", geometry: f.geometry, properties });
    if (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") {
      const point = geometryInteriorPoint(f.geometry);
      if (point) out.push({ type: "Feature", geometry: { type: "Point", coordinates: point }, properties: { ...properties, _rep: 1 } });
    }
  }
  return out;
}

// ── 圖例資料（meta）：圖例元件以 useSyncExternalStore 訂閱 ──
type MetaSnapshot = Readonly<Partial<Record<SiteStudyPart, SiteStudyMeta>>>;
let metaSnapshot: MetaSnapshot = {};
const metaListeners = new Set<() => void>();
function setMeta(next: MetaSnapshot) {
  metaSnapshot = next;
  for (const l of metaListeners) l();
}
export const siteStudyMMetaStore = {
  subscribe(l: () => void): () => void { metaListeners.add(l); return () => { metaListeners.delete(l); }; },
  getSnapshot(): MetaSnapshot { return metaSnapshot; },
};

// ── module cache（撤權時整個清掉；generation 擋「撤權前發出、撤權後才回來」的請求寫回）──
const cache: Partial<Record<SiteStudyPart, Promise<SiteStudyData>>> = {};
let generation = 0;

const TASK: Record<SiteStudyPart, { id: string; label: string }> = {
  sites: { id: "siteStudyM:sites", label: "設施研究 M" },
  overlays: { id: "siteStudyM:overlays", label: "設施研究 M 參考資料" },
};

export function loadSiteStudyPart(part: SiteStudyPart): Promise<SiteStudyData> {
  const hit = cache[part];
  if (hit) return hit;
  const gen = generation;
  const p = fetchOwnerJson<GeoJSON.FeatureCollection & { meta?: unknown }>(SITE_STUDY_M_ASSETS[part], TASK[part].id, TASK[part].label)
    .then((file) => {
      if (gen !== generation) throw Object.assign(new Error("access revoked"), { status: 401 });
      const data: SiteStudyData = { features: prepareSiteStudyFeatures(file, part), meta: parseSiteStudyMeta(file.meta) };
      setMeta({ ...metaSnapshot, [part]: data.meta });
      return data;
    })
    .catch((err) => {
      if (gen === generation && cache[part] === p) delete cache[part];
      throw err;
    });
  cache[part] = p;
  return p;
}

export function clearSiteStudyMCache(): void {
  generation += 1;
  delete cache.sites;
  delete cache.overlays;
  setMeta({});
}
