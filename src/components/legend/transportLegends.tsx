// Legend sub-components (transportLegends) — moved verbatim out of LegendPanel.tsx; registry wiring stays in LegendPanel.tsx (LEGEND_REGISTRY).
import { ROAD_DRIVE_PAINT_COLORS } from "../../map/layerPaintColors";
import { HISTORICAL_FLIGHT_COLORS } from "../../data/historicalFlightTrailsTypes";
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchLine, SwatchSquare, useLegendTheme } from "./legendKit";
import { COLORS, RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { ROAD_CONGESTION_COLORS } from "../../data/roadCongestionLoader";
import { CONGESTION_COLORS, CONGESTION_LABELS } from "../../data/freewayLoader";
import { type LayerVisibility } from "../../types";
import { oneOfParam, paramBool, paramStr, useLayerParams } from "../../layers/layerParamsAccess";
import { LAYER_COLORS } from "../sidebar/layerCatalog";
import { TRA_TRAIN_TYPES } from "../../constants/traTrainTypes";
import { RAIL_LINES, RAIL_OPERATORS, railLegendLines, railMetroOperatorNames, resolveRailCodes } from "../../constants/railLines";
import { PORT_CLASSES, PORT_CLASS_FALLBACK } from "../../data/transportHubTypes";
import { JP_STATION_TYPES, JP_STATION_TYPE_OTHER, JP_STATION_PAX_BUCKETS, JP_STATION_PAX_NO_DATA } from "../../data/jpStationTypes";
import { JP_RAILWAY_TYPES } from "../../data/jpRailwayTypes";
import { SATELLITE_COLORS, SATELLITE_LABELS } from "../../data/satelliteTypes";
import { parkingAvailabilityColor, PARKING_NEUTRAL_STOPS, AVAILABILITY_NULL_COLOR, SOURCE_CATEGORY_META } from "../../data/parkingLoader";
import { FireCatRows, FlatArrowRow } from "./legendShared";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import type { I18nContext } from "../../i18n/layerText";
import { paramText } from "../../i18n/paramText";
import {
  BUS_CROWDING_MIN_TRIPS, BUS_CROWDING_SCENARIOS, BUS_CROWDING_SCENARIO_LABELS, BUS_CROWDING_SIM_KEY,
  BUS_CROWDING_VERSIONS, BUS_CROWDING_VERSION_LABELS,
} from "../../data/busCrowdingSimTypes";
import { BUS_CROWDING_ZERO_LINE, busCrowdingColors, busCrowdingZeroOpacity } from "../../data/busCrowdingSimStyle";

// ── Road Events event_type ──
const ROAD_EVENT_TYPE_ITEMS = [
  { type: 3, color: "#ef4444", labelKey: "legend.transport.roadEvAccident" },
  { type: 1, color: "#eab308", labelKey: "legend.transport.roadEvCongestion" },
  { type: 2, color: "#f97316", labelKey: "legend.transport.roadEvConstruction" },
  { type: 7, color: "#a855f7", labelKey: "legend.transport.roadEvControlled" },
  { type: 5, color: "#dc2626", labelKey: "legend.transport.roadEvDisaster" },
] as const;

/**
 * 航班 —— **刻意只有一條**。
 *
 * FlightScene 的動態軌跡配色是 `idx % colors.length` 的輪替（純粹讓相鄰航班分得開），
 * 沒有任何分類語意 —— 硬編一份「顏色=某類」的圖例會是憑空發明的假資訊。
 * （主站「全路徑靜態軌跡」另有高度漸層配色，但那是 Live 模式限定、embed 不畫，
 *   要補的話是另一條 entry + 顯示條件，見 follow-up。）
 */
export function FlightsLegend() {
  const { t } = useLocale();
  return (
    <div>
      <LegendTitle zh={t("legend.transport.flightsTitle")} en="Flight" />
      <FireCatRows cats={[{ color: LAYER_COLORS.flights, label: t("legend.transport.flightsTrail") }]} />
      <LegendNote style={{ marginTop: 3 }}>
        {t("legend.transport.flightsNote")}
      </LegendNote>
    </div>
  );
}

export function HistoricalFlightTrailsLegend() {
  const { t } = useLocale();
  return (
    <div>
      <LegendTitle zh={t("legend.transport.histTitle")} />
      <div style={{ height: 5, borderRadius: RADIUS.full, background: `linear-gradient(90deg, ${HISTORICAL_FLIGHT_COLORS[0]}, ${HISTORICAL_FLIGHT_COLORS[1]})` }} />
      <LegendNote style={{ marginTop: 3 }}>{t("legend.transport.histNote1")}</LegendNote>
      <LegendNote style={{ marginTop: 2 }}>{t("legend.transport.histNote2")}</LegendNote>
    </div>
  );
}

/**
 * 台鐵車種色票 —— 直接由 `TRA_TRAIN_TYPES` 推導，**不重抄一份**：
 * `TraTrainEngine` 的光球顏色就是 `getTrainColor(train_type_code)`，同一份資料。
 * 同色的車種合併成一列（普悠瑪／太魯閣共用 #E53935），依 priority 排序。
 */
function traTrainTypeRows(i18n: I18nContext) {
  const byColor = new Map<string, string[]>();
  for (const [code, info] of Object.entries(TRA_TRAIN_TYPES).sort(([, a], [, b]) => a.priority - b.priority)) {
    const name = enumLabel("traTrainType", code, info.name, i18n);
    const names = byColor.get(info.color);
    if (names) names.push(name);
    else byColor.set(info.color, [name]);
  }
  return [...byColor].map(([color, names]) => ({ color, label: names.join(" / ") }));
}

/** 捷運線／營運者名 → 目前語系（對不到就原樣）。 */
function railRowName(name: string, i18n: I18nContext): string {
  const line = RAIL_LINES.find((l) => l.name === name);
  if (line) return enumLabel("railLine", `${line.system}-${line.lineId}`, name, i18n);
  const op = RAIL_OPERATORS.find((o) => o.name === name);
  return op ? enumLabel("railOperator", op.id, name, i18n) : name;
}

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
  const i18n = useLocale();
  const { t } = i18n;
  // null ＝ 未指定 ＝ 全部（主站恆走這條）
  const selection = resolveRailCodes(railSystems);
  const showTra = selection == null || selection.has("tra");
  const showThsr = selection == null || selection.has("thsr");
  const lineRows = selection ? railLegendLines(selection) : [];
  const metroNames = selection ? railMetroOperatorNames(railSystems ?? []).map((n) => railRowName(n, i18n)) : [t("legend.transport.railMetroDefault")];
  const hasMetro = selection ? lineRows.length > 0 : true;

  const secondTitle = [showThsr ? t("legend.transport.railThsr") : null, hasMetro ? metroNames.join(t("legend.transport.railOpSep")) : null]
    .filter(Boolean)
    .join(t("legend.transport.railTitleSep"));
  const note = [
    // 有逐條列出線色時這句就多餘了，只在「未指定＝不逐條列」時保留
    hasMetro && selection == null ? t("legend.transport.railNoteMetro") : null,
    showTra ? t("legend.transport.railNoteTra") : null,
  ].filter(Boolean).join(t("legend.transport.railNoteSep"));

  // R6 段 3：列車立體效果關（平面點）時，拉近改畫方向箭頭 → 補 LG-6 箭頭列；顏色兩種模式相同
  const railValues = useLayerParams("rail");
  const trainsFlat = paramBool(railValues, "rail", "railTrainVisible") && !paramBool(railValues, "rail", "railTrain3D");

  return (
    <div>
      {showTra && (
        <>
          <LegendTitle zh={t("legend.transport.railTitleTra")} en="Rail" />
          <FireCatRows cats={traTrainTypeRows(i18n)} />
        </>
      )}
      {secondTitle && (
        <>
          <LegendTitle zh={showTra ? secondTitle : t("legend.transport.railTitleWith", { name: secondTitle })} en={showTra ? undefined : "Rail"} style={{ margin: showTra ? "6px 0 4px" : "0 0 4px" }} />
          {showThsr && <FireCatRows cats={[{ color: LAYER_COLORS.rail, label: t("legend.transport.railThsrRow") }]} />}
          {lineRows.length > 0 && (
            <FireCatRows cats={lineRows.map((l) => ({ color: l.color, label: railRowName(l.name, i18n) }))} />
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
  const { t } = useLocale();
  return (
    <div>
      <LegendTitle zh={t("legend.transport.shuttleTitle")} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <SwatchDot color={"linear-gradient(90deg,#4fc3f7,#f06292,#ba68c8)"} />
        <span style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDefault }}>{t("legend.transport.shuttleRoute")}</span>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: 2 }}>{t("legend.transport.shuttleSpeed")}</div>
      <div style={{ height: 10, borderRadius: 3, background: "linear-gradient(to right,#b71c1c 0%,#e53935 12%,#ff9800 40%,#fdd835 66%,#66bb6a 100%)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, marginBottom: 6, fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>
        <span>{t("legend.transport.shuttleStop")}</span><span>{t("legend.transport.shuttleSlow")}</span><span>{t("legend.transport.shuttleFast")}</span>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted, marginBottom: 2 }}>{t("legend.transport.shuttleDensity")}</div>
      <div style={{ height: 10, borderRadius: 3, background: "linear-gradient(to right,#1a237e 0%,#0097a7 33%,#fdd835 66%,#ff5722 100%)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>
        <span>{t("legend.transport.shuttleQuiet")}</span><span>{t("legend.transport.shuttleTrunk")}</span>
      </div>
    </div>
  );
}

export function PortsLegend() {
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.transport.portsTitle")} en="Port Class" />
      <FireCatRows
        square
        cats={[
          ...PORT_CLASSES.map((entry) => ({ color: entry.color, label: enumLabel("portClass", entry.value, entry.label, i18n) })),
          { color: PORT_CLASS_FALLBACK.color, label: enumLabel("portClass", PORT_CLASS_FALLBACK.value, PORT_CLASS_FALLBACK.label, i18n) },
        ]}
      />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {i18n.t("legend.transport.portsNote")}
      </LegendNote>
    </div>
  );
}

export function OsmRoadDriveLegend() {
  const { t } = useLocale();
  const OSM_ROAD_DRIVE_CATS = [
    { color: ROAD_DRIVE_PAINT_COLORS.motorway, label: t("legend.transport.osmMotorway") },
    { color: ROAD_DRIVE_PAINT_COLORS.trunk, label: t("legend.transport.osmTrunk") },
    { color: ROAD_DRIVE_PAINT_COLORS.primary, label: t("legend.transport.osmPrimary") },
    { color: ROAD_DRIVE_PAINT_COLORS.secondary, label: t("legend.transport.osmSecondary") },
    { color: ROAD_DRIVE_PAINT_COLORS.tertiary, label: t("legend.transport.osmTertiary") },
    { color: ROAD_DRIVE_PAINT_COLORS.other, label: t("legend.transport.osmOther") },
  ];
  return (
    <div>
      <LegendTitle zh={t("legend.transport.osmTitle")} en="Road" />
      <FireCatRows cats={OSM_ROAD_DRIVE_CATS} line />
      <LegendNote>
        {t("legend.transport.osmNote")}
      </LegendNote>
    </div>
  );
}

// ── 日本車站（種類 / 運量 雙模式）──

export function JpStationsLegend({ modeIdx }: { modeIdx?: number }) {
  const i18n = useLocale();
  if (modeIdx === 1) {
    return (
      <div>
        <LegendTitle zh={i18n.t("legend.transport.jpPaxTitle")} />
        <FireCatRows
          cats={[
            ...JP_STATION_PAX_BUCKETS.map((b) => ({ color: b.color, label: enumLabel("jpStationPax", b.min, b.label, i18n) })),
            { color: JP_STATION_PAX_NO_DATA.color, label: i18n.t("legend.common.noData") },
          ]}
        />
      </div>
    );
  }
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.transport.jpTypeTitle")} />
      <FireCatRows
        cats={[
          ...JP_STATION_TYPES.map((s) => ({ color: s.color, label: enumLabel("jpStationType", s.value, s.label, i18n) })),
          { color: JP_STATION_TYPE_OTHER.color, label: enumLabel("jpStationType", JP_STATION_TYPE_OTHER.value, JP_STATION_TYPE_OTHER.label, i18n) },
        ]}
      />
    </div>
  );
}

// ── 日本鐵道路線（事業者種別 5 類，靜態無模式切換）──
// 5 類已窮盡 21,933 段（其他為 0 筆）→ 不列「その他」。
// 同名類別與日本車站共用 hex（色票 SSOT: data/jpRailwayTypes.ts）。

export function JpRailwaysLegend() {
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.transport.jpRailTitle")} />
      <FireCatRows cats={JP_RAILWAY_TYPES.map((r) => ({ color: r.color, label: enumLabel("jpStationType", r.value, r.label, i18n) }))} />
    </div>
  );
}

