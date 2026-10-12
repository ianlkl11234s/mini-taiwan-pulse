import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import {
  parkingAvailabilityColor, AVAILABILITY_NULL_COLOR, SOURCE_CATEGORY_META,
} from "../../data/parkingLoader";
import { Row } from "./shared";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";

interface SpaceRow { code: number; total: number | null; available: number | null; }

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
      code,
      total: total == null ? null : Number(total),
      available: available == null ? null : Number(available),
    };
  });
}

type FormatNumber = (n: number) => string;
function fmt(v: number | null | undefined, formatNumber: FormatNumber): string {
  return v == null || v < 0 ? "—" : formatNumber(v);
}
function ratePct(rate: number | null): string {
  return rate == null ? "" : `${Math.round(rate * 100)}%`;
}

function SpaceTypeRows({ rows }: { rows: SpaceRow[] }) {
  const { t, formatNumber } = useLocale();
  if (rows.length === 0) return null;
  const spaceLabel = (code: number): string =>
    code === 1 ? t("popup.parking.spaceCar")
    : code === 2 ? t("popup.parking.spaceMotorcycle")
    : code === 3 ? t("popup.parking.spaceDisabled")
    : t("popup.parking.spaceOther", { code });
  return (
    <>
      {rows.map((r, i) => (
        <Row key={i} label={spaceLabel(r.code)} value={t("popup.parking.spaceRow", { available: fmt(r.available, formatNumber), total: fmt(r.total, formatNumber) })} />
      ))}
    </>
  );
}

/** 路邊停車 popup — 台北 polygon（僅容量）/ 新北台中 點（空位率） */
export function ParkingOnstreetPanel({ props }: { props: Record<string, unknown> }) {
  const { t, formatNumber } = useLocale();
  const title = String(props.segment_name || props.segment_id || t("popup.parking.onstreetFallback"));
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
      <Row field="type" value={t("popup.parking.onstreetType")} />
      <Row label={t("popup.parking.totalSpaces")} value={fmt(total, formatNumber)} />
      {taipeiCapacityOnly ? (
        <div style={{ fontSize: FONT_SIZE.xs, color: "rgba(255,180,80,0.75)", marginTop: 6, lineHeight: 1.4 }}>
          {t("popup.parking.taipeiCapacityOnly")}
        </div>
      ) : (
        <>
          <Row label={t("popup.parking.available")} value={fmt(available, formatNumber)} color={color} />
          <Row label={t("popup.parking.availabilityRate")} value={ratePct(rate)} color={color} />
        </>
      )}
      <SpaceTypeRows rows={spaceRows} />
    </>
  );
}

/** 場外停車場 popup — 空位率 + 容量 + 類型 / 地址 / 充電 */
export function ParkingOffstreetPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const title = String(props.car_park_name || props.car_park_uid || t("popup.parking.lotFallback"));
  const rate = props.availability_rate == null ? null : Number(props.availability_rate);
  const total = props.total_spaces == null ? null : Number(props.total_spaces);
  const available = props.available_spaces == null ? null : Number(props.available_spaces);
  const color = rate == null ? AVAILABILITY_NULL_COLOR : parkingAvailabilityColor(rate);
  const cat = String(props.source_category ?? "");
  const catLabel = enumLabel("parkingSourceCategory", cat, SOURCE_CATEGORY_META[cat]?.label ?? cat, i18n);
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
      <Row field="classification" value={subCat && subCat !== catLabel ? t("popup.parking.categoryWithSub", { category: catLabel, sub: subCat }) : catLabel} />
      {rate == null ? (
        <>
          <Row label={t("popup.parking.totalLotSpaces")} value={fmt(total, formatNumber)} />
          <div style={{ fontSize: FONT_SIZE.xs, color: "rgba(255,180,80,0.75)", marginTop: 6, lineHeight: 1.4 }}>
            {t("popup.parking.noRealtime")}
          </div>
        </>
      ) : (
        <>
          <Row label={t("popup.parking.available")} value={`${fmt(available, formatNumber)} / ${fmt(total, formatNumber)}`} color={color} />
          <Row label={t("popup.parking.availabilityRate")} value={ratePct(rate)} color={color} />
        </>
      )}
      <SpaceTypeRows rows={spaceRows} />
      {carParkType && <Row label={t("popup.parking.lotType")} value={carParkType} />}
      {ev && <Row label={t("popup.parking.charging")} value={t("popup.parking.evCharging")} color="#22c55e" />}
      {address && <Row field="address" value={address} />}
    </>
  );
}
