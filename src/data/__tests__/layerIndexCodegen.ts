/**
 * 產生 layerIndex.generated.ts 的內容（腳本 scripts/layers/gen-layer-index.ts 與測試共用，兩邊口徑一致）。
 *
 * 索引只放「外國」圖層（country 是 CountryCode 且不是 TW）；TW／WORLD／SIM／orphan 仍由完整 manifest 靜態載入。
 * 值一律取自已跑完統計圖層 icon／color 改寫迴圈的 LAYER_MANIFEST，所以和執行期讀到的一致。
 * 設計：.gis-agent-system 的 B1-DESIGN.md §2.4。
 */
import * as lucide from "lucide-react";
import { isCountryCode } from "../../constants/countries";
import { LAYER_MANIFEST, type LayerManifestEntry } from "../layerManifest";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";
import { GIS_LAYERS } from "../../map/gisClickRegistry";
import { LAYER_PARAMS_SPEC } from "../layerParamsSpec";
import { extendedRecordKeys } from "../../countries/slots";

/**
 * 國家包 key 的宣告順序提示：[前一個非國家包 key, 全域序號]（slots.setRecordOrder 讀）。需先 loadAllPacks。
 * seed：搬家前（全部國家包載入後）的 key 順序（`gen-layer-index.ts --seed-out` 產生）。剛搬的國家還沒有提示，
 * 執行期順序是「接在最後」，要用搬家前的順序算；之後重產時執行期順序已排回原位，不帶 seed 結果相同。
 */
export type LayerOrderSeed = Partial<Record<"layerManifest" | "layerParamsSpec", string[]>>;

function orderHints(name: keyof LayerOrderSeed, record: object, seed?: LayerOrderSeed): Map<string, [string, number]> {
  const ext = extendedRecordKeys(name);
  const out = new Map<string, [string, number]>();
  let anchor = "";
  const keys = seed?.[name] ? seed[name].filter((k) => k in record) : Object.keys(record);
  if (keys.length !== Object.keys(record).length) throw new Error(`layerIndex：seed 的 ${name} 少了 ${Object.keys(record).length - keys.length} 個 key（seed 要在搬家前、全部國家包載入後產生）`);
  keys.forEach((key, i) => {
    if (ext.has(key)) out.set(key, [anchor, i]);
    else anchor = key;
  });
  return out;
}

/** 外國圖層：manifest entry 的國家是 CountryCode 且不是台灣。 */
export function isForeignEntry(entry: LayerManifestEntry): boolean {
  return entry.section !== null && isCountryCode(entry.country) && entry.country !== "TW";
}

/** lucide 元件 → 可 import 的識別名（優先等於 displayName，其次不帶 Icon／Lucide 前後綴的別名）。 */
function lucideExportName(icon: unknown, key: string): string {
  const display = (icon as { displayName?: string }).displayName;
  const table = lucide as unknown as Record<string, unknown>;
  if (display && table[display] === icon) return display;
  const names = Object.keys(table).filter((n) => table[n] === icon && !/^Lucide|Icon$/.test(n)).sort();
  if (names.length === 0) throw new Error(`layerIndex：${key} 的 icon 不是 lucide-react 的具名匯出`);
  return names[0] as string;
}

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/** 欄位為空（undefined／false）就省略，列才不會被一堆 null 撐大。 */
function row(key: string, entry: LayerManifestEntry, iconName: string, draw: number | undefined, click: number | undefined) {
  const e = entry as LayerManifestEntry & { dataTimeZone?: string; longTerm?: { kind: string } };
  const themed = entry as Extract<LayerManifestEntry, { section: unknown }> & { section: { theme: string; group: string } };
  const out: Record<string, Json> = {
    country: String(entry.country),
    name: entry.name as unknown as Json,
    section: { theme: themed.section.theme, group: themed.section.group },
    color: entry.color,
    icon: iconName,
  };
  // 站主限定的唯一來源是 topics 的 OWNER_ONLY（layerCatalog.GATED_LAYERS 同口徑），不是 entry.gated
  if (entry.topics.includes("OWNER_ONLY")) out.gated = true;
  // 明寫 false 的也保留（側欄列照抄，和靜態 manifest 一致）
  if (entry.expandable !== undefined) out.expandable = entry.expandable;
  // 與 key 同名就省略（讀時補回 key）；null＝有意識地沒有
  if (entry.popup !== key) out.popup = entry.popup as Json;
  if (entry.legend !== key) out.legend = entry.legend;
  if (e.dataTimeZone) out.dataTimeZone = e.dataTimeZone;
  if (e.longTerm) out.longTerm = e.longTerm.kind;
  // 即時時間軸圖層：topics 含「即時」且沒有 longTerm（longTermLayers.isLiveTimelineLayer 同口徑）
  if (!e.longTerm && entry.topics.includes("即時")) out.live = true;
  if (draw !== undefined) out.draw = draw;
  if (click !== undefined) out.click = click;
  return out;
}

