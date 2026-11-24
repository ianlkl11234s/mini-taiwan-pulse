// 規格驅動圖例引擎（B1 P2，2026-11-24）：菲律賓第 0–1 波寫的 `PhSpecLegend`，泰國、越南重用，
// 從 phLegends 搬到中性檔，國家 legend 不再互相 import。本檔不得 import 任何國家模組。
import type { ReactNode } from "react";
import { LegendNote, LegendRow, LegendSizeRow, LegendTitle, SwatchDot, SwatchLine, SwatchSquare, LegendRestrictions } from "./legendKit";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import { localizeLayerName } from "../../i18n/layerText";
import { useLocale } from "../../state/localeStore";
import { LINE_WIDTH } from "../../map/mapStyleScale";
import { pickL3, type PhCat, type PhLayerSpec } from "../../data/intlLayerShared";

export function useLayerTitle(key: string): string {
  const i18n = useLocale();
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

function catSwatch(spec: PhLayerSpec<string>, c: PhCat | null, color: string): ReactNode {
  const parts = c?.parts ? spec.parts.filter((p) => c.parts!.includes(p.id)) : spec.parts;
  const part = parts[0]!;
  if (part.geom === "fill") return <SwatchSquare color={color} outline={part.fillOpacity === 0} />;
  if (part.geom === "point" && part.hollow && !part.hollow.when) return <SwatchDot color={color} opacity={0} stroke={color} strokeWidth={1.5} />;
  if (part.geom === "line") return <SwatchLine color={color} width={LINE_WIDTH.standard[1]} dash={part.dashed ? [2, 1.5] : undefined} />;
  return <SwatchDot color={color} />;
}

/** 依規格畫圖例（他國重用，2026-11-13 越南）；`extraParts`：同一層另有其他 PMTiles 的子圖層（署名在圖層「說明・來源」）。 */
export function PhSpecLegend({ spec, extraParts = [] }: { spec: PhLayerSpec<string>; extraParts?: PhLayerSpec<string>["parts"] }) {
  const { locale } = useLocale();
  const title = useLayerTitle(spec.key);
  const all = { ...spec, parts: [...spec.parts, ...extraParts] };
  const ring = all.parts.find((p) => p.ring)?.ring;
  const dashed = all.parts.find((p) => p.dashed);
  // 部分空心（`when` 條件）另列一行說明；整層空心已由分類列的 swatch 表示
  const hollow = all.parts.find((p) => p.hollow?.when)?.hollow;
  return <div>
    <LegendTitle zh={spec.legendTitleNote ? `${title}（${pickL3(spec.legendTitleNote, locale)}）` : title} />
    {spec.cats.map((c) => <LegendRow key={c.id} swatch={catSwatch(all, c, c.color)}>{pickL3(c.label, locale)}</LegendRow>)}
    {spec.otherLabel ? <LegendRow swatch={catSwatch(all, null, spec.otherColor ?? spec.color)}>{pickL3(spec.otherLabel, locale)}</LegendRow> : null}
    {dashed && spec.dashLabel !== null ? <LegendRow swatch={<SwatchLine color={spec.color} width={LINE_WIDTH.standard[1]} dash={[2, 1.5]} />}>{pickL3(spec.dashLabel ?? { zh: "虛線：地下、海底電纜", en: "Dashed: underground / submarine cable", ja: "破線：地中・海底ケーブル" }, locale)}</LegendRow> : null}
    {spec.sizeLegend?.map((s) => <LegendSizeRow key={s.prop} title={pickL3(s.title, locale)} items={s.bands.map((b) => ({ r: b.radius, label: typeof b.label === "string" ? b.label : pickL3(b.label, locale) }))} fill={spec.color} numeric={s.bands.every((b) => typeof b.label === "string")} />)}
    {hollow ? <LegendRow swatch={<SwatchDot color={spec.color} opacity={0} stroke={spec.color} strokeWidth={1.5} />}>{pickL3(hollow.label, locale)}</LegendRow> : null}
    {ring ? <LegendRow swatch={<SwatchDot color={spec.color} stroke="#ffffff" strokeWidth={2} />}>{pickL3(ring.label, locale)}</LegendRow> : null}
    {spec.legendNotes.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendRestrictions layers={[spec.key]} />
  </div>;
}

