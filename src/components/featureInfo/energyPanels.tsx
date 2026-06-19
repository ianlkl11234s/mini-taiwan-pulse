import { useEffect, useState } from "react";
import { Row } from "./shared";
import {
  fuelColorOf,
  FUEL_FALLBACK_COLOR,
  fetchPlantOutput24h,
  type PlantOutputPoint,
} from "../../data/energyLoader";
import { Sparkline } from "../intel/monitor/PressureRing";
import { COLORS, FONT_DATA, FONT_SIZE } from "../../styles/designTokens";

function fmtMW(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n >= 1000 ? `${(n / 1000).toFixed(1)} 萬 kW` : `${n.toFixed(1)} MW`;
}

function fmtPct01(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(0)}%`;
}

function fmtHHmm(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 24h 機組出力時序 sparkline + 數據摘要 */
function PlantOutput24h({ plantName, color }: { plantName: string; color: string }) {
  const [points, setPoints] = useState<PlantOutputPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPoints(null);
    setError(null);
    fetchPlantOutput24h(plantName)
      .then((p) => { if (!cancelled) setPoints(p); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [plantName]);

  if (error) {
    return (
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.sm, color: COLORS.textMuted }}>
        24h 時序載入失敗
      </div>
    );
  }
  if (!points) {
    return (
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.sm, color: COLORS.textMuted }}>
        24h 時序載入中…
      </div>
    );
  }
  if (points.length < 2) {
    return (
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.sm, color: COLORS.textMuted }}>
        24h 內無機組資料
      </div>
    );
  }

  const series = points.map((p) => Number(p.output_mw ?? 0));
  const max = Math.max(...series);
  const min = Math.min(...series);
  const first = series[0]!;
  const last = series[series.length - 1]!;
  const delta = last - first;
  const deltaSign = delta > 0 ? "▲" : delta < 0 ? "▼" : "·";
  const deltaColor = delta > 0 ? "#ef4444" : delta < 0 ? "#22c55e" : COLORS.textMuted;

  return (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed rgba(255,255,255,0.12)" }}>
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: FONT_SIZE.sm, color: COLORS.textMuted, marginBottom: 4,
        }}
      >
        <span>24h 出力（MW）</span>
        <span style={{ color: deltaColor, fontFamily: FONT_DATA }}>
          {deltaSign} {Math.abs(delta).toFixed(0)}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Sparkline data={series} color={color} w={160} h={28} />
      </div>
      <div
        style={{
          display: "flex", justifyContent: "space-between",
          fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textDim,
          marginTop: 2,
        }}
      >
        <span>{fmtHHmm(points[0]!.ts)}</span>
        <span>min {min.toFixed(0)} / max {max.toFixed(0)}</span>
        <span>{fmtHHmm(points[points.length - 1]!.ts)}</span>
      </div>
    </div>
  );
}

export function PowerPlantPanel({ props }: { props: Record<string, unknown> }) {
  const fuel = String(props.fuel_type ?? "");
  const fuelColor = fuel ? fuelColorOf(fuel) : FUEL_FALLBACK_COLOR;
  const sourceTable = String(props.source_table ?? "");
  const isRetired = props.is_retired === true || props.status === "retired";
  const statusNote = String(props.status_note ?? "");
  const plantName = String(props.name ?? "");
  const hasOutput = !isRetired && props.output_mw != null;
  // 不再卡 source — RPC 會用 plant_name 前綴去 JOIN realtime.power_generation_unit；
  // 重疊的 osm_power_plants 興達/大潭 等同名廠也能匹配；RPC 回空時自然顯示「無資料」
  const canShowSparkline = !isRetired && plantName.length >= 2;
  return (
    <div>
      <Row label="電廠" value={plantName} />
      <Row label="燃料" value={fuel || "—"} color={fuelColor} />
      <Row label="裝置容量" value={fmtMW(props.capacity_mw)} />
      {isRetired && (
        <Row
          label="狀態"
          value={statusNote || "已除役"}
          color="#ef4444"
        />
      )}
      {hasOutput && (
        <>
          <Row label="即時出力" value={fmtMW(props.output_mw)} />
          <Row label="負載率" value={fmtPct01(props.output_load_rate)} />
        </>
      )}
      <Row label="資料源" value={sourceTable || "—"} />
      {canShowSparkline && <PlantOutput24h plantName={plantName} color={fuelColor} />}
    </div>
  );
}

export function OsmSubstationPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <div>
      <Row label="名稱" value={String(props.name ?? "(無名)")} />
      <Row label="類型" value={String(props.substation_type ?? "—")} />
      <Row label="電壓" value={String(props.voltage ?? "—")} />
      <Row label="營運單位" value={String(props.operator ?? "—")} />
      <Row label="OSM ID" value={String(props.osm_id ?? "")} />
    </div>
  );
}

function fmtVoltageKv(voltage: string | null | undefined): string {
  if (!voltage) return "—";
  const parts = String(voltage).split(";").map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => Math.round(n / 1000));
  if (parts.length === 0) return "—";
  return parts.join(" / ") + " kV";
}

export function OsmPowerLinePanel({ props }: { props: Record<string, unknown> }) {
  const lineType = String(props.line_type ?? "");
  const lineTypeLabel =
    lineType === "minor_line" ? "配電線" :
    lineType === "cable" ? "地下電纜" :
    lineType === "line" ? "輸電線" : (lineType || "—");
  return (
    <div>
      <Row label="類型" value={lineTypeLabel} />
      <Row label="電壓" value={fmtVoltageKv(String(props.voltage ?? ""))} />
      <Row label="迴路數" value={String(props.circuits ?? "—")} />
      <Row label="頻率" value={String(props.frequency ?? "—")} />
      <Row label="位置" value={String(props.location ?? "—")} />
      <Row label="營運單位" value={String(props.operator ?? "—")} />
      <Row label="OSM ID" value={String(props.osm_id ?? "")} />
    </div>
  );
}

export function OsmPowerTowerPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <div>
      <Row label="編號" value={String(props.ref ?? "—")} />
      <Row label="電壓" value={fmtVoltageKv(String(props.voltage ?? ""))} />
      <Row label="材質" value={String(props.material ?? "—")} />
      <Row label="型式" value={String(props.design ?? "—")} />
      <Row label="營運單位" value={String(props.operator ?? "—")} />
      <Row label="OSM ID" value={String(props.osm_id ?? "")} />
    </div>
  );
}

export function EvChargingPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <div>
      <Row label="站名" value={String(props.name ?? "")} />
      <Row label="營運" value={String(props.operator_name ?? "—")} />
      <Row label="地址" value={String(props.address ?? "—")} />
      <Row label="充電位" value={String(props.charging_points ?? "—")} />
      <Row label="車位" value={String(props.spaces ?? "—")} />
      <Row label="來源" value={String(props.source ?? "—")} />
    </div>
  );
}
