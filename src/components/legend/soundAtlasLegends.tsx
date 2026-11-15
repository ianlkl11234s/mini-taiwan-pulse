/**
 * City Sound Atlas 聲景圖例：十一個聲景圖層共用一份（legend id "soundAtlas"）。
 * W6-7 精簡（使用者：「圖例單純一點」）：每層只有標題、色階、斜線＝無法判斷；
 * 整份圖例只放一句「依資料推估，非實測音量」與必要出處。定義、納入範圍與限制放圖層展開區的說明（manifest description）。
 */
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchHatch, SwatchSquare, useLegendTheme } from "./legendKit";
import { categoricalColor, categoricalNeutral } from "../../map/mapStyleScale";
import { useLayerVisible } from "../../state/layerVisibilityStore";
import { useLocale } from "../../state/localeStore";
import { useSyncExternalStore } from "react";
import { compositePreviewStore } from "../../sound/grid/compositePreview";
import { COMPOSITE } from "../../sound/model/soundProfiles";
import { compositeBColorAt } from "../../hooks/useSoundCompositeGridLayer";
import { COMPOSITE_B_SCALE, COMPOSITE_FAMILIES } from "../../sound/grid/compositeGrid";
import { SOUND_COMPOSITE_A_ALPHA, SOUND_COMPOSITE_A_COLORS, SOUND_COMPOSITE_C_ALPHA, SOUND_COMPOSITE_C_CATEGORICAL_INDEX, SOUND_POTENTIAL_GRID_ALPHA, SOUND_POTENTIAL_GRID_COLORS, SOUND_FAMILY_COLORS, SOUND_RAIN_GRID_ALPHA, SOUND_RAIN_GRID_COLORS, SOUND_RECEIVER_COLOR, SOUND_ROAD_GRID_ALPHA, SOUND_ROAD_GRID_COLORS, SOUND_UNKNOWN_COLOR } from "../../sound/soundAtlasColors";
import { FAMILY_KEYS, formatPotential, rainClassKey } from "../sound/soundAtlasText";
import { paramStr, useLayerParams } from "../../layers/layerParamsAccess";
import { aviationGatePotential } from "../../sound/grid/aviationGates";
import type { PotentialGridFamily } from "../../sound/grid/potentialGridState";
import { soundAtlasStore } from "../../sound/soundAtlasStore";
import { SOUND_FAMILIES_ALL } from "../../sound/engines/receiverQuery";
import type { SoundSourceFamily } from "../../sound/types";

const FAMILIES: readonly SoundSourceFamily[] = SOUND_FAMILIES_ALL;

/** 地圖點與連線只畫開著的圖層（useSoundAtlasLayer flags），圖例的家族點跟著它 */
const FAMILY_LAYER = {
  aviation: "soundAviation", rain: "soundRain", thunder: "soundThunder", waste_collection: "soundWaste", rail: "soundRail",
  road_traffic: "soundRoadTraffic", roadwork: "soundRoadwork", wind_vegetation: "soundWindFoliage", coastal_wave: "soundCoastalWave", river_water: "soundRiverWater",
} as const satisfies Record<SoundSourceFamily, string>;

const UNKNOWN_ROW_KEY = "soundAtlas.level.unknown";

/** W6-1 雨勢網格：五級＋無法判斷斜線；色與透明度同地圖（SOUND_RAIN_GRID_*） */
function SoundRainGridLegend() {
  const { t } = useLocale();
  return <div style={{ marginBottom: 8 }}>
    <LegendTitle zh={t("legend.soundAtlas.rainGridTitle")} />
    {SOUND_RAIN_GRID_COLORS.map((c, k) => (
      <LegendRow key={c} swatch={<SwatchSquare color={c} opacity={Math.max(0.3, SOUND_RAIN_GRID_ALPHA[k]!)} />}>{t(rainClassKey(k))}</LegendRow>
    ))}
    <LegendRow swatch={<SwatchHatch />}>{t(UNKNOWN_ROW_KEY)}</LegendRow>
  </div>;
}

