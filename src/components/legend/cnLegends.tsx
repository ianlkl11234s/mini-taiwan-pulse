// 中國圖例（2026-11-13 第 0–1 波，站主限定）：行政邊界、人口密度（未涵蓋＝灰）、人口網格（模型值）、規格驅動 6 層。SSOT：data/cnDataLayers.ts。
import type { ReactNode } from "react";
import { LegendNote, LegendRow, LegendSizeRow, LegendTitle, SwatchDot, SwatchLine, SwatchSquare, useLegendTheme } from "./legendKit";
import { DenseHeatmapLegendRow } from "./legendShared";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import { localizeLayerName } from "../../i18n/layerText";
import { useLocale } from "../../state/localeStore";
import { BOUNDARY_GRAY, LINE_WIDTH } from "../../map/mapStyleScale";
import {
  CN_ADMIN_NOTES, CN_ADMIN_SOURCE, CN_DENSITY_LABELS, CN_GRID_LEGEND, CN_GRID_NOTES, CN_GRID_SOURCE, CN_NOT_COVERED_COLOR, CN_POPULATION_NOTES,
  CN_POPULATION_SOURCE, CN_SPEC_BY_KEY, pickL3, type CnLayerSpec,
} from "../../data/cnDataLayers";
import type { PhCat } from "../../data/phDataLayers";
import type { CnDataKey } from "../../data/cnDataKeys";
import { cnDensityColors } from "../../hooks/useCnLayers";

function useLayerTitle(key: string): string {
  const i18n = useLocale();
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

export function CnAdminBoundariesLegend() {
  const { locale } = useLocale();
  const title = useLayerTitle("cnAdminBoundaries");
  const t = useLegendTheme();
  return <div>
    <LegendTitle zh={title} />
    <LegendRow swatch={<SwatchLine color={BOUNDARY_GRAY[t.isDark ? "dark" : "light"]} />}>{pickL3({ zh: "行政區界（省級、地級擇一）", en: "Boundary (province or prefecture level)", ja: "行政区域界（省級・地級から選択）" }, locale)}</LegendRow>
    {CN_ADMIN_NOTES.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendNote>{CN_ADMIN_SOURCE.short}</LegendNote>
  </div>;
}

export function CnPopulationLegend() {
  const { locale } = useLocale();
  const title = useLayerTitle("cnPopulation");
  const t = useLegendTheme();
  const colors = cnDensityColors(t.isDark);
  return <div>
    <LegendTitle zh={title} />
    <LegendNote>{pickL3({ zh: "人口密度（人／km²；地級為模型值）", en: "Population density (people/km²; prefecture = model values)", ja: "人口密度（人／km²、地級はモデル値）" }, locale)}</LegendNote>
    {CN_DENSITY_LABELS.map((label, i) => <LegendRow key={label} swatch={<SwatchSquare color={colors[i]!} />}>{label}</LegendRow>)}
    <LegendRow swatch={<SwatchSquare color={CN_NOT_COVERED_COLOR} />}>{pickL3({ zh: "未涵蓋（不是 0）", en: "Not covered (not zero)", ja: "未収録（0 ではない）" }, locale)}</LegendRow>
    {CN_POPULATION_NOTES.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendNote>{CN_POPULATION_SOURCE.short}</LegendNote>
  </div>;
}

export function CnPopulationGridLegend() {
  const { locale } = useLocale();
  const title = useLayerTitle("cnPopulationGrid");
  return <div>
    <LegendTitle zh={title} />
    <LegendNote>{pickL3({ zh: "人口密度（GHS-POP 2025 模型值，人／km²）", en: "Population density (GHS-POP 2025 model values, people/km²)", ja: "人口密度（GHS-POP 2025 モデル値、人／km²）" }, locale)}</LegendNote>
    {CN_GRID_LEGEND.map((c) => <LegendRow key={c.label} swatch={<SwatchSquare color={c.color} />}>{c.label}</LegendRow>)}
    {CN_GRID_NOTES.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendNote>{CN_GRID_SOURCE.org}（{CN_GRID_SOURCE.license}）</LegendNote>
  </div>;
}

function catSwatch(spec: CnLayerSpec, c: PhCat): ReactNode {
  const parts = c.parts ? spec.parts.filter((p) => c.parts!.includes(p.id)) : spec.parts;
  const part = parts[0]!;
  if (part.geom === "line") return <SwatchLine color={c.color} width={LINE_WIDTH.standard[1]} />;
  return <SwatchDot color={c.color} />;
}

/** 規格驅動 6 層：分類列、虛線與淡化說明、大小級距、白框、備註、署名。 */
export function CnDataLegend({ layerKey }: { layerKey: CnDataKey }) {
  const { locale } = useLocale();
  const spec = CN_SPEC_BY_KEY[layerKey];
  const title = useLayerTitle(layerKey);
  const ring = spec.parts.find((p) => p.ring)?.ring;
  const dashed = spec.parts.find((p) => p.dashed);
  const faded = spec.parts.find((p) => p.fadeWhen);
  return <div>
    <LegendTitle zh={title} />
    {spec.heat ? <DenseHeatmapLegendRow layers={[spec.key]} /> : null}
    {spec.cats.map((c) => <LegendRow key={c.id} swatch={catSwatch(spec, c)}>{pickL3(c.label, locale)}</LegendRow>)}
    {dashed ? <LegendRow swatch={<SwatchLine color={spec.color} width={LINE_WIDTH.standard[1]} dash={[2, 1.5]} />}>{pickL3({ zh: "虛線：興建、規劃、擱置等（非運轉中）", en: "Dashed: under construction, proposed, shelved, etc.", ja: "破線：建設中・計画中・保留など" }, locale)}</LegendRow> : null}
    {faded ? <LegendRow swatch={<SwatchLine color={spec.color} width={LINE_WIDTH.standard[1]} opacity={0.4} />}>{pickL3({ zh: "淡色：路線精度低（示意路線）", en: "Faded: low route accuracy (schematic)", ja: "淡色：ルート精度が低い（模式的）" }, locale)}</LegendRow> : null}
    {spec.sizeLegend?.map((s) => <LegendSizeRow key={s.prop} title={pickL3(s.title, locale)} items={s.bands.map((b) => ({ r: b.radius, label: b.label }))} fill={spec.color} />)}
    {ring ? <LegendRow swatch={<SwatchDot color={spec.color} stroke="#ffffff" strokeWidth={2} />}>{pickL3(ring.label, locale)}</LegendRow> : null}
    {spec.minZoomNote ? <LegendNote>{pickL3(spec.minZoomNote, locale)}</LegendNote> : null}
    {spec.legendNotes.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendNote>{spec.sourceOrg}（{spec.license}）</LegendNote>
  </div>;
}
