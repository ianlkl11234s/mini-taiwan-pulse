// 台灣圖層延伸 B6：海洋熱浪月分級、珊瑚白化熱壓力的圖例（色票＝地圖 raster-color 同源 data/twMarineHeatTypes.ts）。
// 等級篩選在設定面板（多選），圖例上關掉的等級畫成淡色。
import { LegendNote, LegendNum, LegendRow, LegendTitle, SwatchSquare, useLegendTheme } from "./legendKit";
import {
  TW_CRW_BAA_LEVELS, TW_CRW_DHW_CLASSES, TW_MARINE_HEAT_UNCOVERED_COLOR, TW_MHW_LEVELS,
  type TwMarineHeatClass, type TwMarineHeatLayerKey,
} from "../../data/twMarineHeatTypes";
import { useTwMarineHeatStatus } from "../../hooks/useTwMarineHeatLayer";
import { useKeyOverlayParams } from "../../layers/layerParamsAccess";
import { FONT_SIZE } from "../../styles/designTokens";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { localizeLayerName } from "../../i18n/layerText";
import { LAYER_MANIFEST } from "../../data/layerManifest";

function on(mask: number | undefined, i: number): boolean {
  return mask === undefined || !Number.isFinite(mask) || (Math.trunc(mask) & (1 << i)) !== 0;
}

/** 目前顯示的期別／載入中／未涵蓋／錯誤 */
function Status({ layerKey }: { layerKey: TwMarineHeatLayerKey }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const s = useTwMarineHeatStatus(layerKey);
  const style = { marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textMuted };
  if (s.state === "error") return <div role="alert" style={{ ...style, color: t.textDefault }}>{i18n.t("legend.marineHeat.error", { message: s.message ?? "" })}</div>;
  if (s.state === "loading") return <div style={style}>{i18n.t("legend.marineHeat.loading", { period: s.period ?? "" })}</div>;
  if (s.state === "uncovered") return <div style={{ ...style, color: t.textDefault }}>{i18n.t("legend.marineHeat.uncoveredPeriod", { period: s.period ?? "" })}</div>;
  if (s.state === "shown") return <div style={style}>{i18n.t("legend.marineHeat.shownPeriod")} <LegendNum>{s.period}</LegendNum></div>;
  return null;
}

function ClassRows({ classes, mask, domain }: { classes: readonly TwMarineHeatClass[]; mask: number | undefined; domain: string | null }) {
  const i18n = useLocale();
  return <>
    {classes.map((c, i) => (
      <div key={c.value} style={{ opacity: on(mask, i) ? 1 : 0.35 }}>
        <LegendRow swatch={<SwatchSquare color={c.color} />}>
          {domain ? enumLabel(domain, String(c.value), c.zh, i18n) : <LegendNum>{c.zh}</LegendNum>}
        </LegendRow>
      </div>
    ))}
    <LegendRow swatch={<SwatchSquare color={TW_MARINE_HEAT_UNCOVERED_COLOR} />}>{i18n.t("legend.marineHeat.uncovered")}</LegendRow>
  </>;
}

function title(key: TwMarineHeatLayerKey, i18n: ReturnType<typeof useLocale>): string {
  return localizeLayerName(key, LAYER_MANIFEST[key].name, i18n).primary;
}

export function TwMarineHeatwavesLegend() {
  const i18n = useLocale();
  const p = useKeyOverlayParams("twMarineHeatwaves");
  return <div>
    <LegendTitle zh={title("twMarineHeatwaves", i18n)} />
    <ClassRows classes={TW_MHW_LEVELS} mask={p.twMarineHeatwavesLevelMask} domain="twMhwLevel" />
    <Status layerKey="twMarineHeatwaves" />
    <LegendNote>{i18n.t("legend.marineHeat.mhwNote")}</LegendNote>
  </div>;
}

export function TwCoralBleachingHeatStressLegend() {
  const i18n = useLocale();
  const t = useLegendTheme();
  const p = useKeyOverlayParams("twCoralBleachingHeatStress");
  const dhw = p.twCoralBleachingHeatStressViewIdx === 1;
  return <div>
    <LegendTitle zh={title("twCoralBleachingHeatStress", i18n)} />
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>{dhw ? i18n.t("legend.marineHeat.dhwTitle") : i18n.t("legend.marineHeat.baaTitle")}</div>
    {dhw
      ? <ClassRows classes={TW_CRW_DHW_CLASSES} mask={p.twCoralBleachingHeatStressDhwMask} domain={null} />
      : <ClassRows classes={TW_CRW_BAA_LEVELS} mask={p.twCoralBleachingHeatStressLevelMask} domain="twCrwBaaLevel" />}
    <Status layerKey="twCoralBleachingHeatStress" />
    <LegendNote>{i18n.t("legend.marineHeat.crwMaskNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.marineHeat.crwNote")}</LegendNote>
  </div>;
}
