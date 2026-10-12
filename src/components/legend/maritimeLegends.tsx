// Legend sub-components (maritimeLegends) — moved verbatim out of LegendPanel.tsx; registry wiring stays in LegendPanel.tsx (LEGEND_REGISTRY).
import { CORAL_REEF_ATTRIBUTION, CORAL_REEF_COLOR } from "../../data/coralReefTypes";
import { allenCoralSource, ALLEN_CORAL_ACQUIRED_AT, ALLEN_CORAL_ATTRIBUTION, ALLEN_CORAL_WARNING, type AllenCoralAtlasView } from "../../data/allenCoralAtlasTypes";
import { useEffect, useState, useSyncExternalStore } from "react";
import { LegendNote, LegendTitle, SwatchDot, SwatchLine, SwatchSquare, useLegendTheme } from "./legendKit";
import { COLORS, RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { type LayerVisibility } from "../../types";
import { oneOfParam, paramStr, useLayerParams } from "../../layers/layerParamsAccess";
import { PLA_KIND_COLORS, PLA_KIND_LABELS } from "../../data/plaTracksLoader";
import { VESSEL_CLASSES } from "../../data/vesselWatchTypes";
import { SHIP_TYPE_LEGEND, SHIP_TYPE_COLORS_DARK } from "../../data/shipTrails";
import { GFW_HOURLY_GRID_V4_COLOR_BANDS } from "../../data/gfwHourlyGridTypes";
import { getGfwHourlyGridDataWindowSnapshot, subscribeGfwHourlyGridDataWindow } from "../../state/gfwHourlyGridDataWindowStore";
import { useGfwV4TrackDataWindow } from "../../state/gfwV4TrackDataWindowStore";
import { loadGfwFishingEffortManifest, type GfwFishingEffortManifest } from "../../data/gfwFishingEffortLoader";
import { loadGfwDarkVesselsManifest } from "../../data/gfwDarkVesselsLoader";
import { loadGfwHourlyTrackManifest } from "../../data/gfwHourlyTracksLoader";
import { gfwFreshness } from "../../data/gfwFreshness";
import { useTimeStoreTime } from "../../hooks/useTimeStoreTime";
import { MARITIME_BOUNDARY_TYPES, MARITIME_BOUNDARY_SOURCE_NOTE } from "../../data/maritimeBoundaryTypes";
import { isobathLegendRows, ISOBATH_ATTRIBUTION } from "../../data/isobathTypes";
import { MARINE_OBSERVATION_STATUS_STYLES } from "../../hooks/useMarineObservationLayer";
import { DenseHeatmapLegendRow, FireCatRows } from "./legendShared";

// ── 台灣好行 Tourist Shuttle：配色模式圖例（route / speed / density 三模式）──
// 色階與 BusScene 的 SPEED_STOPS / DENSITY_STOPS 對齊
/**
 * 船舶 —— AIS 船種 6 桶分色。
 *
 * 色票來自 `data/shipTrails.ts`（three-free 的單一出處），**不是**從 `ShipScene`
 * 拿 —— LegendPanel 是 `/embed` 基礎 bundle 的 static import，若在此 import Scene
 * 就會把整包 three 拖進純靜態嵌入（EM-16 的 bundle 不變量）。
 *
 * 用暗色票：本面板慣例是「色票資料兩主題共用，只有外殼 chrome 換色」。
 * ShipScene 在淺色底圖會換成深飽和版（防 additive 洗白），色相對應相同。
 */
export function ShipsLegend() {
  return (
    <div>
      <LegendTitle zh="船舶・AIS 船種" en="Ship" />
      <FireCatRows
        cats={SHIP_TYPE_LEGEND.map((s) => ({ color: SHIP_TYPE_COLORS_DARK[s.bucket], label: s.label }))}
      />
    </div>
  );
}

// ── 領海界線圖例（4 類：線型也要畫出來，因為 24 浬是虛線）──
//    色票 / 標籤 / 線型全部來自 data/maritimeBoundaryTypes.ts，與 paint、popup 同源。
export function MaritimeBoundaryLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="領海界線" en="Maritime" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {MARITIME_BOUNDARY_TYPES.map((m) => (
          <div key={m.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {m.value === "basepoint" ? (
              <SwatchDot color={m.color} opacity={0.9} />
            ) : (
              <SwatchLine color={m.color} width={2} dash={m.dashed ? [4, 3] : undefined} opacity={0.9} />
            )}
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{m.label}</span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {MARITIME_BOUNDARY_SOURCE_NOTE}｜基點 z≥5 顯示
      </LegendNote>
    </div>
  );
}

// 海底等深線圖例：12 級深度分帶（深→淺），隨 modeIdx 換色（SSOT isobathTypes.ts）
export function IsobathLegend({ modeIdx = 0 }: { modeIdx?: number }) {
  const rows = isobathLegendRows(modeIdx);
  return (
    <div>
      <LegendTitle zh="海底等深線（深 → 淺）" en="Isobath" />
      <FireCatRows cats={rows} square />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {ISOBATH_ATTRIBUTION}
      </LegendNote>
    </div>
  );
}

export function AquacultureLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const rows = ([
    { key: "aquaculturePonds", color: "#26c6da", label: "逐口魚塭 Ponds" },
    { key: "aquacultureZone", color: "#66bb6a", label: "養殖漁業生產區 Zone" },
    { key: "aquacultureCageNet", color: "#5c6bc0", label: "海上箱網 Cage Net" },
    { key: "aquacultureWaterSatellite", color: "#26c6da", label: "確定 · 養殖/OSM" },
    { key: "aquacultureWaterSatellite", color: "#90a4ae", label: "蓄水池/農業設施" },
    { key: "aquacultureWaterSatellite", color: "#cfd8dc", label: "不確定 · 水田/其他" },
  ] as const).filter((it) => visibility[it.key]);
  return (
    <div>
      <LegendTitle zh="養殖漁業" en="Aquaculture" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchSquare color={it.color} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AquacultureWaterSatelliteMoaLegend() {
  const t = useLegendTheme();
  const rows = [
    { color: "#26c6da", label: "確認 Confirmed（NLSC 確認）" },
    { color: "#1e88e5", label: "漁電共生 Solar Symbiotic" },
    { color: "#9e9e9e", label: "其他 Other（未確認/有疑慮/疑山影）" },
  ];
  return (
    <div>
      <LegendTitle zh="魚塭·官方標籤版" en="MOA Labeled" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchSquare color={it.color} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AquacultureWaterUnionLegend() {
  const t = useLegendTheme();
  const rows = [
    { color: "#26c6da", label: "兩版都有 Both（最高信心）" },
    { color: "#43a047", label: "只官方 MOA Only" },
    { color: "#fb8c00", label: "只舊版 OSM Only" },
  ];
  return (
    <div>
      <LegendTitle zh="魚塭·整合對照版" en="Union" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchSquare color={it.color} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AquacultureIntegratedLegend() {
  const t = useLegendTheme();
  const rows = [
    { color: "#26c6da", label: "逐口魚塭（OSM）Ponds" },
    { color: "#66bb6a", label: "衛星偵測補充 Satellite" },
    { color: "#ffa726", label: "生產區 Production" },
  ];
  return (
    <div>
      <LegendTitle zh="養殖漁業整合" en="Integrated" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchSquare color={it.color} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PLA Activity Legend（走廊 / 不規則活動區 + 待核實）──

export function PlaActivityLegend() {
  const t = useLegendTheme();
  const items: { color: string; label: string; dashed?: boolean }[] = [
    { color: PLA_KIND_COLORS.rect, label: PLA_KIND_LABELS.rect },
    { color: PLA_KIND_COLORS.poly, label: PLA_KIND_LABELS.poly },
  ];
  return (
    <div>
      <LegendTitle zh="共機活動區" en="PLA Activity" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((it) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 14,
                height: 9,
                borderRadius: RADIUS.sm,
                background: `${it.color}44`,
                border: `1.5px solid ${it.color}`,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{it.label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 14,
              height: 9,
              borderRadius: RADIUS.sm,
              background: `${PLA_KIND_COLORS.rect}22`,
              border: `1.5px dashed ${PLA_KIND_COLORS.rect}`,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>待核實（虛線）</span>
        </div>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        多日疊加時舊的較淡、新的較亮；重疊處越深＝該區出現越頻繁
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 2 }}>
        依國防部示意圖描繪，非精確航跡
      </div>
    </div>
  );
}

/**
 * 特殊船舶（Vessel Watch）—— 12 類分色。
 *
 * ⚠️ 標籤一律寫**全稱**：`HAIXUN`「海巡」是**中國海事局**的船，
 *    與**台灣海巡署**是兩回事。縮寫成「海巡」等於把這層的核心資訊講反。
 *    文字的 SSOT 在 `data/vesselWatchTypes.ts`，這裡只負責畫。
 */
export function VesselWatchLegend() {
  return (
    <div>
      <LegendTitle zh="特殊船舶" en="Vessel Watch" />
      <FireCatRows cats={VESSEL_CLASSES.map((c) => ({ color: c.color, label: c.label }))} />
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        細線為軌跡（AIS 約 15 分一筆的斷續取樣，非連續航跡）
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 2 }}>
        分類由船名／MMSI 規則推斷；軍艦多為他國過境（中台海軍多靜默）
      </div>
    </div>
  );
}

export function AisstreamVesselsLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="AISStream 船舶" />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SwatchDot color={"#22d3ee"} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>最近 30 分鐘 AIS 回報</span>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        即時點位；目前未接逐船 trail
      </div>
    </div>
  );
}

export function GfwVesselPresenceLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="GFW 舊版每日船舶" en="Historical" />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SwatchDot color={"#f59e0b"} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>歷史快照；不代表最新 release</span>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        最新日期請以小時 Grid／Tracks／SAR 為準；本層非即時 AIS。
      </div>
    </div>
  );
}

export function GfwHourlyGridLegend() {
  const t = useLegendTheme();
  const dataWindow = useSyncExternalStore(subscribeGfwHourlyGridDataWindow, getGfwHourlyGridDataWindowSnapshot, () => null);
  return (
    <div>
      <LegendTitle zh="GFW 小時船舶網格" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, max-content)", gap: "5px 10px" }}>
        {GFW_HOURLY_GRID_V4_COLOR_BANDS.map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <SwatchSquare color={item.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{item.label}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 5 }}>
        色階＝每個 0.1° 格網內的船舶數；透明度隨船舶數連續插值
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 2 }}>
        依全域時間軸切換 UTC 整點
      </div>
      {dataWindow && (
        <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 2 }}>
          資料窗 {dataWindow.utcDateLabel}（UTC）
        </div>
      )}
      {dataWindow && (
        <div style={{ fontSize: FONT_SIZE.xs, color: gfwFreshness(dataWindow.latestCompleteDate).status === "stale" ? "#f97316" : COLORS.textFaint, fontWeight: 600, marginTop: 2 }}>
          最新完整日 {gfwFreshness(dataWindow.latestCompleteDate).label}
        </div>
      )}
      {dataWindow?.status === "out-of-window" && (
        <LegendNote style={{ fontWeight: 600, marginTop: 2 }}>
          ⚠ 目前時間在資料窗外，圖層已淡出
        </LegendNote>
      )}
    </div>
  );
}