// ── Disaster Alert Legend ──

export function RoadEventsLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.transport.roadEventsTitle")} en="Road Events" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {ROAD_EVENT_TYPE_ITEMS.map((item) => (
          <div key={item.type} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchDot color={item.color} opacity={0.85} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t(item.labelKey)}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        {i18n.t("legend.transport.roadEvNote")}
      </div>
    </div>
  );
}

export function RoadCongestionLegend() {
  const { t } = useLocale();
  const items = [
    { level: 1, label: t("legend.transport.roadCongSmooth") },
    { level: 2, label: t("legend.transport.roadCongBusy") },
    { level: 3, label: t("legend.transport.roadCongSlow") },
    { level: 4, label: t("legend.transport.roadCongJam") },
  ];
  return (
    <div>
      <LegendTitle zh={t("legend.transport.roadCongTitle")} en="Congestion" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((it) => (
          <div key={it.level} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchLine color={ROAD_CONGESTION_COLORS[it.level]!} width={4} />
            <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>{it.level} {it.label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <SwatchLine color={ROAD_CONGESTION_COLORS[0]!} width={4} />
          <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>{t("legend.common.noData")}</span>
        </div>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        {t("legend.transport.roadCongNote")}
      </div>
    </div>
  );
}

// ── CCTV source 3 類（overlayRegistry `cctv` 的 circle-color match；glow / core 同色）──
// 標籤與 featureInfo/infraPanels.tsx 的 CCTV_SOURCE 同字串。
// match 的 default 就是 city 的 #26c6da，所以未分類會併入「市區道路」列，圖例不另立一列。
export function CctvLegend() {
  const i18n = useLocale();
  const CCTV_SOURCE_CATS = [
    { color: "#ff9800", label: enumLabel("infraCctvSource", "freeway", "國道 Freeway", i18n) },
    { color: "#ffd54f", label: enumLabel("infraCctvSource", "highway", "省道快速道路 Highway", i18n) },
    { color: "#26c6da", label: i18n.t("legend.transport.cctvCity") },
  ];
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.transport.cctvTitle")} en="CCTV" />
      <FireCatRows cats={CCTV_SOURCE_CATS} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {i18n.t("legend.transport.cctvNote")}
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
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.transport.freewayTitle")} en="Freeway" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {FREEWAY_CONGESTION_LEVELS.map((lv) => (
          <div key={lv} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchLine color={CONGESTION_COLORS[lv]!} width={4} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>
              {lv > 0 ? `${lv} ${enumLabel("freewayCongestion", lv, CONGESTION_LABELS[lv]!, i18n)}` : i18n.t("legend.common.noData")}
            </span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {i18n.t("legend.transport.freewayNote")}
      </LegendNote>
    </div>
  );
}

export function SatelliteLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
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
      <LegendTitle zh={i18n.t("legend.transport.satTitle")} en="Satellites" />
      {active.map((i) => (
        <div key={i.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchDot color={SATELLITE_COLORS[i.cat]} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{enumLabel("satelliteCategory", i.cat, SATELLITE_LABELS[i.cat], i18n)}</span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        {i18n.t("legend.transport.satNote1")}<br />
        {i18n.t("legend.transport.satNote2")}<br />
        {i18n.t("legend.transport.satNote3")}<br />
        {i18n.t("legend.transport.satNote4")}
      </LegendNote>
    </div>
  );
}

// ── Aviation: 航空器空域 eAIP ──

export function AviationAirspaceLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  type Row = { key: string; label: string; color: string; dashed?: boolean };
  const controlRows: Row[] = [
    { key: "FIR", label: i18n.t("legend.transport.aviFir"), color: "#6495ED", dashed: true },
    { key: "TMA", label: i18n.t("legend.transport.aviTma"), color: "#4682B4" },
  ];
  const restrictedRows: Row[] = [
    { key: "CTR", label: i18n.t("legend.transport.aviCtr"), color: "#1E90FF" },
    { key: "RCR", label: i18n.t("legend.transport.aviRcr"), color: "#DC3545" },
    { key: "DANGER", label: i18n.t("legend.transport.aviDanger"), color: "#FF5722" },
    { key: "ULZ", label: i18n.t("legend.transport.aviUlz"), color: "#FFC107" },
    { key: "CIRCUIT", label: i18n.t("legend.transport.aviCircuit"), color: "#4CAF50" },
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
      <LegendTitle zh={i18n.t("legend.transport.aviTitle")} />
      {visibility.aviationControl && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 4, marginBottom: 2 }}>
            {i18n.t("legend.transport.aviHeadControl")}
          </div>
          {controlRows.map(renderRow)}
        </>
      )}
      {visibility.aviationRestricted && (
        <>
          <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 6, marginBottom: 2 }}>
            {i18n.t("legend.transport.aviHeadRestricted")}
          </div>
          {restrictedRows.map(renderRow)}
        </>
      )}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        {i18n.t("legend.transport.aviNote1")}<br />
        {i18n.t("legend.transport.aviNote2")}<br />
        {i18n.t("legend.transport.aviNote3")}
      </LegendNote>
    </div>
  );
}

