import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import {
  WASTE_FACILITY_COLORS, WASTE_FACILITY_LABELS,
  WASTE_DISPOSAL_COLORS, WASTE_DISPOSAL_LABELS,
  WASTE_SOURCE_LABELS, WASTE_SOURCE_BADGE_COLORS,
} from "../../data/wasteLoader";
import { Row } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";

// ─── 垃圾處理設施 ─────────────────────────────────────────────
export function WasteFacilityPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr, formatNumber } = i18n;
  const type = String(props.facility_type ?? "");
  const color = WASTE_FACILITY_COLORS[type] ?? "#9ca3af";
  const label = enumLabel("wasteFacility", type, WASTE_FACILITY_LABELS[type] ?? type, i18n);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.facility_name ?? tr("popup.waste.unnamedFacility"))}
        </div>
      </div>
      <Row field="type" value={label} color={color} />
      <Row field="county" value={String(props.city ?? "")} />
      <Row field="operatorOrg" value={String(props.operator ?? "")} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row label={tr("popup.waste.capacity")} value={props.capacity_tpd != null ? tr("popup.waste.tonsPerDay", { value: String(props.capacity_tpd) }) : ""} />
      <Row field="status" value={String(props.status ?? "")} />
      <Row label={tr("popup.waste.startYear")} value={props.start_year != null ? String(props.start_year) : ""} />
      {props.is_coastal === true && (
        <Row
          label={tr("popup.waste.distanceToCoast")}
          value={
            typeof props.distance_to_sea_m === "number"
              ? `${formatNumber(Math.round(props.distance_to_sea_m))} m`
              : "—"
          }
          color="#0891b2"
        />
      )}
    </>
  );
}

// ─── 清潔隊辦公點 ──────────────────────────────────────────
export function WasteCleaningSquadPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const phone = props.phone ? String(props.phone) : "";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#22c55e", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.squad_name ?? tr("popup.waste.squadFallback"))}
        </div>
      </div>
      <Row field="county" value={String(props.city ?? "")} />
      <Row field="district" value={String(props.district ?? "")} />
      <Row field="address" value={String(props.address ?? "")} />
      {phone && <Row field="phone" value={phone} color={t.link} />}
      <Row label={tr("popup.waste.jurisdiction")} value={String(props.jurisdiction ?? "")} />
    </>
  );
}