export function GfwHourlyTracksLegend({ isDark }: { isDark: boolean }) {
  const t = useLegendTheme();
  const dataWindow = useGfwV4TrackDataWindow();
  const [fallbackLatestDate, setFallbackLatestDate] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void loadGfwHourlyTrackManifest().then((manifest) => {
      if (active) setFallbackLatestDate(manifest?.latestCompleteDate ?? null);
    });
    return () => { active = false; };
  }, []);
  const latestDate = dataWindow.endUtcDate ?? fallbackLatestDate;
  const palette = isDark
    ? { fishing: "#58d68d", cargo: "#39bff4", passenger: "#b3a0ff", carrier: "#ff8f43", other: "#f0cc66", unknown: "#f5f1db" }
    : { fishing: "#187c46", cargo: "#007da8", passenger: "#6552b8", carrier: "#b54c00", other: "#8a6500", unknown: "#34413e" };
  const rows = [
    { color: palette.fishing, label: "Fishing" }, { color: palette.cargo, label: "Cargo" },
    { color: palette.passenger, label: "Passenger" }, { color: palette.carrier, label: "Carrier（預設關閉）" },
    { color: palette.other, label: "Other（預設關閉）" }, { color: palette.unknown, label: "Unknown（預設關閉）" },
  ];
  return (
    <div>
      <LegendTitle zh="GFW 小時近似航跡" />
      <FireCatRows cats={rows} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 5 }}>
        同色細線＝拖尾；同色圓點＝選定時間船頭（觀測間線性內插）
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 5, lineHeight: 1.4 }}>
        線為每小時 GFW HIGH 格網中心近似，不是原始 AIS 精確航跡。只在同 segment 內內插，缺訊與異常跳點不跨段連線；同座標端點會聚合並以大小表示船數。
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4, lineHeight: 1.4 }}>
        來源為正式 schema-4 day pack；Tanker 不屬於本圖層 taxonomy，GEAR/FAD 是獨立非船舶觀測。
      </div>
      {dataWindow.status !== "unknown" && dataWindow.startUtcDate && (
        <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
          資料窗 {dataWindow.startUtcDate === dataWindow.endUtcDate ? dataWindow.startUtcDate : `${dataWindow.startUtcDate} ~ ${dataWindow.endUtcDate}`}（UTC）
        </div>
      )}
      {latestDate && (
        <div style={{ fontSize: FONT_SIZE.xs, color: gfwFreshness(latestDate).status === "stale" ? "#f97316" : COLORS.textFaint, fontWeight: 600, marginTop: 2 }}>
          最新完整日 {gfwFreshness(latestDate).label}
        </div>
      )}
      {dataWindow.status === "out-of-window" && (
        <LegendNote style={{ fontWeight: 600, marginTop: 2 }}>
          ⚠ 目前 {dataWindow.requestedUtcDate ?? "所選日期"} 在資料窗外，圖層刻意空白
        </LegendNote>
      )}
      {dataWindow.status === "hour-unavailable" && (
        <LegendNote style={{ fontWeight: 600, marginTop: 2 }}>
          ⚠ 該小時缺選取船種的資料
        </LegendNote>
      )}
    </div>
  );
}

