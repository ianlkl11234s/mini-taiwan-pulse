import { Row } from "./shared";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import {
  facilityTypeColor, facilityTypeLabel, operatorTypeLabel,
  operatorEntityColor, operatorEntityLabel,
  precisionLabel, isApproxPrecision,
  cemeteryZoningColor, cemeteryZoningClassLabel,
  CEMETERY_OSM_ODBL_NOTE, FUNERAL_LAYER_COLORS,
} from "../../data/funeralTypes";

// 本檔 Title 為極簡本地版（同 religionPanels / urbanPanels 慣例）。
function Title({ color, children }: { color: string; children: string }) {
  const t = useFeatureTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>{children}</div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  const t = useFeatureTheme();
  return (
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
      {children}
    </div>
  );
}

const str = (v: unknown): string => (v == null || v === "" ? "" : String(v));

/**
 * 座標精度誠實標記（A 源兩層共用）。
 * ⚠️ 設施有 42%（parcel_centroid 1,576 + approximate 429）不是實際入口位置 ——
 *    使用者若拿去導航會被誤導，故概略值一律明講；精確段位不佔版面。
 */
function PrecisionNote({ precision }: { precision: string }) {
  if (!precision) return null;
  if (!isApproxPrecision(precision)) return null;
  return <Note>⚠️ 位置為概略值：{precisionLabel(precision)}，非實際入口座標</Note>;
}

/**
 * A 源 · 殯葬設施（3,707 點）：facility_type 6 類分色。
 * name 上游保證非 null，但可能是空字串 → fallback 用類型名不憑空造名。
 */
export function FuneralFacilityPanel({ props }: { props: Record<string, unknown> }) {
  const type = str(props.facility_type);
  const color = facilityTypeColor(type);
  const district = str(props.district);
  return (
    <>
      <Title color={color}>{str(props.name) || facilityTypeLabel(type)}</Title>
      <Row label="類型" value={facilityTypeLabel(type)} color={color} />
      <Row label="公私別" value={operatorTypeLabel(str(props.operator_type))} />
      {str(props.eco_type) ? <Row label="環保葬類型" value={str(props.eco_type)} /> : null}
      <Row label="行政區" value={district ? `${str(props.county)}${district}` : str(props.county)} />
      <Row label="電話" value={str(props.phone)} />
      <PrecisionNote precision={str(props.precision)} />
    </>
  );
}

/**
 * A 源 · 禮儀業者（6,233 點，圖層預設只畫仍營業的 4,569）：entity_type 2 類分色。
 * capital 僅公司登記有值（獨資合夥為 null）。
 */
export function FuneralOperatorPanel({ props }: { props: Record<string, unknown> }) {
  const entity = str(props.entity_type);
  const color = operatorEntityColor(entity);
  const active = props.is_active === true;
  const capital = typeof props.capital === "number" ? props.capital : null;
  return (
    <>
      <Title color={color}>{str(props.name) || "禮儀業者"}</Title>
      <Row label="登記別" value={operatorEntityLabel(entity)} color={color} />
      <Row
        label="營業狀態"
        // status 幾乎必有值；fallback 用「已失效」不用「已歇業」——這桶含遷他縣市
        value={str(props.status) || (active ? "核准設立" : "已失效")}
        color={active ? undefined : "#9e9e9e"}
      />
      {capital != null ? <Row label="資本額" value={`${capital.toLocaleString()} 元`} /> : null}
      <Row label="統一編號" value={str(props.uniform_id)} />
      <Row label="行政區" value={`${str(props.county)}${str(props.district)}`} />
      <PrecisionNote precision={str(props.precision)} />
    </>
  );
}

/**
 * A 源 · 區級業者密度（325 區）。
 * operatorCount 來自 feature-state（非 baked properties）—— useMapInteraction 已把
 * `f.state` 併進 properties，見該檔 feature-state 白名單。
 */
export function FuneralOperatorDensityPanel({ props }: { props: Record<string, unknown> }) {
  const count = typeof props.operatorCount === "number" ? props.operatorCount : 0;
  return (
    <>
      <Title color={FUNERAL_LAYER_COLORS.funeralOperatorDensity}>
        {`${str(props.COUNTYNAME)}${str(props.TOWNNAME)}` || "鄉鎮市區"}
      </Title>
      <Row label="登記業者" value={`${count.toLocaleString()} 家`} />
      <Note>
        ⓘ 這是業者「登記地」家數，<b>不是服務涵蓋率</b> —— 禮儀業者常跨區服務，
        不可當可及性指標。
      </Note>
    </>
  );
}

/**
 * B 源 · OSM 墓區面（3,229 面）。
 * ⚠️ 僅 34.5% 有 name → 標題用 osm_id 兜底，不做以名稱為主的呈現。
 * 🔴 ODbL：本層一律顯示 © OpenStreetMap contributors。
 */
export function CemeteryOsmPanel({ props }: { props: Record<string, unknown> }) {
  const name = str(props.name);
  const area = typeof props.area_ha === "number" ? props.area_ha : null;
  return (
    <>
      <Title color={FUNERAL_LAYER_COLORS.cemeteryOsm}>{name || "未命名墓區"}</Title>
      {area != null ? <Row label="面積" value={`${area.toFixed(2)} 公頃`} /> : null}
      <Row label="OSM 標籤" value={str(props.landuse) || str(props.amenity)} />
      <Row label="OSM ID" value={str(props.osm_id)} />
      {name ? null : <Note>OSM 上約 65% 的墓區未標名稱，要名稱請疊「殯葬設施」層</Note>}
      <Note>ⓘ OpenStreetMap 群眾標註，{CEMETERY_OSM_ODBL_NOTE}</Note>
    </>
  );
}

/**
 * C 源 · 都市計畫墓葬類法定用地（114 面 / 702.6 ha）。
 * ⚠️ 僅臺北（12）＋新北（102），且只含都市土地 —— 山區大型公墓多在非都市土地的
 *    「墳墓用地」編定，那份資料尚未取得。
 */
export function CemeteryZoningPanel({ props }: { props: Record<string, unknown> }) {
  const zone = str(props.zone_label);
  const color = cemeteryZoningColor(zone);
  const area = typeof props.area_ha === "number" ? props.area_ha : null;
  return (
    <>
      <Title color={color}>{zone || "墓葬類用地"}</Title>
      <Row label="分區群組" value={cemeteryZoningClassLabel(zone)} color={color} />
      {area != null ? <Row label="面積" value={`${area.toFixed(2)} 公頃`} /> : null}
      <Row label="縣市" value={str(props.county)} />
      <Row label="分區編號" value={str(props.zoning_id)} />
      <Note>ⓘ 都市計畫<b>法定劃設</b>（非實際使用範圍），目前僅臺北市與新北市有此資料</Note>
    </>
  );
}
