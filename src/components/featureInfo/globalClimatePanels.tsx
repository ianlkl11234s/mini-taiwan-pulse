import { Row } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { parseGfwHourlyGridVessels, type GfwHourlyGridVessel } from "../../data/gfwHourlyGridTypes";
import { globalEventCategoryLabel, globalEventSeverityLabel } from "../../data/globalEventsTypes";

function fmtAge(ts: unknown): string {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return "—";
  const now = Math.floor(Date.now() / 1000);
  const dt = now - ts;
  if (dt < 60) return `${dt}s 前`;
  if (dt < 3600) return `${Math.floor(dt / 60)} 分鐘前`;
  if (dt < 86400) return `${Math.floor(dt / 3600)} 小時前`;
  return `${Math.floor(dt / 86400)} 天前`;
}

function fmtTime(ts: unknown): string {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleString("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    hour12: false,
  });
}

// 與 useEarthquakesGlobalLayer 的 COLOR_EXPR 同步
function depthColor(depth: number): string {
  if (depth <= 30) return "#dc2626";
  if (depth <= 70) return "#f97316";
  if (depth <= 150) return "#facc15";
  if (depth <= 300) return "#38bdf8";
  return "#3949ab";
}

function magBadgeColor(mag: number): string {
  if (mag >= 7) return "#dc2626";
  if (mag >= 6) return "#ef4444";
  if (mag >= 5) return "#f97316";
  if (mag >= 4) return "#facc15";
  return "#94a3b8";
}

export function EarthquakeGlobalPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const mag = typeof props.mag === "number" ? props.mag : null;
  const depth = typeof props.depth_km === "number" ? props.depth_km : null;
  const magColor = mag != null ? magBadgeColor(mag) : t.textDim;
  const dColor = depth != null ? depthColor(depth) : t.textDim;
  return (
    <div>
      <Row label="地點" value={String(props.place ?? "—")} />
      <Row
        label="規模 (M)"
        value={mag != null ? `M ${mag.toFixed(1)}` : "—"}
        color={magColor}
      />
      <Row
        label="深度"
        value={depth != null ? `${depth.toFixed(1)} km` : "—"}
        color={dColor}
      />
      <Row label="發生時刻" value={fmtTime(props.observed_ts)} />
      <Row label="距現在" value={fmtAge(props.observed_ts)} />
      <Row label="USGS ID" value={String(props.event_id ?? "—")} />
    </div>
  );
}

export function TyphoonTrackPanel({ props }: { props: Record<string, unknown> }) {
  const pointType = String(props.point_type ?? "");
  const isFcst = pointType === "forecast";
  const wind = typeof props.max_wind_kt === "number" ? props.max_wind_kt : null;
  const pressure = typeof props.center_pressure === "number" ? props.center_pressure : null;
  const adv = typeof props.advisory_number === "number" ? props.advisory_number : null;
  const sourceLabel = String(props.source ?? "—").toUpperCase();
  return (
    <div>
      <Row
        label="名稱"
        value={`${String(props.name_en ?? "")}${
          props.name_local ? ` (${String(props.name_local)})` : ""
        }`}
      />
      <Row label="編號" value={String(props.storm_id ?? "—")} />
      <Row
        label="類型"
        value={isFcst ? "預報位置 Forecast" : "觀測位置 Observed"}
        color={isFcst ? "#c084fc" : "#a855f7"}
      />
      <Row label="資料源" value={sourceLabel} />
      {adv != null && <Row label="Advisory" value={`#${adv}`} />}
      <Row
        label="近中心最大風"
        value={wind != null ? `${wind.toFixed(0)} kt（約 ${(wind * 1.852).toFixed(0)} km/h）` : "—"}
        color={wind != null && wind >= 64 ? "#dc2626" : undefined}
      />
      <Row
        label="中心氣壓"
        value={pressure != null ? `${pressure.toFixed(0)} hPa` : "—"}
        color={pressure != null && pressure <= 970 ? "#ef4444" : undefined}
      />
      <Row label="位置時刻" value={fmtTime(props.valid_ts)} />
      <Row label="距現在" value={fmtAge(props.valid_ts)} />
    </div>
  );
}

// ── 🌍 世界 World：全球垃圾殘骸（Outerview）──

export function WorldTrashDebrisPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <div>
      <Row label="區域 Region" value={String(props.region ?? "—")} />
      <Row label="ID" value={String(props.id ?? "—")} />
      <Row label="資料" value="Outerview（CC-BY-4.0）" />
      <Row label="說明" value="點密度反映 Mapillary 街景覆蓋，非真實垃圾分佈" />
    </div>
  );
}

