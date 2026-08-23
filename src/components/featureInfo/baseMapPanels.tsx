import { Row } from "./shared";
import {
  maritimeBoundaryType, MARITIME_BOUNDARY_SOURCE_NOTE,
} from "../../data/maritimeBoundaryTypes";
import { formatIsobathRange, ISOBATH_ATTRIBUTION } from "../../data/isobathTypes";

// Base map popup panels — 行政邊界 + 海域界線 + 等高線 + OSM 路網
// PMTiles 來源 taipei-gis-analytics，欄位由 _manifest.json / catalog 各檔定義

const HIGHWAY_LABEL: Record<string, string> = {
  motorway: "高速公路 Motorway",
  motorway_link: "高速公路匝道",
  trunk: "快速道路 Trunk",
  trunk_link: "快速道路匝道",
  primary: "主要道路 Primary",
  primary_link: "主要道路匝道",
  secondary: "次要道路 Secondary",
  secondary_link: "次要道路匝道",
  tertiary: "聯絡道路 Tertiary",
  tertiary_link: "聯絡道路匝道",
  unclassified: "未分級 Unclassified",
  residential: "住宅道路 Residential",
  service: "服務道路 Service",
};

export function CountyBoundaryPanel({ props }: { props: Record<string, unknown> }) {
  const name = String(props["名稱"] ?? "");
  const code = String(props["行政區域代碼"] ?? "");
  const scale = String(props["比例尺分母"] ?? "");
  return (
    <div>
      <Row label="縣市" value={name} />
      <Row label="行政代碼" value={code} />
      <Row label="來源比例尺" value={scale ? `1:${scale}` : ""} />
      <Row label="來源" value="內政部國土測繪中心" />
    </div>
  );
}

export function TownshipBoundaryPanel({ props }: { props: Record<string, unknown> }) {
  const county = String(props.COUNTYNAME ?? "");
  const town = String(props.TOWNNAME ?? "");
  const eng = String(props.TOWNENG ?? "");
  const id = String(props.TOWNID ?? "");
  return (
    <div>
      <Row label="鄉鎮市區" value={town} />
      <Row label="縣市" value={county} />
      <Row label="英文" value={eng} />
      <Row label="TOWNID" value={id} />
      <Row label="來源" value="內政部國土測繪中心" />
    </div>
  );
}

export function VillageBoundaryPanel({ props }: { props: Record<string, unknown> }) {
  const county = String(props.COUNTYNAME ?? "");
  const town = String(props.TOWNNAME ?? "");
  const vill = String(props.VILLNAME ?? "");
  const eng = String(props.VILLENG ?? "");
  const code = String(props.VILLCODE ?? "");
  const note = String(props.NOTE ?? "");
  return (
    <div>
      <Row label="村里" value={vill} />
      <Row label="鄉鎮市區" value={town} />
      <Row label="縣市" value={county} />
      <Row label="英文" value={eng} />
      <Row label="VILLCODE" value={code} />
      <Row label="備註" value={note} />
      <Row label="來源" value="內政部國土測繪中心 NLSC" />
    </div>
  );
}

/**
 * 領海界線 —— 一個 layer 四種 feature（properties.layer 區分）。
 * 類型標籤／顏色／法律意義全部走 maritimeBoundaryTypes SSOT，
 * 只有基點才有 name / base_point_id / type 三欄（其餘類型為空，Row 自動略過）。
 */
export function MaritimeBoundaryPanel({ props }: { props: Record<string, unknown> }) {
  const meta = maritimeBoundaryType(props.layer);
  // layer_zh 是切片自帶的中文層名；SSOT 查不到時才退回它（不編造分類）
  const kind = meta?.label ?? String(props.layer_zh ?? props.layer ?? "");
  const region = String(props.region ?? "");
  const isPoint = props.layer === "basepoint";
  return (
    <div>
      <Row label="類型" value={kind} color={meta?.color} />
      <Row label="區域" value={region} />
      {isPoint && <Row label="基點名稱" value={String(props.name ?? "")} />}
      {isPoint && <Row label="基點編號" value={String(props.base_point_id ?? "")} />}
      {isPoint && <Row label="基點類型" value={String(props.type ?? "")} />}
      <Row label="法律意義" value={meta?.meaning ?? ""} />
      <Row label="來源" value={MARITIME_BOUNDARY_SOURCE_NOTE} />
    </div>
  );
}

