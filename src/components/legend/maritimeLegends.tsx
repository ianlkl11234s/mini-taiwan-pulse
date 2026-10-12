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
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";

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
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.maritime.shipsTitle")} en="Ship" />
      <FireCatRows
        cats={SHIP_TYPE_LEGEND.map((s) => ({ color: SHIP_TYPE_COLORS_DARK[s.bucket], label: enumLabel("shipTypeBucket", s.bucket, s.label, i18n) }))}
      />
    </div>
  );
}

// ── 領海界線圖例（4 類：線型也要畫出來，因為 24 浬是虛線）──
//    色票 / 標籤 / 線型全部來自 data/maritimeBoundaryTypes.ts，與 paint、popup 同源。
export function MaritimeBoundaryLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.maritime.boundaryTitle")} en="Maritime" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {MARITIME_BOUNDARY_TYPES.map((m) => (
          <div key={m.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {m.value === "basepoint" ? (
              <SwatchDot color={m.color} opacity={0.9} />
            ) : (
              <SwatchLine color={m.color} width={2} dash={m.dashed ? [4, 3] : undefined} opacity={0.9} />
            )}
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("maritimeBoundary", m.value, m.label, i18n)}</span>
          </div>
        ))}
      </div>
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {i18n.t("legend.maritime.boundaryNote", { source: enumLabel("maritimeBoundarySource", "note", MARITIME_BOUNDARY_SOURCE_NOTE, i18n) })}
      </LegendNote>
    </div>
  );
}

// 海底等深線圖例：12 級深度分帶（深→淺），隨 modeIdx 換色（SSOT isobathTypes.ts）
export function IsobathLegend({ modeIdx = 0 }: { modeIdx?: number }) {
  const i18n = useLocale();
  const rows = isobathLegendRows(modeIdx);
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.maritime.isobathTitle")} en="Isobath" />
      <FireCatRows cats={rows} square />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {enumLabel("isobathAttribution", "gebco", ISOBATH_ATTRIBUTION, i18n)}
      </LegendNote>
    </div>
  );
}

export function AquacultureLegend({ visibility }: { visibility: LayerVisibility }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const rows = ([
    { key: "aquaculturePonds", color: "#26c6da", labelKey: "legend.maritime.aquaPonds" },
    { key: "aquacultureZone", color: "#66bb6a", labelKey: "legend.maritime.aquaZone" },
    { key: "aquacultureCageNet", color: "#5c6bc0", labelKey: "legend.maritime.aquaCageNet" },
    { key: "aquacultureWaterSatellite", color: "#26c6da", labelKey: "legend.maritime.aquaSatConfirmed" },
    { key: "aquacultureWaterSatellite", color: "#90a4ae", labelKey: "legend.maritime.aquaSatReservoir" },
    { key: "aquacultureWaterSatellite", color: "#cfd8dc", labelKey: "legend.maritime.aquaSatUncertain" },
  ] as const).filter((it) => visibility[it.key]);
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.maritime.aquaTitle")} en="Aquaculture" />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((it) => (
          <div key={it.labelKey} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SwatchSquare color={it.color} opacity={0.9} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t(it.labelKey)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AquacultureWaterSatelliteMoaLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  const rows = [
    { color: "#26c6da", label: i18n.t("legend.maritime.moaConfirmed") },
    { color: "#1e88e5", label: i18n.t("legend.maritime.moaSolar") },
    { color: "#9e9e9e", label: i18n.t("legend.maritime.moaOther") },
  ];
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.maritime.moaTitle")} en="MOA Labeled" />
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
  const i18n = useLocale();
  const rows = [
    { color: "#26c6da", label: i18n.t("legend.maritime.unionBoth") },
    { color: "#43a047", label: i18n.t("legend.maritime.unionMoa") },
    { color: "#fb8c00", label: i18n.t("legend.maritime.unionOsm") },
  ];
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.maritime.unionTitle")} en="Union" />
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
  const i18n = useLocale();
  const rows = [
    { color: "#26c6da", label: i18n.t("legend.maritime.integratedPonds") },
    { color: "#66bb6a", label: i18n.t("legend.maritime.integratedSat") },
    { color: "#ffa726", label: i18n.t("legend.maritime.integratedProd") },
  ];
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.maritime.integratedTitle")} en="Integrated" />
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
  const i18n = useLocale();
  const items: { color: string; label: string; dashed?: boolean }[] = [
    { color: PLA_KIND_COLORS.rect, label: enumLabel("plaKind", "rect", PLA_KIND_LABELS.rect, i18n) },
    { color: PLA_KIND_COLORS.poly, label: enumLabel("plaKind", "poly", PLA_KIND_LABELS.poly, i18n) },
  ];
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.maritime.plaTitle")} en="PLA Activity" />
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
          <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.maritime.plaPending")}</span>
        </div>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        {i18n.t("legend.maritime.plaNote1")}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 2 }}>
        {i18n.t("legend.maritime.plaNote2")}
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
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.maritime.vwTitle")} en="Vessel Watch" />
      <FireCatRows cats={VESSEL_CLASSES.map((c) => ({ color: c.color, label: enumLabel("vesselClass", c.value, c.label, i18n) }))} />
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        {i18n.t("legend.maritime.vwNote1")}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 2 }}>
        {i18n.t("legend.maritime.vwNote2")}
      </div>
    </div>
  );
}