// ─── 垃圾投放點 ─────────────────────────────────────────────
export function WasteDisposalPointPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const type = String(props.point_type ?? "");
  const color = WASTE_DISPOSAL_COLORS[type] ?? "#9ca3af";
  const label = enumLabel("wasteDisposal", type, WASTE_DISPOSAL_LABELS[type] ?? type, i18n);
  const source = String(props.source ?? "");
  const sourceLabel = enumLabel("wasteSource", source, WASTE_SOURCE_LABELS[source] ?? source, i18n);
  const badge = WASTE_SOURCE_BADGE_COLORS[source] ?? { bg: "rgba(148,163,184,0.18)", fg: "#94a3b8" };
  let categories: string[] = [];
  const rawCats = props.accepts_categories;
  if (Array.isArray(rawCats)) categories = rawCats.map(String);
  else if (typeof rawCats === "string") {
    try { const j = JSON.parse(rawCats); if (Array.isArray(j)) categories = j.map(String); } catch { /* */ }
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.point_name ?? label)}
        </div>
      </div>
      <Row field="type" value={label} color={color} />
      <Row field="county" value={String(props.city ?? "")} />
      <Row field="district" value={String(props.district ?? "")} />
      <Row field="address" value={String(props.address ?? "")} />
      <Row label={tr("popup.waste.manager")} value={String(props.operator ?? "")} />

      {/* 來源權威度 badge */}
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: t.textMuted, fontSize: FONT_SIZE.base, minWidth: 56 }}>{tr("popup.field.source")}</span>
        <span
          style={{
            fontSize: FONT_SIZE.sm,
            padding: "2px 8px",
            borderRadius: RADIUS.xl,
            background: badge.bg,
            color: badge.fg,
            border: `1px solid ${badge.fg}55`,
            fontWeight: 600,
          }}
        >
          {sourceLabel}
        </span>
      </div>

      {/* 可投放類別 chips */}
      {categories.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ color: t.textMuted, fontSize: FONT_SIZE.base, marginBottom: 4 }}>
            {tr("popup.waste.accepts")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {categories.map((c) => (
              <span
                key={c}
                style={{
                  fontSize: FONT_SIZE.sm,
                  padding: "1px 7px",
                  borderRadius: RADIUS.xl,
                  background: t.bgSubtle,
                  color: t.textDefault,
                  border: `1px solid ${t.border}`,
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

    </>
  );
}

// ─── 清運點位（靜態全台 73,060 點）─────────────────────────────
// 欄位契約：public/geo/waste_stops_static.geojson
//   stop_name / city / district / route_id / route_name / vehicle_type /
//   routes_count / via（座標取得方式，資料品質揭露用）
const WASTE_VEHICLE_LABELS: Record<string, string> = {
  garbage: "垃圾車",
  recycling: "資源回收車",
  kitchen: "廚餘車",
  mixed: "混合",
};

/** `via` = 這個點的座標怎麼來的（政府原始資料附座標 vs. 後製地理編碼）。 */
const WASTE_STOP_VIA_LABELS: Record<string, string> = {
  waste_open_data: "政府開放資料原始座標",
  tgos_batch_v2: "TGOS 地址批次地理編碼",
  tgos_batch_v2_round4: "TGOS 地址批次地理編碼",
  legacy: "早期匯入",
  poi_nominatim: "Nominatim POI 比對",
  poi_school: "學校 POI 比對",
  poi_foursquare: "Foursquare POI 比對",
};

export function WasteStopsStaticPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const stopName = String(props.stop_name ?? "");
  const city = String(props.city ?? "");
  const district = String(props.district ?? "");
  const routeName = String(props.route_name ?? "");
  const routesCount = Number(props.routes_count);
  const vehicle = String(props.vehicle_type ?? "");
  const via = String(props.via ?? "");

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#d97706", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {stopName || tr("popup.waste.unnamedStop")}
        </div>
      </div>
      <Row field="district" value={[city, district].filter(Boolean).join(" ")} />
      <Row label={tr("popup.waste.collectionRoute")} value={routeName} />
      {Number.isFinite(routesCount) && routesCount > 0 && (
        <Row
          label={tr("popup.waste.routesPassing")}
          value={tr("popup.waste.routeCount", { count: routesCount })}
          color={routesCount > 1 ? "#f59e0b" : undefined}
        />
      )}
      <Row label={tr("popup.waste.vehicleType")} value={enumLabel("wasteVehicle", vehicle, WASTE_VEHICLE_LABELS[vehicle] ?? vehicle, i18n)} />
      <Row label={tr("popup.waste.positionSource")} value={enumLabel("wasteStopVia", via, WASTE_STOP_VIA_LABELS[via] ?? via, i18n)} color={t.textDim} />
    </>
  );
}

/**
 * 垃圾車實跡（W2）。資料來自 `WasteTrailRow`（GPS 軌跡），由
 * `WasteTruckScene.pickTruck` 拾取 InstancedMesh 光球後開啟。
 *
 * 只有三欄可顯示：pickTruck 回傳的是整列 row，逐點狀態（collecting / returning /
 * parked …）是每幀插值算出來的 frame 屬性、不在 row 上 —— 不硬湊。
 * `route_id` 是收運路線代碼（可能為 null，例如尚未配線的車）。
 */
export function WasteTruckPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const i18n = useLocale();
  const { t: tr } = i18n;
  const vehicleNo = String(props.vehicle_no ?? "");
  const city = String(props.city ?? "");
  const routeId = props.route_id == null ? "" : String(props.route_id);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#22c55e", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {vehicleNo || tr("popup.waste.garbageTruck")}
        </div>
      </div>
      <Row label={tr("popup.waste.vehicleNo")} value={vehicleNo} />
      <Row field="county" value={city} />
      <Row label={tr("popup.waste.routeCode")} value={routeId} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 6 }}>
        {tr("popup.waste.truckNote")}
      </div>
    </>
  );
}