function fmtGlobalEventTime(value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

export function GlobalEventPanel({ props }: { props: Record<string, unknown> }) {
  const confidence = typeof props.confidence === "number" && Number.isFinite(props.confidence)
    ? `${Math.round(props.confidence * 100)}%`
    : "—";
  const placeParts = [props.place_name, props.admin2, props.admin1, props.country_code]
    .filter((value) => typeof value === "string" && value.length > 0);
  return (
    <div>
      <Row label="事件" value={String(props.title_zh_tw ?? "—")} />
      <Row label="摘要" value={String(props.summary_zh_tw ?? "—")} />
      <Row label="分類" value={globalEventCategoryLabel(props.category)} />
      <Row label="嚴重度" value={globalEventSeverityLabel(props.severity)} />
      <Row label="信心" value={confidence} />
      <Row label="地點" value={placeParts.length > 0 ? placeParts.join(" · ") : "—"} />
      <Row label="事件時間" value={fmtGlobalEventTime(props.valid_from)} />
      <Row label="發布時間" value={fmtGlobalEventTime(props.published_at)} />
      <Row label="位置精度" value={String(props.precision ?? "—")} />
    </div>
  );
}

function fmtMaritimeTime(value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

function fmtMaritimeUtcTime(value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("zh-TW", {
    timeZone: "UTC",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function GfwMemberDetails({ vessel }: { vessel: GfwHourlyGridVessel }) {
  const t = useFeatureTheme();
  const hasFullDetail = vessel.hours !== undefined;
  return (
    <div style={{ color: t.textDim, fontSize: 10, lineHeight: 1.5 }}>
      ID {vessel.vesselId} · MMSI {vessel.mmsi ?? "—"}<br />
      {vessel.vesselType ?? "類型未知"} · {vessel.flag ?? "旗國未知"}
      {hasFullDetail && <>
        <br />IMO {vessel.imo ?? "—"} · Callsign {vessel.callsign ?? "—"}
        <br />Gear {vessel.geartype ?? "—"} · Dataset {vessel.dataset ?? "—"}
        <br />格內小時 {vessel.hours?.toLocaleString("zh-TW", { maximumFractionDigits: 4 }) ?? "—"}
        <br />進入 {fmtMaritimeUtcTime(vessel.entryTimestamp)} · 離開 {fmtMaritimeUtcTime(vessel.exitTimestamp)}
        <br />首傳 {fmtMaritimeUtcTime(vessel.firstTransmissionDate)} · 末傳 {fmtMaritimeUtcTime(vessel.lastTransmissionDate)}
      </>}
    </div>
  );
}

export function AisstreamVesselPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <div>
      <Row label="船名" value={String(props.ship_name ?? "—")} />
      <Row label="MMSI" value={String(props.mmsi ?? "—")} />
      <Row label="船舶類型" value={String(props.ship_type ?? "—")} />
      <Row label="航速 / 航向" value={`${props.speed_knots ?? "—"} kt / ${props.course_over_ground ?? "—"}°`} />
      <Row label="目的地（自報）" value={String(props.destination ?? "—")} />
      <Row label="觀測時間" value={fmtMaritimeTime(props.observed_at)} />
      <Row label="訊息年齡" value={props.age_seconds == null ? "—" : `${Number(props.age_seconds).toFixed(0)} 秒`} />
      <Row label="資料源" value="AISStream（AIS message feed）" />
    </div>
  );
}

export function GfwVesselPresencePanel({ props }: { props: Record<string, unknown> }) {
  return (
    <div>
      <Row label="船名" value={String(props.ship_name ?? "—")} />
      <Row label="Vessel ID" value={String(props.vessel_id ?? "—")} />
      <Row label="MMSI / 旗國" value={`${props.mmsi ?? "—"} / ${props.flag ?? "—"}`} />
      <Row label="船舶類型" value={String(props.vessel_type ?? "—")} />
      <Row label="快照日期" value={String(props.source_snapshot_date ?? "—")} />
      <Row label="觀測時間" value={fmtMaritimeTime(props.observed_at)} />
      <Row label="資料年齡" value={props.age_hours == null ? "—" : `${Number(props.age_hours).toFixed(1)} 小時`} />
      <Row label="資料源" value="Global Fishing Watch（daily vessel presence；非即時）" />
    </div>
  );
}

export function GfwHourlyGridPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const vessels = parseGfwHourlyGridVessels(props.vessels_json) ?? [];
  const expectedCount = Number(props.vessel_count);
  const detailStatus = props.detail_status;
  return (
    <div>
      <Row label="UTC 小時" value={fmtMaritimeUtcTime(props.observed_at)} />
      {typeof props.dominant_observed_at === "string" && <Row label="點擊主導小時" value={fmtMaritimeUtcTime(props.dominant_observed_at)} />}
      <Row label="格內船數" value={Number.isFinite(expectedCount) ? `${expectedCount} 艘` : "—"} />
      <Row label="格網中心" value={`${props.center_lon ?? props.grid_lon ?? "—"}, ${props.center_lat ?? props.grid_lat ?? "—"}`} />
      {typeof props.cell_id === "string" && <Row label="網格 ID" value={props.cell_id} />}
      <Row label="位置語意" value={props.geometry_semantics === "globally_aligned_0_1_degree_cell" ? "GFW HIGH 本地聚合 0.1° 格網" : "GFW HIGH 格網中心（非原始 AIS 精確座標）"} />
      {props.geometry_semantics === "inferred_0_01_degree_footprint" && <Row label="幾何範圍" value="推定 0.01° 格網 footprint" />}
      {props.geometry_semantics === "globally_aligned_0_1_degree_cell" && <Row label="幾何範圍" value="全球對齊 0.1° 格網 footprint（非原始 AIS 精確位置）" />}
      {Number(props.full_fidelity) === 1 && <Row label="完整性" value="已驗證 full fidelity" />}
      {detailStatus === "loading" && <Row label="完整清單" value="正在驗證並載入全部船舶…" />}
      {detailStatus === "error" && <Row label="完整清單" value={String(props.detail_error ?? "驗證失敗，未顯示部分清單")} color="#f87171" />}
      <div style={{ marginTop: 8, fontSize: 11, color: t.textDim, letterSpacing: 0.6 }}>
        格內船舶 {vessels.length.toLocaleString()} 艘
      </div>
      <div style={{ maxHeight: 220, overflowY: "auto", marginTop: 4, paddingRight: 4 }}>
        {vessels.map((vessel, index) => (
          <div
            key={`${vessel.vesselId}-${index}`}
            style={{ padding: "6px 0", borderTop: `1px solid ${t.border}` }}
          >
            <div style={{ color: t.textDefault, fontSize: 12 }}>
              {vessel.shipName || vessel.vesselId}
            </div>
            <GfwMemberDetails vessel={vessel} />
          </div>
        ))}
        {vessels.length === 0 && detailStatus !== "loading" && (
          <div style={{ color: t.textDim, fontSize: 11, padding: "6px 0" }}>{detailStatus === "error" ? "不顯示未驗證的部分船舶" : "船舶清單無法解析"}</div>
        )}
      </div>
      <Row label="資料源" value={`Global Fishing Watch ${String(props.source_dataset ?? "public-global-presence")}`} />
      <div style={{ marginTop: 7, fontSize: 10, color: t.textDim, lineHeight: 1.5 }}>
        非即時、格網中心近似資料 · <a href={String(props.attribution_href ?? "https://globalfishingwatch.org/")} target="_blank" rel="noreferrer" style={{ color: t.link }}>Powered by {String(props.attribution_label ?? "Global Fishing Watch")}</a>
      </div>
    </div>
  );
}

export function GfwHourlyTrackPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const vessels = parseGfwHourlyGridVessels(props.vessels_json);
  const shipName = String(props.ship_name ?? "").trim();
  const vesselId = String(props.vessel_id ?? "—");
  const count = Number(props.point_count);
  const vesselCount = Number(props.vessel_count);
  const interpolated = Number(props.interpolated) === 1;
  const grouped = vessels && vessels.length > 1;
  const singleVessel = vessels?.length === 1 ? vessels[0] : null;
  const detailStatus = props.detail_status;
  return (
    <div>
      {!grouped && (singleVessel ? <>
        <Row label="船名" value={singleVessel.shipName || "（無船名）"} />
        <GfwMemberDetails vessel={singleVessel} />
      </> : <>
        <Row label="船名" value={shipName || "（無船名）"} />
        <Row label="Vessel ID" value={vesselId} />
        <Row label="MMSI / 旗國" value={`${props.mmsi ?? "—"} / ${props.flag ?? "—"}`} />
        <Row label="GFW 原始船種" value={String(props.vessel_type ?? "—")} />
      </>)}
      <Row label={grouped ? "同座標船舶" : "視覺分類"} value={grouped && Number.isFinite(vesselCount) ? `${vesselCount} 艘` : String(props.ship_type_label ?? "其他 Other")} />
      {Number(props.mixed_type) === 1 && <Row label="船種" value="混合船種 Mixed" />}
      <Row label="拖尾起點（UTC）" value={fmtMaritimeUtcTime(props.start_at)} />
      <Row label="拖尾終點（UTC）" value={fmtMaritimeUtcTime(props.end_at)} />
      <Row
        label="時間軸位置（UTC）"
        value={`${fmtMaritimeUtcTime(props.selected_time)}${interpolated ? "（線性內插）" : "（實際觀測）"}`}
      />
      <Row label="拖尾點數" value={Number.isFinite(count) ? `${count} 點` : "—"} />
      <Row label="資料源" value={`Global Fishing Watch ${String(props.source_dataset ?? "public-global-presence")}`} />
      {Number(props.full_fidelity) === 1 && <Row label="完整性" value="已驗證 full fidelity" />}
      {detailStatus === "loading" && <Row label="航段詳情" value="正在驗證完整航段…" />}
      {detailStatus === "error" && <Row label="航段詳情" value={String(props.detail_error ?? "驗證失敗，未顯示部分詳情")} color="#f87171" />}
      {grouped && (
        <div style={{ maxHeight: 220, overflowY: "auto", marginTop: 6, paddingRight: 4 }}>
          {(vessels ?? []).map((vessel, index) => (
            <div key={`${vessel.vesselId}-${index}`} style={{ padding: "6px 0", borderTop: `1px solid ${t.border}` }}>
              <div style={{ color: t.textDefault, fontSize: 12 }}>{vessel.shipName || vessel.vesselId}</div>
              <GfwMemberDetails vessel={vessel} />
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 7, fontSize: 10, color: t.textDim, lineHeight: 1.5 }}>
        每個頂點代表該船每小時所在的 GFW HIGH 格網中心，不是原始 AIS 精確位置；
        時間軸位置只在同一 segment 的相鄰觀測間做線性內插。
        缺訊與不合理跳點已由上游切段，前端不跨段補線。
        {" "}非即時近似資料 · <a href={String(props.attribution_href ?? "https://globalfishingwatch.org/")} target="_blank" rel="noreferrer" style={{ color: t.link }}>Powered by {String(props.attribution_label ?? "Global Fishing Watch")}</a>
      </div>
    </div>
  );
}

export function GfwFishingEffortPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const hours = typeof props.apparent_fishing_hours === "number" && Number.isFinite(props.apparent_fishing_hours) && props.apparent_fishing_hours >= 0
    ? props.apparent_fishing_hours : null;
  const components = typeof props.component_count === "number" && Number.isInteger(props.component_count) && props.component_count >= 1
    ? props.component_count : null;
  let facets: Record<string, unknown>[] = [];
  let facetCount: number | null = null;
  if (typeof props.aggregation_facets_json === "string") {
    try {
      const parsed: unknown = JSON.parse(props.aggregation_facets_json);
      facets = Array.isArray(parsed) && parsed.every((item) => item !== null && typeof item === "object" && !Array.isArray(item))
        ? parsed as Record<string, unknown>[] : [];
      facetCount = facets.length > 0 ? facets.length : null;
    } catch {
      facetCount = null;
    }
  }
  const unavailable = (value: unknown): string => value == null || value === "" ? "未提供" : String(value);
  const attributionHref = typeof props.attribution_href === "string" && props.attribution_href ? props.attribution_href : null;
  return (
    <div>
      <Row label="選定 UTC 日" value={unavailable(props.selected_utc_date ?? props.date)} />
      <Row label="捕撈活動" value={hours != null ? `${hours.toLocaleString("zh-TW", { maximumFractionDigits: 2 })} ${unavailable(props.unit)}` : "未提供"} />
      <Row label="彙整 components" value={components != null ? components.toLocaleString("zh-TW") : "未提供"} />
      {facetCount != null && <Row label="Aggregation facets" value={`${facetCount.toLocaleString("zh-TW")} 組`} />}
      {facets.length > 0 && (
        <details style={{ marginTop: 7, color: t.textDim }}>
          <summary style={{ cursor: "pointer", fontSize: 10 }}>查看完整 aggregation facets</summary>
          <pre style={{ maxHeight: 180, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 9, lineHeight: 1.35 }}>
            {JSON.stringify(facets, null, 2)}
          </pre>
        </details>
      )}
      <Row label="資料版本" value={unavailable(props.dataset_version ?? props.resolved_dataset_version)} />
      <Row label="指標" value={unavailable(props.metric_semantics ?? props.metric)} />
      <Row label="最新可用日期" value={unavailable(props.latest_available_date)} />
      <Row label="Finalization" value={unavailable(props.finalization_status)} />
      <Row label="Revision" value={unavailable(props.revision_semantics)} />
      <Row label="資料源" value={unavailable(props.attribution)} />
      <div style={{ marginTop: 7, fontSize: 10, lineHeight: 1.5, color: t.textDim }}>
        {unavailable(props.caveat)}
        {attributionHref && <> · <a href={attributionHref} target="_blank" rel="noreferrer" style={{ color: t.link }}>GFW attribution</a></>}
      </div>
    </div>
  );
}

export function GfwDarkVesselPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const detections = Number(props.detections);
  return (
    <div>
      <Row label="觀測時間（UTC）" value={fmtMaritimeUtcTime(props.observed_at)} />
      <Row label="SAR detections" value={Number.isFinite(detections) ? `${detections} 筆` : "—"} />
      <Row label="位置語意" value="GFW HIGH 格網中心（非精確 SAR 座標）" />
      <Row label="匹配狀態" value="SAR 偵測未與 AIS 匹配" />
      <Row label="資料源" value={`Global Fishing Watch ${String(props.source_dataset ?? "—")}`} />
      <div style={{ marginTop: 8, padding: "7px 8px", border: `1px solid ${t.border}`, borderRadius: 6, color: t.textDim, fontSize: 10, lineHeight: 1.5 }}>
        SAR 偵測未與 AIS 匹配，不代表違法、不是確認暗船，也不能據此認定船舶刻意關閉 AIS。
        {props.interpretation_note ? ` ${String(props.interpretation_note)}` : ""}
      </div>
    </div>
  );
}

// ── 氣候場 click 讀值（風場 / 海流 UV 前端取樣）──

const COMPASS_16 = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

function compassLabel(deg: number): string {
  return COMPASS_16[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]!;
}

/** 風「來向」（氣象慣例）：u 東向、v 北向分量 → 風從哪個方位吹來。 */
function windDirFrom(u: number, v: number): number {
  return ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360;
}

/** 流「去向」（海洋慣例）：海流往哪個方位流。 */
function currentDirTo(u: number, v: number): number {
  return ((Math.atan2(u, v) * 180) / Math.PI + 360) % 360;
}

function fmtValidAt(validAt: unknown): string {
  if (typeof validAt !== "string" || !validAt) return "—";
  const d = new Date(validAt);
  if (Number.isNaN(d.getTime())) return validAt;
  return d.toLocaleString("zh-TW", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

interface FieldSampleProps {
  u: number;
  v: number;
  speed: number;
  valid_at: string | null;
}

function asFieldSample(raw: unknown): FieldSampleProps | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.u !== "number" || typeof o.v !== "number" || typeof o.speed !== "number") return null;
  return { u: o.u, v: o.v, speed: o.speed, valid_at: typeof o.valid_at === "string" ? o.valid_at : null };
}

export function ClimateFieldPanel({ props }: { props: Record<string, unknown> }) {
  const wind = asFieldSample(props.wind);
  const currents = asFieldSample(props.currents);
  return (
    <div>
      {wind && (
        <>
          <Row label="風速" value={`${wind.speed.toFixed(1)} m/s（${(wind.speed * 3.6).toFixed(0)} km/h）`} />
          <Row
            label="風向"
            value={`${windDirFrom(wind.u, wind.v).toFixed(0)}°（${compassLabel(windDirFrom(wind.u, wind.v))} 來風）`}
          />
          <Row label="風場時刻" value={fmtValidAt(wind.valid_at)} />
        </>
      )}
      {currents && (
        <>
          <Row label="流速" value={`${currents.speed.toFixed(2)} m/s（${(currents.speed * 1.944).toFixed(1)} kt）`} />
          <Row
            label="流向"
            value={`${currentDirTo(currents.u, currents.v).toFixed(0)}°（往 ${compassLabel(currentDirTo(currents.u, currents.v))}）`}
          />
          <Row label="海流時刻" value={fmtValidAt(currents.valid_at)} />
        </>
      )}
    </div>
  );
}
