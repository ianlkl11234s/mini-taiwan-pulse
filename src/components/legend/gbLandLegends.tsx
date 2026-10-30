// 英國 C003 地形兩層、C028 公有地標售圖例（2026-10-29）。色票與署名 SSOT 在 data/gbLandTypes.ts。
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchGradient, useLegendTheme } from "./legendKit";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import {
  GB_OS_TERRAIN_ATTRIBUTION, GB_SURPLUS_ATTRIBUTION, GB_SURPLUS_COLOR, GB_SURPLUS_STATUSES, GB_SURPLUS_STROKE_WIDTH,
  GB_TERRAIN_RELIEF_STOPS, type GbSurplusStatus,
} from "../../data/gbLandTypes";
import { GB_ONSPD_ATTRIBUTION } from "../../data/gbCivicTypes";
import { mapSeamColor } from "../../map/mapStyleScale";
import { useLocale } from "../../state/localeStore";
import { localizeLayerName } from "../../i18n/layerText";
import type { MessageKey } from "../../i18n/keys";

type I18n = ReturnType<typeof useLocale>;
function layerTitle(key: string, i18n: I18n): string {
  const name = (LAYER_MANIFEST as Record<string, { name?: LayerName }>)[key]?.name;
  return name ? localizeLayerName(key, name, i18n).primary : key;
}

/** 英國山體陰影：灰階起伏，文字說明即可。 */
export function GbTerrainHillshadeLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbTerrainHillshade", i18n)} en="Hillshade (OS Terrain 50)" />
    <LegendNote>{i18n.t("legend.urban.gbHillshadeNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.gbTerrainCoverage")}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.gbTerrainResolution")}</LegendNote>
    <LegendNote>{GB_OS_TERRAIN_ATTRIBUTION}</LegendNote>
  </div>;
}

/** 英國色別標高：列出上游烘進圖磚的停點色（設計規範沒有標高色階 token，不另上色）。 */
export function GbTerrainReliefLegend() {
  const i18n = useLocale();
  const t = useLegendTheme();
  const first = GB_TERRAIN_RELIEF_STOPS[0]!;
  const last = GB_TERRAIN_RELIEF_STOPS[GB_TERRAIN_RELIEF_STOPS.length - 1]!;
  return <div>
    <LegendTitle zh={layerTitle("gbTerrainRelief", i18n)} en="Elevation Tint (OS Terrain 50)" />
    <SwatchGradient
      gradient={`linear-gradient(to right, ${GB_TERRAIN_RELIEF_STOPS.map((s) => `${s.color} ${((s.m - first.m) / (last.m - first.m) * 100).toFixed(1)}%`).join(", ")})`}
      labels={[`${i18n.formatNumber(first.m)} m`, `${i18n.formatNumber(last.m)} m`]}
      stroke={mapSeamColor(t.isDark)}
    />
    <LegendNote>{i18n.t("legend.urban.gbReliefStops", { stops: GB_TERRAIN_RELIEF_STOPS.slice(1).map((s) => i18n.formatNumber(s.m)).join("／") })}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.gbReliefNote")}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.gbTerrainCoverage")}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.gbTerrainResolution")}</LegendNote>
    <LegendNote>{GB_OS_TERRAIN_ATTRIBUTION}</LegendNote>
  </div>;
}

export const GB_SURPLUS_STATUS_KEYS: Record<GbSurplusStatus, MessageKey> = {
  not_on_market: "legend.urban.gbSurplusNotOnMarket",
  under_offer: "legend.urban.gbSurplusUnderOffer",
  on_market: "legend.urban.gbSurplusOnMarket",
};

/** 英國公有地標售：三個進度（同色，填色由淡到強；尚未上市＝同色空心框，其餘底圖色細縫）。 */
export function GbSurplusLandLegend() {
  const i18n = useLocale();
  return <div>
    <LegendTitle zh={layerTitle("gbSurplusLand", i18n)} en="Surplus Public Land" />
    {GB_SURPLUS_STATUSES.map((s) => (
      <LegendRow key={s.value} swatch={<SwatchDot color={`color-mix(in srgb, ${GB_SURPLUS_COLOR} ${s.fill * 100}%, transparent)`} opacity={1} {...(s.value === "not_on_market" ? { stroke: GB_SURPLUS_COLOR, strokeWidth: GB_SURPLUS_STROKE_WIDTH } : {})} />}>
        {i18n.t(GB_SURPLUS_STATUS_KEYS[s.value], { n: i18n.formatNumber(s.count) })}
      </LegendRow>
    ))}
    <LegendNote>{i18n.t("legend.urban.gbSurplusScope")}</LegendNote>
    <LegendNote>{i18n.t("legend.urban.gbSurplusCoverage")}</LegendNote>
    <LegendNote>{GB_SURPLUS_ATTRIBUTION}</LegendNote>
    <LegendNote>{GB_ONSPD_ATTRIBUTION.join(" · ")}</LegendNote>
  </div>;
}
