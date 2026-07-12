import { Row } from "./shared";

// Base map popup panels — 行政邊界 + 等高線 + OSM 路網
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
