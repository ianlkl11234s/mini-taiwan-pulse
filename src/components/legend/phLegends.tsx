// 菲律賓圖例（2026-11-13 第 0–1 波）：行政邊界、人口密度（未涵蓋＝灰）、規格驅動 8 層。SSOT：data/phDataLayers.ts。
import type { ReactNode } from "react";
import { LegendNote, LegendRow, LegendSizeRow, LegendTitle, SwatchDot, SwatchGradient, SwatchLine, SwatchSquare, SwatchSteps, useLegendTheme } from "./legendKit";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import { localizeLayerName } from "../../i18n/layerText";
import { useLocale } from "../../state/localeStore";
import { BOUNDARY_GRAY, LINE_WIDTH } from "../../map/mapStyleScale";
import {
  PH_ADMIN_NOTES, PH_ADMIN_SOURCE, PH_DENSITY_LABELS, PH_NOT_COVERED_COLOR, PH_POPULATION_NOTES, PH_POPULATION_SOURCE,
  PH_SPEC_BY_KEY, phText, pickL3, type PhCat, type PhLayerSpec,
} from "../../data/phDataLayers";
import type { PhDataKey, PhRasterKey } from "../../data/phDataKeys";
import { PH_RASTER_BY_KEY } from "../../data/phWavesLayers";
import { phDensityColors } from "../../hooks/usePhLayers";

function useLayerTitle(key: string): string {
  const i18n = useLocale();
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

export function PhAdminBoundariesLegend() {
  const { locale } = useLocale();
  const title = useLayerTitle("phAdminBoundaries");
  const t = useLegendTheme();
  return <div>
    <LegendTitle zh={title} />
    <LegendRow swatch={<SwatchLine color={BOUNDARY_GRAY[t.isDark ? "dark" : "light"]} />}>{pickL3({ zh: "行政區界（區域、省、市鎮、村里擇一）", en: "Boundary (region / province / city-municipality / barangay)", ja: "行政区域界（地方・州・市町・バランガイから選択）" }, locale)}</LegendRow>
    {PH_ADMIN_NOTES.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendNote>{PH_ADMIN_SOURCE.short}</LegendNote>
  </div>;
}

export function PhPopulationLegend() {
  const { locale } = useLocale();
  const title = useLayerTitle("phPopulation");
  const t = useLegendTheme();
  const colors = phDensityColors(t.isDark);
  return <div>
    <LegendTitle zh={title} />
    <LegendNote>{pickL3({ zh: "人口密度（人／km²）", en: "Population density (people/km²)", ja: "人口密度（人／km²）" }, locale)}</LegendNote>
    {PH_DENSITY_LABELS.map((label, i) => <LegendRow key={label} swatch={<SwatchSquare color={colors[i]!} />}>{label}</LegendRow>)}
    <LegendRow swatch={<SwatchSquare color={PH_NOT_COVERED_COLOR} />}>{pickL3({ zh: "未涵蓋（不是 0）", en: "Not covered (not zero)", ja: "未収録（0 ではない）" }, locale)}</LegendRow>
    {PH_POPULATION_NOTES.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendNote>{PH_POPULATION_SOURCE.short}</LegendNote>
  </div>;
}

function catSwatch(spec: PhLayerSpec<string>, c: PhCat | null, color: string): ReactNode {
  const parts = c?.parts ? spec.parts.filter((p) => c.parts!.includes(p.id)) : spec.parts;
  const part = parts[0]!;
  if (part.geom === "fill") return <SwatchSquare color={color} outline={part.fillOpacity === 0} />;
  if (part.geom === "point" && part.hollow && !part.hollow.when) return <SwatchDot color={color} opacity={0} stroke={color} strokeWidth={1.5} />;
  if (part.geom === "line") return <SwatchLine color={color} width={LINE_WIDTH.standard[1]} dash={part.dashed ? [2, 1.5] : undefined} />;
  return <SwatchDot color={color} />;
}

/** 規格驅動 8 層：分類列（線／點依子圖層）、大小級距、白框補缺、備註、署名。 */
export function PhDataLegend({ layerKey }: { layerKey: PhDataKey }) {
  return <PhSpecLegend spec={PH_SPEC_BY_KEY[layerKey]} />;
}

/** 依規格畫圖例（他國重用，2026-11-13 越南）；`extraParts`／`extraSources`：同一層另有其他 PMTiles 的子圖層與署名。 */
export function PhSpecLegend({ spec, extraParts = [], extraSources = [] }: { spec: PhLayerSpec<string>; extraParts?: PhLayerSpec<string>["parts"]; extraSources?: readonly string[] }) {
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
    <LegendNote>{phText(spec.sourceOrg, locale)}（{phText(spec.license, locale)}）</LegendNote>
    {extraSources.map((s) => <LegendNote key={s}>{s}</LegendNote>)}
  </div>;
}

/** Raster 4 層（2026-11-16）：山體陰影畫明暗漸層，其餘照上游 color-relief 色帶分段。 */
export function PhRasterLegend({ layerKey }: { layerKey: PhRasterKey }) {
  const { locale } = useLocale();
  const spec = PH_RASTER_BY_KEY[layerKey];
  const title = useLayerTitle(layerKey);
  return <div>
    <LegendTitle zh={title} />
    {spec.steps
      ? <SwatchSteps colors={spec.steps.map((x) => x.color)} breaks={spec.steps.map((x) => x.label)} />
      : <SwatchGradient gradient="linear-gradient(90deg, #000000, #ffffff)" labels={[pickL3({ zh: "背光坡", en: "Shaded", ja: "陰" }, locale), pickL3({ zh: "向光坡", en: "Lit", ja: "陽" }, locale)]} />}
    {spec.notes.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendNote>{spec.sourceShort}</LegendNote>
  </div>;
}
