/**
 * City Sound Atlas 聲景（實驗）圖例：十個家族共用一份（legend id "soundAtlas"）。
 * 家族色、接收點、無法判斷（灰色空心）、連線與雷聲波前（示意）；固定註明非 dB。
 */
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchHatch, SwatchSquare } from "./legendKit";
import { useLayerVisible } from "../../state/layerVisibilityStore";
import { useLocale } from "../../state/localeStore";
import { SOUND_POTENTIAL_GRID_ALPHA, SOUND_POTENTIAL_GRID_COLORS, SOUND_FAMILY_COLORS, SOUND_RAIN_GRID_ALPHA, SOUND_RAIN_GRID_COLORS, SOUND_RECEIVER_COLOR, SOUND_ROAD_GRID_ALPHA, SOUND_ROAD_GRID_COLORS, SOUND_UNKNOWN_COLOR } from "../../sound/soundAtlasColors";
import { FAMILY_KEYS, formatPotential, rainClassKey, ROAD_EVIDENCE_KEYS } from "../sound/soundAtlasText";
import { paramStr, useLayerParams } from "../../layers/layerParamsAccess";
import { aviationGatePotential } from "../../sound/grid/aviationGates";
import type { PotentialGridFamily } from "../../sound/grid/potentialGridState";
import type { MessageKey } from "../../i18n/keys";
import { SOUND_FAMILIES_ALL } from "../../sound/engines/receiverQuery";
import type { SoundSourceFamily } from "../../sound/types";

const FAMILIES: readonly SoundSourceFamily[] = SOUND_FAMILIES_ALL;

/** W6-1 雨勢網格：五級＋無法判斷斜線；色與透明度同地圖（SOUND_RAIN_GRID_*） */
function SoundRainGridLegend() {
  const { t } = useLocale();
  return <div style={{ marginBottom: 8 }}>
    <LegendTitle zh={t("legend.soundAtlas.rainGridTitle")} />
    {SOUND_RAIN_GRID_COLORS.map((c, k) => (
      <LegendRow key={c} swatch={<SwatchSquare color={c} opacity={Math.max(0.3, SOUND_RAIN_GRID_ALPHA[k]!)} />}>{t(rainClassKey(k))}</LegendRow>
    ))}
    <LegendRow swatch={<SwatchHatch />}>{t("legend.soundAtlas.rainGridUnknown")}</LegendRow>
    <LegendNote>{t("legend.soundAtlas.rainGridNote")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.rainGridAnimation")}</LegendNote>
  </div>;
}

/** W6-2 道路車流網格：三級證據各一列（很低→很高四格，色與透明度同地圖）＋很低＋斜線 */
function SoundRoadGridLegend() {
  const { t } = useLocale();
  const evs = ["observed", "estimated", "inferred"] as const;
  return <div style={{ marginBottom: 8 }}>
    <LegendTitle zh={t("legend.soundAtlas.roadGridTitle")} />
    {evs.map((ev) => (
      <LegendRow key={ev} swatch={<span style={{ display: "inline-flex", gap: 1 }}>
        {[1, 2, 3, 4].map((k) => <SwatchSquare key={k} color={SOUND_ROAD_GRID_COLORS[ev][k]!} opacity={Math.max(0.3, SOUND_ROAD_GRID_ALPHA[ev][k]!)} />)}
      </span>}>{t(ROAD_EVIDENCE_KEYS[ev])}</LegendRow>
    ))}
    <LegendRow swatch={<SwatchSquare color={SOUND_ROAD_GRID_COLORS.observed[0]} opacity={0.3} />}>{t("soundAtlas.road.level.0")}</LegendRow>
    <LegendRow swatch={<SwatchHatch />}>{t("legend.soundAtlas.roadGridUnknown")}</LegendRow>
    <LegendNote>{t("legend.soundAtlas.roadGridLevels")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.roadGridNote")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.roadGridAttribution")}</LegendNote>
  </div>;
}

