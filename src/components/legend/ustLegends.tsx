// 美國屬地圖例（2026-11-25 波多黎各、關島第 0–1 波）：行政邊界、人口密度、規格驅動 8×2 層（重用菲律賓 PhSpecLegend）。SSOT：data/ustDataLayers.ts。
// 來源、授權、資料日期在圖層「說明・來源」，圖例只留色階、單位、縮放與涵蓋範圍提示。
import { LegendNote, LegendRow, LegendTitle, SwatchLine, SwatchSquare, useLegendTheme } from "./legendKit";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import { localizeLayerName } from "../../i18n/layerText";
import { useLocale } from "../../state/localeStore";
import { BOUNDARY_GRAY, LINE_WIDTH } from "../../map/mapStyleScale";
import { UST_ADMIN_LEVELS, UST_ADMIN_NOTES, UST_NOT_COVERED_COLOR, UST_POP_LEVELS, UST_POP_NOTES, UST_SPEC_BY_KEY, pickL3, ustDensityLabels, type UstCc } from "../../data/ustDataLayers";
import type { UstDataKey } from "../../data/ustDataKeys";
import { ustDensityColors } from "../../hooks/useUstLayers";
import { PhSpecLegend } from "./intlSpecLegend";

function useLayerTitle(key: string): string {
  const i18n = useLocale();
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

export function UstAdminBoundariesLegend({ cc }: { cc: UstCc }) {
  const { locale } = useLocale();
  const title = useLayerTitle(`${cc}AdminBoundaries`);
  const t = useLegendTheme();
  const color = BOUNDARY_GRAY[t.isDark ? "dark" : "light"];
  return <div>
    <LegendTitle zh={title} />
    {UST_ADMIN_LEVELS[cc].map((lv, i) => <LegendRow key={lv.value} swatch={<SwatchLine color={color} width={LINE_WIDTH.standard[1] * (1 - i * 0.2)} />}>{pickL3(lv.l3, locale)}</LegendRow>)}
    {UST_ADMIN_NOTES[cc].map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
  </div>;
}

export function UstPopulationLegend({ cc }: { cc: UstCc }) {
  const { locale } = useLocale();
  const title = useLayerTitle(`${cc}Population`);
  const t = useLegendTheme();
  const colors = ustDensityColors(t.isDark);
  return <div>
    <LegendTitle zh={title} />
    <LegendNote>{pickL3({ zh: "人口密度（人／km²，陸地面積）", en: "Population density (people/km², land area)", ja: "人口密度（人／km²、陸地面積）" }, locale)}</LegendNote>
    {UST_POP_LEVELS[cc].map((lv) => <div key={lv.value}>
      <LegendNote>{pickL3(lv.l3, locale)}</LegendNote>
      {ustDensityLabels(cc, lv.value).map((label, i) => <LegendRow key={label} swatch={<SwatchSquare color={colors[i]!} />}>{label}</LegendRow>)}
    </div>)}
    {cc === "gu" ? <LegendRow swatch={<SwatchSquare color={UST_NOT_COVERED_COLOR} />}>{pickL3({ zh: "未涵蓋（來源表空白，不是 0）", en: "Not covered (blank in source, not zero)", ja: "未収録（元表が空欄、0 ではない）" }, locale)}</LegendRow> : null}
    {UST_POP_NOTES[cc].map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
  </div>;
}

export function UstDataLegend({ layerKey }: { layerKey: UstDataKey }) {
  return <PhSpecLegend spec={UST_SPEC_BY_KEY[layerKey]} />;
}
