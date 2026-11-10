/**
 * 對比契約（design-system map-layers §3.9 C-3）的抽取與計算：測試與重產基準腳本共用同一份，兩邊各寫一份必漂移。
 *
 * 來源：
 *   - registry 圖層：`layer-golden.json` 的 overlays（預設參數下已求值的暗底 paint）。
 *   - 統計圖層：`statisticsRenderRecipe(key, …, { isDark: true })` 的實際色階＋`STATISTICS_FILL_OPACITY.dark`。
 *
 * registry 規則（同 2026-11-10 稽核 extract.py／analyze.py）：
 *   - 只看主體子圖層：type ∈ circle／line／fill／fill-extrusion，suffix 不含 glow／halo／outline／label 等裝飾字。
 *   - 子圖層色＝color 表達式「輸出位置」的字面色（match／case／step／interpolate 的輸出；比較條件裡的不算）。
 *   - 子圖層透明度＝opacity 數字；是表達式時取輸出位置 0–1 的最大數值（可能高估可見度）。
 *   - 子圖層代表對比＝各色（× 透明度 × 色本身 alpha）疊在暗陸 `#292828` 後 WCAG 對比的中位數。
 *   - 每個 key 取最顯眼的主體子圖層（代表對比最大者）。違規：< 3。
 * 統計規則：對比單調（序列）或兩端最亮（雙向）、最低 ≥ 1.8、最高 ≥ 6；違規時記最高級對比（政黨色另記 statistics-party）。
 * 不涵蓋：hook 自建圖層、Three.js／3D、heatmap／raster（另有色盤測試）、symbol 文字。
 */
import { readFileSync } from "node:fs";
import { BASEMAP_LAND } from "../mapStyleScale";
import { compositeOver, contrastRatio, parseColor } from "../colorContrast";
import { STATISTICS_RENDER_KEYS, statisticsRenderRecipe } from "../../data/regionalStatisticsRecipes";
import { STATISTICS_FILL_OPACITY } from "../../data/statisticsVisuals";
import { isDecorativeSuffix } from "../legendLayerOpacity";

export const GOLDEN_PATH = "src/data/__tests__/__fixtures__/layer-golden.json";
export const CONTRAST_BASELINE_PATH = "src/map/__tests__/__fixtures__/contrast-baseline.json";
export const MIN_CONTRAST_DARK = 3;
export const STATISTICS_MIN = 1.8;
export const STATISTICS_TOP = 6;

export interface ContrastViolation {
  /** 對比（registry：最顯眼主體子圖層的代表對比；統計：最高級對比）。 */
  contrast: number;
  /** 最顯眼子圖層的型別；統計為 statistics。 */
  type: string;
}

const LAND = parseColor(BASEMAP_LAND.dark)!.rgb;
const COLOR_TO_OPACITY: Record<string, string> = {
  "circle-color": "circle-opacity",
  "line-color": "line-opacity",
  "fill-color": "fill-opacity",
  "fill-extrusion-color": "fill-extrusion-opacity",
};
const MAIN_TYPES = new Set(["circle", "line", "fill", "fill-extrusion"]);
const CONDITION_OPS = new Set(["get", "has", "==", "!=", "<", ">", "<=", ">=", "in", "zoom", "literal", "feature-state", "to-string", "to-number", "concat", "all", "any", "!", "length", "typeof"]);

function walkColors(expr: unknown, out: string[]): void {
  if (typeof expr === "string") {
    if ((expr.startsWith("#") || expr.startsWith("rgb")) && parseColor(expr)) out.push(expr);
    return;
  }
  if (!Array.isArray(expr) || expr.length === 0) return;
  const op = expr[0];
  if (typeof op === "string" && CONDITION_OPS.has(op)) return;
  if (op === "match") {
    for (let i = 3; i < expr.length - 1; i += 2) walkColors(expr[i], out);
    walkColors(expr[expr.length - 1], out);
  } else if (op === "case") {
    for (let i = 2; i < expr.length - 1; i += 2) walkColors(expr[i], out);
    walkColors(expr[expr.length - 1], out);
  } else if (op === "step") {
    walkColors(expr[2], out);
    for (let i = 4; i < expr.length; i += 2) walkColors(expr[i], out);
  } else if (typeof op === "string" && op.startsWith("interpolate")) {
    for (let i = 4; i < expr.length; i += 2) walkColors(expr[i], out);
  } else {
    for (const x of expr.slice(1)) walkColors(x, out);
  }
}

