import { Row } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import {
  LIGHTNING_TYPE_LABELS,
  lightningTypeColor,
} from "../../data/lightningLoader";
import {
  classifyNuclearDose, nuclearDoseColor,
  NUCLEAR_LEVEL_LABELS, NUCLEAR_DOSE_THRESHOLDS,
} from "../../data/nuclearLoader";
import { intensityColor, intensityLabel } from "../../data/earthquakeReplayTypes";
import { mountainRescueCauseColor, mountainRescueCauseLabel } from "../../data/mountainSafetyTypes";
import { FONT_SIZE } from "../../styles/designTokens";

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
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

/** 發生時間強制以台灣時區顯示（不依賴瀏覽器本地時區） */
function fmtTimeTaipei(ts: unknown): string {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return "—";
  return new Date(ts * 1000).toLocaleString("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Taipei",
  });
}

function magBadgeColor(mag: number): string {
  if (mag >= 7) return "#dc2626";
  if (mag >= 6) return "#ef4444";
  if (mag >= 5) return "#f97316";
  if (mag >= 4) return "#facc15";
  return "#94a3b8";
}

// 與 useEarthquakeLayer 的 COLOR_EXPR 同步（依深度分級）
function depthColor(depth: number): string {
  if (depth <= 30) return "#ff3b30";
  if (depth <= 70) return "#ff9500";
  if (depth <= 150) return "#ffcc00";
  if (depth <= 300) return "#42a5f5";
  return "#3949ab";
}

/**
 * 山域意外事故救援案件 popup。
 * 出動人次分 6 欄（消防在地／消防支援／警察／國家公園／林業／民間），
 * 直升機・搜救犬・無人機是「架次／次數」跟人次分開列，不要加總。
 */
export function MountainRescuePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const cause = props.cause == null ? null : String(props.cause);
  const color = mountainRescueCauseColor(cause);
  const int0 = (v: unknown) => (typeof v === "number" ? v : 0);
  const persons =
    int0(props.fire_local_persons) + int0(props.fire_support_persons) + int0(props.police_persons) +
    int0(props.npark_persons) + int0(props.forestry_persons) + int0(props.civilian_persons);
  const sorties = int0(props.mnd_heli_sorties) + int0(props.nasc_heli_sorties);
  const str = (v: unknown) => (v == null || v === "" ? null : String(v));
  const area = str(props.mountain_area);
  const entry = str(props.entry_point);
  const dest = str(props.destination);
  const deaths = int0(props.deaths);
  const missing = int0(props.missing);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 5, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {mountainRescueCauseLabel(cause)}
        </div>
      </div>
      <Row label="案件編號" value={String(props.case_id ?? "—")} />
      <Row label="年份" value={props.year == null ? "—" : String(props.year)} />
      <Row label="縣市" value={String(props.city ?? "—")} />
      {area ? <Row label="山域" value={area} /> : null}
      {entry ? <Row label="入山口" value={entry} /> : null}
      {dest ? <Row label="目的地" value={dest} /> : null}
      <Row label="報案時間" value={String(props.reported_at ?? "—")} />
      <Row label="結案時間" value={String(props.closed_at ?? "—")} />
      {props.over_48hr ? <Row label="逾 48 小時" value={String(props.over_48hr)} color={props.over_48hr === "是" ? "#f97316" : undefined} /> : null}
      <Row label="出動人次" value={`${persons} 人`} />
      {sorties > 0 ? <Row label="直升機" value={`${sorties} 架次`} /> : null}
      {int0(props.sar_dog_times) > 0 ? <Row label="搜救犬" value={`${int0(props.sar_dog_times)} 次`} /> : null}
      {int0(props.drone_sorties) > 0 ? <Row label="無人機" value={`${int0(props.drone_sorties)} 架次`} /> : null}
      <Row label="獲救" value={`${int0(props.rescued)} 人`} />
      {deaths > 0 ? <Row label="死亡" value={`${deaths} 人`} color="#ff2d2d" /> : null}
      {missing > 0 ? <Row label="失蹤" value={`${missing} 人`} color="#f97316" /> : null}
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
        消防署山域意外事故救援案件（2019-2024）
      </div>
    </div>
  );
}

export function LightningStrikePanel({ props }: { props: Record<string, unknown> }) {
  const t = typeof props.strike_type === "number" ? props.strike_type : null;
  const intensity = typeof props.intensity_ka === "number" ? props.intensity_ka : null;
  const color = lightningTypeColor(t);
  return (
    <div>
      <Row label="類型" value={t != null ? (LIGHTNING_TYPE_LABELS[t] ?? "—") : "—"} color={color} />
      <Row
        label="強度"
        value={intensity != null ? `${intensity.toFixed(1)} kA` : "—"}
        color={intensity != null && Math.abs(intensity) > 30 ? "#ef4444" : undefined}
      />
      <Row label="擊發時刻" value={fmtTime(props.strike_ts)} />
      <Row label="距現在" value={fmtAge(props.strike_ts)} />
    </div>
  );
}