export function collectLayerIndex(): { key: string; entry: LayerManifestEntry }[] {
  return (Object.entries(LAYER_MANIFEST) as [string, LayerManifestEntry][])
    .filter(([, entry]) => isForeignEntry(entry))
    .map(([key, entry]) => ({ key, entry }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

export function renderLayerIndexModule(seed?: LayerOrderSeed): string {
  const rows = collectLayerIndex();
  const drawOrder = new Map<string, number>();
  OVERLAY_REGISTRY.forEach((cfg, i) => { if (!drawOrder.has(cfg.id)) drawOrder.set(cfg.id, i); });
  const clickOrder = new Map<string, number>();
  GIS_LAYERS.forEach((g, i) => { if (!clickOrder.has(g.type)) clickOrder.set(g.type, i); });

  const mo = orderHints("layerManifest", LAYER_MANIFEST, seed);
  const po = orderHints("layerParamsSpec", LAYER_PARAMS_SPEC, seed);
  const iconNames = new Set<string>();
  const body: string[] = [];
  for (const { key, entry } of rows) {
    const iconName = lucideExportName(entry.icon, key);
    iconNames.add(iconName);
    const types = entry.popup === null ? [] : Array.isArray(entry.popup) ? entry.popup : [entry.popup];
    const clicks = types.map((t) => clickOrder.get(t)).filter((n): n is number => n !== undefined);
    const r = row(key, entry, iconName, drawOrder.get(key), clicks.length ? Math.min(...clicks) : undefined);
    const m = mo.get(key); if (m) r.mo = m;
    const q = po.get(key); if (q) r.po = q;
    body.push(`  ${JSON.stringify(key)}: ${JSON.stringify(r)},`);
  }
  const icons = [...iconNames].sort();
  return [
    "// ⚠️ 自動產生，請勿手改：npx vite-node scripts/layers/gen-layer-index.ts",
    "// 來源：src/data/layerManifest.ts 的外國圖層（country 是 CountryCode 且不是 TW）。TW／WORLD／SIM／orphan 不在這裡。",
    "// 欄位說明與讀法：src/data/layerIndex.ts。",
    `import { ${icons.join(", ")} } from "lucide-react";`,
    'import type { LucideIcon } from "lucide-react";',
    'import type { LayerIndexRow } from "./layerIndex";',
    "",
    "/** icon 識別名 → 元件（只含外國圖層用到的）。 */",
    `export const LAYER_INDEX_ICONS: Readonly<Record<string, LucideIcon>> = { ${icons.join(", ")} };`,
    "",
    `/** 外國圖層索引，依 key 排序（共 ${rows.length} 列）。 */`,
    "export const LAYER_INDEX = {",
    ...body,
    "} as const satisfies Record<string, LayerIndexRow>;",
    "",
  ].join("\n");
}
