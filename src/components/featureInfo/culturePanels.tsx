import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { Row, SourceFooter } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import {
  CULTURAL_FACILITY_TYPES, CULTURAL_MUSEUM_TYPES, CULTURE_MISSING_COLOR,
  ARTS_EVENT_ONGOING_COLOR, ARTS_EVENT_UPCOMING_COLOR, PERFORMING_VENUE_COLOR,
} from "../../data/cultureTypes";

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