export function Contour25kPanel({ props }: { props: Record<string, unknown> }) {
  const elev = props.elevation_m;
  const sheet = String(props.sheet_id ?? "");
  const period = String(props.release_period ?? "");
  return (
    <div>
      <Row label="海拔" value={typeof elev === "number" ? `${elev} m` : String(elev ?? "")} />
      <Row label="圖幅" value={sheet} />
      <Row label="期別" value={period} />
      <Row label="來源" value="經建版 1:25000 地形圖（精度 10m）" />
    </div>
  );
}

export function ContourDtm20Panel({ props }: { props: Record<string, unknown> }) {
  const elev = props.elev_m;
  return (
    <div>
      <Row label="海拔" value={typeof elev === "number" ? `${elev} m` : String(elev ?? "")} />
      <Row label="來源" value="DTM 20m 等高線（gdal_contour，全臺）" />
    </div>
  );
}

// 坡度分級（建管六級坡）— slope_class 1-6 對照坡度百分比區間
const SLOPE_CLASS_RANGE: Record<number, string> = {
  1: "<5%", 2: "5-15%", 3: "15-30%", 4: "30-40%", 5: "40-55%", 6: ">55%",
};

export function SlopeVectorPanel({ props }: { props: Record<string, unknown> }) {
  const cls = Number(props.slope_class ?? 0);
  const range = SLOPE_CLASS_RANGE[cls] ?? "";
  return (
    <div>
      <Row label="坡度級別" value={cls ? `${cls}級坡 · ${range}（建管）` : "無資料"} />
      <Row label="來源" value="建築技術規則六級坡分級（DTM 20m 計算）" />
    </div>
  );
}

// 坡向分級（8 方位）— aspect_class 1-8 方位，9 為平地
const ASPECT_CLASS_NAME: Record<number, string> = {
  1: "北", 2: "東北", 3: "東", 4: "東南", 5: "南",
  6: "西南", 7: "西", 8: "西北", 9: "平地（坡度<5°）",
};

export function AspectVectorPanel({ props }: { props: Record<string, unknown> }) {
  const cls = Number(props.aspect_class ?? 0);
  const name = ASPECT_CLASS_NAME[cls] ?? "";
  return (
    <div>
      <Row label="坡向" value={cls ? name : "無資料"} />
      <Row label="來源" value="坡面朝向 8 方位分級（DTM 20m 計算）" />
    </div>
  );
}

// 海底等深線（線）：depth_m 整數負值，11 級
export function IsobathLinePanel({ props }: { props: Record<string, unknown> }) {
  const depth = Number(props.depth_m ?? 0);
  return (
    <div>
      <Row label="水深" value={depth ? `${Math.abs(depth).toLocaleString("zh-TW")} m` : ""} />
      <Row label="來源" value={ISOBATH_ATTRIBUTION} />
    </div>
  );
}

// 海底等深線（深度分帶 band）：dmin/dmax 整數負值，12 級
export function IsobathBandPanel({ props }: { props: Record<string, unknown> }) {
  const dmin = Number(props.dmin ?? 0);
  const dmax = Number(props.dmax ?? 0);
  return (
    <div>
      <Row label="深度區間" value={formatIsobathRange(dmin, dmax)} />
      <Row label="來源" value={ISOBATH_ATTRIBUTION} />
    </div>
  );
}

export function OsmRoadDrivePanel({ props }: { props: Record<string, unknown> }) {
  const name = String(props.name ?? "");
  const ref = String(props.ref ?? "");
  const highway = String(props.highway ?? "");
  const oneway = props.oneway;
  const maxspeed = String(props.maxspeed ?? "");
  const lanes = String(props.lanes ?? "");
  const surface = String(props.surface ?? "");
  const bridge = String(props.bridge ?? "");
  const tunnel = String(props.tunnel ?? "");
  return (
    <div>
      <Row label="名稱" value={name} />
      <Row label="編號" value={ref} />
      <Row label="等級" value={HIGHWAY_LABEL[highway] ?? highway} />
      <Row label="單行道" value={oneway ? "是" : ""} />
      <Row label="速限" value={maxspeed} />
      <Row label="車道" value={lanes} />
      <Row label="路面" value={surface} />
      <Row label="橋梁" value={bridge && bridge !== "no" ? bridge : ""} />
      <Row label="隧道" value={tunnel && tunnel !== "no" ? tunnel : ""} />
      <Row label="來源" value="OpenStreetMap" />
    </div>
  );
}
