import { Row } from "./shared";
import { getNewsCategoryDef } from "../../data/newsEventTypes";
import { confidenceLabel } from "../../data/vesselWatchTypes";
import type { ClusterEvent } from "../../data/newsEventsLoader";
import { FONT_DATA, RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";

function parseEvents(raw: unknown): ClusterEvent[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ClusterEvent[]) : [];
  } catch {
    return [];
  }
}

function formatTs(unixSec: number | undefined | null): string {
  if (!unixSec) return "";
  return new Date(unixSec * 1000).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });
}

export function NewsEventPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const eventCount = Number(props.event_count ?? 1);
  const location = String(props.location_name ?? props.county ?? "");
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
        <Row label="摘要" value={String(props.summary ?? "")} />
        <Row label="地點" value={location} />
        <Row label="分類" value={cat.label} color={cat.color} />
        <Row label="時間" value={String(props.published ?? "")} />
        {link && (
          <div style={{ marginTop: 6 }}>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: cat.color, fontSize: FONT_SIZE.base, fontFamily: FONT_DATA, textDecoration: "underline" }}
            >
              原文連結
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
          {eventCount} 則
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
                  <span style={{ color: cat.color }}>{cat.label}</span>
                  <span>·</span>
                  <span>{formatTs(e.published_ts)}</span>
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
  const severity = String(props.severity ?? "Unknown");
  const color = String(props.color ?? "#dc2626");
  const event = String(props.event ?? props.event_term ?? "災害示警");
  const headline = String(props.headline ?? "");
  const areaDesc = String(props.area_desc ?? "");
  const sender = String(props.sender_name ?? "");
  const startTs = Number(props.start_ts ?? 0);
  const endTs = Number(props.end_ts ?? 0);
  const fmt = (ts: number) =>
    ts > 0 && ts < Number.MAX_SAFE_INTEGER
      ? new Date(ts * 1000).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false })
      : "—";
  const sevLabel: Record<string, string> = {
    Extreme: "極端", Severe: "嚴重", Moderate: "中度", Minor: "輕度", Unknown: "未分類",
  };
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
          {sevLabel[severity] ?? severity}
        </div>
      </div>
      {headline && <Row label="標題" value={headline} />}
      {areaDesc && (
        <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: FONT_SIZE.base, lineHeight: 1.5 }}>
          <span style={{ color: t.textMuted, flexShrink: 0, minWidth: 56 }}>影響區域</span>
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
      <Row label="生效" value={fmt(startTs)} />
      <Row label="失效" value={fmt(endTs)} />
      {sender && <Row label="發布單位" value={sender} />}
    </>
  );
}

export function RoadEventPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const eventType = Number(props.event_type ?? 0);
  const color = String(props.color ?? "#6b7280");
  const source = String(props.source ?? "");
  const roadName = String(props.road_name ?? "");
  const direction = String(props.direction ?? "");
  const title = String(props.title ?? props.description ?? props.location_other ?? "路況事件");
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
    ts > 0 ? new Date(ts * 1000).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false }) : "—";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title || (EVENT_TYPE_LABELS[eventType] ?? "路況事件")}
        </div>
        <div style={{ fontSize: FONT_SIZE.sm, padding: "1px 6px", borderRadius: RADIUS.md, background: color, color: "#fff", fontWeight: 600, flexShrink: 0 }}>
          {EVENT_TYPE_LABELS[eventType] ?? "其他"}
        </div>
      </div>
      {source && <Row label="來源" value={SOURCE_LABELS[source] ?? source} />}
      {roadName && <Row label="路段" value={roadName + (direction ? ` ${direction}` : "")} />}
      {startKm > 0 && <Row label="里程" value={`${startKm.toFixed(1)} ~ ${endKm.toFixed(1)} km`} />}
      {description && description !== title && <Row label="描述" value={description} />}
      {locationOther && locationOther !== description && <Row label="位置" value={locationOther} />}
      {blockedLanes && <Row label="封閉車道" value={blockedLanes} />}
      <Row label="生效" value={fmt(startTs)} />
      {endTs > 0 && <Row label="失效" value={fmt(endTs)} />}
    </>
  );
}

