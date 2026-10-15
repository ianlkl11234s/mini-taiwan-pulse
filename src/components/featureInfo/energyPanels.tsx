import { useEffect, useState } from "react";
import { Row } from "./shared";
import {
  fuelColorOf,
  FUEL_FALLBACK_COLOR,
  fetchPlantOutput24h,
  fetchFacilityProvenance,
  fetchFacilityUnits,
  SUBSTATION_CLASS_COLORS,
  type PlantOutputPoint,
  type FacilityProvenance,
  type FacilityUnit,
} from "../../data/energyLoader";
import { Sparkline } from "../intel/monitor/PressureRing";
import { FONT_DATA, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import type { StaticMessageKey } from "../../i18n/keys";

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
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
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
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.sm, color: t.textMuted }}>
        {tr("popup.energy.outputLoadFailed")}
      </div>
    );
  }
  if (!points) {
    return (
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.sm, color: t.textMuted }}>
        {tr("popup.energy.outputLoading")}
      </div>
    );
  }
  if (points.length < 2) {
    return (
      <div style={{ marginTop: 8, fontSize: FONT_SIZE.sm, color: t.textMuted }}>
        {tr("popup.energy.outputNoData")}
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
  const deltaColor = delta > 0 ? "#ef4444" : delta < 0 ? "#22c55e" : t.textMuted;

  return (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${t.border}` }}>
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: FONT_SIZE.sm, color: t.textMuted, marginBottom: 4,
        }}
      >
        <span>{tr("popup.energy.output24h")}</span>
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
          fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: t.textDim,
          marginTop: 2,
        }}
      >
        <span>{fmtHHmm(points[0]!.ts)}</span>
        <span>{tr("popup.energy.minMax", { min: min.toFixed(0), max: max.toFixed(0) })}</span>
        <span>{fmtHHmm(points[points.length - 1]!.ts)}</span>
      </div>
    </div>
  );
}

export function PowerPlantPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
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
      <Row label={t("popup.energy.plant")} value={plantName} />
      <Row label={t("popup.energy.fuel")} value={fuel || "—"} color={fuelColor} />
      <Row field="installedCapacity" value={fmtMW(props.capacity_mw)} />
      {isRetired && (
        <Row
          field="status"
          value={statusNote || t("popup.energy.retired")}
          color="#ef4444"
        />
      )}
      {hasOutput && (
        <>
          <Row label={t("popup.energy.liveOutput")} value={fmtMW(props.output_mw)} />
          <Row label={t("popup.energy.loadRate")} value={fmtPct01(props.output_load_rate)} />
        </>
      )}
      <Row field="dataSource" value={sourceTable || "—"} />
      {canShowSparkline && <PlantOutput24h plantName={plantName} color={fuelColor} />}
      <UnitDrillDownBlock facilityId={String(props.facility_id ?? "")} />
      <FacilityProvenanceBlock facilityId={String(props.facility_id ?? "")} />
    </div>
  );
}

// ── 機組 drill-down lazy fetch block（migration 239） ──────────
function UnitDrillDownBlock({ facilityId }: { facilityId: string }) {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  const [units, setUnits] = useState<FacilityUnit[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!facilityId) { setUnits(null); return; }
    let alive = true;
    fetchFacilityUnits(facilityId)
      .then((d) => { if (alive) setUnits(d); })
      .catch((e) => { if (alive) setErr(String(e?.message ?? e)); });
    return () => { alive = false; };
  }, [facilityId]);

  if (!facilityId) return null;
  if (err) return (
    <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: "#f87171" }}>{tr("popup.energy.unitError", { error: err })}</div>
  );
  if (!units || units.length === 0) return null;

  const hasOutput = units.some((u) => u.net_gen_mw != null);
  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 8,
        borderTop: `1px solid ${t.border}`,
      }}
    >
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        {tr("popup.energy.unitsHeader", { count: units.length })}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {units.map((u) => {
          const rate = u.util_rate;
          const rateColor = rate == null
            ? t.textDim
            : rate >= 85 ? "#f97316" : rate >= 50 ? "#22c55e" : "#64aaff";
          return (
            <div
              key={u.unit_id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 0.9fr 0.9fr 0.6fr",
                gap: 6,
                alignItems: "baseline",
                fontFamily: FONT_DATA,
                fontSize: FONT_SIZE.xs,
                color: t.textDim,
              }}
            >
              <span style={{ color: t.textDefault, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {u.unit_name}
              </span>
              <span>{fmtMW(u.capacity_mw)}</span>
              <span style={{ color: hasOutput ? t.textDefault : t.textDim }}>
                {u.net_gen_mw != null ? fmtMW(u.net_gen_mw) : "—"}
              </span>
              <span style={{ color: rateColor, textAlign: "right" }}>
                {rate != null ? `${rate.toFixed(0)}%` : "—"}
              </span>
            </div>
          );
        })}
      </div>
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
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
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

  const tierColor = pv.source_priority != null ? (TIER_COLOR[pv.source_priority] ?? t.textDim) : t.textDim;
  const fetched = pv.source_last_refreshed ?? "—";
  const cadence = pv.source_refresh_cadence ?? "—";

  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 8,
        borderTop: `1px solid ${t.border}`,
      }}
    >
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, letterSpacing: 1, marginBottom: 4 }}>
        {tr("popup.energy.sourceHeader")}
      </div>
      <Row field="tier" value={pv.tier_label ?? "—"} color={tierColor} />
      <Row label={tr("popup.energy.platform")} value={pv.source_platform ?? "—"} />
      {pv.source_dataset_name && (
        <Row field="dataset" value={pv.source_dataset_name} />
      )}
      {pv.source_dataset_url && (
        <div style={{ marginTop: 3, fontSize: FONT_SIZE.xs, lineHeight: 1.4 }}>
          <a
            href={pv.source_dataset_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#67e8f9", textDecoration: "underline" }}
          >
            {tr("popup.energy.openDataset")}
          </a>
        </div>
      )}
      <Row field="license" value={pv.source_license ?? "—"} />
      <Row label={tr("popup.energy.fetchedDate")} value={fetched} />
      <Row label={tr("popup.energy.updateFrequency")} value={cadence} />
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
          title={tr("popup.energy.agentBadgeTitle")}
        >
          {tr("popup.energy.agentBadge", { count: pv.agent_intervention_count })}
        </div>
      )}
    </div>
  );
}

export function OsmSubstationPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const cls = String(props.class ?? "OTHER");
  const classLabel = String(props.class_label ?? t("popup.common.unclassified"));
  const classColor = SUBSTATION_CLASS_COLORS[cls as keyof typeof SUBSTATION_CLASS_COLORS]
                  ?? SUBSTATION_CLASS_COLORS.OTHER;
  return (
    <div>
      <Row field="name" value={String(props.name ?? t("popup.energy.unnamed"))} />
      <Row label={t("popup.energy.gridLevel")} value={classLabel} color={classColor} />
      <Row label="OSM type" value={String(props.substation_type ?? "—")} />
      <Row field="voltage" value={fmtVoltageKv(String(props.voltage ?? ""))} />
      <Row field="operatorOrg" value={String(props.operator ?? "—")} />
      <Row field="osmId" value={String(props.osm_id ?? "")} />
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
  const i18n = useLocale();
  const { t } = i18n;
  const lineType = String(props.line_type ?? "");
  const lineTypeLabel =
    lineType === "minor_line" ? enumLabel("powerLineType", lineType, "配電線", i18n) :
    lineType === "cable" ? enumLabel("powerLineType", lineType, "地下電纜", i18n) :
    lineType === "line" ? enumLabel("powerLineType", lineType, "輸電線", i18n) : (lineType || "—");
  return (
    <div>
      <Row field="type" value={lineTypeLabel} />
      <Row field="voltage" value={fmtVoltageKv(String(props.voltage ?? ""))} />
      <Row label={t("popup.energy.circuits")} value={String(props.circuits ?? "—")} />
      <Row label={t("popup.energy.frequency")} value={String(props.frequency ?? "—")} />
      <Row field="location" value={String(props.location ?? "—")} />
      <Row field="operatorOrg" value={String(props.operator ?? "—")} />
      <Row field="osmId" value={String(props.osm_id ?? "")} />
    </div>
  );
}

export function OsmPowerTowerPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <div>
      <Row field="number" value={String(props.ref ?? "—")} />
      <Row field="voltage" value={fmtVoltageKv(String(props.voltage ?? ""))} />
      <Row label={t("popup.energy.material")} value={String(props.material ?? "—")} />
      <Row label={t("popup.energy.design")} value={String(props.design ?? "—")} />
      <Row field="operatorOrg" value={String(props.operator ?? "—")} />
      <Row field="osmId" value={String(props.osm_id ?? "")} />
    </div>
  );
}

function fmtM(v: unknown, unit = "m"): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toFixed(0)} ${unit}` : "—";
}

export function OsmWindTurbinePanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const offshore = props.is_offshore;
  const offshoreLabel = offshore === true ? t("popup.energy.offshore") : offshore === false ? t("popup.energy.onshore") : "—";
  return (
    <div>
      <Row field="name" value={String(props.name || t("popup.energy.unnamed"))} />
      <Row field="type" value={offshoreLabel} color={offshore === true ? "#67e8f9" : offshore === false ? "#2dd4bf" : undefined} />
      <Row field="installedCapacity" value={fmtMW(props.capacity_mw)} />
      <Row label={t("popup.energy.towerHeight")} value={fmtM(props.height_m)} />
      <Row label={t("popup.energy.rotorDiameter")} value={fmtM(props.rotor_diameter_m)} />
      <Row label={t("popup.energy.manufacturer")} value={String(props.manufacturer || "—")} />
      <Row label={t("popup.energy.model")} value={String(props.model || "—")} />
      <Row field="operatorOrg" value={String(props.operator || "—")} />
      <Row field="osmId" value={String(props.osm_id ?? "")} />
    </div>
  );
}

export function OsmSolarFarmPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <div>
      <Row field="name" value={String(props.name || t("popup.energy.unnamed"))} />
      <Row field="installedCapacity" value={fmtMW(props.capacity_mw)} />
      <Row label={t("popup.energy.modules")} value={String(props.modules ?? "—")} />
      <Row field="area" value={fmtM(props.area_m2, "m²")} />
      <Row label={t("popup.energy.method")} value={String(props.plant_method || "—")} />
      <Row field="operatorOrg" value={String(props.operator || "—")} />
      <Row field="osmId" value={String(props.osm_id ?? "")} />
    </div>
  );
}

export function OsmPowerPlantStaticPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const src = String(props.plant_source || "");
  return (
    <div>
      <Row field="name" value={String(props.name || t("popup.energy.unnamed"))} />
      <Row label={t("popup.energy.fuelSource")} value={src || "—"} color={fuelColorOf(src)} />
      <Row label={t("popup.energy.method")} value={String(props.plant_method || "—")} />
      <Row label={t("popup.energy.generator")} value={String(props.generator_source || "—")} />
      <Row field="installedCapacity" value={fmtMW(props.capacity_mw)} />
      <Row field="operatorOrg" value={String(props.operator || "—")} />
      <Row field="osmId" value={String(props.osm_id ?? "")} />
    </div>
  );
}

export function OffshoreWindZonePanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const dMin = props.depth_min_m, dMax = props.depth_max_m;
  const depthLabel = dMin != null && dMax != null ? `${Number(dMin).toFixed(0)} ~ ${Number(dMax).toFixed(0)} m` : "—";
  return (
    <div>
      <Row label={t("popup.energy.zone")} value={String(props.zone_name || props.zone_code || "—")} />
      <Row field="type" value={String(props.zone_type || "—")} />
      <Row label={t("popup.energy.phase")} value={String(props.phase || "—")} />
      <Row label={t("popup.energy.developer")} value={String(props.developer || "—")} />
      <Row field="installedCapacity" value={fmtMW(props.capacity_mw)} />
      <Row label={t("popup.energy.awardYear")} value={String(props.award_year ?? "—")} />
      <Row label={t("popup.energy.onlineYear")} value={String(props.cod_year ?? "—")} />
      <Row label={t("popup.energy.depth")} value={depthLabel} />
      <Row label={t("popup.energy.distanceOffshore")} value={props.distance_km != null ? `${Number(props.distance_km).toFixed(1)} km` : "—"} />
    </div>
  );
}