export function AisstreamVesselsLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.maritime.aisTitle")} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SwatchDot color={"#22d3ee"} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.maritime.aisRow")}</span>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        {i18n.t("legend.maritime.aisNote")}
      </div>
    </div>
  );
}

export function GfwVesselPresenceLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.maritime.presTitle")} en="Historical" />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SwatchDot color={"#f59e0b"} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.maritime.presRow")}</span>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        {i18n.t("legend.maritime.presNote")}
      </div>
    </div>
  );
}

/** gfwFreshness 的 label 是寫死的中文，這裡依狀態重組成目前語系（中文輸出與原本逐字相同）。 */
function freshnessText(date: string, i18n: ReturnType<typeof useLocale>): string {
  const f = gfwFreshness(date);
  const shown = f.ageDays == null && f.status === "invalid" ? (date || i18n.t("legend.common.notProvided")) : date;
  if (f.status === "invalid") {
    return f.ageDays == null
      ? i18n.t("legend.maritime.freshInvalid", { date: shown })
      : i18n.t("legend.maritime.freshFuture", { date });
  }
  const key = f.status === "current" ? "legend.maritime.freshCurrent" : f.status === "delayed" ? "legend.maritime.freshDelayed" : "legend.maritime.freshStale";
  return i18n.t(key, { date, days: f.ageDays ?? 0 });
}

export function GfwHourlyGridLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  const dataWindow = useSyncExternalStore(subscribeGfwHourlyGridDataWindow, getGfwHourlyGridDataWindowSnapshot, () => null);
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.maritime.gridTitle")} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, max-content)", gap: "5px 10px" }}>
        {GFW_HOURLY_GRID_V4_COLOR_BANDS.map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <SwatchSquare color={item.color} />
            <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{enumLabel("gfwGridBand", item.min, item.label, i18n)}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 5 }}>
        {i18n.t("legend.maritime.gridNote1")}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 2 }}>
        {i18n.t("legend.maritime.gridNote2")}
      </div>
      {dataWindow && (
        <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 2 }}>
          {i18n.t("legend.maritime.dataWindow", { range: dataWindow.utcDateLabel })}
        </div>
      )}
      {dataWindow && (
        <div style={{ fontSize: FONT_SIZE.xs, color: gfwFreshness(dataWindow.latestCompleteDate).status === "stale" ? "#f97316" : COLORS.textFaint, fontWeight: 600, marginTop: 2 }}>
          {i18n.t("legend.maritime.latestComplete", { label: freshnessText(dataWindow.latestCompleteDate, i18n) })}
        </div>
      )}
      {dataWindow?.status === "out-of-window" && (
        <LegendNote style={{ fontWeight: 600, marginTop: 2 }}>
          {i18n.t("legend.maritime.gridOutOfWindow")}
        </LegendNote>
      )}
    </div>
  );
}

export function GfwHourlyTracksLegend({ isDark }: { isDark: boolean }) {
  const t = useLegendTheme();
  const i18n = useLocale();
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
    { color: palette.fishing, label: i18n.t("legend.maritime.trkFishing") }, { color: palette.cargo, label: i18n.t("legend.maritime.trkCargo") },
    { color: palette.passenger, label: i18n.t("legend.maritime.trkPassenger") }, { color: palette.carrier, label: i18n.t("legend.maritime.trkCarrier") },
    { color: palette.other, label: i18n.t("legend.maritime.trkOther") }, { color: palette.unknown, label: i18n.t("legend.maritime.trkUnknown") },
  ];
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.maritime.tracksTitle")} />
      <FireCatRows cats={rows} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 5 }}>
        {i18n.t("legend.maritime.tracksNote1")}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 5, lineHeight: 1.4 }}>
        {i18n.t("legend.maritime.tracksNote2")}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4, lineHeight: 1.4 }}>
        {i18n.t("legend.maritime.tracksNote3")}
      </div>
      {dataWindow.status !== "unknown" && dataWindow.startUtcDate && (
        <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
          {i18n.t("legend.maritime.dataWindow", { range: dataWindow.startUtcDate === dataWindow.endUtcDate ? dataWindow.startUtcDate : `${dataWindow.startUtcDate} ~ ${dataWindow.endUtcDate}` })}
        </div>
      )}
      {latestDate && (
        <div style={{ fontSize: FONT_SIZE.xs, color: gfwFreshness(latestDate).status === "stale" ? "#f97316" : COLORS.textFaint, fontWeight: 600, marginTop: 2 }}>
          {i18n.t("legend.maritime.latestComplete", { label: freshnessText(latestDate, i18n) })}
        </div>
      )}
      {dataWindow.status === "out-of-window" && (
        <LegendNote style={{ fontWeight: 600, marginTop: 2 }}>
          {i18n.t("legend.maritime.tracksOutOfWindow", { date: dataWindow.requestedUtcDate ?? i18n.t("legend.maritime.selectedDate") })}
        </LegendNote>
      )}
      {dataWindow.status === "hour-unavailable" && (
        <LegendNote style={{ fontWeight: 600, marginTop: 2 }}>
          {i18n.t("legend.maritime.hourUnavailable")}
        </LegendNote>
      )}
    </div>
  );
}