const ROAD_EVIDENCE_LEGEND_KEYS = {
  observed: "legend.soundAtlas.roadObserved",
  estimated: "legend.soundAtlas.roadEstimated",
  inferred: "legend.soundAtlas.roadInferred",
} as const;

/** W6-2 道路車流網格：三級證據各一列（低→很高四格，色與透明度同地圖）＋很低＋斜線 */
function SoundRoadGridLegend() {
  const { t } = useLocale();
  const evs = ["observed", "estimated", "inferred"] as const;
  return <div style={{ marginBottom: 8 }}>
    <LegendTitle zh={t("legend.soundAtlas.roadGridTitle")} />
    {evs.map((ev) => (
      <LegendRow key={ev} swatch={<span style={{ display: "inline-flex", gap: 1 }}>
        {[1, 2, 3, 4].map((k) => <SwatchSquare key={k} color={SOUND_ROAD_GRID_COLORS[ev][k]!} opacity={Math.max(0.3, SOUND_ROAD_GRID_ALPHA[ev][k]!)} />)}
      </span>}>{t(ROAD_EVIDENCE_LEGEND_KEYS[ev])}</LegendRow>
    ))}
    <LegendRow swatch={<SwatchSquare color={SOUND_ROAD_GRID_COLORS.observed[0]} opacity={0.3} />}>{t("soundAtlas.road.level.0")}</LegendRow>
    <LegendRow swatch={<SwatchHatch />}>{t("legend.soundAtlas.roadGridUnknown")}</LegendRow>
  </div>;
}

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
    <LegendRow swatch={<SwatchHatch />}>{t(UNKNOWN_ROW_KEY)}</LegendRow>
  </div>;
}