export function IslandPowerFacilityPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <div>
      <Row field="name" value={String(props.name || "—")} />
      <Row label={t("popup.energy.island")} value={String(props.island || "—")} />
      <Row field="facilityType" value={String(props.facility_type || "—")} />
      <Row label={t("popup.energy.fuel")} value={String(props.fuel_type || "—")} />
      <Row field="installedCapacity" value={fmtMW(props.capacity_mw)} />
      <Row field="voltage" value={props.voltage_kv != null ? `${props.voltage_kv} kV` : "—"} />
      <Row label={t("popup.energy.onlineYear")} value={String(props.online_year ?? "—")} />
      <Row field="operatorOrg" value={String(props.operator || "—")} />
      <Row field="address" value={String(props.address || "—")} />
      <Row field="source" value={String(props.source || "—")} />
    </div>
  );
}

export function FossilFuelFacilityPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const ft = String(props.facility_type || "");
  const ftLabel =
    ft === "lng_terminal" ? enumLabel("fossilFacilityType", ft, "LNG 接收站", i18n) :
    ft === "oil_refinery" ? enumLabel("fossilFacilityType", ft, "煉油廠", i18n) :
    ft === "gas_power_plant" ? enumLabel("fossilFacilityType", ft, "燃氣電廠", i18n) : (ft || "—");
  return (
    <div>
      <Row field="name" value={String(props.name || "—")} />
      <Row field="type" value={ftLabel} />
      <Row label={t("popup.energy.content")} value={String(props.content || "—")} />
      {props.capacity_tonnes != null && (
        <Row label={t("popup.energy.capacityTonnes")} value={formatNumber(Number(props.capacity_tonnes))} />
      )}
      {props.capacity_kl != null && (
        <Row label={t("popup.energy.capacityKl")} value={formatNumber(Number(props.capacity_kl))} />
      )}
      {props.daily_throughput_kbpd != null && (
        <Row label={t("popup.energy.dailyThroughput")} value={`${formatNumber(Number(props.daily_throughput_kbpd))} kbpd`} />
      )}
      <Row label={t("popup.energy.onlineYear")} value={String(props.online_year ?? "—")} />
      <Row field="status" value={String(props.status || "—")} />
      <Row field="operatorOrg" value={String(props.operator || "—")} />
      <Row field="address" value={String(props.address || "—")} />
    </div>
  );
}

