// Legend sub-components (transportLegends) — moved verbatim out of LegendPanel.tsx; registry wiring stays in LegendPanel.tsx (LEGEND_REGISTRY).
import { ROAD_DRIVE_PAINT_COLORS } from "../../map/layerPaintColors";
import { HISTORICAL_FLIGHT_COLORS } from "../../data/historicalFlightTrailsTypes";
import { LegendNote, LegendTitle, SwatchDot, SwatchLine, SwatchSquare, useLegendTheme } from "./legendKit";
import { COLORS, RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { ROAD_CONGESTION_COLORS } from "../../data/roadCongestionLoader";
import { CONGESTION_COLORS, CONGESTION_LABELS } from "../../data/freewayLoader";
import { type LayerVisibility } from "../../types";
import { paramBool, useLayerParams } from "../../layers/layerParamsAccess";
import { LAYER_COLORS } from "../sidebar/layerCatalog";
import { TRA_TRAIN_TYPES } from "../../constants/traTrainTypes";
import { railLegendLines, railMetroOperatorNames, resolveRailCodes } from "../../constants/railLines";
import { PORT_CLASSES, PORT_CLASS_FALLBACK } from "../../data/transportHubTypes";
import { JP_STATION_TYPES, JP_STATION_TYPE_OTHER, JP_STATION_PAX_BUCKETS, JP_STATION_PAX_NO_DATA } from "../../data/jpStationTypes";
import { JP_RAILWAY_TYPES } from "../../data/jpRailwayTypes";
import { SATELLITE_COLORS, SATELLITE_LABELS } from "../../data/satelliteTypes";
import { parkingAvailabilityColor, PARKING_NEUTRAL_STOPS, AVAILABILITY_NULL_COLOR, SOURCE_CATEGORY_META } from "../../data/parkingLoader";
import { FireCatRows, FlatArrowRow } from "./legendShared";

// ── Road Events event_type ──
const ROAD_EVENT_TYPE_ITEMS = [
  { type: 3, color: "#ef4444", label: "事故 Accident" },
  { type: 1, color: "#eab308", label: "壅塞/事故 Congestion" },
  { type: 2, color: "#f97316", label: "施工 Construction" },
  { type: 7, color: "#a855f7", label: "活動/管制 Controlled" },
  { type: 5, color: "#dc2626", label: "災害/障礙 Disaster" },
];

/**
 * 航班 —— **刻意只有一條**。
 *
 * FlightScene 的動態軌跡配色是 `idx % colors.length` 的輪替（純粹讓相鄰航班分得開），
 * 沒有任何分類語意 —— 硬編一份「顏色=某類」的圖例會是憑空發明的假資訊。
 * （主站「全路徑靜態軌跡」另有高度漸層配色，但那是 Live 模式限定、embed 不畫，
 *   要補的話是另一條 entry + 顯示條件，見 follow-up。）
 */
export function FlightsLegend() {
  return (
    <div>
      <LegendTitle zh="航班" en="Flight" />
      <FireCatRows cats={[{ color: LAYER_COLORS.flights, label: "航跡 Trail" }]} />
      <LegendNote style={{ marginTop: 3 }}>
        軌跡為輪替配色，不代表分類
      </LegendNote>
    </div>
  );
}

export function HistoricalFlightTrailsLegend() {
  return (
    <div>
      <LegendTitle zh="歷史航班軌跡" />
      <div style={{ height: 5, borderRadius: RADIUS.full, background: `linear-gradient(90deg, ${HISTORICAL_FLIGHT_COLORS[0]}, ${HISTORICAL_FLIGHT_COLORS[1]})` }} />
      <LegendNote style={{ marginTop: 3 }}>3D 航跡依觀測高度呈藍白漸層；高度倍率僅放大視覺，不改動資料。</LegendNote>
      <LegendNote style={{ marginTop: 2 }}>觀測空白以直線連接；連線不代表中間有實測資料。缺口數見點選資訊。</LegendNote>
    </div>
  );
}

/**
 * 台鐵車種色票 —— 直接由 `TRA_TRAIN_TYPES` 推導，**不重抄一份**：
 * `TraTrainEngine` 的光球顏色就是 `getTrainColor(train_type_code)`，同一份資料。
 * 同色的車種合併成一列（普悠瑪／太魯閣共用 #E53935），依 priority 排序。
 */
const TRA_TRAIN_TYPE_ROWS = (() => {
  const byColor = new Map<string, string[]>();
  for (const info of Object.values(TRA_TRAIN_TYPES).sort((a, b) => a.priority - b.priority)) {
    const names = byColor.get(info.color);
    if (names) names.push(info.name);
    else byColor.set(info.color, [info.name]);
  }
  return [...byColor].map(([color, names]) => ({ color, label: names.join(" / ") }));
})();

/**
 * 鐵路 —— 分色維度是**車種（台鐵）與路線（高鐵／捷運）**，不是「系統」。
 *
 * 台鐵佔畫面上絕大多數的車，且引擎確實照車種上色（`getTrainColor`），所以那是主圖例。
 * 高鐵全線同色（時刻表無 `train_color`、軌道無 `color` → 落到系統預設 #ee6c00）。
 * 捷運則是**每條路線各自的官方線色**。
 *
 * `railSystems`（`/embed` 的 `rsys=`）指定時**整段收斂**：沒被選到的系統／線路
 * 連軌道都沒進場（過濾在 `railReplayData` 的組裝階段），圖例還列著就是誤導。
 * 收斂粒度跟著代碼走 —— `rsys=trtc` 列北捷五線、`rsys=trtc-bl` 只列板南線，
 * 用的是 `constants/railLines.ts` 抄自資料的官方線色（與地圖上那條線同色）。
 * 特別是「灰線為軌道」——灰色是台鐵 golden track 專屬，沒選台鐵時畫面上根本沒有灰線。
 *
 * 未傳（主站）＝ undefined ＝ 全部顯示：**不逐條列**（六系統上百條路線列不完），
 * 用一行「捷運依各路線官方線色」帶過，輸出與加這個參數之前逐字相同。
 */
export function RailLegend({ railSystems }: { railSystems?: readonly string[] }) {
  // null ＝ 未指定 ＝ 全部（主站恆走這條）
  const selection = resolveRailCodes(railSystems);
  const showTra = selection == null || selection.has("tra");
  const showThsr = selection == null || selection.has("thsr");
  const lineRows = selection ? railLegendLines(selection) : [];
  const metroNames = selection ? railMetroOperatorNames(railSystems ?? []) : ["捷運"];
  const hasMetro = selection ? lineRows.length > 0 : true;

  const secondTitle = [showThsr ? "高鐵" : null, hasMetro ? metroNames.join("／") : null]
    .filter(Boolean)
    .join("・");
  const note = [
    // 有逐條列出線色時這句就多餘了，只在「未指定＝不逐條列」時保留
    hasMetro && selection == null ? "捷運依各路線官方線色" : null,
    showTra ? "灰線為軌道" : null,
  ].filter(Boolean).join("｜");

  // R6 段 3：列車立體效果關（平面點）時，拉近改畫方向箭頭 → 補 LG-6 箭頭列；顏色兩種模式相同
  const railValues = useLayerParams("rail");
  const trainsFlat = paramBool(railValues, "rail", "railTrainVisible") && !paramBool(railValues, "rail", "railTrain3D");

  return (
    <div>
      {showTra && (
        <>
          <LegendTitle zh="鐵路・台鐵車種" en="Rail" />
          <FireCatRows cats={TRA_TRAIN_TYPE_ROWS} />
        </>
      )}
      {secondTitle && (
        <>
          <LegendTitle zh={showTra ? secondTitle : `鐵路・${secondTitle}`} en={showTra ? undefined : "Rail"} style={{ margin: showTra ? "6px 0 4px" : "0 0 4px" }} />
          {showThsr && <FireCatRows cats={[{ color: LAYER_COLORS.rail, label: "高鐵 THSR" }]} />}
          {lineRows.length > 0 && (
            <FireCatRows cats={lineRows.map((l) => ({ color: l.color, label: l.name }))} />
          )}
        </>
      )}
      {trainsFlat && <FlatArrowRow />}
      {note && (
        <LegendNote style={{ marginTop: 3 }}>{note}</LegendNote>
      )}
    </div>
  );
}

export function TouristShuttleLegend() {
  return (
    <div>
      <LegendTitle zh="台灣好行 · 配色模式" />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <SwatchDot color={"linear-gradient(90deg,#4fc3f7,#f06292,#ba68c8)"} />
        <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>路線 Route：依路線配色</span>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: 2 }}>速度 Speed (km/h)</div>
      <div style={{ height: 10, borderRadius: 3, background: "linear-gradient(to right,#b71c1c 0%,#e53935 12%,#ff9800 40%,#fdd835 66%,#66bb6a 100%)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, marginBottom: 6, fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>
        <span>停</span><span>慢</span><span>快</span>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: 2 }}>密度 Density (班次/hr)</div>
      <div style={{ height: 10, borderRadius: 3, background: "linear-gradient(to right,#1a237e 0%,#0097a7 33%,#fdd835 66%,#ff5722 100%)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>
        <span>冷門</span><span>幹線</span>
      </div>
    </div>
  );
}

export function PortsLegend() {
  return (
    <div>
      <LegendTitle zh="港口分類" en="Port Class" />
      <FireCatRows
        square
        cats={[
          ...PORT_CLASSES.map((entry) => ({ color: entry.color, label: entry.label })),
          { color: PORT_CLASS_FALLBACK.color, label: PORT_CLASS_FALLBACK.label },
        ]}
      />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        顏色依原始 port_class；缺值不當作任一既有分級
      </LegendNote>
    </div>
  );
}

const OSM_ROAD_DRIVE_CATS = [
  { color: ROAD_DRIVE_PAINT_COLORS.motorway, label: "高速公路 Motorway" },
  { color: ROAD_DRIVE_PAINT_COLORS.trunk, label: "快速道路 Trunk" },
  { color: ROAD_DRIVE_PAINT_COLORS.primary, label: "主要道路 Primary" },
  { color: ROAD_DRIVE_PAINT_COLORS.secondary, label: "次要道路 Secondary" },
  { color: ROAD_DRIVE_PAINT_COLORS.tertiary, label: "聯絡道路 Tertiary" },
  { color: ROAD_DRIVE_PAINT_COLORS.other, label: "其餘 (residential / service / unclassified)" },
];

export function OsmRoadDriveLegend() {
  return (
    <div>
      <LegendTitle zh="OSM 道路" en="Road" />
      <FireCatRows cats={OSM_ROAD_DRIVE_CATS} line />
      <LegendNote>
        z≥10 才顯示｜來源 OpenStreetMap｜55 萬 edges
      </LegendNote>
    </div>
  );
}

// ── 日本車站（種類 / 運量 雙模式）──

export function JpStationsLegend({ modeIdx }: { modeIdx?: number }) {
  if (modeIdx === 1) {
    return (
      <div>
        <LegendTitle zh="車站運量 駅利用者数（人／日）" />
        <FireCatRows
          cats={[
            ...JP_STATION_PAX_BUCKETS.map((b) => ({ color: b.color, label: b.label })),
            { color: JP_STATION_PAX_NO_DATA.color, label: JP_STATION_PAX_NO_DATA.label },
          ]}
        />
      </div>
    );
  }
  return (
    <div>
      <LegendTitle zh="車站類型 駅種別" />
      <FireCatRows
        cats={[
          ...JP_STATION_TYPES.map((s) => ({ color: s.color, label: s.label })),
          { color: JP_STATION_TYPE_OTHER.color, label: JP_STATION_TYPE_OTHER.label },
        ]}
      />
    </div>
  );
}

// ── 日本鐵道路線（事業者種別 5 類，靜態無模式切換）──
// 5 類已窮盡 21,933 段（其他為 0 筆）→ 不列「その他」。
// 同名類別與日本車站共用 hex（色票 SSOT: data/jpRailwayTypes.ts）。

export function JpRailwaysLegend() {
  return (
    <div>
      <LegendTitle zh="鐵道營運者類型 鉄道事業者種別" />
      <FireCatRows cats={JP_RAILWAY_TYPES.map((r) => ({ color: r.color, label: r.label }))} />
    </div>
  );
}

// ── Disaster Alert Legend ──

export function RoadEventsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="即時路況" en="Road Events" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {ROAD_EVENT_TYPE_ITEMS.map((item) => (
          <div key={item.type} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchDot color={item.color} opacity={0.85} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{item.label}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        ⚠ live_city 偏基隆；高雄缺 TDX 來源
      </div>
    </div>
  );
}

export function RoadCongestionLegend() {
  const items = [
    { level: 1, label: "順暢" },
    { level: 2, label: "車多" },
    { level: 3, label: "略壅" },
    { level: 4, label: "壅塞" },
  ];
  return (
    <div>
      <LegendTitle zh="省道路況" en="Congestion" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((it) => (
          <div key={it.level} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchLine color={ROAD_CONGESTION_COLORS[it.level]!} width={4} />
            <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>{it.level} {it.label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <SwatchLine color={ROAD_CONGESTION_COLORS[0]!} width={4} />
          <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>無資料</span>
        </div>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        v1 僅省道 highway
      </div>
    </div>
  );
}

// ── CCTV source 3 類（overlayRegistry `cctv` 的 circle-color match；glow / core 同色）──
// 標籤與 featureInfo/infraPanels.tsx 的 CCTV_SOURCE 同字串。
// match 的 default 就是 city 的 #26c6da，所以未分類會併入「市區道路」列，圖例不另立一列。
const CCTV_SOURCE_CATS = [
  { color: "#ff9800", label: "國道 Freeway" },
  { color: "#ffd54f", label: "省道快速道路 Highway" },
  { color: "#26c6da", label: "市區道路 City（含未分類）" },
];

export function CctvLegend() {
  return (
    <div>
      <LegendTitle zh="道路攝影機" en="CCTV" />
      <FireCatRows cats={CCTV_SOURCE_CATS} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        z≥7 才顯示｜點選看即時畫面
      </LegendNote>
    </div>
  );
}

// ── 國道壅塞 level 1~5 + 0 無資料 ──
// 顏色不在 paint 裡：freewayLoader.buildFreewayGeoJSON 把 CONGESTION_COLORS[level]
// 預烤進 feature.properties.color，paint 只是 ["get","color"]（useFreewayLayer.ts:42/58）。
// 因此直接吃同一份 SSOT，不複製 hex。
const FREEWAY_CONGESTION_LEVELS = [1, 2, 3, 4, 5, 0];

export function FreewayCongestionLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="國道壅塞" en="Freeway" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {FREEWAY_CONGESTION_LEVELS.map((lv) => (
          <div key={lv} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchLine color={CONGESTION_COLORS[lv]!} width={4} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
              {lv > 0 ? `${lv} ${CONGESTION_LABELS[lv]}` : CONGESTION_LABELS[lv]}
            </span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        TDX 路段壅塞等級，隨時間軸播放
      </LegendNote>
    </div>
  );
}

export function SatelliteLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const items: { key: keyof LayerVisibility; cat: keyof typeof SATELLITE_COLORS }[] = [
    { key: "satellitesYaogan", cat: "china_yaogan" },
    { key: "satellitesJilin", cat: "china_jilin" },
    { key: "satellitesGaofen", cat: "china_gaofen" },
    { key: "satellitesTJS", cat: "china_tjs" },
    { key: "satellitesBeidou", cat: "china_beidou" },
    { key: "satellitesShiyan", cat: "china_shiyan" },
    { key: "satellitesTaiwan", cat: "taiwan" },
    { key: "satellitesUSA", cat: "usa" },
    { key: "satellitesJapan", cat: "japan" },
    { key: "satellitesRussia", cat: "russia" },
    { key: "satellitesIndia", cat: "india" },
    { key: "satellitesKorea", cat: "korea" },
    { key: "satellitesFrance", cat: "france" },
    { key: "satellitesGermany", cat: "germany" },
    { key: "satellitesItaly", cat: "italy" },
    { key: "satellitesIsrael", cat: "israel" },
  ];
  const active = items.filter((i) => visibility[i.key]);
  if (!active.length) return null;
  return (
    <div>
      <LegendTitle zh="衛星" en="Satellites" />
      {active.map((i) => (
        <div key={i.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchDot color={SATELLITE_COLORS[i.cat]} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{SATELLITE_LABELS[i.cat]}</span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        ● 即時點 = 子衛星正下方<br />
        ● 內圓 50 km swath（成像範圍示意）<br />
        ● 虛線外圓 1,500 km（仰角 ≥ 10° 可見 cone）<br />
        ● 軌跡 = 未來 30 分鐘地面航跡
      </LegendNote>
    </div>
  );
}

// ── Aviation: 航空器空域 eAIP ──

export function AviationAirspaceLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  type Row = { key: string; label: string; color: string; dashed?: boolean };
  const controlRows: Row[] = [
    { key: "FIR", label: "FIR 飛航情報區（3）僅邊框", color: "#6495ED", dashed: true },
    { key: "TMA", label: "TMA 終端管制區（6）", color: "#4682B4" },
  ];
  const restrictedRows: Row[] = [
    { key: "CTR", label: "CTR/CONTROL/SURFACE 機場管制（20）", color: "#1E90FF" },
    { key: "RCR", label: "RCR 限航區（29）", color: "#DC3545" },
    { key: "DANGER", label: "DANGER 危險區（2）", color: "#FF5722" },
    { key: "ULZ", label: "ULZ 超輕型活動區（20）", color: "#FFC107" },
    { key: "CIRCUIT", label: "CIRCUIT 起降航線（1）", color: "#4CAF50" },
  ];
  const renderRow = (r: Row) => (
    <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
      <span style={r.dashed
        ? { width: 14, height: 10, border: `1.5px dashed ${r.color}`, display: "inline-block", borderRadius: 2, boxSizing: "border-box" }
        : { width: 14, height: 10, background: r.color, display: "inline-block", borderRadius: 2, opacity: 0.55 }} />
      <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{r.label}</span>
    </div>
  );
  return (
    <div>
      <LegendTitle zh="航空器空域 eAIP" />
      {visibility.aviationControl && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 4, marginBottom: 2 }}>
            ✈️ 飛航情報 / 終端管制
          </div>
          {controlRows.map(renderRow)}
        </>
      )}
      {visibility.aviationRestricted && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6, marginBottom: 2 }}>
            ⛔ 機場管制 / 限航 / 危險
          </div>
          {restrictedRows.map(renderRow)}
        </>
      )}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        ● 來源：民航局 eAIP AIRAC 01-26（2026-03-19）<br />
        ● 載人航空器適用（民航法 §43），與 🛸 無人機規則不同<br />
        ● 點 polygon 看 floor/ceiling 高度上下界
      </LegendNote>
    </div>
  );
}

// ── Aviation: 無人機禁航區 ──

export function DroneZonesLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const rows: Array<{ key: string; label: string; color: string }> = [];
  if (visibility.droneNoFlyZone) {
    rows.push({ key: "nfz", label: "2026-06-30 參考面（紅+未分類 5,635；現行規則未驗）", color: "#DC3545" });
  }
  if (visibility.droneRestrictedZone) {
    rows.push({ key: "restricted", label: "2026-06-30 黃區參考面（108；現行規則未驗）", color: "#FFC107" });
  }
  if (rows.length === 0) return null;
  return (
    <div>
      <LegendTitle zh="無人機空域" />
      {rows.map((r) => (
        <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchSquare color={r.color} opacity={0.55} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{r.label}</span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        ● 來源：民航局 dronegis（2026-06）<br />
        ● z &lt; 7 不顯示，避免大區塊遮蓋<br />
        ● 點 polygon 可看罰則 / 主管機關
      </LegendNote>
    </div>
  );
}

export function ParkingLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const rateRows = [
    { rate: 1.0, label: "空位多 100%" },
    { rate: 0.5, label: "半滿 50%" },
    { rate: 0.15, label: "略滿 15%" },
    { rate: 0.0, label: "滿 0%" },
  ];
  const neutralMid = PARKING_NEUTRAL_STOPS[Math.floor(PARKING_NEUTRAL_STOPS.length / 2)]?.[1] ?? "#94a3b8";
  return (
    <div>
      <LegendTitle zh="停車空位率" />
      {rateRows.map((r) => (
        <div key={r.rate} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchDot color={parkingAvailabilityColor(r.rate)} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{r.label}</span>
        </div>
      ))}
      {visibility.parkingOnstreet && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
          <SwatchSquare color={neutralMid} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDim }}>
            台北路邊：僅容量（深=多），無即時空位
          </span>
        </div>
      )}
      {visibility.parkingOffstreet && (
        <>
          <LegendTitle zh="場外分類（外環）" style={{ margin: "6px 0 3px" }} />
          {Object.values(SOURCE_CATEGORY_META).map((m) => (
            <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              <SwatchDot color={AVAILABILITY_NULL_COLOR} stroke={m.ring} strokeWidth={2} />
              <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{m.label}</span>
            </div>
          ))}
          <LegendNote style={{ marginTop: 4, lineHeight: 1.35 }}>
            圓越大 = 車位越多
          </LegendNote>
        </>
      )}
    </div>
  );
}
