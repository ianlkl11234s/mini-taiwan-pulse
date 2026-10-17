import { Row } from "./shared";
import { getNewsCategoryDef } from "../../data/newsEventTypes";
import { confidenceLabel } from "../../data/vesselWatchTypes";
import type { ClusterEvent } from "../../data/newsEventsLoader";
import { FONT_DATA, RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import { placeName } from "../../i18n/placeText";
import { enumLabel } from "../../i18n/dataText";

/** 等同 toLocaleString 預設的完整日期時間（台北時區由 formatDateTime 處理） */
const DT_FULL: Intl.DateTimeFormatOptions = { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hour12: false };

function parseEvents(raw: unknown): ClusterEvent[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ClusterEvent[]) : [];
  } catch {
    return [];
  }
}

function formatTs(unixSec: number | undefined | null, fmt: (d: Date, o: Intl.DateTimeFormatOptions) => string): string {
  if (!unixSec) return "";
  return fmt(new Date(unixSec * 1000), DT_FULL);
}

export function NewsEventPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr, formatDateTime } = i18n;
  const eventCount = Number(props.event_count ?? 1);
  const location = props.location_name != null ? String(props.location_name) : placeName(String(props.county ?? ""), i18n);
  const events = parseEvents(props.events_json);

  // 單則：維持原本簡潔版型（向後相容）
  if (eventCount <= 1 || events.length <= 1) {
    const link = String(props.link ?? "");
    const cat = getNewsCategoryDef(props.category as string | undefined);
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: cat.color, flexShrink: 0 }} />
          <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5, lineHeight: 1.4 }}>
            {String(props.title ?? "Unknown Event")}
          </div>
        </div>
        <Row label={tr("popup.event.summary")} value={String(props.summary ?? "")} />
        <Row field="place" value={location} />
        <Row field="classification" value={enumLabel("eventNewsCategory", cat.key, cat.label, i18n)} color={cat.color} />
        <Row field="time" value={String(props.published ?? "")} />
        {link && (
          <div style={{ marginTop: 6 }}>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: cat.color, fontSize: FONT_SIZE.base, fontFamily: FONT_DATA, textDecoration: "underline" }}
            >
              {tr("popup.event.originalLink")}
            </a>
          </div>
        )}
      </>
    );
  }

  // 多則：標題列 + 可滑動清單
  return (
    <>
      <div style={{
        display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
        paddingBottom: 6, borderBottom: `1px solid ${t.border}`,
      }}>
        <div style={{ fontSize: FONT_SIZE.lg, lineHeight: 1 }}>📰</div>
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5, lineHeight: 1.4 }}>
          {location}
        </div>
        <div style={{
          marginLeft: "auto", fontSize: FONT_SIZE.sm, padding: "1px 6px", borderRadius: RADIUS.md,
          background: t.bgStrong, color: t.textStrong, fontWeight: 600,
        }}>
          {tr("popup.event.itemCount", { count: eventCount })}
        </div>
      </div>
      <div style={{
        display: "flex", flexDirection: "column", gap: 6,
        maxHeight: 240, overflowY: "auto", paddingRight: 4,
      }}>
        {events.map((e) => {
          const cat = getNewsCategoryDef(e.category);
          return (
            <div key={e.id} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              <div style={{
                width: 8, height: 8, borderRadius: RADIUS.full,
                background: cat.color, marginTop: 5, flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <a
                  href={e.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: t.textStrong, fontSize: 11.5, fontWeight: 600,
                    textDecoration: "none", lineHeight: 1.4, display: "block",
                  }}
                >
                  {e.title}
                </a>
                <div style={{
                  fontSize: FONT_SIZE.sm, color: t.textDim, marginTop: 2,
                  display: "flex", gap: 6, flexWrap: "wrap",
                }}>
                  <span style={{ color: cat.color }}>{enumLabel("eventNewsCategory", cat.key, cat.label, i18n)}</span>
                  <span>·</span>
                  <span>{formatTs(e.published_ts, formatDateTime)}</span>
                  {e.source && <span>· {e.source.toUpperCase()}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function DisasterAlertPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr, formatDateTime } = i18n;
  const severity = String(props.severity ?? "Unknown");
  const color = String(props.color ?? "#dc2626");
  const event = String(props.event ?? props.event_term ?? tr("popup.event.disasterAlert"));
  const headline = String(props.headline ?? "");
  const areaDesc = String(props.area_desc ?? "");
  const sender = String(props.sender_name ?? "");
  const startTs = Number(props.start_ts ?? 0);
  const endTs = Number(props.end_ts ?? 0);
  const fmt = (ts: number) =>
    ts > 0 && ts < Number.MAX_SAFE_INTEGER
      ? formatDateTime(new Date(ts * 1000), DT_FULL)
      : "—";
  const sevLabel: Record<string, string> = {
    Extreme: "極端", Severe: "嚴重", Moderate: "中度", Minor: "輕度", Unknown: "未分類",
  };
  const sevText = enumLabel("eventSeverity", severity, sevLabel[severity] ?? severity, i18n);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {event}
        </div>
        <div style={{
          marginLeft: "auto", fontSize: FONT_SIZE.sm, padding: "1px 6px", borderRadius: RADIUS.md,
          background: color, color: "#fff", fontWeight: 600,
        }}>
          {sevText}
        </div>
      </div>
      {headline && <Row label={tr("popup.event.headline")} value={headline} />}
      {areaDesc && (
        <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: FONT_SIZE.base, lineHeight: 1.5 }}>
          <span style={{ color: t.textMuted, flexShrink: 0, minWidth: 56 }}>{tr("popup.event.affectedArea")}</span>
          <div
            style={{
              color: t.textStrong,
              wordBreak: "break-word",
              maxHeight: 20 * 16.5, // 11px × 1.5 line-height × 20 lines
              overflowY: "auto",
              paddingRight: 4,
            }}
          >
            {areaDesc}
          </div>
        </div>
      )}
      <Row label={tr("popup.event.effective")} value={fmt(startTs)} />
      <Row label={tr("popup.event.expires")} value={fmt(endTs)} />
      {sender && <Row label={tr("popup.event.sender")} value={sender} />}
    </>
  );
}

export function RoadEventPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr, formatDateTime } = i18n;
  const eventType = Number(props.event_type ?? 0);
  const color = String(props.color ?? "#6b7280");
  const source = String(props.source ?? "");
  const roadName = String(props.road_name ?? "");
  const direction = String(props.direction ?? "");
  const title = String(props.title ?? props.description ?? props.location_other ?? tr("popup.event.roadEvent"));
  const description = String(props.description ?? "");
  const locationOther = String(props.location_other ?? "");
  const blockedLanes = String(props.blocked_lanes ?? "");
  const startKm = Number(props.start_km ?? 0);
  const endKm = Number(props.end_km ?? 0);
  const startTs = Number(props.start_ts ?? 0);
  const endTs = Number(props.end_ts ?? 0);

  const EVENT_TYPE_LABELS: Record<number, string> = {
    1: "壅塞/事故", 2: "施工", 3: "事故", 4: "其他",
    5: "災害/障礙", 6: "其他", 7: "活動/管制", 8: "其他",
  };
  const SOURCE_LABELS: Record<string, string> = {
    live_freeway: "國道", live_highway: "省道",
    live_city: "縣市", event_city: "縣市預告",
  };
  const fmt = (ts: number) =>
    ts > 0 ? formatDateTime(new Date(ts * 1000), DT_FULL) : "—";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title || enumLabel("eventRoadType", eventType, EVENT_TYPE_LABELS[eventType] ?? tr("popup.event.roadEvent"), i18n)}
        </div>
        <div style={{ fontSize: FONT_SIZE.sm, padding: "1px 6px", borderRadius: RADIUS.md, background: color, color: "#fff", fontWeight: 600, flexShrink: 0 }}>
          {enumLabel("eventRoadType", eventType, EVENT_TYPE_LABELS[eventType] ?? "其他", i18n)}
        </div>
      </div>
      {source && <Row field="source" value={enumLabel("eventRoadSource", source, SOURCE_LABELS[source] ?? source, i18n)} />}
      {roadName && <Row field="roadSection" value={roadName + (direction ? ` ${direction}` : "")} />}
      {startKm > 0 && <Row label={tr("popup.event.mileage")} value={`${startKm.toFixed(1)} ~ ${endKm.toFixed(1)} km`} />}
      {description && description !== title && <Row label={tr("popup.event.description")} value={description} />}
      {locationOther && locationOther !== description && <Row field="location" value={locationOther} />}
      {blockedLanes && <Row label={tr("popup.event.blockedLanes")} value={blockedLanes} />}
      <Row label={tr("popup.event.effective")} value={fmt(startTs)} />
      {endTs > 0 && <Row label={tr("popup.event.expires")} value={fmt(endTs)} />}
    </>
  );
}