export function GeothermalWellPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const reportUrl = String(props.report_url || "");
  const figureUrl = String(props.figure_url || "");
  return (
    <div>
      <Row label={t("popup.energy.wellArea")} value={String(props.geothermal_area || "—")} />
      <Row label={t("popup.energy.report")} value={String(props.report_name || "—")} />
      <Row label={t("popup.energy.figureDesc")} value={String(props.figure_content || "—")} />
      <Row field="county" value={String(props.county_code || "—")} />
      {reportUrl && (
        <div style={{ marginTop: 6 }}>
          <a href={reportUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: "#22d3ee", fontSize: FONT_SIZE.sm, textDecoration: "underline" }}>
            {t("popup.energy.openReport")}
          </a>
          {figureUrl && (
            <a href={figureUrl} target="_blank" rel="noopener noreferrer"
              style={{ marginLeft: 12, color: "#22d3ee", fontSize: FONT_SIZE.sm, textDecoration: "underline" }}>
              {t("popup.energy.openFigure")}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function RenewablePermitTaipeiPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  // 政府原始資料未提供 district / installed_at；district 從 address regex 抓 XX區
  const addr = String(props.address || "");
  const districtFromAddr = addr.match(/[一-龥]{1,3}區/)?.[0] ?? "";
  const district = String(props.district || "") || districtFromAddr || "—";
  return (
    <div>
      <Row field="facilityName" value={String(props.installation_name || "—")} />
      <Row field="category" value={String(props.category || "—")} />
      <Row field="installedCapacity" value={props.capacity_kw != null ? `${Number(props.capacity_kw).toFixed(1)} kW` : "—"} />
      <Row field="district" value={district} />
      <Row field="address" value={addr || "—"} />
      <div style={{ marginTop: 6, fontSize: FONT_SIZE.xs, color: t.textMuted, lineHeight: 1.4 }}>
        {tr("popup.energy.permitNote")}
      </div>
    </div>
  );
}

export function EvChargingPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <div>
      <Row field="stationName" value={String(props.name ?? "")} />
      <Row label={t("popup.energy.operatingEntity")} value={String(props.operator_name ?? "—")} />
      <Row field="address" value={String(props.address ?? "—")} />
      <Row label={t("popup.energy.chargingPoints")} value={String(props.charging_points ?? "—")} />
      <Row label={t("popup.energy.spaces")} value={String(props.spaces ?? "—")} />
      <Row field="source" value={String(props.source ?? "—")} />
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
// 化石燃料 14 panel（Phase B — public.get_fossil_fuel_layers()）
// 溯源 footer 改由 FeatureInfoPanel 統一在 content 後掛一次（Phase D），
// 本檔各 panel 不再各自呼叫 SourceFooter。
// canonical SSOT 3 個 layer 多顯示 confidence + n_sources
// ══════════════════════════════════════════════════════════════════

function joinBrand(b: unknown): string {
  if (Array.isArray(b)) return b.join(" / ");
  return String(b ?? "");
}

function GasStationCommonRows({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <Row field="stationName" value={String(props.name ?? "—")} />
      <Row field="brand" value={joinBrand(props.brand) || "—"} />
      <Row field="address" value={String(props.address ?? "—")} />
      <Row field="phone" value={String(props.telephone ?? "—")} />
    </>
  );
}

export function GasStationCpcPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <div>
      <GasStationCommonRows props={props} />
      <Row field="category" value={String(props.category ?? "—")} />
      <Row field="businessHours" value={String(props.service_time ?? "—")} />
    </div>
  );
}

export function GasStationFpccPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <div>
      <GasStationCommonRows props={props} />
    </div>
  );
}

