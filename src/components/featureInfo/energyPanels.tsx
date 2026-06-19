import { useEffect, useState } from "react";
import { Row } from "./shared";
import {
  fuelColorOf,
  FUEL_FALLBACK_COLOR,
  fetchPlantOutput24h,
  fetchFacilityProvenance,
  SUBSTATION_CLASS_COLORS,
  type PlantOutputPoint,
  type FacilityProvenance,
} from "../../data/energyLoader";
import { Sparkline } from "../intel/monitor/PressureRing";
import { COLORS, FONT_DATA, FONT_SIZE } from "../../styles/designTokens";

/**
 * Format MW value:
 *   - ≥ 1000 MW → GW（e.g. 2700 MW → "2.70 GW"）
 *   - ≥ 1 MW    → MW（e.g. 36 MW → "36.0 MW"）
 *   - < 1 MW    → kW（e.g. 0.5 MW → "500 kW"）
 *
 * 修正先前 bug：原 `(n/1000) 萬 kW` 差 100 倍（1 MW = 0.1 萬 kW，
 * 2700 MW 應 = 270 萬 kW 或 2.7 GW，不是 "2.7 萬 kW"）。
 */
function fmtMW(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(2)} GW`;
  if (n >= 1) return `${n.toFixed(1)} MW`;
  return `${Math.round(n * 1000)} kW`;
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
      <FacilityProvenanceBlock facilityId={String(props.facility_id ?? "")} />
    </div>
  );
}

// ── 廠 provenance lazy fetch block（migration 236） ──────────────
const TIER_COLOR: Record<number, string> = {
  0: "#22c55e",  // 即時
  1: "#3b82f6",  // 官方已建
  2: "#0ea5e9",  // 官方補充
  3: "#06b6d4",  // 台電 / 離島
  4: "#a78bfa",  // GEM
  5: "#94a3b8",  // OSM
};

function FacilityProvenanceBlock({ facilityId }: { facilityId: string }) {
  const [pv, setPv] = useState<FacilityProvenance | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!facilityId) { setPv(null); return; }
    let alive = true;
    fetchFacilityProvenance(facilityId)
      .then((d) => { if (alive) setPv(d); })
      .catch((e) => { if (alive) setErr(String(e?.message ?? e)); });
    return () => { alive = false; };
  }, [facilityId]);

  if (!facilityId) return null;
  if (err) return <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: "#f87171" }}>provenance: {err}</div>;
  if (!pv) return null;

  const tierColor = pv.source_priority != null ? (TIER_COLOR[pv.source_priority] ?? COLORS.textDim) : COLORS.textDim;
  const fetched = pv.source_last_refreshed ?? "—";
  const cadence = pv.source_refresh_cadence ?? "—";

  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 8,
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        📋 資料來源
      </div>
      <Row label="層級" value={pv.tier_label ?? "—"} color={tierColor} />
      <Row label="平台" value={pv.source_platform ?? "—"} />
      {pv.source_dataset_name && (
        <Row label="資料集" value={pv.source_dataset_name} />
      )}
      {pv.source_dataset_url && (
        <div style={{ marginTop: 3, fontSize: FONT_SIZE.xs, lineHeight: 1.4 }}>
          <a
            href={pv.source_dataset_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#67e8f9", textDecoration: "underline" }}
          >
            ↗ 開啟原始資料集
          </a>
        </div>
      )}
      <Row label="授權" value={pv.source_license ?? "—"} />
      <Row label="抓取日" value={fetched} />
      <Row label="更新頻率" value={cadence} />
      {pv.agent_intervention_count > 0 && (
        <div
          style={{
            marginTop: 4,
            display: "inline-block",
            padding: "2px 6px",
            borderRadius: 3,
            background: "rgba(167,139,250,0.15)",
            border: "1px solid rgba(167,139,250,0.5)",
            fontSize: FONT_SIZE.xs,
            color: "#c4b5fd",
          }}
          title="Agent 校正中英名稱 / 配對核對 / 缺失盤點次數"
        >
          ⚙ Agent 校正 ×{pv.agent_intervention_count}
        </div>
      )}
    </div>
  );
}

export function OsmSubstationPanel({ props }: { props: Record<string, unknown> }) {
  const cls = String(props.class ?? "OTHER");
  const classLabel = String(props.class_label ?? "未分類");
  const classColor = SUBSTATION_CLASS_COLORS[cls as keyof typeof SUBSTATION_CLASS_COLORS]
                  ?? SUBSTATION_CLASS_COLORS.OTHER;
  return (
    <div>
      <Row label="名稱" value={String(props.name ?? "(無名)")} />
      <Row label="電網層級" value={classLabel} color={classColor} />
      <Row label="OSM type" value={String(props.substation_type ?? "—")} />
      <Row label="電壓" value={fmtVoltageKv(String(props.voltage ?? ""))} />
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

function fmtM(v: unknown, unit = "m"): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(0)} ${unit}` : "—";
}

