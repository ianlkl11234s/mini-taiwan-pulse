import { useEffect, useMemo, useState } from "react";
import { RADIUS, FONT_SIZE, COLORS } from "../../styles/designTokens";
import { Row, SourceFooter } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import {
  CULTURAL_FACILITY_TYPES, CULTURAL_MUSEUM_TYPES, CULTURE_MISSING_COLOR,
  ARTS_EVENT_ONGOING_COLOR, ARTS_EVENT_UPCOMING_COLOR, PERFORMING_VENUE_COLOR,
  LIBRARY_SEATS_COLORS,
} from "../../data/cultureTypes";
import { fetchLibrarySeats24h, type LibrarySeatArea } from "../../data/librarySeatsLoader";
import { TimeseriesSparkline, type SparklinePoint } from "../TimeseriesSparkline";

// 本檔 Title 為極簡本地版（同 urbanPanels 慣例）：shared.tsx 未 export Title，故不去改動它。
function Title({ color, children }: { color: string; children: string }) {
  const t = useFeatureTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>{children}</div>
    </div>
  );
}

/** 整數場次數（非有限值回空字串，Row 對空值自動隱藏） */
function intOrEmpty(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : "";
}

/** 文化設施（787 點）：名稱 + 類型（染色）+ 城市 + 地址 */
export function CulturalFacilitiesPanel({ props }: { props: Record<string, unknown> }) {
  const type = String(props.facility_type ?? "");
  const color = CULTURAL_FACILITY_TYPES.find((c) => c.name === type)?.color ?? CULTURE_MISSING_COLOR;
  return (
    <>
      <Title color={color}>{String(props.name ?? "文化設施")}</Title>
      <Row label="類型" value={type} color={color} />
      <Row label="城市" value={String(props.city ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

/** 地方文化館（252 點）：名稱 + 類型（染色）+ 城市 + 地址 + 官網（純文字） */
export function CulturalMuseumsPanel({ props }: { props: Record<string, unknown> }) {
  const type = String(props.type ?? "");
  const color = CULTURAL_MUSEUM_TYPES.find((c) => c.name === type)?.color ?? CULTURE_MISSING_COLOR;
  return (
    <>
      <Title color={color}>{String(props.name ?? "地方文化館")}</Title>
      <Row label="類型" value={type} color={color} />
      <Row label="城市" value={String(props.city ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="官網" value={String(props.website ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

/** 台北時區今日 YYYY/MM/DD（判斷藝文活動進行中/未開始，與 overlayRegistry cultureTodayStr 同源） */
function cultureTodayStr(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" }).replace(/-/g, "/");
}

/**
 * 藝文活動（6,121 點）：標題 + 進行中/未開始狀態（染色）+ 類別代碼 + 日期 + 場次時間 + 地點 + 地址。
 * category 為原始代碼字串（"1"-"19"，無官方名稱對照）→ 顯示「類別代碼 N」。
 */
export function ArtsEventsPanel({ props }: { props: Record<string, unknown> }) {
  const startDate = String(props.start_date ?? "");
  const endDate = String(props.end_date ?? "");
  const ongoing = startDate !== "" && startDate <= cultureTodayStr();
  const statusLabel = ongoing ? "進行中" : "未開始";
  const statusColor = ongoing ? ARTS_EVENT_ONGOING_COLOR : ARTS_EVENT_UPCOMING_COLOR;
  const category = String(props.category ?? "");
  const dateRange = startDate && endDate ? `${startDate} ~ ${endDate}` : startDate || endDate;
  return (
    <>
      <Title color={statusColor}>{String(props.title ?? "藝文活動")}</Title>
      <Row label="狀態" value={statusLabel} color={statusColor} />
      <Row label="類別代碼" value={category} />
      <Row label="日期" value={dateRange} />
      <Row label="場次時間" value={String(props.show_time ?? "")} />
      <Row label="地點" value={String(props.location_name ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <SourceFooter props={props} />
    </>
  );
}

/** 表演場館（857 點）：場館名 + 城市 + 地址 + 活動數 + 場次數 */
export function PerformingVenuesPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <Title color={PERFORMING_VENUE_COLOR}>{String(props.venue_name ?? "表演場館")}</Title>
      <Row label="城市" value={String(props.city ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="活動數" value={intOrEmpty(props.event_count)} />
      <Row label="場次數" value={intOrEmpty(props.show_count)} />
      <SourceFooter props={props} />
    </>
  );
}

/**
 * 北市圖即時座位（6 分館聚合）：分館總覽 + 各閱覽區列表 + 單區 24h 空位折線。
 * ⭐ is_closed 一律顯示「休館中」，絕不顯示成 0 空位（閉館 free_count 無意義）。
 * observed_ts 為 unix 秒 → ×1000 給 Date。折線不支援斷線 → 排除閉館點並標註。
 */
export function LibrarySeatsPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const branch = String(props.branch_name ?? "北市圖");
  const allClosed = Number(props.all_closed ?? 0) === 1;
  const openFree = Number(props.open_free ?? 0);
  const openTotal = Number(props.open_total ?? 0);
  const areaCount = Number(props.area_count ?? 0);
  const closedCount = Number(props.closed_count ?? 0);
  const openCount = areaCount - closedCount;
  const obsTs = props.observed_ts == null ? null : Number(props.observed_ts);

  const areas = useMemo<LibrarySeatArea[]>(() => {
    const raw = props.areas;
    if (typeof raw === "string") {
      try { return JSON.parse(raw) as LibrarySeatArea[]; } catch { return []; }
    }
    return Array.isArray(raw) ? (raw as LibrarySeatArea[]) : [];
  }, [props.areas]);

  const ratio = openTotal > 0 ? openFree / openTotal : 0;
  const headerColor = allClosed
    ? LIBRARY_SEATS_COLORS.closed
    : ratio >= 0.5 ? LIBRARY_SEATS_COLORS.full
    : ratio > 0 ? LIBRARY_SEATS_COLORS.half
    : LIBRARY_SEATS_COLORS.empty;

  // 24h 折線：區選擇（預設第一個未閉館區；隨分館切換 reset）
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  useEffect(() => {
    const fo = areas.find((a) => !a.is_closed) ?? areas[0];
    setSelectedAreaId(fo ? fo.area_id : null);
  }, [areas]);

  const [series, setSeries] = useState<SparklinePoint[]>([]);
  const [hasClosedGap, setHasClosedGap] = useState(false);
  const [loadingTs, setLoadingTs] = useState(true);

  useEffect(() => {
    if (selectedAreaId == null) { setSeries([]); setHasClosedGap(false); setLoadingTs(false); return; }
    let cancelled = false;
    setLoadingTs(true);
    fetchLibrarySeats24h(selectedAreaId)
      .then((rows) => {
        if (cancelled) return;
        const open = rows.filter((r) => !r.is_closed);
        setHasClosedGap(open.length < rows.length);
        setSeries(open.map((r) => ({ t: Number(r.observed_ts), v: Number(r.free_count) })));
      })
      .catch((e) => console.warn("[LibrarySeats] 24h fetch failed:", e))
      .finally(() => { if (!cancelled) setLoadingTs(false); });
    return () => { cancelled = true; };
  }, [selectedAreaId]);

  const areaLabel = (a: LibrarySeatArea) => `${a.floor_name} ${a.area_name}`.trim();

  return (
    <>
      <Title color={headerColor}>{branch}</Title>
      {allClosed ? (
        <Row label="狀態" value="休館中" color={LIBRARY_SEATS_COLORS.closed} />
      ) : (
        <>
          <Row label="開放區" value={`${openCount} / ${areaCount} 區`} color={headerColor} />
          <Row label="空位" value={`${openFree} / ${openTotal}`} color={headerColor} />
        </>
      )}
      {obsTs != null && (
        <Row
          label="觀測時間"
          value={new Date(obsTs * 1000).toLocaleString("zh-TW", { hour12: false }).slice(5, 16)}
        />
      )}

      {/* 各閱覽區明細 */}
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textMuted, letterSpacing: 0.5 }}>
        各閱覽區（{areaCount}）
      </div>
      {areas.map((a) => (
        <Row
          key={a.area_id}
          label={areaLabel(a)}
          value={a.is_closed ? "休館中" : `${a.free_count} / ${a.total_count}`}
          color={a.is_closed ? LIBRARY_SEATS_COLORS.closed : undefined}
        />
      ))}

      {/* 單區 24h 空位折線 */}
      {areas.length > 0 && (
        <>
          <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textMuted, letterSpacing: 0.5 }}>
            24h 空位趨勢
          </div>
          <select
            value={selectedAreaId ?? ""}
            onChange={(e) => setSelectedAreaId(Number(e.target.value))}
            style={{
              width: "100%", marginTop: 4, fontSize: FONT_SIZE.sm, padding: "3px 6px",
              background: "rgba(127,127,127,0.12)", color: t.textDefault,
              border: `1px solid ${t.border}`, borderRadius: RADIUS.md,
            }}
          >
            {areas.map((a) => (
              <option key={a.area_id} value={a.area_id} style={{ background: "#1a1a1a" }}>
                {areaLabel(a)}{a.is_closed ? "（休館）" : ""}
              </option>
            ))}
          </select>
          {loadingTs ? (
            <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDim, padding: "8px 4px", textAlign: "center" }}>
              載入中…
            </div>
          ) : (
            <TimeseriesSparkline data={series} unit="空位" lineColor={LIBRARY_SEATS_COLORS.full} height={120} />
          )}
          {hasClosedGap && (
            <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 2, lineHeight: 1.4 }}>
              閉館時段不顯示
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textDim, lineHeight: 1.4 }}>
        臺北市立圖書館 · 資料 10 分鐘更新
      </div>
    </>
  );
}