function utcDateFromSeconds(seconds: number): string | null {
  const date = new Date(seconds * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

export function GfwFishingEffortLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  const notProvided = i18n.t("legend.common.notProvided");
  const timelineSeconds = useTimeStoreTime(1000);
  const [manifest, setManifest] = useState<GfwFishingEffortManifest | null>(null);
  useEffect(() => {
    let active = true;
    void loadGfwFishingEffortManifest().then((next) => {
      if (active) setManifest(next);
    });
    return () => { active = false; };
  }, []);
  const selectedUtcDate = utcDateFromSeconds(timelineSeconds) ?? notProvided;
  const attributionHref = manifest?.attributionHref;
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.maritime.effTitle")} style={{ marginBottom: 5 }} />
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden" }}>
        {["#0f766e", "#22d3ee", "#facc15", "#fb7185"].map((color) => (
          <div key={color} style={{ flex: 1, background: color }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: FONT_SIZE.xs, color: t.textMuted }}>
        <span>0 h</span><span>1 h</span><span>12 h</span><span>48 h+</span>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 5, lineHeight: 1.4 }}>
        {i18n.t("legend.maritime.effDay", { date: selectedUtcDate })}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 2, lineHeight: 1.4 }}>
        {i18n.t("legend.maritime.effUnit", { unit: manifest?.unit ?? notProvided, version: manifest?.resolvedDatasetVersion ?? notProvided })}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 2, lineHeight: 1.4 }}>
        {i18n.t("legend.maritime.effFacets")}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 2, lineHeight: 1.4 }}>
        {i18n.t("legend.maritime.effLatest", { available: manifest?.latestAvailableDate ?? i18n.t("legend.maritime.effNotProvidedGfw"), active: manifest?.latestObservedActiveDate ?? notProvided })}
      </div>
      {manifest?.selectedUtcDate && (
        <div style={{ fontSize: FONT_SIZE.xs, color: gfwFreshness(manifest.selectedUtcDate).status === "stale" ? "#f97316" : t.textMuted, fontWeight: 600, marginTop: 2, lineHeight: 1.4 }}>
          {i18n.t("legend.maritime.effRelease", { label: freshnessText(manifest.selectedUtcDate, i18n) })}
        </div>
      )}
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 2, lineHeight: 1.4 }}>
        {i18n.t("legend.maritime.effFinal", { finalization: manifest?.finalizationStatus ?? notProvided, revision: manifest?.revisionSemantics ?? notProvided })}
      </div>
      {manifest?.caveat && <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4, lineHeight: 1.4 }}>{manifest.caveat}</div>}
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4, lineHeight: 1.4 }}>
        {attributionHref ? <a href={attributionHref} target="_blank" rel="noreferrer" style={{ color: t.textStrong }}>{i18n.t("legend.maritime.effPoweredBy", { name: manifest?.attribution?.match(/Global Fishing Watch/) ? "Global Fishing Watch" : i18n.t("legend.maritime.effProvider") })}</a> : i18n.t("legend.maritime.effNoLink")}
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 5, lineHeight: 1.4 }}>
        {i18n.t("legend.maritime.effNote")}
      </div>
    </div>
  );
}

export function GfwDarkVesselsLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
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
      <LegendTitle zh={i18n.t("legend.maritime.darkTitle")} />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SwatchDot color={"#f43f5e"} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.maritime.darkRow")}</span>
      </div>
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 5, lineHeight: 1.4 }}>
        {i18n.t("legend.maritime.darkNote")}
      </div>
      {latestDate && (
        <div style={{ fontSize: FONT_SIZE.xs, color: gfwFreshness(latestDate).status === "stale" ? "#f97316" : COLORS.textFaint, fontWeight: 600, marginTop: 4 }}>
          {i18n.t("legend.maritime.latestComplete", { label: freshnessText(latestDate, i18n) })}
        </div>
      )}
    </div>
  );
}