function opacityOf(expr: unknown): number {
  if (typeof expr === "number") return expr;
  if (expr == null) return 1;
  const nums: number[] = [];
  const walk = (x: unknown) => {
    if (typeof x === "number") { if (x >= 0 && x <= 1) nums.push(x); return; }
    if (!Array.isArray(x) || x.length === 0) return;
    const op = x[0];
    if (typeof op === "string" && op.startsWith("interpolate")) { for (let i = 4; i < x.length; i += 2) walk(x[i]); }
    else if (op === "step") { walk(x[2]); for (let i = 4; i < x.length; i += 2) walk(x[i]); }
    else if (op === "match") { for (let i = 3; i < x.length - 1; i += 2) walk(x[i]); walk(x[x.length - 1]); }
    else if (op === "case") { for (let i = 2; i < x.length - 1; i += 2) walk(x[i]); walk(x[x.length - 1]); }
    else if (op === "*" || op === "min" || op === "max" || op === "coalesce" || op === "+") { for (const y of x.slice(1)) walk(y); }
  };
  walk(expr);
  return nums.length ? Math.max(...nums) : 1;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

interface GoldenOverlay { id: string; layers: Array<{ suffix?: string; type: string; paint?: { dark?: Record<string, unknown> } }> }

/** registry 每個 key 的「最顯眼主體子圖層」代表對比（暗陸）。 */
export function registryKeyContrasts(golden = JSON.parse(readFileSync(GOLDEN_PATH, "utf8")) as { overlays: GoldenOverlay[] }): Map<string, ContrastViolation> {
  const best = new Map<string, ContrastViolation>();
  for (const overlay of golden.overlays) {
    for (const layer of overlay.layers) {
      if (!MAIN_TYPES.has(layer.type)) continue;
      if (isDecorativeSuffix(layer.suffix)) continue;
      const paint = layer.paint?.dark ?? {};
      for (const [colorProp, opacityProp] of Object.entries(COLOR_TO_OPACITY)) {
        if (!(colorProp in paint)) continue;
        const colors: string[] = [];
        walkColors(paint[colorProp], colors);
        if (!colors.length) continue;
        const alpha = opacityOf(paint[opacityProp]);
        const contrast = median(colors.map((color) => {
          const parsed = parseColor(color)!;
          return contrastRatio(compositeOver(parsed.rgb, LAND, alpha * parsed.alpha), LAND);
        }));
        const previous = best.get(overlay.id);
        if (!previous || contrast > previous.contrast) best.set(overlay.id, { contrast: round2(contrast), type: layer.type });
      }
    }
  }
  return best;
}

/** 統計圖層暗底色階不合門檻者（最高級對比）。 */
export function statisticsViolations(): Map<string, ContrastViolation> {
  const out = new Map<string, ContrastViolation>();
  for (const key of STATISTICS_RENDER_KEYS) {
    const recipe = statisticsRenderRecipe(key, undefined, undefined, { isDark: true });
    if ("categories" in recipe && recipe.categories) continue;
    const cr = recipe.colors.map((color) => contrastRatio(compositeOver(parseColor(color)!.rgb, LAND, STATISTICS_FILL_OPACITY.dark), LAND));
    if (cr.length < 2) continue;
    const ascending = cr.every((v, i) => i === 0 || v > cr[i - 1]!);
    const descending = cr.every((v, i) => i === 0 || v < cr[i - 1]!);
    const endsBright = Math.min(cr[0]!, cr[cr.length - 1]!) >= STATISTICS_TOP;
    const ok = (ascending || descending || endsBright) && Math.min(...cr) >= STATISTICS_MIN && Math.max(...cr) >= STATISTICS_TOP;
    // 政黨色（partisan、依政黨 sequential）刻意不分底圖（statistics-layer-guidelines §4），另記一類供後續拍板。
    const party = recipe.colors.join() === statisticsRenderRecipe(key).colors.join();
    if (!ok) out.set(key, { contrast: round2(Math.max(...cr)), type: party ? "statistics-party" : "statistics" });
  }
  return out;
}

/** 目前全部違規（registry＋統計），key 排序。 */
export function currentContrastViolations(): Record<string, ContrastViolation> {
  const all: Array<[string, ContrastViolation]> = [];
  for (const [key, value] of registryKeyContrasts()) if (value.contrast < MIN_CONTRAST_DARK) all.push([key, value]);
  for (const entry of statisticsViolations()) all.push(entry);
  all.sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(all);
}