export function GasStationTaisugarPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const yn = (v: unknown) => (v ? t("popup.common.yes") : v === false ? t("popup.common.no") : "—");
  return (
    <div>
      <GasStationCommonRows props={props} />
      <Row label={t("popup.energy.selfService")} value={yn(props.is_self_service)} />
      <Row label={t("popup.energy.open24h")} value={yn(props.is_24h)} />
      <Row label={t("popup.energy.evCharging")} value={props.has_ev_charging ? t("popup.energy.has") : props.has_ev_charging === false ? t("popup.common.none") : "—"} />
    </div>
  );
}

export function GasStationOtherPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <div>
      <GasStationCommonRows props={props} />
      <Row label={t("popup.energy.taxId")} value={String(props.tax_id ?? "—")} />
      <Row field="capital" value={String(props.capital ?? "—")} />
    </div>
  );
}

export function GasStationCanonicalPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <div>
      <GasStationCommonRows props={props} />
      <Row label={t("popup.energy.confidence")} value={props.confidence != null ? String(props.confidence) : "—"} />
      <Row field="sourceCount" value={props.n_sources != null ? String(props.n_sources) : "—"} />
    </div>
  );
}

export function LpgSubpackagingPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const kinds = Array.isArray(props.facility_kinds) ? props.facility_kinds.join(", ") : "—";
  return (
    <div>
      <Row label={t("popup.energy.lpgSite")} value={String(props.name ?? "—")} />
      <Row field="type" value={kinds} />
      <Row field="address" value={String(props.address ?? "—")} />
      <Row field="phone" value={String(props.telephone ?? "—")} />
    </div>
  );
}

export function LpgRetailersPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <div>
      <Row label={t("popup.energy.lpgShop")} value={String(props.name ?? "—")} />
      <Row field="address" value={String(props.address ?? "—")} />
      <Row field="phone" value={String(props.telephone ?? "—")} />
      <Row label={t("popup.energy.confidence")} value={props.confidence != null ? String(props.confidence) : "—"} />
      <Row field="sourceCount" value={props.n_sources != null ? String(props.n_sources) : "—"} />
    </div>
  );
}

export function LngTerminalPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <div>
      <Row label={t("popup.energy.terminal")} value={String(props.name ?? "—")} />
      <Row field="englishName" value={String(props.name_en ?? "—")} />
      <Row field="status" value={String(props.status ?? "—")} />
      <Row field="operator" value={String(props.owner ?? "—")} />
      <Row label={t("popup.energy.capacityMtpa")} value={String(props.capacity_mtpa ?? "—")} />
      <Row label={t("popup.energy.confidence")} value={props.confidence != null ? String(props.confidence) : "—"} />
      <Row field="sourceCount" value={props.n_sources != null ? String(props.n_sources) : "—"} />
    </div>
  );
}

export function PipelineGasPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <div>
      <Row label={t("popup.energy.pipelineName")} value={String(props.pipeline_name ?? props.name ?? "—")} />
      <Row label={t("popup.energy.substance")} value={String(props.substance ?? "gas")} />
      <Row field="status" value={String(props.status ?? "—")} />
      <Row field="operator" value={String(props.owner ?? "—")} />
      <Row label={t("popup.energy.diameterIn")} value={String(props.diameter_in ?? "—")} />
      <Row label={t("popup.energy.completionYear")} value={String(props.start_year ?? "—")} />
    </div>
  );
}

