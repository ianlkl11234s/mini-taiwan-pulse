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
  if (entry.expandable) out.expandable = true;
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

export function renderLayerIndexModule(): string {
  const rows = collectLayerIndex();
  const drawOrder = new Map<string, number>();
  OVERLAY_REGISTRY.forEach((cfg, i) => { if (!drawOrder.has(cfg.id)) drawOrder.set(cfg.id, i); });
  const clickOrder = new Map<string, number>();
  GIS_LAYERS.forEach((g, i) => { if (!clickOrder.has(g.type)) clickOrder.set(g.type, i); });

  const iconNames = new Set<string>();
  const body: string[] = [];
  for (const { key, entry } of rows) {
    const iconName = lucideExportName(entry.icon, key);
    iconNames.add(iconName);
    const types = entry.popup === null ? [] : Array.isArray(entry.popup) ? entry.popup : [entry.popup];
    const clicks = types.map((t) => clickOrder.get(t)).filter((n): n is number => n !== undefined);
    const r = row(key, entry, iconName, drawOrder.get(key), clicks.length ? Math.min(...clicks) : undefined);
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