// ── Aviation: 無人機禁航區 ──

export function DroneZonesLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const rows: Array<{ key: string; label: string; color: string }> = [];
  if (visibility.droneNoFlyZone) {
    rows.push({ key: "nfz", label: i18n.t("legend.transport.droneRed"), color: "#DC3545" });
  }
  if (visibility.droneRestrictedZone) {
    rows.push({ key: "restricted", label: i18n.t("legend.transport.droneYellow"), color: "#FFC107" });
  }
  if (rows.length === 0) return null;
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.transport.droneTitle")} />
      {rows.map((r) => (
        <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <SwatchSquare color={r.color} opacity={0.55} />
          <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{r.label}</span>
        </div>
      ))}
      <LegendNote style={{ marginTop: 6, lineHeight: 1.35 }}>
        {i18n.t("legend.transport.droneNote1")}<br />
        {i18n.t("legend.transport.droneNote2")}<br />
        {i18n.t("legend.transport.droneNote3")}
      </LegendNote>
    </div>
  );
}

export function ParkingLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const rateRows = [
    { rate: 1.0, label: i18n.t("legend.transport.parkMany") },
    { rate: 0.5, label: i18n.t("legend.transport.parkHalf") },
    { rate: 0.15, label: i18n.t("legend.transport.parkNear") },
    { rate: 0.0, label: i18n.t("legend.transport.parkFull") },
  ];
  const neutralMid = PARKING_NEUTRAL_STOPS[Math.floor(PARKING_NEUTRAL_STOPS.length / 2)]?.[1] ?? "#94a3b8";
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.transport.parkTitle")} />
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
            {i18n.t("legend.transport.parkOnstreet")}
          </span>
        </div>
      )}
      {visibility.parkingOffstreet && (
        <>
          <LegendTitle zh={i18n.t("legend.transport.parkOffTitle")} style={{ margin: "6px 0 3px" }} />
          {Object.entries(SOURCE_CATEGORY_META).map(([code, m]) => (
            <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              <SwatchDot color={AVAILABILITY_NULL_COLOR} stroke={m.ring} strokeWidth={2} />
              <span style={{ fontSize: FONT_SIZE.sm, color: t.textDefault }}>{enumLabel("parkingSourceCategory", code, m.label, i18n)}</span>
            </div>
          ))}
          <LegendNote style={{ marginTop: 4, lineHeight: 1.35 }}>
            {i18n.t("legend.transport.parkOffNote")}
          </LegendNote>
        </>
      )}
    </div>
  );
}

