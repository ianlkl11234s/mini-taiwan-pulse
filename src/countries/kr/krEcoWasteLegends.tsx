// 南韓 KRH-1 圖例：生態自然圖（C117）、生活垃圾排出規則（C086）。文案與色票 SSOT 在 data/krEcoWasteTypes.ts。
import { LegendNote, LegendRestrictions, LegendRow, LegendTitle, SwatchHatch, SwatchSquare, useLegendTheme } from "../../components/legend/legendKit";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import { pickL3 } from "./krDataLayers";
import { krEcoGrades, KR_ECO_TEXT, KR_WASTE_ATTRIBUTION, KR_WASTE_COLOR, KR_WASTE_LICENSE, KR_WASTE_TEXT } from "./krEcoWasteTypes";
import { useLocale } from "../../state/localeStore";
import { localizeLayerName } from "../../i18n/layerText";

function useTitle(key: string): string {
  const i18n = useLocale();
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

export function KrEcologyNaturalnessLegend() {
  const { locale } = useLocale();
  const title = useTitle("krEcologyNaturalness");
  const t = useLegendTheme();
  return <div>
    <LegendTitle zh={title} />
    {krEcoGrades(t.isDark).map((g) => <LegendRow key={g.value} swatch={<SwatchSquare color={g.color} />}>{pickL3(g.label, locale)}</LegendRow>)}
    <LegendNote>{pickL3(KR_ECO_TEXT.legendBlank, locale)}</LegendNote>
    <LegendNote>{pickL3(KR_ECO_TEXT.legendNine, locale)}</LegendNote>
    <LegendNote>{pickL3(KR_ECO_TEXT.legendZoom, locale)}</LegendNote>
    <LegendRestrictions layers={["krEcologyNaturalness"]} />
  </div>;
}

export function KrWasteDisposalRulesLegend() {
  const { locale } = useLocale();
  const title = useTitle("krWasteDisposalRules");
  return <div>
    <LegendTitle zh={title} />
    <LegendRow swatch={<SwatchSquare color={KR_WASTE_COLOR} />}>{pickL3(KR_WASTE_TEXT.hasData, locale)}</LegendRow>
    <LegendRow swatch={<SwatchHatch kind="missing" />}>{pickL3(KR_WASTE_TEXT.uncovered, locale)}</LegendRow>
    <LegendNote>{pickL3(KR_WASTE_TEXT.legendNoColor, locale)}</LegendNote>
    <LegendNote>{pickL3(KR_WASTE_TEXT.legendClick, locale)}</LegendNote>
    <LegendNote>{KR_WASTE_ATTRIBUTION}（{KR_WASTE_LICENSE}）</LegendNote>
  </div>;
}