/** W6-4/5 綜合網格（預覽）：依目前甲／乙版本顯示色階＋斜線；定義與納入範圍在圖層說明 */
function SoundCompositeLegend() {
  const { t } = useLocale();
  const { isDark } = useLegendTheme();
  const variant = useSyncExternalStore(compositePreviewStore.subscribe, () => compositePreviewStore.get().variant);
  const max = COMPOSITE.displayMaxIndex.value;
  const a = ["legend.soundAtlas.compositeA0", "legend.soundAtlas.compositeA1", "legend.soundAtlas.compositeA2"] as const;
  return <div style={{ marginBottom: 8 }}>
    <LegendTitle zh={t("legend.soundAtlas.compositeTitle", { v: t(variant === "a" ? "soundAtlas.composite.previewA" : variant === "b" ? "soundAtlas.composite.previewB" : "soundAtlas.composite.previewC") })} />
    {variant === "c" ? (
      <>
        {COMPOSITE_FAMILIES.map((f) => (
          <LegendRow key={f} swatch={<SwatchSquare color={categoricalColor(SOUND_COMPOSITE_C_CATEGORICAL_INDEX[f], isDark)} opacity={SOUND_COMPOSITE_C_ALPHA[2]} />}>{t(FAMILY_KEYS[f])}</LegendRow>
        ))}
        <LegendRow swatch={<span style={{ display: "inline-flex", gap: 1 }}>
          {SOUND_COMPOSITE_C_ALPHA.map((a) => <SwatchSquare key={a} color={SOUND_UNKNOWN_COLOR} opacity={a} />)}
        </span>}>{t("legend.soundAtlas.compositeCDepth")}</LegendRow>
        <LegendRow swatch={<SwatchSquare color={categoricalNeutral(isDark)} opacity={0.3} />}>{t("soundAtlas.composite.level.0")}</LegendRow>
      </>
    ) : variant === "a" ? (
      SOUND_COMPOSITE_A_COLORS.map((c, k) => (
        <LegendRow key={c} swatch={<SwatchSquare color={c} opacity={Math.max(0.3, SOUND_COMPOSITE_A_ALPHA[k]!)} />}>{t(a[k as 0 | 1 | 2])}</LegendRow>
      ))
    ) : (
      <LegendRow swatch={<span style={{ display: "inline-flex", gap: 1 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((x) => { const c = compositeBColorAt(Math.round(x * max * COMPOSITE_B_SCALE)); return <SwatchSquare key={x} color={c.color} opacity={Math.max(0.3, c.alpha)} />; })}
      </span>}>{t("legend.soundAtlas.compositeBLow")} → {t("legend.soundAtlas.compositeBHigh", { max: max.toFixed(1) })}</LegendRow>
    )}
    <LegendRow swatch={<SwatchHatch />}>{t(UNKNOWN_ROW_KEY)}</LegendRow>
  </div>;
}

export function SoundAtlasLegend() {
  const { t } = useLocale();
  const hasReceiver = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().receiver != null);
  const compositeOn = useLayerVisible("soundComposite");
  const vis: Record<SoundSourceFamily, boolean> = {
    aviation: useLayerVisible(FAMILY_LAYER.aviation), rain: useLayerVisible(FAMILY_LAYER.rain), thunder: useLayerVisible(FAMILY_LAYER.thunder),
    waste_collection: useLayerVisible(FAMILY_LAYER.waste_collection), rail: useLayerVisible(FAMILY_LAYER.rail), road_traffic: useLayerVisible(FAMILY_LAYER.road_traffic),
    roadwork: useLayerVisible(FAMILY_LAYER.roadwork), wind_vegetation: useLayerVisible(FAMILY_LAYER.wind_vegetation),
    coastal_wave: useLayerVisible(FAMILY_LAYER.coastal_wave), river_water: useLayerVisible(FAMILY_LAYER.river_water),
  };
  const potentialOn: [PotentialGridFamily, boolean][] = [
    ["aviation", vis.aviation], ["rail", vis.rail], ["wind_vegetation", vis.wind_vegetation], ["coastal_wave", vis.coastal_wave], ["river_water", vis.river_water],
  ];
  const dotFamilies = FAMILIES.filter((f) => vis[f]);
  // 授權要求的出處（ODbL、政府資料開放授權、樹冠 CC BY）：只列開著的圖層用到的，一行
  const attr = [
    (vis.rail || vis.road_traffic || compositeOn) && t("legend.soundAtlas.attrOsm"),
    (vis.wind_vegetation || vis.coastal_wave || vis.river_water || compositeOn) && t("legend.soundAtlas.attrNatural"),
  ].filter(Boolean).join("；");
  return <div>
    {compositeOn && <SoundCompositeLegend />}
    {potentialOn.map(([f, on]) => on && <SoundPotentialGridLegend key={f} family={f} />)}
    {vis.rain && <SoundRainGridLegend />}
    {vis.road_traffic && <SoundRoadGridLegend />}
    {(dotFamilies.length > 0 || hasReceiver) && <>
      <LegendTitle zh={t("legend.soundAtlas.title")} />
      {dotFamilies.map((f) => (
        <LegendRow key={f} swatch={<SwatchDot color={SOUND_FAMILY_COLORS[f]} />}>{t(FAMILY_KEYS[f])}</LegendRow>
      ))}
      {hasReceiver && <LegendRow swatch={<SwatchDot color="#ffffff" stroke={SOUND_RECEIVER_COLOR} strokeWidth={3} opacity={1} />}>{t("legend.soundAtlas.receiver")}</LegendRow>}
      {dotFamilies.length > 0 && <LegendRow swatch={<SwatchDot color="transparent" stroke={SOUND_UNKNOWN_COLOR} strokeWidth={1.5} opacity={1} />}>{t("legend.soundAtlas.unknown")}</LegendRow>}
    </>}
    <LegendNote>{t("legend.soundAtlas.disclaimer")}</LegendNote>
    {attr && <LegendNote>{t("legend.soundAtlas.attributionLine", { parts: attr })}</LegendNote>}
  </div>;
}