export function OsmWindTurbinePanel({ props }: { props: Record<string, unknown> }) {
  const offshore = props.is_offshore;
  const offshoreLabel = offshore === true ? "離岸" : offshore === false ? "陸域" : "—";
  return (
    <div>
      <Row label="名稱" value={String(props.name || "(無名)")} />
      <Row label="類型" value={offshoreLabel} color={offshore === true ? "#67e8f9" : offshore === false ? "#2dd4bf" : undefined} />
      <Row label="裝置容量" value={fmtMW(props.capacity_mw)} />
      <Row label="塔高" value={fmtM(props.height_m)} />
      <Row label="葉片直徑" value={fmtM(props.rotor_diameter_m)} />
      <Row label="製造商" value={String(props.manufacturer || "—")} />
      <Row label="型號" value={String(props.model || "—")} />
      <Row label="營運單位" value={String(props.operator || "—")} />
      <Row label="OSM ID" value={String(props.osm_id ?? "")} />
    </div>
  );
}

export function OsmSolarFarmPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <div>
      <Row label="名稱" value={String(props.name || "(無名)")} />
      <Row label="裝置容量" value={fmtMW(props.capacity_mw)} />
      <Row label="模組數" value={String(props.modules ?? "—")} />
      <Row label="面積" value={fmtM(props.area_m2, "m²")} />
      <Row label="方式" value={String(props.plant_method || "—")} />
      <Row label="營運單位" value={String(props.operator || "—")} />
      <Row label="OSM ID" value={String(props.osm_id ?? "")} />
    </div>
  );
}

export function OsmPowerPlantStaticPanel({ props }: { props: Record<string, unknown> }) {
  const src = String(props.plant_source || "");
  return (
    <div>
      <Row label="名稱" value={String(props.name || "(無名)")} />
      <Row label="燃料 / 來源" value={src || "—"} color={fuelColorOf(src)} />
      <Row label="方式" value={String(props.plant_method || "—")} />
      <Row label="發電機" value={String(props.generator_source || "—")} />
      <Row label="裝置容量" value={fmtMW(props.capacity_mw)} />
      <Row label="營運單位" value={String(props.operator || "—")} />
      <Row label="OSM ID" value={String(props.osm_id ?? "")} />
    </div>
  );
}

export function OffshoreWindZonePanel({ props }: { props: Record<string, unknown> }) {
  const dMin = props.depth_min_m, dMax = props.depth_max_m;
  const depthLabel = dMin != null && dMax != null ? `${Number(dMin).toFixed(0)} ~ ${Number(dMax).toFixed(0)} m` : "—";
  return (
    <div>
      <Row label="場址" value={String(props.zone_name || props.zone_code || "—")} />
      <Row label="類型" value={String(props.zone_type || "—")} />
      <Row label="開發階段" value={String(props.phase || "—")} />
      <Row label="開發商" value={String(props.developer || "—")} />
      <Row label="裝置容量" value={fmtMW(props.capacity_mw)} />
      <Row label="得標年" value={String(props.award_year ?? "—")} />
      <Row label="商轉年" value={String(props.cod_year ?? "—")} />
      <Row label="水深" value={depthLabel} />
      <Row label="離岸距離" value={props.distance_km != null ? `${Number(props.distance_km).toFixed(1)} km` : "—"} />
    </div>
  );
}