function utcDateFromSeconds(seconds: number): string {
  const date = new Date(seconds * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : "未提供";
}

export function GfwFishingEffortLegend() {
  const t = useLegendTheme();
  const timelineSeconds = useTimeStoreTime(1000);
  const [manifest, setManifest] = useState<GfwFishingEffortManifest | null>(null);
  useEffect(() => {
    let active = true;
    void loadGfwFishingEffortManifest().then((next) => {
      if (active) setManifest(next);
    });
    return () => { active = false; };
  }, []);
  const selectedUtcDate = utcDateFromSeconds(timelineSeconds);
  const attributionHref = manifest?.attributionHref;
  return (
    <div>
      <LegendTitle zh="GFW 每日捕撈活動" style={{ marginBottom: 5 }} />
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden" }}>
        {["#0f766e", "#22d3ee", "#facc15", "#fb7185"].map((color) => (
          <div key={color} style={{ flex: 1, background: color }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: FONT_SIZE.xs, color: t.textMuted }}>
        <span>0 h</span><span>1 h</span><span>12 h</span><span>48 h+</span>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 5, lineHeight: 1.4 }}>
        時間軸 UTC 日：{selectedUtcDate} · log1p(apparent fishing hours)
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 2, lineHeight: 1.4 }}>
        單位：{manifest?.unit ?? "未提供"} · 資料版本：{manifest?.resolvedDatasetVersion ?? "未提供"}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 2, lineHeight: 1.4 }}>
        Aggregation facets：每格保留 component facets（詳 popup）
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 2, lineHeight: 1.4 }}>
        最新可用日期：{manifest?.latestAvailableDate ?? "未提供（GFW 未提供）"} · active：{manifest?.latestObservedActiveDate ?? "未提供"}
      </div>
      {manifest?.selectedUtcDate && (
        <div style={{ fontSize: FONT_SIZE.xs, color: gfwFreshness(manifest.selectedUtcDate).status === "stale" ? "#f97316" : t.textMuted, fontWeight: 600, marginTop: 2, lineHeight: 1.4 }}>
          Release 完整日：{gfwFreshness(manifest.selectedUtcDate).label}
        </div>
      )}
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 2, lineHeight: 1.4 }}>
        Finalization：{manifest?.finalizationStatus ?? "未提供"} · Revision：{manifest?.revisionSemantics ?? "未提供"}
      </div>
      {manifest?.caveat && <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4, lineHeight: 1.4 }}>{manifest.caveat}</div>}
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4, lineHeight: 1.4 }}>
        {attributionHref ? <a href={attributionHref} target="_blank" rel="noreferrer" style={{ color: t.textStrong }}>Powered by {manifest?.attribution?.match(/Global Fishing Watch/) ? "Global Fishing Watch" : "資料提供者"}</a> : "資料提供者：未提供連結"}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 5, lineHeight: 1.4 }}>
        每日獨立 sample；apparent/model-derived、非即時；不是漁獲量、船數、執法證據或違法捕撈判定。
      </div>
    </div>
  );
}

