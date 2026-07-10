import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import {
  parkingAvailabilityColor, AVAILABILITY_NULL_COLOR, SOURCE_CATEGORY_META,
} from "../../data/parkingLoader";
import { Row } from "./shared";

// 車格類型代碼 → 標籤（汽車 / 身障 / 其他）
const SPACE_TYPE_LABEL: Record<number, string> = {
  1: "汽車",
  2: "機車",
  3: "身障",
};

interface SpaceRow { label: string; total: number | null; available: number | null; }

/**
 * space_types 兩種 schema 正規化：
 *   路邊 segments：[{type, total, available, occupancy}]
 *   場外 lots：    [{SpaceType, NumberOfSpaces, AvailableSpaces}]
 */
function parseSpaceTypes(raw: unknown): SpaceRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => {
    const o = s as Record<string, unknown>;
    const code = Number(o.type ?? o.SpaceType ?? 0);
    const total = o.total ?? o.NumberOfSpaces;
    const available = o.available ?? o.AvailableSpaces;
    return {
      label: SPACE_TYPE_LABEL[code] ?? `其他 (類型 ${code})`,
      total: total == null ? null : Number(total),
      available: available == null ? null : Number(available),
    };
  });
}

function fmt(v: number | null | undefined): string {
  return v == null || v < 0 ? "—" : v.toLocaleString("zh-TW");
}
function ratePct(rate: number | null): string {
  return rate == null ? "" : `${Math.round(rate * 100)}%`;
}

function SpaceTypeRows({ rows }: { rows: SpaceRow[] }) {
  if (rows.length === 0) return null;
  return (
    <>
      {rows.map((r, i) => (
        <Row key={i} label={r.label} value={`空 ${fmt(r.available)} / 共 ${fmt(r.total)}`} />
      ))}
    </>
  );
}

/** 路邊停車 popup — 台北 polygon（僅容量）/ 新北台中 點（空位率） */
export function ParkingOnstreetPanel({ props }: { props: Record<string, unknown> }) {
  const title = String(props.segment_name || props.segment_id || "路邊停車");
  const rate = props.availability_rate == null ? null : Number(props.availability_rate);
  const total = props.total_spaces == null ? null : Number(props.total_spaces);
  const available = props.available_spaces == null ? null : Number(props.available_spaces);
  const color = parkingAvailabilityColor(rate);
  const spaceRows = parseSpaceTypes(props.space_types);
  const taipeiCapacityOnly = rate == null; // 台北：無即時空位

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>{title}</div>
      </div>
      <Row label="類型" value="路邊停車格" />
      <Row label="總車格" value={fmt(total)} />
      {taipeiCapacityOnly ? (
        <div style={{ fontSize: FONT_SIZE.xs, color: "rgba(255,180,80,0.75)", marginTop: 6, lineHeight: 1.4 }}>
          ⚠️ 台北路邊僅提供容量，無即時空位
        </div>
      ) : (
        <>
          <Row label="剩餘空位" value={fmt(available)} color={color} />
          <Row label="空位率" value={ratePct(rate)} color={color} />
        </>
      )}
      <SpaceTypeRows rows={spaceRows} />
    </>
  );
}

/** 場外停車場 popup — 空位率 + 容量 + 類型 / 地址 / 充電 */
export function ParkingOffstreetPanel({ props }: { props: Record<string, unknown> }) {
  const title = String(props.car_park_name || props.car_park_uid || "停車場");
  const rate = props.availability_rate == null ? null : Number(props.availability_rate);
  const total = props.total_spaces == null ? null : Number(props.total_spaces);
  const available = props.available_spaces == null ? null : Number(props.available_spaces);
  const color = rate == null ? AVAILABILITY_NULL_COLOR : parkingAvailabilityColor(rate);
  const cat = String(props.source_category ?? "");
  const catLabel = SOURCE_CATEGORY_META[cat]?.label ?? cat;
  const subCat = String(props.sub_category ?? "");
  const address = String(props.address ?? "");
  const carParkType = String(props.car_park_type ?? "");
  const ev = props.ev_charging === true;
  const spaceRows = parseSpaceTypes(props.space_types);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>{title}</div>
      </div>
      <Row label="分類" value={subCat && subCat !== catLabel ? `${catLabel}（${subCat}）` : catLabel} />
      {rate == null ? (
        <>
          <Row label="總車位" value={fmt(total)} />
          <div style={{ fontSize: FONT_SIZE.xs, color: "rgba(255,180,80,0.75)", marginTop: 6, lineHeight: 1.4 }}>
            ⚠️ 此場無即時空位資料
          </div>
        </>
      ) : (
        <>
          <Row label="剩餘空位" value={`${fmt(available)} / ${fmt(total)}`} color={color} />
          <Row label="空位率" value={ratePct(rate)} color={color} />
        </>
      )}
      <SpaceTypeRows rows={spaceRows} />
      {carParkType && <Row label="型態" value={carParkType} />}
      {ev && <Row label="充電" value="有電動車充電" color="#22c55e" />}
      {address && <Row label="地址" value={address} />}
    </>
  );
}
