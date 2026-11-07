// 愛爾蘭圖例：第 0 波行政邊界（SSOT data/ieAdminTypes.ts）、第 1 波規格驅動 6 層與海床地形（SSOT data/ieDataLayers.ts）。
import type { ReactNode } from "react";
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchGradient, SwatchLine, SwatchSquare, useLegendTheme } from "./legendKit";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import { localizeLayerName } from "../../i18n/layerText";
import { useLocale } from "../../state/localeStore";
import { BOUNDARY_GRAY, LINE_WIDTH } from "../../map/mapStyleScale";
import { IE_ADMIN_NOTES, IE_ADMIN_SOURCE, pickL3 } from "../../data/ieAdminTypes";
import { IE_BATHYMETRY, IE_SPEC_BY_KEY, type IeLayerSpec } from "../../data/ieDataLayers";
import type { IeDataKey } from "../../data/ieDataKeys";
import { krRampColors } from "../../data/krDataLayers";

export function IeAdminBoundariesLegend() {
  const i18n = useLocale();
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>).ieAdminBoundaries?.name;
  const title = name ? localizeLayerName("ieAdminBoundaries", name, i18n).primary : "ieAdminBoundaries";
  const t = useLegendTheme();
  return <div>
    <LegendTitle zh={title} />
    <LegendRow swatch={<SwatchLine color={BOUNDARY_GRAY[t.isDark ? "dark" : "light"]} />}>{pickL3({ zh: "行政區界（地方政府、選舉分區、統計小區）", en: "Boundary (local authority / electoral division / small area)", ja: "行政区域界（自治体・選挙区・スモールエリア）" }, i18n.locale)}</LegendRow>
    {IE_ADMIN_NOTES.map((n, i) => <LegendNote key={i}>{pickL3(n, i18n.locale)}</LegendNote>)}
    <LegendNote>{IE_ADMIN_SOURCE.short}</LegendNote>
  </div>;
}

function useLayerTitle(key: string): string {
  const i18n = useLocale();
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

function swatch(spec: IeLayerSpec, color: string): ReactNode {
  return spec.geom === "point" ? <SwatchDot color={color} /> : spec.geom === "line" ? <SwatchLine color={color} width={LINE_WIDTH.standard[1]} /> : <SwatchSquare color={color} />;
}

/** 第 1 波規格驅動 6 層（比照南韓 KrDataLayerLegend）：分類列／序列色階、備註、署名。 */
export function IeDataLegend({ layerKey }: { layerKey: IeDataKey }) {
  const { locale } = useLocale();
  const spec = IE_SPEC_BY_KEY[layerKey];
  const title = useLayerTitle(layerKey);
  const theme = useLegendTheme();
  const ramp = spec.ramp ? krRampColors(spec, theme.isDark) : null;
  return <div>
    <LegendTitle zh={title} />
    {spec.ramp && ramp ? <>
      <LegendNote>{pickL3(spec.ramp.unit, locale)}</LegendNote>
      {spec.ramp.labels.map((label, i) => <LegendRow key={label} swatch={<SwatchSquare color={ramp[i]!} />}>{label}</LegendRow>)}
    </> : spec.cats ? spec.cats.map((c) => <LegendRow key={c.id} swatch={swatch(spec, c.color)}>{pickL3(c.label, locale)}</LegendRow>) : <LegendRow swatch={swatch(spec, spec.color)}>{title}</LegendRow>}
    {spec.cats && spec.otherLabel ? <LegendRow swatch={swatch(spec, spec.otherColor ?? spec.color)}>{pickL3(spec.otherLabel, locale)}</LegendRow> : null}
    {spec.legendNotes.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendNote>{spec.sourceOrg}（{spec.license}）</LegendNote>
  </div>;
}

/** 海床地形（raster）：深度色階＋備註＋署名。 */
export function IeBathymetryLegend() {
  const { locale } = useLocale();
  const title = useLayerTitle("ieBathymetry");
  const stops = IE_BATHYMETRY.stops;
  const gradient = `linear-gradient(90deg, ${stops.map((s, i) => `${s.color} ${Math.round((i / (stops.length - 1)) * 100)}%`).join(", ")})`;
  return <div>
    <LegendTitle zh={title} />
    <SwatchGradient gradient={gradient} labels={["0 m", "200 m", "5,000 m"]} />
    <LegendNote>{pickL3({ zh: "色階非等距：0、20、50、100、200、500、1,000、2,000、3,000、5,000 m", en: "Non-linear ramp: 0, 20, 50, 100, 200, 500, 1,000, 2,000, 3,000, 5,000 m", ja: "非等間隔の段彩：0・20・50・100・200・500・1,000・2,000・3,000・5,000 m" }, locale)}</LegendNote>
    {IE_BATHYMETRY.notes.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendNote>{IE_BATHYMETRY.sourceOrg}（{IE_BATHYMETRY.license}）</LegendNote>
  </div>;
}
