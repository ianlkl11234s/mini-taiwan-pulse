// Legend sub-components (hazardLegends) — moved verbatim out of LegendPanel.tsx; registry wiring stays in LegendPanel.tsx (LEGEND_REGISTRY).
import { THEMED_PAINT_COLORS } from "../../map/layerPaintColors";
import { LegendNote, LegendNum, LegendRow, LegendTitle, SwatchDot, SwatchHatch, SwatchLine, SwatchSquare, SwatchSteps, useLegendTheme } from "./legendKit";
import { BRIDGE_RESILIENCE_COLORS, BRIDGE_RESILIENCE_LIMITS_TEXT, BRIDGE_RESILIENCE_UNVALIDATED_OPACITY_FACTOR, BRIDGE_RESILIENCE_UNVALIDATED_TEXT, BRIDGE_WEIGHTINGS, DECAY_RAMP, BRIDGE_RESILIENCE_RAMP, DEST_MEAN_BREAKS, VILLAGE_METRICS, VILLAGE_METRIC_BREAKS, VILLAGE_METRIC_LABELS } from "../../data/bridgeResilienceTypes";
import { useBridgeResilienceOrigin } from "../../data/bridgeResilienceStore";
import { BSS_BRIDGE_ACCESS_COLORS, BSS_BRIDGE_RIGHTS_TEXT, BSS_BRIDGE_V5_LINE_COLORS } from "../../data/bssBridgeTypes";
import { LIQUEFACTION_SITE_COLOR, SOIL_POTENTIAL_CLASSES, WEAK_SOIL_CLASS_UPPER_M, WEAK_SOIL_COLORS, WEAK_SOIL_MIN_ZOOM, WEAK_SOIL_SPT_THRESHOLD } from "../../data/soilLiquefactionTypes";
import { COLORS, RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { type LayerVisibility } from "../../types";
import { ALERT_GROUPS, ALERT_GROUP_KEYS } from "../../data/disasterAlertTypes";
import { NEWS_CATEGORIES } from "../../data/newsEventTypes";
import { GLOBAL_EVENT_CATEGORIES, GLOBAL_EVENT_SEVERITIES } from "../../data/globalEventsTypes";
import { CWA_INTENSITY_BANDS } from "../../data/earthquakeReplayTypes";
import { FIRE_STATION_CATS, FIRE_HYDRANT_CATS, FIRE_EVENT_CATS, FIRE_HYDRANT_COVERAGE_NOTE, FIRE_ISOCHRONE_BANDS, FIRE_ISOCHRONE_NOTE } from "../../data/fireTypes";
import { MOUNTAIN_RESCUE_CAUSES } from "../../data/mountainSafetyTypes";
import { NUCLEAR_DOSE_THRESHOLDS, NUCLEAR_LEVEL_COLORS, type NuclearDoseLevel } from "../../data/nuclearLoader";
import { ER_LEVEL_COLORS, ER_LEVEL_LABELS, ER_CONGESTION_THRESHOLDS, type ErCongestionLevel } from "../../data/erCongestionTypes";
import { DenseHeatmapLegendRow, FireCatRows } from "./legendShared";

const EQ_DEPTH_STOPS: { depth: number; color: string; label: string }[] = [
  { depth: 0, color: "#ff3b30", label: "0" },
  { depth: 30, color: "#ff9500", label: "30" },
  { depth: 70, color: "#ffcc00", label: "70" },
  { depth: 150, color: "#42a5f5", label: "150" },
  { depth: 300, color: "#3949ab", label: "300" },
];

// ── 坡度 / 坡向 分級向量（PMTiles polygon）圖例 ──
const SLOPE_VECTOR_CATS = [
  { color: "#1a9850", label: "1級 <5% 平緩" },
  { color: "#66bd63", label: "2級 5-15%" },
  { color: "#d9ef8b", label: "3級 15-30%" },
  { color: "#fee08b", label: "4級 30-40%" },
  { color: "#fc8d59", label: "5級 40-55%" },
  { color: "#d73027", label: "6級 >55% 極陡" },
];

export function SlopeVectorLegend() {
  return (
    <div>
      <LegendTitle zh="坡度分級（建管六級坡）" en="Slope" />
      <FireCatRows cats={SLOPE_VECTOR_CATS} square />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        建築技術規則坡度分級｜可點選查級別
      </LegendNote>
    </div>
  );
}

const ASPECT_VECTOR_CATS = [
  { color: "#e41a1c", label: "N 北" },
  { color: "#ff7f00", label: "NE 東北" },
  { color: "#ffde00", label: "E 東" },
  { color: "#a6d854", label: "SE 東南" },
  { color: "#4daf4a", label: "S 南" },
  { color: "#20b2aa", label: "SW 西南" },
  { color: "#377eb8", label: "W 西" },
  { color: "#984ea3", label: "NW 西北" },
  { color: "#bdbdbd", label: "平地" },
];

export function AspectVectorLegend() {
  return (
    <div>
      <LegendTitle zh="坡向分級（8 方位）" en="Aspect" />
      <FireCatRows cats={ASPECT_VECTOR_CATS} square />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        坡面朝向 8 方位｜可點選查方位
      </LegendNote>
    </div>
  );
}

const FLOOD_SENSOR_CATS = [
  { color: "#404040", label: "0 cm 無淹水" },
  { color: "#fde047", label: "<5 cm 輕度" },
  { color: "#fb923c", label: "≥5 cm 中度" },
  { color: "#ef4444", label: "≥15 cm 嚴重" },
  { color: "#7f1d1d", label: "≥30 cm 極嚴重" },
];

export function FloodSensorLegend() {
  return (
    <div>
      <LegendTitle zh="都市淹水" en="USWG" />
      <FireCatRows cats={FLOOD_SENSOR_CATS} />
    </div>
  );
}

export function FireEventLegend() {
  return (
    <div>
      <LegendTitle zh="火災歷史" en="Fire" />
      <FireCatRows cats={FIRE_EVENT_CATS} />
      <DenseHeatmapLegendRow layers={["fireEvents", "fireLatest"]} />
      <LegendNote>有死傷＝較大的紅點＋醒目外框（其餘點只有淡色描邊）</LegendNote>
    </div>
  );
}

export function FireStationLegend() {
  return (
    <div>
      <LegendTitle zh="消防分隊" en="Stations" />
      <FireCatRows cats={FIRE_STATION_CATS} />
    </div>
  );
}

const BSS_BRIDGE_CLASS_LEGEND: readonly { key: keyof typeof BSS_BRIDGE_ACCESS_COLORS; point: string }[] = [
  { key: "road_bridge_carrier_candidate", point: "既有一般道路候選分類" },
  { key: "road_elevated_or_expressway_review", point: "既有高架／快速道路候選分類" },
  { key: "road_unresolved", point: "既有道路類型未定線索" },
  { key: "foot_or_rail_register_only", point: "既有人行／鐵道清冊線索" },
];

const BSS_BRIDGE_V5_LINE_LEGEND: readonly { key: keyof typeof BSS_BRIDGE_V5_LINE_COLORS; label: string; dash?: number[] }[] = [
  { key: "osm_entity_unique", label: "唯一 OSM 橋實體（整段，14,291）" },
  { key: "osm_entity_multi_segment", label: "同實體多標段（3,539）" },
  { key: "official_axis_only", label: "僅新北官方頭尾近似軸（206）" },
  { key: "network_inferred_only", label: "僅路網推估，低把握度（5,240）", dash: [2, 1] },
];

function BssBridgeSharedNotes() {
  return <>
    <LegendNote>v5：26,188 筆是來源紀錄，不是去重後橋座數；2,912 筆只有點、沒有線（多候選待複核 1,731、無候選 1,181）。</LegendNote>
    <LegendNote>v4 影像抽驗 300 筆：103 支持、2 負向、195 未定；整體錯誤率 &lt;3% 尚未證明。</LegendNote>
    <LegendNote>{BSS_BRIDGE_RIGHTS_TEXT}；進行中，非已驗證實橋或路網。</LegendNote>
  </>;
}

export function BssBridgeLineLegend() {
  return <div>
    <LegendTitle zh="全臺橋梁方向候選（進行中）" en="Bridge Direction Candidates" />
    {BSS_BRIDGE_V5_LINE_LEGEND.map((item) => (
      <LegendRow key={item.key} swatch={<SwatchLine color={BSS_BRIDGE_V5_LINE_COLORS[item.key]} dash={item.dash} />}>{item.label}</LegendRow>
    ))}
    <LegendNote>依 v5 分類著色；23,276 條線中 OSM 橋實體為整段幾何（未裁切到登錄範圍），路網推估為固定短線示意。都不是已審核身份、工程橋長或路網；「交通類別」篩選仍依既有分類。</LegendNote>
    <BssBridgeSharedNotes />
  </div>;
}

export function BssBridgePointLegend() {
  return <div>
    <LegendTitle zh="全臺橋梁清冊點位（進行中）" en="Bridge Register Points" />
    {BSS_BRIDGE_CLASS_LEGEND.map((item) => (
      <LegendRow key={item.key} swatch={<SwatchDot color={BSS_BRIDGE_ACCESS_COLORS[item.key]} />}>{item.point}</LegendRow>
    ))}
    <DenseHeatmapLegendRow layers={["bssNationalBridgePointsPreview"]} />
    <LegendNote>位置是清冊參考點，不是橋頭尾或路網節點；z10 以上才顯示。</LegendNote>
    <BssBridgeSharedNotes />
  </div>;
}

export function BridgeResilienceLegend({ weightingIdx, metricIdx, showVillages, showRoutes }: { weightingIdx: number; metricIdx: number; showVillages: boolean; showRoutes: boolean }) {
  const decay = (BRIDGE_WEIGHTINGS[weightingIdx] ?? "decay") === "decay";
  const metric = VILLAGE_METRICS[metricIdx] ?? "p90";
  const breaks = VILLAGE_METRIC_BREAKS[metric];
  const labels = metric === "p90" ? [...breaks.map((b) => `${b / 60}分`)] : [...breaks.map((b) => `${Math.round(b * 100)}%`)];
  const origin = useBridgeResilienceOrigin();
  const destinationView = showVillages && !!origin;
  return <div>
    <LegendTitle zh="雙北跨河橋梁韌性（研究中）" en="Bridge Resilience" />
    <LegendRow swatch={<SwatchLine color={BRIDGE_RESILIENCE_COLORS.car} width={3} />}>汽車：被移除的橋段</LegendRow>
    <LegendRow swatch={<SwatchLine color={BRIDGE_RESILIENCE_COLORS.scooter} width={2} />}>機車：被移除的橋段</LegendRow>
    <LegendRow swatch={<SwatchLine color={BRIDGE_RESILIENCE_COLORS.car} width={2} dash={[1.5, 1.5]} />}>地面引道（未移除，淡色虛線）</LegendRow>
    <LegendRow swatch={<SwatchLine color={BRIDGE_RESILIENCE_COLORS.car} width={3} opacity={BRIDGE_RESILIENCE_UNVALIDATED_OPACITY_FACTOR} />}>{BRIDGE_RESILIENCE_UNVALIDATED_TEXT}（47 座，較淡）</LegendRow>
    <LegendNote>73 座＝26 座人工複核＋47 座自動選入；自動選入的路段群組是機器比對，名次只供參考。</LegendNote>
    {showRoutes && <>
      <LegendRow swatch={<SwatchLine color={BRIDGE_RESILIENCE_COLORS.routeBefore} width={2} dash={[1.5, 1.5]} />}>替代路線：移除前</LegendRow>
      <LegendRow swatch={<SwatchLine color={BRIDGE_RESILIENCE_COLORS.routeAfter} width={2.5} />}>替代路線：移除後</LegendRow>
      <LegendNote>只畫戶籍權重最大的 3 組代表性起訖對，不一定是繞最遠的。</LegendNote>
    </>}
    {showVillages && !destinationView && decay && <div style={{ marginTop: 6 }}>
      <LegendTitle zh="距離遞減（平均行程 20 分）：平均多花秒數" />
      <SwatchSteps colors={DECAY_RAMP} breaks={["<1", "1", "5", "15", "30", "60", "≥120"]} />
      <LegendRow swatch={<SwatchSquare color={BRIDGE_RESILIENCE_COLORS.villageNeutral} />}>無可達權重（缺值，非 0）</LegendRow>
      <LegendNote>單位：秒。每個村里的顏色＝「從這裡出發」去其他村里平均多花幾秒；近處目的地權重大、遠處打折（τ=20 分鐘，假設值）；未受影響的目的地計 0 秒。</LegendNote>
    </div>}
    {showVillages && !destinationView && !decay && <div style={{ marginTop: 6 }}>
      <LegendTitle zh={`起點視角：${VILLAGE_METRIC_LABELS[metric]}`} />
      <SwatchSteps colors={BRIDGE_RESILIENCE_RAMP} breaks={["0", ...labels]} />
      <LegendRow swatch={<SwatchSquare color={BRIDGE_RESILIENCE_COLORS.villageNeutral} />}>{metric === "p90" ? "無受影響目的地（非 0）" : "缺值（非 0）"}</LegendRow>
      <LegendNote>起點視角：每個村里的顏色＝「從這裡出發」去其他地方平均變慢多少。點村里可切到目的地視角。</LegendNote>
    </div>}
    {destinationView && <div style={{ marginTop: 6 }}>
      <LegendTitle zh="目的地視角：所在行政區的平均額外時間" />
      <SwatchSteps colors={BRIDGE_RESILIENCE_RAMP} breaks={["0", ...DEST_MEAN_BREAKS.map((b) => `${b / 60}分`)]} />
      <LegendRow swatch={<SwatchSquare color={BRIDGE_RESILIENCE_COLORS.villageNeutral} />}>沒有受影響的目的地（額外時間未超過 60 秒，非 0）</LegendRow>
      <LegendRow swatch={<SwatchSquare color={BRIDGE_RESILIENCE_COLORS.destUnreachable} />}>無法抵達（移除後無路可達，不當作很大的時間）</LegendRow>
      <LegendRow swatch={<SwatchLine color={BRIDGE_RESILIENCE_COLORS.destOrigin} width={3} />}>起點村里（白色粗外框）</LegendRow>
      <LegendRow swatch={<SwatchLine color={BRIDGE_RESILIENCE_COLORS.destTop} width={2} />}>受影響最多的前 20 個村里（藍色外框）</LegendRow>
      <LegendNote>目的地視角：顏色＝「去那裡」變慢多少，只算受影響的目的地；資料只到行政區，同區同色。點空白處或「回到起點視角」返回。</LegendNote>
      {decay && <LegendNote>目的地明細是不分遠近版（沒有距離遞減版資料），與距離遞減的村里色階口徑不同。</LegendNote>}
    </div>}
    {BRIDGE_RESILIENCE_LIMITS_TEXT.map((text) => <LegendNote key={text}>{text}</LegendNote>)}
    <LegendNote>先點選一座橋，再開村里或替代路線；站主限定（BSS 授權 HOLD）。</LegendNote>
  </div>;
}

export function FireHydrantLegend() {
  return (
    <div>
      <LegendTitle zh="消防栓" en="Hydrants" />
      <FireCatRows cats={FIRE_HYDRANT_CATS} />
      <DenseHeatmapLegendRow layers={["fireHydrants"]} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        ⚠️ {FIRE_HYDRANT_COVERAGE_NOTE}
      </LegendNote>
    </div>
  );
}

export function FireIsochroneLegend() {
  return (
    <div>
      <LegendTitle zh="救援等時圈" en="Isochrone" />
      <FireCatRows
        cats={FIRE_ISOCHRONE_BANDS.map((b) => ({ color: b.color, label: b.label }))}
        square
      />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        ⚠️ {FIRE_ISOCHRONE_NOTE}
      </LegendNote>
    </div>
  );
}

// ── 山域事故 Legend（cause 9 族 + 點大小/紅描邊語意）──

export function MountainRescueLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="山域事故 事故原因" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {MOUNTAIN_RESCUE_CAUSES.map((c) => (
          <div key={c.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchDot color={c.color} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{c.label}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 4, paddingLeft: 8, borderLeft: `1px solid ${t.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
          <SwatchDot color={"transparent"} stroke="#ff2d2d" strokeWidth={1.5} />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>紅框 = 有死亡</span>
        </div>
        <LegendNote style={{ lineHeight: 1.4 }}>
          點大小 = 出動總人次（消防・警察・國家公園・林業・民間）
        </LegendNote>
      </div>
    </div>
  );
}

// ── Soil Liquefaction Legend（owner-only 私人 PMTiles；色票與 hook 同一組常數）──

const SOIL_RIGHTS_NOTE = "來源：經濟部地質調查及礦業管理中心；站主限定研究，重利用條款待確認（RIGHTS_HOLD_REUSE_TERMS_UNCONFIRMED）。";

export function SoilLiquefactionPotentialLegend() {
  const t = useLegendTheme();
  return <div>
    <LegendTitle zh="土壤液化潛勢" en="Soil Liquefaction" />
    {SOIL_POTENTIAL_CLASSES.map((item) => <LegendRow key={item.value} swatch={<SwatchSquare color={item.color} />}>{item.label}</LegendRow>)}
    <LegendRow swatch={<SwatchHatch />}>未調查（官方明示；不等於低潛勢）</LegendRow>
    <LegendRow swatch={<SwatchSquare color={t.border} outline />}>無資料（來源缺類別；不填色，不算未調查）</LegendRow>
    <LegendNote>高／中／低是官方綜合類別，不是量測值；個別基地僅供初步評估，不構成工程安全判定。</LegendNote>
    <LegendNote>{SOIL_RIGHTS_NOTE}</LegendNote>
  </div>;
}

const weakSoilBreaks = (uppers: readonly number[]) => uppers.map((upper) => `≤${upper}`);

export function WeakSoilLegend({ type }: { type: 'clay' | 'sand' }) {
  const t = useLegendTheme();
  const colors = WEAK_SOIL_COLORS[type];
  return <div>
    <LegendTitle zh={type === 'clay' ? '弱層黏土厚度' : '弱層砂土厚度'} en={type === 'clay' ? 'Soft Clay' : 'Loose Sand'} />
    <LegendRow swatch={null}>0–5、5–10 m 段（m）</LegendRow>
    <SwatchSteps colors={colors} breaks={weakSoilBreaks(WEAK_SOIL_CLASS_UPPER_M['0_5m'])} />
    <LegendRow swatch={null}>10–20 m 段（m）</LegendRow>
    <SwatchSteps colors={colors} breaks={weakSoilBreaks(WEAK_SOIL_CLASS_UPPER_M['10_20m'])} />
    <LegendRow swatch={<SwatchSquare color={t.border} outline />}>厚度 <LegendNum>0 m</LegendNum>＝該深度段無弱層（不填色）</LegendRow>
    <LegendRow swatch={<SwatchHatch />}>缺值（無資料，不等於 0）</LegendRow>
    <LegendNote>{`門檻 ${WEAK_SOIL_SPT_THRESHOLD[type]}；每級＝該深度段厚度的 20%。三個深度段對應不同開挖參考深度，縮放 ${WEAK_SOIL_MIN_ZOOM} 級以上顯示。`}</LegendNote>
    <LegendNote>{SOIL_RIGHTS_NOTE}</LegendNote>
  </div>;
}

export function LiquefactionMonitoringLegend() {
  return <div>
    <LegendTitle zh="土壤液化監測站" en="Liquefaction Monitoring" />
    <LegendRow swatch={<SwatchDot color={LIQUEFACTION_SITE_COLOR} />}>官方圖台列出的 11 個站點位置</LegendRow>
    <LegendNote>只有位置與名稱，不是即時觀測值；監測數據請回官方頁面查詢。</LegendNote>
    <LegendNote>{SOIL_RIGHTS_NOTE}</LegendNote>
  </div>;
}

// ── Earthquake Legend ──

export function EarthquakeLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="地震" en="Earthquake" />

      {/* Depth color bar */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
          Depth (km)
        </div>
        <div
          style={{
            height: 8,
            borderRadius: RADIUS.md,
            background: `linear-gradient(to right, ${EQ_DEPTH_STOPS.map((s) => s.color).join(", ")})`,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          {EQ_DEPTH_STOPS.map((s) => (
            <span key={s.depth} style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Magnitude size reference */}
      <div>
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
          Magnitude
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[3, 5, 7].map((m) => {
            const r = m === 3 ? 4 : m === 5 ? 10 : 24;
            return (
              <div key={m} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div
                  style={{
                    width: Math.min(r, 16),
                    height: Math.min(r, 16),
                    borderRadius: RADIUS.full,
                    background: "rgba(255, 59, 48, 0.4)",
                    border: "1px solid rgba(255, 59, 48, 0.7)",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>M{m}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 地震回放：CWA 震度色階（測站 circle / 等震度網格 / 鄉鎮面量圖三處同色）──

export function EarthquakeReplayLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="震度" en="CWA Intensity" />
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {CWA_INTENSITY_BANDS.map((band) => (
          <div key={band.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchSquare color={band.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{band.label}</span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 3, lineHeight: 1.4 }}>
        圓點 = 測站（大小依 PGA）· 方格 = 2.5km 等震度網格 · 面 = 鄉鎮震度
        <br />
        波前依 S 波 3.5 km/s 由震央外擴
      </LegendNote>
    </div>
  );
}

// ── USGS Global Earthquake Legend ──

const EQ_GLOBAL_DEPTH_STOPS: { depth: number; color: string; label: string }[] = [
  { depth: 0, color: "#dc2626", label: "0" },
  { depth: 30, color: "#f97316", label: "30" },
  { depth: 70, color: "#facc15", label: "70" },
  { depth: 150, color: "#38bdf8", label: "150" },
  { depth: 300, color: "#3949ab", label: "300" },
];

export function EarthquakeGlobalLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="全球地震（每小時）" en="USGS" />
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 2 }}>
          Depth (km)
        </div>
        <div
          style={{
            height: 8,
            borderRadius: RADIUS.md,
            background: `linear-gradient(to right, ${EQ_GLOBAL_DEPTH_STOPS.map((s) => s.color).join(", ")})`,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 1 }}>
          {EQ_GLOBAL_DEPTH_STOPS.map((s) => (
            <span key={s.depth} style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginBottom: 3 }}>
          Magnitude (M)
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[2, 4, 6, 8].map((m) => {
            const r = m === 2 ? 4 : m === 4 ? 8 : m === 6 ? 14 : 20;
            return (
              <div key={m} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div
                  style={{
                    width: Math.min(r, 18),
                    height: Math.min(r, 18),
                    borderRadius: RADIUS.full,
                    background: "rgba(220, 38, 38, 0.4)",
                    border: "1px solid rgba(220, 38, 38, 0.85)",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>M{m}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Typhoon Track Legend ──

export function TyphoonTrackLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="颱風軌跡" en="JMA / JTWC" />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <SwatchLine color="#a855f7" width={3} />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>實際軌跡 Observed（實心紫）</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 28,
              height: 0,
              borderTop: "2px dashed #38bdf8",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>預測軌跡 Forecast（藍虛線 / 空心點）</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <SwatchDot color={"transparent"} stroke="#fde047" strokeWidth={1.5} glow="#f0abfc" />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>現在位置 Current（黃圈，click 看詳情）</span>
        </div>
      </div>
    </div>
  );
}

export function DisasterAlertLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const groups = ALERT_GROUP_KEYS.filter((k) => visibility[k]);
  return (
    <div>
      <LegendTitle zh="NCDR 示警" en="Alerts" />
      {groups.map((g) => (
        <div key={g} style={{ marginBottom: 4 }}>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginBottom: 2 }}>
            {ALERT_GROUPS[g].label}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {Object.entries(ALERT_GROUPS[g].types).map(([term, color]) => (
              <div key={term} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <SwatchSquare color={color} opacity={0.8} />
                <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{term}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: RADIUS.full,
            border: "2px solid #dc2626",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
          脈動環 = 嚴重以上且仍在時效內
        </span>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 2 }}>
        填色深淺 = 嚴重度（Extreme→Minor）
      </div>
    </div>
  );
}

// ── News Events Legend (7 類分色) ──

export function NewsEventsLegend({ isDark = true }: { isDark?: boolean }) {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="新聞事件" en="News Events" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NEWS_CATEGORIES.map((cat) => (
          <div key={cat.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchDot glow={THEMED_PAINT_COLORS.newsGlow[isDark ? "dark" : "light"]} color={cat.color} opacity={cat.key === "other" ? 0.4 : 0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{cat.label}</span>
          </div>
        ))}
      </div>
      <LegendNote>
        座標 = 鄉鎮代表點（非事件位置）
      </LegendNote>
    </div>
  );
}

export function GlobalEventsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="全球情勢" en="Global Events" />
      <FireCatRows cats={GLOBAL_EVENT_CATEGORIES.map(({ color, label }) => ({ color, label }))} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
        {GLOBAL_EVENT_SEVERITIES.map((item) => (
          <div key={item.value} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{
              width: item.radius * 2,
              height: item.radius * 2,
              borderRadius: RADIUS.full,
              background: "#94a3b8",
              border: "1px solid rgba(15,23,42,0.8)",
              flexShrink: 0,
            }} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textDim }}>{item.value}</span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 4 }}>
        大小 = 嚴重度 0–3
        <br />淺色外框 = AI 初判；深色外框 = 已研究發布。全部重要程度均保留。
      </LegendNote>
      <div style={{ display: "flex", gap: 9, marginTop: 4, fontSize: FONT_SIZE.xs, color: t.textDim }}>
        <span><span style={{ color: "#facc15" }}>○</span> 新事件</span>
        <span><span style={{ color: "#38bdf8" }}>○</span> 版本更新</span>
      </div>
      <LegendNote style={{ marginTop: 4, lineHeight: 1.35 }}>
        點位可能是來源支持的事件點，或城市／國家代表中心；代表點不是精確發生座標，詳見 popup。
        同位置不同事件並排；數字點可點開展開。弧線僅表示跨國事件關聯，沒有移動方向或時間順序。
      </LegendNote>
    </div>
  );
}

export function NuclearLegend() {
  const t = useLegendTheme();
  const rows: { key: NuclearDoseLevel; label: string }[] = [
    { key: "normal", label: `正常 ≤ ${NUCLEAR_DOSE_THRESHOLDS.normal} µSv/h` },
    { key: "watch", label: `略高 ≤ ${NUCLEAR_DOSE_THRESHOLDS.watch}` },
    { key: "warning", label: `觀察 ≤ ${NUCLEAR_DOSE_THRESHOLDS.warning}` },
    { key: "alarm", label: `警戒 > ${NUCLEAR_DOSE_THRESHOLDS.warning}` },
    { key: "stale", label: "離線 stale（劑量不可信）" },
  ];
  return (
    <div>
      <LegendTitle zh="核安劑量" />
      {rows.map((row) => (
        <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchDot color={NUCLEAR_LEVEL_COLORS[row.key]} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{row.label}</span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        ⚠️ 高劑量 + stale = 感測器離線 ≠ 真實核災<br />
        背景值 0.039 ~ 0.072 µSv/h（自然輻射）
      </LegendNote>
    </div>
  );
}

export function ErCongestionLegend() {
  const rows: { key: ErCongestionLevel; label: string }[] = [
    { key: "smooth", label: `順暢 ≤ ${ER_CONGESTION_THRESHOLDS.smooth}` },
    { key: "light", label: `略壅 ${ER_CONGESTION_THRESHOLDS.smooth + 1}–${ER_CONGESTION_THRESHOLDS.light}` },
    { key: "congested", label: `壅塞 ${ER_CONGESTION_THRESHOLDS.light + 1}–${ER_CONGESTION_THRESHOLDS.congested}` },
    { key: "severe", label: `嚴重 > ${ER_CONGESTION_THRESHOLDS.congested}` },
    { key: "nodata", label: "無資料" },
  ];
  return (
    <div>
      <LegendTitle zh="急診壅塞（等一般病床）" />
      {rows.map((row) => (
        <div key={row.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchDot color={ER_LEVEL_COLORS[row.key]} />
          <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>
            {ER_LEVEL_LABELS[row.key]} · {row.label}
          </span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        ⚪ 白框 = 有加護病房 (ICU) 等待<br />
        分級依 wait_general_cnt 37 天 history 校準
      </LegendNote>
    </div>
  );
}
