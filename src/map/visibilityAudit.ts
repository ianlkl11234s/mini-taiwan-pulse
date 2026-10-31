/**
 * 全國視角可見性契約（map-layers.md §3.8 V-2／V-4）的盤點函式：從現有結構可判斷的部分。
 * - 涵蓋：registry overlay（`OVERLAY_REGISTRY`，PMTiles 圖磚範圍＋各子圖層縮放、paint 類別色）、
 *   南韓資料層（`KR_DATA_SPECS` 的 `srcMinzoom`／`minzoom`／`cats`）。
 * - 不涵蓋：其他 hook 自建的圖層（英國 `useGb*`、台灣／日本各 hook）——縮放與色票寫在命令式程式裡，
 *   無法可靠抽出；這些靠 §3.8 V-7 截圖驗收。
 */
import { OVERLAY_REGISTRY } from "./overlayRegistry";
import { KR_DATA_SPECS } from "../data/krDataLayers";
import { LAYER_MANIFEST } from "../data/layerManifest";
import { getParamsSpec, paramControlCategory, paramDefault } from "../data/layerParamsSpec";

/** V-2 容許：layer 最早出現縮放比圖磚 minzoom 晚最多 1 級 */
export const V2_MAX_ZOOM_LAG = 1;

export interface ZoomLag { key: string; sourceMinzoom: number; firstDrawZoom: number }

type ManifestSource = { kind?: string; minzoom?: number } | null | undefined;

function manifestSourceMinzoom(key: string): number | undefined {
  const src = (LAYER_MANIFEST as Record<string, { source?: ManifestSource } | undefined>)[key]?.source;
  return src?.kind === "pmtiles" && typeof src.minzoom === "number" ? src.minzoom : undefined;
}

/**
 * V-2：圖磚有、圖層晚畫。最早出現縮放＝各子圖層 minzoom 的最小值（未設＝0），
 * 所以「低縮放熱區＋高縮放點」不算違規。只看有圖磚範圍的來源（GeoJSON 沒有 source minzoom）。
 */
export function zoomLagViolations(): ZoomLag[] {
  const byKey = new Map<string, ZoomLag>();
  for (const config of OVERLAY_REGISTRY) {
    const sourceMinzoom = config.pmtiles?.minzoom ?? manifestSourceMinzoom(config.id);
    if (sourceMinzoom === undefined || !config.layers.length) continue;
    const firstDrawZoom = Math.min(...config.layers.map((l) => l.minzoom ?? 0));
    const prev = byKey.get(config.id);
    if (prev && prev.firstDrawZoom - prev.sourceMinzoom <= firstDrawZoom - sourceMinzoom) continue;
    byKey.set(config.id, { key: config.id, sourceMinzoom, firstDrawZoom });
  }
  for (const spec of KR_DATA_SPECS) {
    byKey.set(spec.key, { key: spec.key, sourceMinzoom: spec.srcMinzoom, firstDrawZoom: spec.minzoom });
  }
  return [...byKey.values()]
    .filter((v) => v.firstDrawZoom - v.sourceMinzoom > V2_MAX_ZOOM_LAG)
    .sort((a, b) => a.key.localeCompare(b.key));
}

const COLOR_PROPS = ["circle-color", "fill-color", "line-color", "fill-extrusion-color", "icon-color", "text-color"];

function referencesGet(expr: unknown): boolean {
  return Array.isArray(expr) && (expr[0] === "get" || expr.some(referencesGet));
}

/** `["match", ["get", p], "a", c1, ["b","c"], c2, …, fallback]`：字串標籤、≥2 種輸出色 → 名目類別數 */
function nominalMatchSize(expr: unknown): number {
  if (!Array.isArray(expr)) return 0;
  let best = 0;
  if (expr[0] === "match" && referencesGet(expr[1]) && expr.length >= 5) {
    const branches = expr.slice(2, -1);
    const labels: unknown[] = [];
    const outputs = new Set<string>();
    for (let i = 0; i + 1 < branches.length; i += 2) {
      labels.push(branches[i]);
      outputs.add(JSON.stringify(branches[i + 1]));
    }
    const allStrings = labels.every((l) => typeof l === "string" || (Array.isArray(l) && l.every((x) => typeof x === "string")));
    if (allStrings && outputs.size >= 2) best = outputs.size;
  }
  for (const child of expr) best = Math.max(best, nominalMatchSize(child));
  return best;
}

function defaultParams(key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const spec of getParamsSpec(key) ?? []) {
    const v = paramDefault(key, spec.name);
    if (typeof v === "number") out[spec.name] = v;
  }
  return out;
}

/** 有沒有類別篩選類控件（設定區「資料篩選」類的 multiSelect／linkedSelect／select／toggle） */
export function hasCategoryFilter(key: string): boolean {
  return (getParamsSpec(key) ?? []).some((s) => s.kind !== "slider" && s.kind !== "palette" && paramControlCategory(s) === "data");
}

export interface UnfilterableCategories { key: string; categories: number }

/** V-4：地圖用名目類別上色（≥2 類）但規格沒有任何資料篩選控件 */
export function categoryFilterViolations(): UnfilterableCategories[] {
  const byKey = new Map<string, number>();
  for (const config of OVERLAY_REGISTRY) {
    const params = defaultParams(config.id);
    for (const layer of config.layers) {
      let paint: Record<string, unknown>;
      try { paint = layer.paint(true, params); } catch { continue; }
      for (const prop of COLOR_PROPS) {
        const n = nominalMatchSize(paint[prop]);
        if (n >= 2) byKey.set(config.id, Math.max(byKey.get(config.id) ?? 0, n));
      }
    }
  }
  for (const spec of KR_DATA_SPECS) {
    if ((spec.cats?.length ?? 0) >= 2) byKey.set(spec.key, Math.max(byKey.get(spec.key) ?? 0, spec.cats!.length));
  }
  return [...byKey]
    .filter(([key]) => !hasCategoryFilter(key))
    .map(([key, categories]) => ({ key, categories }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
