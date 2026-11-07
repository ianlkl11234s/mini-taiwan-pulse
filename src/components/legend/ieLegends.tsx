// 愛爾蘭第 0 波圖例（行政邊界）。色票、備註與署名 SSOT 在 data/ieAdminTypes.ts。
import { LegendNote, LegendRow, LegendTitle, SwatchLine, useLegendTheme } from "./legendKit";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import { localizeLayerName } from "../../i18n/layerText";
import { useLocale } from "../../state/localeStore";
import { BOUNDARY_GRAY } from "../../map/mapStyleScale";
import { IE_ADMIN_NOTES, IE_ADMIN_SOURCE, pickL3 } from "../../data/ieAdminTypes";

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
