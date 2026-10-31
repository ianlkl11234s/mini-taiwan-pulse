// 南韓第 3–5 波 18 層的共用圖例（規格見 data/krDataLayers.ts）：分類列＋涵蓋／語意備註＋署名。
import type { ReactNode } from "react";
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchLine, SwatchSquare } from "./legendKit";
import { useLocale } from "../../state/localeStore";
import { localizeLayerName } from "../../i18n/layerText";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import type { LayerName } from "../../data/layerManifest";
import { KR_SPEC_BY_KEY, pickL3, type KrLayerSpec } from "../../data/krDataLayers";
import type { KrDataKey } from "../../data/krDataKeys";
import { LINE_WIDTH } from "../../map/mapStyleScale";

function swatch(spec: KrLayerSpec, color: string): ReactNode {
  return spec.geom === "point" ? <SwatchDot color={color} /> : spec.geom === "line" ? <SwatchLine color={color} width={LINE_WIDTH.standard[1]} /> : <SwatchSquare color={color} />;
}

export function KrDataLegend({ layerKey }: { layerKey: KrDataKey }) {
  const i18n = useLocale();
  const spec = KR_SPEC_BY_KEY[layerKey];
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[layerKey]?.name;
  const title = name ? localizeLayerName(layerKey, name, i18n).primary : layerKey;
  const locale = i18n.locale;
  return <div>
    <LegendTitle zh={title} />
    {spec.cats ? spec.cats.map((c) => <LegendRow key={c.id} swatch={swatch(spec, c.color)}>{pickL3(c.label, locale)}</LegendRow>) : <LegendRow swatch={swatch(spec, spec.color)}>{title}</LegendRow>}
    {spec.cats && spec.otherLabel ? <LegendRow swatch={swatch(spec, spec.otherColor ?? spec.color)}>{pickL3(spec.otherLabel, locale)}</LegendRow> : null}
    {spec.legendNotes.map((n, i) => <LegendNote key={i}>{pickL3(n, locale)}</LegendNote>)}
    <LegendNote>{spec.sourceOrg}（{spec.license}）</LegendNote>
  </div>;
}