export function IslandPowerFacilityPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <div>
      <Row label="名稱" value={String(props.name || "—")} />
      <Row label="島嶼" value={String(props.island || "—")} />
      <Row label="設施類型" value={String(props.facility_type || "—")} />
      <Row label="燃料" value={String(props.fuel_type || "—")} />
      <Row label="裝置容量" value={fmtMW(props.capacity_mw)} />
      <Row label="電壓" value={props.voltage_kv != null ? `${props.voltage_kv} kV` : "—"} />
      <Row label="商轉年" value={String(props.online_year ?? "—")} />
      <Row label="營運單位" value={String(props.operator || "—")} />
      <Row label="地址" value={String(props.address || "—")} />
      <Row label="來源" value={String(props.source || "—")} />
    </div>
  );
}

export function FossilFuelFacilityPanel({ props }: { props: Record<string, unknown> }) {
  const ft = String(props.facility_type || "");
  const ftLabel =
    ft === "lng_terminal" ? "LNG 接收站" :
    ft === "oil_refinery" ? "煉油廠" :
    ft === "gas_power_plant" ? "燃氣電廠" : (ft || "—");
  return (
    <div>
      <Row label="名稱" value={String(props.name || "—")} />
      <Row label="類型" value={ftLabel} />
      <Row label="內容物" value={String(props.content || "—")} />
      {props.capacity_tonnes != null && (
        <Row label="容量（噸）" value={`${Number(props.capacity_tonnes).toLocaleString()}`} />
      )}
      {props.capacity_kl != null && (
        <Row label="容量（公秉）" value={`${Number(props.capacity_kl).toLocaleString()}`} />
      )}
      {props.daily_throughput_kbpd != null && (
        <Row label="日處理量" value={`${Number(props.daily_throughput_kbpd).toLocaleString()} kbpd`} />
      )}
      <Row label="商轉年" value={String(props.online_year ?? "—")} />
      <Row label="狀態" value={String(props.status || "—")} />
      <Row label="營運單位" value={String(props.operator || "—")} />
      <Row label="地址" value={String(props.address || "—")} />
    </div>
  );
}

export function GeothermalWellPanel({ props }: { props: Record<string, unknown> }) {
  const reportUrl = String(props.report_url || "");
  const figureUrl = String(props.figure_url || "");
  return (
    <div>
      <Row label="井名 / 區" value={String(props.geothermal_area || "—")} />
      <Row label="報告" value={String(props.report_name || "—")} />
      <Row label="圖件說明" value={String(props.figure_content || "—")} />
      <Row label="縣市" value={String(props.county_code || "—")} />
      {reportUrl && (
        <div style={{ marginTop: 6 }}>
          <a href={reportUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: "#22d3ee", fontSize: FONT_SIZE.sm, textDecoration: "underline" }}>
            開報告 ↗
          </a>
          {figureUrl && (
            <a href={figureUrl} target="_blank" rel="noopener noreferrer"
              style={{ marginLeft: 12, color: "#22d3ee", fontSize: FONT_SIZE.sm, textDecoration: "underline" }}>
              開圖件 ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function RenewablePermitTaipeiPanel({ props }: { props: Record<string, unknown> }) {
  // 政府原始資料未提供 district / installed_at；district 從 address regex 抓 XX區
  const addr = String(props.address || "");
  const districtFromAddr = addr.match(/[一-龥]{1,3}區/)?.[0] ?? "";
  const district = String(props.district || "") || districtFromAddr || "—";
  return (
    <div>
      <Row label="設施名稱" value={String(props.installation_name || "—")} />
      <Row label="類別" value={String(props.category || "—")} />
      <Row label="裝置容量" value={props.capacity_kw != null ? `${Number(props.capacity_kw).toFixed(1)} kW` : "—"} />
      <Row label="行政區" value={district} />
      <Row label="地址" value={addr || "—"} />
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, color: COLORS.textMuted, lineHeight: 1.4 }}>
        ⚠ 政府原始資料位置精度約 1km，呈網格狀；
        設置日 / 行政區欄位上游未提供
      </div>
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
