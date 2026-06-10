import { Row } from "./shared";

export function NewsEventPanel({ props }: { props: Record<string, unknown> }) {
  const link = String(props.link ?? "");
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff9800", flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5, lineHeight: 1.4 }}>
          {String(props.title ?? "Unknown Event")}
        </div>
      </div>
      <Row label="摘要" value={String(props.summary ?? "")} />
      <Row label="地點" value={String(props.location_name ?? "")} />
      <Row label="分類" value={String(props.category ?? "")} color="#ff9800" />
      <Row label="時間" value={String(props.published ?? "")} />
      {link && (
        <div style={{ marginTop: 6 }}>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#ff9800", fontSize: 11, fontFamily: "monospace", textDecoration: "underline" }}
          >
            CNA 原文
          </a>
        </div>
      )}
    </>
  );
}

export function DisasterAlertPanel({ props }: { props: Record<string, unknown> }) {
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
        <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {event}
        </div>
        <div style={{
          marginLeft: "auto", fontSize: 10, padding: "1px 6px", borderRadius: 3,
          background: color, color: "#fff", fontWeight: 600,
        }}>
          {sevLabel[severity] ?? severity}
        </div>
      </div>
      {headline && <Row label="標題" value={headline} />}
      {areaDesc && (
        <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: 11, lineHeight: 1.5 }}>
          <span style={{ color: "rgba(255,255,255,0.45)", flexShrink: 0, minWidth: 56 }}>影響區域</span>
          <div
            style={{
              color: "rgba(255,255,255,0.85)",
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
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title || (EVENT_TYPE_LABELS[eventType] ?? "路況事件")}
        </div>
        <div style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: color, color: "#fff", fontWeight: 600, flexShrink: 0 }}>
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
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: "#ef5350", flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.fault_name ?? "Unknown Fault")}
        </div>
      </div>
      <Row label="編號" value={String(props.fault_id ?? "")} />
      <Row label="全稱" value={String(props.name ?? "")} />
    </>
  );
}