export function NuclearStationPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const dose = typeof props.dose_usvh === "number" ? props.dose_usvh : null;
  const isStale = props.is_stale === true;
  const level = classifyNuclearDose(dose, isStale);
  const color = nuclearDoseColor(dose, isStale);
  return (
    <div>
      <Row label="站名" value={String(props.station_name ?? "—")} />
      <Row label="站號" value={String(props.station_id ?? "—")} />
      <Row
        label="即時劑量"
        value={dose != null ? `${dose.toFixed(3)} µSv/h` : "—"}
        color={color}
      />
      <Row label="分級" value={NUCLEAR_LEVEL_LABELS[level]} color={color} />
      <Row label="觀測時間" value={fmtTime(props.observed_ts)} />
      <Row label="距現在" value={fmtAge(props.observed_ts)} />
      {isStale && (
        <div
          style={{
            marginTop: 8, padding: "6px 8px", borderRadius: 6,
            background: "rgba(107,114,128,0.15)",
            border: `1px solid ${t.border}`,
            fontSize: 11, lineHeight: 1.4, color: t.textDim,
          }}
        >
          ⚠️ 感測器已離線（is_stale），上方劑量值為最後可信回報，<br />
          <b>不代表現場狀況</b>。高值 + stale = 感測器故障，<b>非核災</b>。
        </div>
      )}
      {!isStale && level === "alarm" && (
        <div
          style={{
            marginTop: 8, padding: "6px 8px", borderRadius: 6,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.4)",
            fontSize: 11, lineHeight: 1.4, color: "#fca5a5",
          }}
        >
          ⚠️ 已達 AEC 警戒閾值（&gt; {NUCLEAR_DOSE_THRESHOLDS.warning} µSv/h），建議交叉確認原能會即時頁面。
        </div>
      )}
    </div>
  );
}

/**
 * 本土地震（CWA earthquake_events，useEarthquakeLayer 的 pre/post 兩態）。
 * ripple 動畫圈不接 click（見 useMapInteraction GIS_LAYERS 註解）。
 */
export function EarthquakePanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const mag = typeof props.magnitude === "number" ? props.magnitude : null;
  const depth = typeof props.depth_km === "number" ? props.depth_km : null;
  const magColor = mag != null ? magBadgeColor(mag) : t.textDim;
  const dColor = depth != null ? depthColor(depth) : t.textDim;
  return (
    <div>
      <Row label="規模 (M)" value={mag != null ? `M ${mag.toFixed(1)}` : "—"} color={magColor} />
      <Row label="深度" value={depth != null ? `${depth.toFixed(1)} km` : "—"} color={dColor} />
      <Row label="發生時間" value={fmtTimeTaipei(props.occurred_ts)} />
      <Row label="震央位置" value={String(props.location_desc || "—")} />
      <Row label="報告類型" value={String(props.report_type || "—")} />
    </div>
  );
}

/**
 * 地震回放 — 強震測站（earthquake_station_obs）。
 * 震度色階與網格 / 鄉鎮面量圖同源（earthquakeReplayTypes.CWA_INTENSITY_BANDS）。
 */
export function EarthquakeReplayStationPanel({ props }: { props: Record<string, unknown> }) {
  const iv = typeof props.intensity_value === "number" ? props.intensity_value : null;
  const pga = typeof props.pga_int === "number" ? props.pga_int : null;
  const dist = typeof props.epicenter_distance_km === "number" ? props.epicenter_distance_km : null;
  return (
    <div>
      <Row label="測站" value={String(props.station_id ?? "—")} />
      <Row
        label="震度"
        value={iv != null ? intensityLabel(iv) : "—"}
        color={iv != null ? intensityColor(iv) : undefined}
      />
      <Row label="PGA" value={pga != null ? `${pga.toFixed(1)} gal` : "—"} />
      <Row label="震央距" value={dist != null ? `${dist.toFixed(1)} km` : "—"} />
      <Row
        label="S 波抵達"
        value={dist != null ? `震後 ${(dist / 3.5).toFixed(1)} 秒` : "—"}
      />
    </div>
  );
}

/**
 * 地震回放 — 鄉鎮震度（earthquake_town_intensity join 鄉鎮 polygon）。
 * 震度值來自 feature-state `eqi`（PMTiles 幾何本身沒有震度屬性）。
 */
export function EarthquakeReplayTownPanel({ props }: { props: Record<string, unknown> }) {
  const iv = typeof props.eqi === "number" ? props.eqi : null;
  return (
    <div>
      <Row label="鄉鎮市區" value={String(props.TOWNNAME ?? "—")} />
      <Row label="縣市" value={String(props.COUNTYNAME ?? "—")} />
      <Row
        label="震度"
        value={iv != null ? intensityLabel(iv) : "—"}
        color={iv != null ? intensityColor(iv) : undefined}
      />
      <Row label="來源" value="CWA 鄉鎮震度報告" />
    </div>
  );
}
