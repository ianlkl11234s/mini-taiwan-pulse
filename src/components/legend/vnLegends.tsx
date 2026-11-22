// 越南圖例（2026-11-13 第 0–1 波）：行政邊界、人口密度、規格驅動 10 層（重用菲律賓 PhSpecLegend）。SSOT：data/vnDataLayers.ts。
import { LegendNote, LegendRow, LegendTitle, SwatchGradient, SwatchLine, SwatchSquare, SwatchSteps, useLegendTheme } from "./legendKit";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import { localizeLayerName } from "../../i18n/layerText";
import { useLocale } from "../../state/localeStore";
import { BOUNDARY_GRAY } from "../../map/mapStyleScale";
import {
  VN_ADMIN_NOTES, VN_ADMIN_SOURCE, VN_DENSITY_LABELS, VN_POPULATION_NOTES, VN_POPULATION_SOURCE, VN_SPEC_BY_KEY, phText, pickL3,
} from "../../data/vnDataLayers";
import type { VnDataKey, VnRasterKey } from "../../data/vnDataKeys";
import { VN_RASTER_BY_KEY } from "../../data/vnWavesLayers";
import { vnDensityColors } from "../../hooks/useVnLayers";
import { PhSpecLegend } from "./phLegends";

function useLayerTitle(key: string): string {
  const i18n = useLocale();
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

export function VnAdminBoundariesLegend() {
  const { locale } = useLocale();
  const title = useLayerTitle("vnAdminBoundaries");
  const t = useLegendTheme();
  return <div>
    <LegendTitle zh={title} />
    <LegendRow swatch={<SwatchLine color={BOUNDARY_GRAY[t.isDark ? "dark" : "light"]} />}>{pickL3({ zh: "省界（34 省）", en: "Province boundary (34)", ja: "省界（34 省）" }, locale)}</LegendRow>
    {VN_ADMIN_NOTES.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendNote>{phText(VN_ADMIN_SOURCE.short, locale)}</LegendNote>
  </div>;
}

export function VnPopulationLegend() {
  const { locale } = useLocale();
  const title = useLayerTitle("vnPopulation");
  const t = useLegendTheme();
  const colors = vnDensityColors(t.isDark);
  return <div>
    <LegendTitle zh={title} />
    <LegendNote>{pickL3({ zh: "人口密度（人／km²）", en: "Population density (people/km²)", ja: "人口密度（人／km²）" }, locale)}</LegendNote>
    {VN_DENSITY_LABELS.map((label, i) => <LegendRow key={label} swatch={<SwatchSquare color={colors[i]!} />}>{label}</LegendRow>)}
    {VN_POPULATION_NOTES.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendNote>{phText(VN_POPULATION_SOURCE.short, locale)}</LegendNote>
  </div>;
}

/** 規格驅動 10 層；分檔的層把第二檔子圖層與署名一起列出。 */
export function VnDataLegend({ layerKey }: { layerKey: VnDataKey }) {
  const spec = VN_SPEC_BY_KEY[layerKey];
  const { locale } = useLocale();
  const more = spec.more;
  return <PhSpecLegend spec={spec} extraParts={more?.parts ?? []} extraSources={more ? [`${phText(more.sourceOrg, locale)}（${phText(more.license, locale)}）`] : []} />;
}

/** Raster 4 層（2026-11-17）：山體陰影畫明暗漸層；色別標高照上游色帶分段；崩塌潛勢、WDPCA 列分類色塊（外框類只畫框）。 */
export function VnRasterLegend({ layerKey }: { layerKey: VnRasterKey }) {
  const { locale } = useLocale();
  const spec = VN_RASTER_BY_KEY[layerKey];
  const title = useLayerTitle(layerKey);
  return <div>
    <LegendTitle zh={title} />
    {spec.steps
      ? <SwatchSteps colors={spec.steps.map((x) => x.color)} breaks={spec.steps.map((x) => x.label)} />
      : spec.swatches
        ? spec.swatches.map((x) => <LegendRow key={x.color} swatch={<SwatchSquare color={x.color} outline={x.outline} />}>{pickL3(x.label, locale)}</LegendRow>)
        : <SwatchGradient gradient="linear-gradient(90deg, #000000, #ffffff)" labels={[pickL3({ zh: "背光坡", en: "Shaded", ja: "陰" }, locale), pickL3({ zh: "向光坡", en: "Lit", ja: "陽" }, locale)]} />}
    {spec.notes.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendNote>{phText(spec.sourceShort, locale)}</LegendNote>
  </div>;
}