export function ActiveFaultPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: "#ef5350", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.fault_name ?? "Unknown Fault")}
        </div>
      </div>
      <Row field="number" value={String(props.fault_id ?? "")} />
      <Row label={tr("popup.event.fullName")} value={String(props.name ?? "")} />
    </>
  );
}

/**
 * 共機活動區 popup
 *
 * ⚠️ 必標「依國防部示意圖描繪之活動區域，非精確航跡」—— 官方來源本身即為
 * 示意圖，精度以其為上限。needs_review 的形狀另標「待核實」，不可混為已核實資料。
 */
export function PlaActivityPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  const color = String(props.kind_color ?? "#38bdf8");
  const kindLabel = String(props.kind_label ?? tr("popup.event.activityZone"));
  const shapeNo = Number(props.shape_no ?? 0);
  const reportDate = String(props.report_date ?? "");
  const needsReview = Number(props.needs_review ?? 0) === 1;
  const balloons = Number(props.balloon_items ?? 0);
  const chartUrl = String(props.chart_url ?? "");
  const num = (v: unknown) =>
    v === null || v === undefined || v === "" ? null : Number(v);
  // ⚠ null = 該日通報解析失敗，與「0 架次」語意不同 → 顯示「—」而非 0
  const show = (v: number | null, unit: string) => (v === null ? "—" : `${v} ${unit}`);
  const sortieUnit = tr("popup.event.sortieUnit");
  const sorties = num(props.sorties);
  const crossed = num(props.crossed_median);
  const vessels = num(props.plan_vessels);
  const ships = num(props.official_ships);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {kindLabel} #{shapeNo}
        </div>
        {needsReview && (
          <div style={{
            marginLeft: "auto", fontSize: FONT_SIZE.sm, padding: "1px 6px", borderRadius: RADIUS.md,
            background: "#b45309", color: "#fff", fontWeight: 600,
          }}>
            {tr("popup.event.needsReview")}
          </div>
        )}
      </div>
      <Row field="date" value={reportDate} />
      <Row label={tr("popup.event.plaSorties")} value={show(sorties, sortieUnit)} />
      <Row label={tr("popup.event.crossedMedian")} value={show(crossed, sortieUnit)} />
      <Row label={tr("popup.event.plaVessels")} value={show(vessels, tr("popup.event.shipUnit"))} />
      <Row label={tr("popup.event.officialShips")} value={show(ships, tr("popup.event.shipUnit"))} />
      {balloons > 0 && <Row label={tr("popup.event.balloons")} value={tr("popup.event.balloonValue", { count: balloons })} />}
      {chartUrl && (
        <div style={{ marginTop: 6, fontSize: FONT_SIZE.base }}>
          <a
            href={chartUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color, textDecoration: "underline" }}
          >
            {tr("popup.event.chartLink")}
          </a>
        </div>
      )}
      <div style={{
        marginTop: 6, fontSize: FONT_SIZE.sm, color: t.textMuted, lineHeight: 1.5,
      }}>
        {tr("popup.event.plaNote")}
        {needsReview && tr("popup.event.plaNeedsReviewNote")}
      </div>
    </>
  );
}

