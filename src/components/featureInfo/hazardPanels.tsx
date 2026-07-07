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