export function ActiveFaultPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.sm, background: "#ef5350", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.fault_name ?? "Unknown Fault")}
        </div>
      </div>
      <Row label="編號" value={String(props.fault_id ?? "")} />
      <Row label="全稱" value={String(props.name ?? "")} />
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
  const color = String(props.kind_color ?? "#38bdf8");
  const kindLabel = String(props.kind_label ?? "活動區");
  const shapeNo = Number(props.shape_no ?? 0);
  const reportDate = String(props.report_date ?? "");
  const needsReview = Number(props.needs_review ?? 0) === 1;
  const balloons = Number(props.balloon_items ?? 0);
  const chartUrl = String(props.chart_url ?? "");
  const num = (v: unknown) =>
    v === null || v === undefined || v === "" ? null : Number(v);
  // ⚠ null = 該日通報解析失敗，與「0 架次」語意不同 → 顯示「—」而非 0
  const show = (v: number | null, unit: string) => (v === null ? "—" : `${v} ${unit}`);
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
            待核實
          </div>
        )}
      </div>
      <Row label="日期" value={reportDate} />
      <Row label="共機架次" value={show(sorties, "架次")} />
      <Row label="逾越中線" value={show(crossed, "架次")} />
      <Row label="共艦" value={show(vessels, "艘")} />
      <Row label="公務船" value={show(ships, "艘")} />
      {balloons > 0 && <Row label="空飄氣球" value={`${balloons} 顆（不繪成活動區）`} />}
      {chartUrl && (
        <div style={{ marginTop: 6, fontSize: FONT_SIZE.base }}>
          <a
            href={chartUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color, textDecoration: "underline" }}
          >
            國防部原始航跡示意圖 ↗
          </a>
        </div>
      )}
      <div style={{
        marginTop: 6, fontSize: FONT_SIZE.sm, color: t.textMuted, lineHeight: 1.5,
      }}>
        依國防部示意圖描繪之活動區域，非精確航跡。
        {needsReview && "此形狀未通過自動守門，尚未人工核實。"}
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
  const color = String(props.class_color ?? "#fb7185");
  const classLabel = String(props.class_label ?? "未分類");
  const shipName = String(props.ship_name ?? "").trim() || "（無船名）";
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
    ? new Date(collectedAt).toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false })
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
      <Row label="分類" value={classLabel} />
      {/* 可信度：讓使用者看得到「這艘為什麼被這樣分類」。
          rule_strong 不是猜的（MID×船名雙重印證），presumed 才是只憑船方自報。 */}
      <Row label="判定依據" value={confidenceLabel(props.confidence as string)} />
      <Row label="MMSI" value={str(props.mmsi)} />
      <Row label="IMO" value={str(props.imo)} />
      <Row label="呼號" value={str(props.call_sign)} />
      <Row label="船長" value={num(props.length_m, "m")} />
      {isTrail ? (
        <Row label="軌跡點數" value={num(props.point_count, "點")} />
      ) : (
        <>
          <Row label="速度" value={num(props.speed, "節", 1)} />
          <Row label="航向" value={num(props.heading, "°")} />
          <Row label="航行狀態" value={str(props.nav_status)} />
          <Row label="目的地（自報）" value={str(props.destination)} />
          <Row label="最後回報" value={collectedText} />
        </>
      )}
      <div style={{
        marginTop: 6, fontSize: FONT_SIZE.sm, color: t.textMuted, lineHeight: 1.5,
      }}>
        分類由船名／MMSI 國碼規則推斷，非官方認定；目的地為船方自報可造假。
        位置為最後已知 AIS 回報（離岸遠即收不到訊號），軌跡為約 15 分鐘一筆的斷續取樣。
      </div>
    </>
  );
}