export function GfwDarkVesselsLegend() {
  const t = useLegendTheme();
  const [latestDate, setLatestDate] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void loadGfwDarkVesselsManifest().then((manifest) => {
      if (active) setLatestDate(manifest?.latestCompleteDate ?? null);
    });
    return () => { active = false; };
  }, []);
  return (
    <div>
      <LegendTitle zh="GFW SAR 未匹配 AIS 偵測" />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SwatchDot color={"#f43f5e"} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>圓點大小＝同格 SAR detections</span>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 5, lineHeight: 1.4 }}>
        點位是 GFW HIGH 格網中心。「未與 AIS 匹配」不等於違法、暗船，也不能確認船舶刻意關閉 AIS。
      </div>
      {latestDate && (
        <div style={{ fontSize: FONT_SIZE.xs, color: gfwFreshness(latestDate).status === "stale" ? "#f97316" : COLORS.textFaint, fontWeight: 600, marginTop: 4 }}>
          最新完整日 {gfwFreshness(latestDate).label}
        </div>
      )}
    </div>
  );
}

export function MarineObservationLegend({ network }: { network: "cwa" | "isohe" }) {
  const t = useLegendTheme();
  const isCwa = network === "cwa";
  const cats = (Object.keys(MARINE_OBSERVATION_STATUS_STYLES) as Array<keyof typeof MARINE_OBSERVATION_STATUS_STYLES>)
    .map((key) => ({
      color: MARINE_OBSERVATION_STATUS_STYLES[key].colors[network],
      label: MARINE_OBSERVATION_STATUS_STYLES[key].label,
    }));
  return (
    <div>
      <LegendTitle zh={isCwa ? "CWA 海洋觀測站" : "ISOHE 港區海氣象站"} />
      <FireCatRows cats={cats} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.35 }}>
        {isCwa
          ? "中央氣象署固定站｜約每小時更新；freshness 使用 CWA 專屬門檻"
          : "港灣環境資訊網固定站｜約每 10 分鐘更新；freshness 使用 ISOHE 專屬門檻"}
      </LegendNote>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 3, lineHeight: 1.35 }}>
        點色只表示站點 freshness／來源狀態，不代表任一 metric；潮位比較前請確認 vertical datum。
      </div>
    </div>
  );
}