/** 公車擁擠模擬（spec §5.40 S-3）：目前版本寫進標題、方案放第二行；四級共用門檻，基準與情境可直接比。 */
export function BusCrowdingSimLegend() {
  const i18n = useLocale();
  const values = useLayerParams(BUS_CROWDING_SIM_KEY);
  const version = oneOfParam(paramStr(values, BUS_CROWDING_SIM_KEY, "busCrowdingSimVersion"), BUS_CROWDING_VERSIONS, "v137");
  const scenario = oneOfParam(paramStr(values, BUS_CROWDING_SIM_KEY, "busCrowdingSimScenario"), BUS_CROWDING_SCENARIOS, "base");
  const { t } = i18n;
  const theme = useLegendTheme();
  const colors = busCrowdingColors(theme.isDark);
  const levels = [
    { color: colors[0], width: BUS_CROWDING_ZERO_LINE.width, opacity: busCrowdingZeroOpacity(theme.isDark), label: t("legend.transport.busSimZero") },
    { color: colors[1], width: 2, opacity: 1, label: t("legend.transport.busSimLow") },
    { color: colors[2], width: 2, opacity: 1, label: t("legend.transport.busSimMid") },
    { color: colors[3], width: 2, opacity: 1, label: t("legend.transport.busSimHigh") },
  ];
  return <div>
    <LegendTitle zh={t("legend.transport.busSimTitle", { version: paramText(BUS_CROWDING_VERSION_LABELS[version], i18n) })} en="Bus Crowding" />
    <LegendRow swatch={null}>{t("legend.transport.busSimScenario", { scenario: paramText(BUS_CROWDING_SCENARIO_LABELS[scenario], i18n) })}</LegendRow>
    <div style={{ marginTop: 4 }}>
      {levels.map((level) => <LegendRow key={level.color} swatch={<SwatchLine color={level.color} width={level.width} opacity={level.opacity} />}>{level.label}</LegendRow>)}
    </div>
    <LegendNote>{t("legend.transport.busSimHidden", { n: BUS_CROWDING_MIN_TRIPS })}</LegendNote>
    <LegendNote>{t("legend.transport.busSimDefinition")}</LegendNote>
    <LegendNote>{t("legend.transport.busSimWindow")}</LegendNote>
    <LegendNote>{t("legend.transport.busSimCoverage")}</LegendNote>
  </div>;
}