export function PipelineOilGasPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <div>
      <Row label={t("popup.energy.pipelineName")} value={String(props.pipeline_name ?? props.name ?? "—")} />
      <Row label={t("popup.energy.substance")} value={String(props.substance ?? "—")} />
      <Row field="status" value={String(props.status ?? "—")} />
      <Row field="operator" value={String(props.owner ?? "—")} />
      <Row label={t("popup.energy.diameterIn")} value={String(props.diameter_in ?? "—")} />
    </div>
  );
}

export function IndustrialRefineryPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <div>
      <Row label={t("popup.energy.industrialSiteName")} value={String(props.name ?? "—")} />
      <Row field="type" value={String(props.industrial_type ?? "refinery")} />
      <Row field="operatorOrg" value={String(props.operator ?? "—")} />
    </div>
  );
}

export function IndustrialStorageTankPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <div>
      <Row label={t("popup.energy.tankName")} value={String(props.name ?? "—")} />
      <Row field="type" value={String(props.industrial_type ?? "storage_tank")} />
      <Row field="operatorOrg" value={String(props.operator ?? "—")} />
    </div>
  );
}

export function IndustrialPowerPlantPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <div>
      <Row label={t("popup.energy.industrialSiteName")} value={String(props.name ?? "—")} />
      <Row field="type" value={String(props.industrial_type ?? "power_plant")} />
      <Row field="operatorOrg" value={String(props.operator ?? "—")} />
    </div>
  );
}

export function CoalTerminalPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <div>
      <Row label={t("popup.energy.terminalName")} value={String(props.terminal_name ?? props.name ?? "—")} />
      <Row label={t("popup.energy.parentPort")} value={String(props.parent_port ?? "—")} />
      <Row label={t("popup.energy.capacityMt")} value={String(props.capacity_mt ?? "—")} />
      <Row field="status" value={String(props.status ?? "—")} />
      <Row field="operator" value={String(props.owner ?? "—")} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// 全台覆蓋分析 5 panel — PMTiles × OSM edge nearest distance
// ──────────────────────────────────────────────────────────────────

function CoveragePocFooter() {
  const t = useFeatureTheme();
  const { t: tr } = useLocale();
  return (
    <div style={{ marginTop: 8, fontSize: FONT_SIZE.xs, color: t.textDim, lineHeight: 1.4 }}>
      {tr("popup.energy.coverageFooter")}
    </div>
  );
}

function formatDist(distM: unknown): string {
  const m = Number(distM);
  if (!Number.isFinite(m)) return "—";
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

function CoverageNearestRows({ props, sourceKey }: { props: Record<string, unknown>; sourceKey: StaticMessageKey }) {
  const { t } = useLocale();
  return (
    <>
      <Row label={t("popup.energy.nearestDistance")} value={formatDist(props.dist_m)} />
      <Row label={t("popup.energy.band")} value={String(props.band ?? "—")} />
      <Row label={t("popup.energy.measureMethod")} value={t(sourceKey)} />
    </>
  );
}

export function GasCoverageAllPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <div>
      <CoverageNearestRows props={props} sourceKey="popup.energy.nearestGas" />
      <CoveragePocFooter />
    </div>
  );
}

export function GasCoverageCpcPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <div>
      <CoverageNearestRows props={props} sourceKey="popup.energy.nearestCpc" />
      <CoveragePocFooter />
    </div>
  );
}

export function GasCoverageFpccPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <div>
      <CoverageNearestRows props={props} sourceKey="popup.energy.nearestFpcc" />
      <CoveragePocFooter />
    </div>
  );
}

export function GasCoverageTaisugarPanel({ props }: { props: Record<string, unknown> }) {
  return (
    <div>
      <CoverageNearestRows props={props} sourceKey="popup.energy.nearestTaisugar" />
      <CoveragePocFooter />
    </div>
  );
}

export function EvIslandPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const distM = Number(props.dist_m);
  const isFar = Number.isFinite(distM) && distM >= 30000;
  return (
    <div>
      <CoverageNearestRows props={props} sourceKey="popup.energy.nearestCharger" />
      {isFar && (
        <div style={{
          marginTop: 8, padding: "6px 8px",
          background: "rgba(242,53,53,0.12)", border: "1px solid rgba(242,53,53,0.4)",
          borderRadius: 4, color: "#F23535", fontSize: FONT_SIZE.sm, lineHeight: 1.4,
        }}>
          {t("popup.energy.chargingIsland")}
        </div>
      )}
      <CoveragePocFooter />
    </div>
  );
}