export function WorldTrashDebrisLegend() {
  const t = useLegendTheme();
  return (
    <div>
      <LegendTitle zh="垃圾與殘骸觀測" en="Trash & Debris Observations" />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SwatchDot color={"#f59e0b"} opacity={0.9} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>偵測到的垃圾 / 殘骸點位</span>
      </div>
      <DenseHeatmapLegendRow layers={["worldTrashDebris"]} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        點位密度反映 Mapillary 街景覆蓋，非真實垃圾分佈
      </LegendNote>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.3 }}>
        資料：Outerview (CC-BY-4.0)
      </LegendNote>
    </div>
  );
}

export function CoralReefDistributionLegend() {
  const t = useLegendTheme();
  return <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, maxWidth: 340 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      <SwatchDot color={CORAL_REEF_COLOR} />
      <span>暖水珊瑚礁歷史分布 · v4.1（2021-03 發布）</span>
    </div>
    <div style={{ color: t.textDim, lineHeight: 1.45 }}>歷史基線，非現況健康、活珊瑚覆蓋率或白化。</div>
    <div style={{ color: t.textDim, lineHeight: 1.45 }}>低 zoom 可見性損失與無 coverage 都不等於沒有珊瑚；馬祖本版無 coverage。</div>
    <div style={{ color: t.textDim, lineHeight: 1.45 }}>臺灣僅為研究窗口，非行政邊界；面積是全球完整來源 feature，不可加總。</div>
    <div style={{ marginTop: 4, color: t.textDim, lineHeight: 1.45 }}>{CORAL_REEF_ATTRIBUTION}</div>
  </div>;
}

