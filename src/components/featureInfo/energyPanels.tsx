import { Row } from "./shared";
import { fuelColorOf, FUEL_FALLBACK_COLOR } from "../../data/energyLoader";

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

export function PowerPlantPanel({ props }: { props: Record<string, unknown> }) {
  const fuel = String(props.fuel_type ?? "");
  const fuelColor = fuel ? fuelColorOf(fuel) : FUEL_FALLBACK_COLOR;
  const sourceTable = String(props.source_table ?? "");
  const isRetired = props.is_retired === true || props.status === "retired";
  const statusNote = String(props.status_note ?? "");
  return (
    <div>
      <Row label="電廠" value={String(props.name ?? "")} />
      <Row label="燃料" value={fuel || "—"} color={fuelColor} />
      <Row label="裝置容量" value={fmtMW(props.capacity_mw)} />
      {isRetired && (
        <Row
          label="狀態"
          value={statusNote || "已除役"}
          color="#ef4444"
        />
      )}
      {!isRetired && props.output_mw != null && (
        <>
          <Row label="即時出力" value={fmtMW(props.output_mw)} />
          <Row label="負載率" value={fmtPct01(props.output_load_rate)} />
        </>
      )}
      <Row label="資料源" value={sourceTable || "—"} />
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
