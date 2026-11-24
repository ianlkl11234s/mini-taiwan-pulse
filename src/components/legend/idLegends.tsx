// 印尼圖例（2026-11-23 第 0–4 波）：行政邊界、人口密度、農村發展指數、規格驅動 19 層（重用菲律賓 PhSpecLegend）、5 張 raster。SSOT：data/idDataLayers.ts。
// 來源、授權、資料日期在圖層「說明・來源」，圖例只留色階、單位、縮放與涵蓋範圍提示。
import { LegendNote, LegendRow, LegendTitle, SwatchGradient, SwatchLine, SwatchSquare, SwatchSteps, useLegendTheme } from "./legendKit";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import { localizeLayerName } from "../../i18n/layerText";
import { useLocale } from "../../state/localeStore";
import { BOUNDARY_GRAY, LINE_WIDTH } from "../../map/mapStyleScale";
import {
  ID_ADMIN_NOTES, ID_DENSITY_LABELS_BY_LEVEL, ID_IDM_LABELS_BY_LEVEL, ID_NOT_COVERED_COLOR, ID_POPULATION_NOTES, ID_RURAL_NOTES, ID_SPEC_BY_KEY, phText, pickL3,
} from "../../data/idDataLayers";
import type { IdDataKey, IdRasterKey } from "../../data/idDataKeys";
import { ID_RASTER_BY_KEY } from "../../data/idWavesLayers";
import { idDensityColors, idIdmColors } from "../../hooks/useIdLayers";
import { PhSpecLegend } from "./intlSpecLegend";

function useLayerTitle(key: string): string {
  const i18n = useLocale();
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

export function IdAdminBoundariesLegend() {
  const { locale } = useLocale();
  const title = useLayerTitle("idAdminBoundaries");
  const t = useLegendTheme();
  const color = BOUNDARY_GRAY[t.isDark ? "dark" : "light"];
  return <div>
    <LegendTitle zh={title} />
    <LegendRow swatch={<SwatchLine color={color} width={LINE_WIDTH.standard[1]} />}>{pickL3({ zh: "國界（Country）", en: "Country boundary", ja: "国境（Country）" }, locale)}</LegendRow>
    <LegendRow swatch={<SwatchLine color={color} width={LINE_WIDTH.standard[1] * 0.8} />}>{pickL3({ zh: "省界（38 省）", en: "Province boundary (38)", ja: "州境（38 州）" }, locale)}</LegendRow>
    <LegendRow swatch={<SwatchLine color={color} width={LINE_WIDTH.standard[1] * 0.6} />}>{pickL3({ zh: "縣市界（514，z5 起）", en: "Regency / city boundary (514, from z5)", ja: "県市境（514、z5 以上）" }, locale)}</LegendRow>
    {ID_ADMIN_NOTES.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
  </div>;
}

function ChoroplethLegend({ layerKey, intro, labels, colors, notes }: {
  layerKey: string; intro: { zh: string; en: string; ja: string };
  labels: { province: readonly string[]; kabkota: readonly string[] }; colors: string[]; notes: readonly { zh: string; en: string; ja: string }[];
}) {
  const { locale } = useLocale();
  const title = useLayerTitle(layerKey);
  return <div>
    <LegendTitle zh={title} />
    <LegendNote>{pickL3(intro, locale)}</LegendNote>
    {(["province", "kabkota"] as const).map((lv) => <div key={lv}>
      <LegendNote>{pickL3(lv === "province" ? { zh: "省層級（38）", en: "Province level (38)", ja: "州レベル（38）" } : { zh: "縣市層級（514，z5 起）", en: "Regency / city level (514, from z5)", ja: "県市レベル（514、z5 以上）" }, locale)}</LegendNote>
      {labels[lv].map((label, i) => <LegendRow key={label} swatch={<SwatchSquare color={colors[i]!} />}>{label}</LegendRow>)}
    </div>)}
    <LegendRow swatch={<SwatchSquare color={ID_NOT_COVERED_COLOR} />}>{pickL3({ zh: "未涵蓋（不是 0）", en: "Not covered (not zero)", ja: "未収録（0 ではない）" }, locale)}</LegendRow>
    {notes.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
  </div>;
}

export function IdPopulationLegend() {
  const t = useLegendTheme();
  return <ChoroplethLegend layerKey="idPopulation" intro={{ zh: "人口密度（人／km²，2020 推估）", en: "Population density (people/km², 2020 estimate)", ja: "人口密度（人／km²、2020 年推計）" }}
    labels={ID_DENSITY_LABELS_BY_LEVEL} colors={idDensityColors(t.isDark)} notes={ID_POPULATION_NOTES} />;
}

export function IdRuralDevelopmentLegend() {
  const t = useLegendTheme();
  return <ChoroplethLegend layerKey="idRuralDevelopment" intro={{ zh: "IDM 2024 村均值（0–1，越高越發展）", en: "IDM 2024 village mean (0–1, higher = more developed)", ja: "IDM 2024 村平均（0–1、高いほど発展）" }}
    labels={ID_IDM_LABELS_BY_LEVEL} colors={idIdmColors(t.isDark)} notes={ID_RURAL_NOTES} />;
}

/** 規格驅動 19 層。 */
export function IdDataLegend({ layerKey }: { layerKey: IdDataKey }) {
  return <PhSpecLegend spec={ID_SPEC_BY_KEY[layerKey]} />;
}

/** Raster 5 層：山體陰影畫明暗漸層，其餘照色階分段。 */
export function IdRasterLegend({ layerKey }: { layerKey: IdRasterKey }) {
  const { locale } = useLocale();
  const spec = ID_RASTER_BY_KEY[layerKey];
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