export function AllenCoralAtlasLegend() {
  const t = useLegendTheme();
  const values = useLayerParams("allenCoralAtlas");
  const view = oneOfParam(
    paramStr(values, "allenCoralAtlas", "allenCoralAtlasView"),
    ["coralAlgae", "benthic", "geomorphic"] as const satisfies readonly AllenCoralAtlasView[],
    "coralAlgae",
  );
  const rows = allenCoralSource(view).legend.filter((item) => view !== "coralAlgae" || item.value === "Coral/Algae");
  const title = view === "coralAlgae" ? "珊瑚／藻類棲地" : view === "benthic" ? "淺海棲地分類" : "礁體地形分區";
  return <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, maxWidth: 340 }}>
    <div style={{ color: t.textStrong, fontWeight: 700, marginBottom: 4 }}>Allen Coral Atlas · {title}</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "3px 8px" }}>
      {rows.map((item) => <div key={item.value} style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
        <SwatchSquare color={item.color} />
        <span>{item.label_zh}</span>
      </div>)}
    </div>
    <div style={{ color: t.textDim, lineHeight: 1.45, marginTop: 6 }}>{ALLEN_CORAL_WARNING}</div>
    <div style={{ color: t.textDim, lineHeight: 1.45, marginTop: 3 }}>取得日：{ALLEN_CORAL_ACQUIRED_AT.slice(0, 10)}（非觀測日）；來源完整要素面積未裁切，不可作研究區總面積。</div>
    <div style={{ color: t.textDim, lineHeight: 1.45, marginTop: 3 }}>{ALLEN_CORAL_ATTRIBUTION}</div>
  </div>;
}
