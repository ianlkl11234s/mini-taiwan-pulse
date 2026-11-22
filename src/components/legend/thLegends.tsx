// 泰國圖例（2026-11-22 第 0–1 波）：行政邊界、人口密度、規格驅動 8 層（重用菲律賓 PhSpecLegend）。SSOT：data/thDataLayers.ts。
import { LegendNote, LegendRow, LegendTitle, SwatchGradient, SwatchLine, SwatchSquare, SwatchSteps, useLegendTheme } from "./legendKit";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import { localizeLayerName } from "../../i18n/layerText";
import { useLocale } from "../../state/localeStore";
import { BOUNDARY_GRAY, LINE_WIDTH } from "../../map/mapStyleScale";
import {
  TH_ADMIN_NOTES, TH_ADMIN_SOURCE, TH_DENSITY_LABELS, TH_NOT_COVERED_COLOR, TH_POPULATION_NOTES, TH_POPULATION_SOURCE, TH_SPEC_BY_KEY, phText, pickL3,
} from "../../data/thDataLayers";
import type { ThDataKey, ThRasterKey } from "../../data/thDataKeys";
import { TH_RASTER_BY_KEY } from "../../data/thWavesLayers";
import { thDensityColors } from "../../hooks/useThLayers";
import { PhSpecLegend } from "./phLegends";

function useLayerTitle(key: string): string {
  const i18n = useLocale();
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

export function ThAdminBoundariesLegend() {
  const { locale } = useLocale();
  const title = useLayerTitle("thAdminBoundaries");
  const t = useLegendTheme();
  const color = BOUNDARY_GRAY[t.isDark ? "dark" : "light"];
  return <div>
    <LegendTitle zh={title} />
    <LegendRow swatch={<SwatchLine color={color} width={LINE_WIDTH.standard[1]} />}>{pickL3({ zh: "國界（Country）", en: "Country boundary", ja: "国境（Country）" }, locale)}</LegendRow>
    <LegendRow swatch={<SwatchLine color={color} width={LINE_WIDTH.standard[1] * 0.8} />}>{pickL3({ zh: "府界（77 府）", en: "Province boundary (77)", ja: "県境（77 県）" }, locale)}</LegendRow>
    <LegendRow swatch={<SwatchLine color={color} width={LINE_WIDTH.standard[1] * 0.6} />}>{pickL3({ zh: "縣界（amphoe／khet，928）", en: "District boundary (amphoe / khet, 928)", ja: "郡境（amphoe／khet、928）" }, locale)}</LegendRow>
    <LegendRow swatch={<SwatchLine color={color} width={LINE_WIDTH.standard[1] * 0.4} />}>{pickL3({ zh: "區界（tambon／khwaeng，7,425）", en: "Sub-district boundary (tambon / khwaeng, 7,425)", ja: "区境（tambon／khwaeng、7,425）" }, locale)}</LegendRow>
    {TH_ADMIN_NOTES.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendNote>{phText(TH_ADMIN_SOURCE.short, locale)}</LegendNote>
  </div>;
}

export function ThPopulationLegend() {
  const { locale } = useLocale();
  const title = useLayerTitle("thPopulation");
  const t = useLegendTheme();
  const colors = thDensityColors(t.isDark);
  return <div>
    <LegendTitle zh={title} />
    <LegendNote>{pickL3({ zh: "人口密度（人／km²，戶籍人口）", en: "Population density (people/km², registered)", ja: "人口密度（人／km²、住民登録人口）" }, locale)}</LegendNote>
    {TH_DENSITY_LABELS.map((label, i) => <LegendRow key={label} swatch={<SwatchSquare color={colors[i]!} />}>{label}</LegendRow>)}
    <LegendRow swatch={<SwatchSquare color={TH_NOT_COVERED_COLOR} />}>{pickL3({ zh: "未涵蓋（不是 0）", en: "Not covered (not zero)", ja: "未収録（0 ではない）" }, locale)}</LegendRow>
    {TH_POPULATION_NOTES.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendNote>{pickL3(TH_POPULATION_SOURCE.short, locale)}</LegendNote>
  </div>;
}

/** 規格驅動 8 層。 */
export function ThDataLegend({ layerKey }: { layerKey: ThDataKey }) {
  return <PhSpecLegend spec={TH_SPEC_BY_KEY[layerKey]} />;
}

/** Raster 2 層：山體陰影畫明暗漸層，色別標高照色帶分段。 */
export function ThRasterLegend({ layerKey }: { layerKey: ThRasterKey }) {
  const { locale } = useLocale();
  const spec = TH_RASTER_BY_KEY[layerKey];
  const title = useLayerTitle(layerKey);
  return <div>
    <LegendTitle zh={title} />
    {spec.steps
      ? <SwatchSteps colors={spec.steps.map((x) => x.color)} breaks={spec.steps.map((x) => x.label)} />
      : <SwatchGradient gradient="linear-gradient(90deg, #000000, #ffffff)" labels={[pickL3({ zh: "背光坡", en: "Shaded", ja: "陰" }, locale), pickL3({ zh: "向光坡", en: "Lit", ja: "陽" }, locale)]} />}
    {spec.notes.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendNote>{phText(spec.sourceShort, locale)}</LegendNote>
  </div>;
}