/**
 * 特殊船舶 popup（點船位圓點或其軌跡線都會開）
 *
 * ⚠️ 三處誠實標註不可省：
 *   1. `destination`（目的地）是 **AIS 自報欄位**，船方可任意填寫甚至造假。
 *   2. 分類是**規則推斷**（船名 pattern ＋ MMSI 國碼），不是官方認定。
 *   3. 「最後回報」不等於「現在在那裡」—— 離岸遠就收不到訊號，位置會停在原地。
 */
export function VesselWatchPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const { t: tr, formatDateTime } = useLocale();
  const color = String(props.class_color ?? "#fb7185");
  const classLabel = String(props.class_label ?? tr("popup.common.unclassified"));
  const shipName = String(props.ship_name ?? "").trim() || tr("popup.event.noShipName");
  const str = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v).trim();
    return s === "" ? "—" : s;
  };
  const num = (v: unknown, unit: string, digits = 0) => {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    return Number.isFinite(n) ? `${n.toFixed(digits)} ${unit}` : "—";
  };
  const collectedAt = String(props.collected_at ?? "");
  const collectedText = collectedAt
    ? formatDateTime(new Date(collectedAt), DT_FULL)
    : "—";
  // 軌跡線 feature 沒有這些欄位（只有 mmsi / 分類 / 點數）→ 用它判斷要不要畫動態區塊
  const isTrail = props.point_count !== undefined && props.speed === undefined;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {shipName}
        </div>
      </div>
      <Row field="classification" value={classLabel} />
      {/* 可信度：讓使用者看得到「這艘為什麼被這樣分類」。
          rule_strong 不是猜的（MID×船名雙重印證），presumed 才是只憑船方自報。 */}
      <Row label={tr("popup.event.basis")} value={confidenceLabel(props.confidence as string)} />
      <Row label="MMSI" value={str(props.mmsi)} />
      <Row label="IMO" value={str(props.imo)} />
      <Row field="callSign" value={str(props.call_sign)} />
      <Row label={tr("popup.event.shipLength")} value={num(props.length_m, "m")} />
      {isTrail ? (
        <Row label={tr("popup.event.trailPoints")} value={num(props.point_count, tr("popup.event.pointUnit"))} />
      ) : (
        <>
          <Row label={tr("popup.event.speed")} value={num(props.speed, tr("popup.event.knotUnit"), 1)} />
          <Row label={tr("popup.event.heading")} value={num(props.heading, "°")} />
          <Row label={tr("popup.event.navStatus")} value={str(props.nav_status)} />
          <Row label={tr("popup.event.destination")} value={str(props.destination)} />
          <Row label={tr("popup.event.lastReport")} value={collectedText} />
        </>
      )}
      <div style={{
        marginTop: 6, fontSize: FONT_SIZE.sm, color: t.textMuted, lineHeight: 1.5,
      }}>
        {tr("popup.event.vesselNote")}
      </div>
    </>
  );
}
