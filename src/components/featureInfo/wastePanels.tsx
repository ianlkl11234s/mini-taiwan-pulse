import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import {
  WASTE_FACILITY_COLORS, WASTE_FACILITY_LABELS,
  WASTE_DISPOSAL_COLORS, WASTE_DISPOSAL_LABELS,
  WASTE_SOURCE_LABELS, WASTE_SOURCE_BADGE_COLORS,
} from "../../data/wasteLoader";
import { Row } from "./shared";
import { useFeatureTheme } from "./featureTheme";

// ─── 垃圾處理設施 ─────────────────────────────────────────────
export function WasteFacilityPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const type = String(props.facility_type ?? "");
  const color = WASTE_FACILITY_COLORS[type] ?? "#9ca3af";
  const label = WASTE_FACILITY_LABELS[type] ?? type;
  const sourceUrl = props.source_url ? String(props.source_url) : "";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.facility_name ?? "(未命名設施)")}
        </div>
      </div>
      <Row label="類型" value={label} color={color} />
      <Row label="縣市" value={String(props.city ?? "")} />
      <Row label="營運單位" value={String(props.operator ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="處理量" value={props.capacity_tpd != null ? `${props.capacity_tpd} 噸/日` : ""} />
      <Row label="狀態" value={String(props.status ?? "")} />
      <Row label="啟用年" value={props.start_year != null ? String(props.start_year) : ""} />
      {props.is_coastal === true && (
        <Row
          label="距海岸"
          value={
            typeof props.distance_to_sea_m === "number"
              ? `${Math.round(props.distance_to_sea_m).toLocaleString()} m`
              : "—"
          }
          color="#0891b2"
        />
      )}
      {sourceUrl && (
        <div style={{ marginTop: 6 }}>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: FONT_SIZE.sm,
              color: t.link,
              textDecoration: "underline",
              wordBreak: "break-all",
            }}
          >
            原始資料 ↗
          </a>
        </div>
      )}
    </>
  );
}

// ─── 清潔隊辦公點 ──────────────────────────────────────────
export function WasteCleaningSquadPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const phone = props.phone ? String(props.phone) : "";
  const sourceUrl = props.source_url ? String(props.source_url) : "";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#22c55e", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {String(props.squad_name ?? "(清潔隊)")}
        </div>
      </div>
      <Row label="縣市" value={String(props.city ?? "")} />
      <Row label="行政區" value={String(props.district ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      {phone && <Row label="電話" value={phone} color={t.link} />}
      <Row label="主管轄區" value={String(props.jurisdiction ?? "")} />
      {sourceUrl && (
        <div style={{ marginTop: 6 }}>
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: FONT_SIZE.sm, color: t.link, textDecoration: "underline", wordBreak: "break-all" }}>
            原始資料 ↗
          </a>
        </div>
      )}
    </>
  );
}

// ─── 垃圾投放點 ─────────────────────────────────────────────
export function WasteDisposalPointPanel({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const type = String(props.point_type ?? "");
  const color = WASTE_DISPOSAL_COLORS[type] ?? "#9ca3af";
  const label = WASTE_DISPOSAL_LABELS[type] ?? type;
  const source = String(props.source ?? "");
  const sourceLabel = WASTE_SOURCE_LABELS[source] ?? source;
  const badge = WASTE_SOURCE_BADGE_COLORS[source] ?? { bg: "rgba(148,163,184,0.18)", fg: "#94a3b8" };
  const sourceUrl = props.source_url ? String(props.source_url) : "";
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
      <Row label="類型" value={label} color={color} />
      <Row label="縣市" value={String(props.city ?? "")} />
      <Row label="行政區" value={String(props.district ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="管理者" value={String(props.operator ?? "")} />

      {/* 來源權威度 badge */}
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: t.textMuted, fontSize: FONT_SIZE.base, minWidth: 56 }}>來源</span>
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
            可投放
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

      {sourceUrl && (
        <div style={{ marginTop: 8 }}>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: FONT_SIZE.sm,
              color: t.link,
              textDecoration: "underline",
              wordBreak: "break-all",
            }}
          >
            原始資料 ↗
          </a>
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
          {stopName || "(未命名點位)"}
        </div>
      </div>
      <Row label="行政區" value={[city, district].filter(Boolean).join(" ")} />
      <Row label="清運路線" value={routeName} />
      {Number.isFinite(routesCount) && routesCount > 0 && (
        <Row
          label="經過路線"
          value={`${routesCount} 條`}
          color={routesCount > 1 ? "#f59e0b" : undefined}
        />
      )}
      <Row label="車種" value={WASTE_VEHICLE_LABELS[vehicle] ?? vehicle} />
      <Row label="定位來源" value={WASTE_STOP_VIA_LABELS[via] ?? via} color={t.textDim} />
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
  const vehicleNo = String(props.vehicle_no ?? "");
  const city = String(props.city ?? "");
  const routeId = props.route_id == null ? "" : String(props.route_id);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: "#22c55e", flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>
          {vehicleNo || "垃圾車"}
        </div>
      </div>
      <Row label="車號" value={vehicleNo} />
      <Row label="縣市" value={city} />
      <Row label="路線代碼" value={routeId} />
      <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 6 }}>
        GPS 實跡車輛 · 位置隨時間軸插值
      </div>
    </>
  );
}