export function MarineObservationLegend({ network }: { network: "cwa" | "isohe" }) {
  const t = useLegendTheme();
  const i18n = useLocale();
  const isCwa = network === "cwa";
  const cats = (Object.keys(MARINE_OBSERVATION_STATUS_STYLES) as Array<keyof typeof MARINE_OBSERVATION_STATUS_STYLES>)
    .map((key) => ({
      color: MARINE_OBSERVATION_STATUS_STYLES[key].colors[network],
      label: enumLabel("marineObsStatus", key, MARINE_OBSERVATION_STATUS_STYLES[key].label, i18n),
    }));
  return (
    <div>
      <LegendTitle zh={isCwa ? i18n.t("legend.maritime.moTitleCwa") : i18n.t("legend.maritime.moTitleIsohe")} />
      <FireCatRows cats={cats} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.35 }}>
        {isCwa
          ? i18n.t("legend.maritime.moNoteCwa")
          : i18n.t("legend.maritime.moNoteIsohe")}
      </LegendNote>
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, marginTop: 3, lineHeight: 1.35 }}>
        {i18n.t("legend.maritime.moNote2")}
      </div>
    </div>
  );
}

export function WorldTrashDebrisLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return (
    <div>
      <LegendTitle zh={i18n.t("legend.maritime.trashTitle")} en="Trash & Debris Observations" />
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SwatchDot color={"#f59e0b"} opacity={0.9} />
        <span style={{ fontSize: FONT_SIZE.xs, color: t.textMuted }}>{i18n.t("legend.maritime.trashRow")}</span>
      </div>
      <DenseHeatmapLegendRow layers={["worldTrashDebris"]} />
      <LegendNote style={{ marginTop: 4, lineHeight: 1.3 }}>
        {i18n.t("legend.maritime.trashNote1")}
      </LegendNote>
      <LegendNote style={{ marginTop: 2, lineHeight: 1.3 }}>
        {i18n.t("legend.maritime.trashNote2")}
      </LegendNote>
    </div>
  );
}

export function CoralReefDistributionLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  return <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, maxWidth: 340 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      <SwatchDot color={CORAL_REEF_COLOR} />
      <span>{i18n.t("legend.maritime.coralLine")}</span>
    </div>
    <div style={{ color: t.textDim, lineHeight: 1.45 }}>{i18n.t("legend.maritime.coralNote1")}</div>
    <div style={{ color: t.textDim, lineHeight: 1.45 }}>{i18n.t("legend.maritime.coralNote2")}</div>
    <div style={{ color: t.textDim, lineHeight: 1.45 }}>{i18n.t("legend.maritime.coralNote3")}</div>
    <div style={{ marginTop: 4, color: t.textDim, lineHeight: 1.45 }}>{enumLabel("coralReefNote", "attribution", CORAL_REEF_ATTRIBUTION, i18n)}</div>
  </div>;
}

export function AllenCoralAtlasLegend() {
  const t = useLegendTheme();
  const i18n = useLocale();
  const values = useLayerParams("allenCoralAtlas");
  const view = oneOfParam(
    paramStr(values, "allenCoralAtlas", "allenCoralAtlasView"),
    ["coralAlgae", "benthic", "geomorphic"] as const satisfies readonly AllenCoralAtlasView[],
    "coralAlgae",
  );
  const rows = allenCoralSource(view).legend.filter((item) => view !== "coralAlgae" || item.value === "Coral/Algae");
  const title = view === "coralAlgae" ? i18n.t("legend.maritime.allenTitleCoral") : view === "benthic" ? i18n.t("legend.maritime.allenTitleBenthic") : i18n.t("legend.maritime.allenTitleGeo");
  return <div style={{ fontSize: FONT_SIZE.xs, color: t.textMuted, maxWidth: 340 }}>
    <div style={{ color: t.textStrong, fontWeight: 700, marginBottom: 4 }}>Allen Coral Atlas · {title}</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "3px 8px" }}>
      {rows.map((item) => <div key={item.value} style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
        <SwatchSquare color={item.color} />
        <span>{enumLabel("allenCoralClass", item.value, item.label_zh, i18n)}</span>
      </div>)}
    </div>
    <div style={{ color: t.textDim, lineHeight: 1.45, marginTop: 6 }}>{enumLabel("allenCoralNote", "warning", ALLEN_CORAL_WARNING, i18n)}</div>
    <div style={{ color: t.textDim, lineHeight: 1.45, marginTop: 3 }}>{i18n.t("legend.maritime.allenAcquired", { date: ALLEN_CORAL_ACQUIRED_AT.slice(0, 10) })}</div>
    <div style={{ color: t.textDim, lineHeight: 1.45, marginTop: 3 }}>{enumLabel("allenCoralNote", "attribution", ALLEN_CORAL_ATTRIBUTION, i18n)}</div>
  </div>;
}