const POTENTIAL_NOTE_KEYS: Record<PotentialGridFamily, MessageKey> = {
  aviation: "legend.soundAtlas.potentialGrid.aviation",
  rail: "legend.soundAtlas.potentialGrid.rail",
  wind_vegetation: "legend.soundAtlas.potentialGrid.wind",
  coastal_wave: "legend.soundAtlas.potentialGrid.wave",
  river_water: "legend.soundAtlas.potentialGrid.river",
};

/** W6-3 連續潛勢網格（飛機／鐵道／風／浪／河川）：低→很高四級＋沒有＋斜線；色與透明度同地圖（SOUND_POTENTIAL_GRID_*） */
function SoundPotentialGridLegend({ family }: { family: PotentialGridFamily }) {
  const { t } = useLocale();
  const gate = aviationGatePotential(paramStr(useLayerParams("soundAviation"), "soundAviation", "soundAviationGate"));
  const colors = SOUND_POTENTIAL_GRID_COLORS[family];
  return <div style={{ marginBottom: 8 }}>
    <LegendTitle zh={t("soundAtlas.potentialCell.title", { family: t(FAMILY_KEYS[family]) })} />
    <LegendRow swatch={<span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4].map((k) => <SwatchSquare key={k} color={colors[k]!} opacity={Math.max(0.3, SOUND_POTENTIAL_GRID_ALPHA[k]!)} />)}
    </span>}>{t("legend.soundAtlas.potentialGrid.levels")}</LegendRow>
    <LegendRow swatch={<SwatchSquare color={colors[0]} opacity={0.3} />}>
      {family === "aviation" ? t("legend.soundAtlas.potentialGrid.noneGate", { gate: formatPotential(gate) }) : t("soundAtlas.level.0")}
    </LegendRow>
    <LegendRow swatch={<SwatchHatch />}>{t("soundAtlas.level.unknown")}</LegendRow>
    <LegendNote>{t(POTENTIAL_NOTE_KEYS[family])}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.potentialGrid.note")}</LegendNote>
  </div>;
}

export function SoundAtlasLegend() {
  const { t } = useLocale();
  const rainOn = useLayerVisible("soundRain");
  const roadOn = useLayerVisible("soundRoadTraffic");
  const potentialOn: [PotentialGridFamily, boolean][] = [
    ["aviation", useLayerVisible("soundAviation")], ["rail", useLayerVisible("soundRail")],
    ["wind_vegetation", useLayerVisible("soundWindFoliage")], ["coastal_wave", useLayerVisible("soundCoastalWave")],
    ["river_water", useLayerVisible("soundRiverWater")],
  ];
  return <div>
    {potentialOn.map(([f, on]) => on && <SoundPotentialGridLegend key={f} family={f} />)}
    {rainOn && <SoundRainGridLegend />}
    {roadOn && <SoundRoadGridLegend />}
    <LegendTitle zh={t("legend.soundAtlas.title")} />
    {FAMILIES.map((f) => (
      <LegendRow key={f} swatch={<SwatchDot color={SOUND_FAMILY_COLORS[f]} />}>{t(FAMILY_KEYS[f])}</LegendRow>
    ))}
    <LegendRow swatch={<SwatchDot color="#ffffff" stroke={SOUND_RECEIVER_COLOR} strokeWidth={3} opacity={1} />}>{t("legend.soundAtlas.receiver")}</LegendRow>
    <LegendRow swatch={<SwatchDot color="transparent" stroke={SOUND_UNKNOWN_COLOR} strokeWidth={1.5} opacity={1} />}>{t("legend.soundAtlas.unknown")}</LegendRow>
    <LegendNote>{t("legend.soundAtlas.size")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.link")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.wavefront")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.animation")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.rail")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.roadTypical")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.roadTraffic")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.roadwork")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.wind")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.wave")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.river")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.naturalSnapshot")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.attribution")}</LegendNote>
    <LegendNote>{t("legend.soundAtlas.naturalAttribution")}</LegendNote>
    <LegendNote>{t("soundAtlas.disclaimer")}</LegendNote>
  </div>;
}
