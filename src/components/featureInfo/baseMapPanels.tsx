import { Row } from "./shared";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
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
  const { t: tr } = useLocale();
  const name = String(props["名稱"] ?? "");
  const code = String(props["行政區域代碼"] ?? "");
  const scale = String(props["比例尺分母"] ?? "");
  return (
    <div>
      <Row field="county" value={name} />
      <Row label={tr("popup.baseMap.adminCode")} value={code} />
      <Row label={tr("popup.baseMap.sourceScale")} value={scale ? `1:${scale}` : ""} />
      <Row field="source" value={tr("popup.baseMap.nlsc")} />
    </div>
  );
}

export function TownshipBoundaryPanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  const county = String(props.COUNTYNAME ?? "");
  const town = String(props.TOWNNAME ?? "");
  const eng = String(props.TOWNENG ?? "");
  const id = String(props.TOWNID ?? "");
  return (
    <div>
      <Row label={tr("popup.baseMap.township")} value={town} />
      <Row field="county" value={county} />
      <Row field="englishShort" value={eng} />
      <Row label="TOWNID" value={id} />
      <Row field="source" value={tr("popup.baseMap.nlsc")} />
    </div>
  );
}

export function VillageBoundaryPanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  const county = String(props.COUNTYNAME ?? "");
  const town = String(props.TOWNNAME ?? "");
  const vill = String(props.VILLNAME ?? "");
  const eng = String(props.VILLENG ?? "");
  const code = String(props.VILLCODE ?? "");
  const note = String(props.NOTE ?? "");
  return (
    <div>
      <Row field="village" value={vill} />
      <Row label={tr("popup.baseMap.township")} value={town} />
      <Row field="county" value={county} />
      <Row field="englishShort" value={eng} />
      <Row label="VILLCODE" value={code} />
      <Row field="remarks" value={note} />
      <Row field="source" value={tr("popup.baseMap.nlscShort")} />
    </div>
  );
}

/**
 * 領海界線 —— 一個 layer 四種 feature（properties.layer 區分）。
 * 類型標籤／顏色／法律意義全部走 maritimeBoundaryTypes SSOT，
 * 只有基點才有 name / base_point_id / type 三欄（其餘類型為空，Row 自動略過）。
 */
export function MaritimeBoundaryPanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  const meta = maritimeBoundaryType(props.layer);
  // layer_zh 是切片自帶的中文層名；SSOT 查不到時才退回它（不編造分類）
  const kind = meta?.label ?? String(props.layer_zh ?? props.layer ?? "");
  const region = String(props.region ?? "");
  const isPoint = props.layer === "basepoint";
  return (
    <div>
      <Row field="type" value={kind} color={meta?.color} />
      <Row field="region" value={region} />
      {isPoint && <Row label={tr("popup.baseMap.basepointName")} value={String(props.name ?? "")} />}
      {isPoint && <Row label={tr("popup.baseMap.basepointId")} value={String(props.base_point_id ?? "")} />}
      {isPoint && <Row label={tr("popup.baseMap.basepointType")} value={String(props.type ?? "")} />}
      <Row label={tr("popup.baseMap.legalMeaning")} value={meta?.meaning ?? ""} />
      <Row field="source" value={MARITIME_BOUNDARY_SOURCE_NOTE} />
    </div>
  );
}

export function Contour25kPanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  const elev = props.elevation_m;
  const sheet = String(props.sheet_id ?? "");
  const period = String(props.release_period ?? "");
  return (
    <div>
      <Row field="elevation" value={typeof elev === "number" ? `${elev} m` : String(elev ?? "")} />
      <Row label={tr("popup.baseMap.sheet")} value={sheet} />
      <Row label={tr("popup.baseMap.releasePeriod")} value={period} />
      <Row field="source" value={tr("popup.baseMap.contour25kSource")} />
    </div>
  );
}

export function ContourDtm20Panel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  const elev = props.elev_m;
  return (
    <div>
      <Row field="elevation" value={typeof elev === "number" ? `${elev} m` : String(elev ?? "")} />
      <Row field="source" value={tr("popup.baseMap.contourDtmSource")} />
    </div>
  );
}

// 坡度分級（建管六級坡）— slope_class 1-6 對照坡度百分比區間
const SLOPE_CLASS_RANGE: Record<number, string> = {
  1: "<5%", 2: "5-15%", 3: "15-30%", 4: "30-40%", 5: "40-55%", 6: ">55%",
};

export function SlopeVectorPanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  const cls = Number(props.slope_class ?? 0);
  const range = SLOPE_CLASS_RANGE[cls] ?? "";
  return (
    <div>
      <Row label={tr("popup.baseMap.slopeClass")} value={cls ? tr("popup.baseMap.slopeValue", { cls, range }) : tr("popup.common.noData")} />
      <Row field="source" value={tr("popup.baseMap.slopeSource")} />
    </div>
  );
}

// 坡向分級（8 方位）— aspect_class 1-8 方位，9 為平地
const ASPECT_CLASS_NAME: Record<number, string> = {
  1: "北", 2: "東北", 3: "東", 4: "東南", 5: "南",
  6: "西南", 7: "西", 8: "西北", 9: "平地（坡度<5°）",
};

export function AspectVectorPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const cls = Number(props.aspect_class ?? 0);
  const name = ASPECT_CLASS_NAME[cls] ?? "";
  return (
    <div>
      <Row label={tr("popup.baseMap.aspect")} value={cls ? enumLabel("baseMapAspect", cls, name, i18n) : tr("popup.common.noData")} />
      <Row field="source" value={tr("popup.baseMap.aspectSource")} />
    </div>
  );
}

// 海底等深線（線）：depth_m 整數負值，11 級
export function IsobathLinePanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr, formatNumber } = useLocale();
  const depth = Number(props.depth_m ?? 0);
  return (
    <div>
      <Row label={tr("popup.baseMap.waterDepth")} value={depth ? `${formatNumber(Math.abs(depth))} m` : ""} />
      <Row field="source" value={ISOBATH_ATTRIBUTION} />
    </div>
  );
}

// 海底等深線（深度分帶 band）：dmin/dmax 整數負值，12 級
export function IsobathBandPanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  const dmin = Number(props.dmin ?? 0);
  const dmax = Number(props.dmax ?? 0);
  return (
    <div>
      <Row label={tr("popup.baseMap.depthRange")} value={formatIsobathRange(dmin, dmax)} />
      <Row field="source" value={ISOBATH_ATTRIBUTION} />
    </div>
  );
}

export function OsmRoadDrivePanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
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
      <Row field="name" value={name} />
      <Row field="number" value={ref} />
      <Row field="level" value={highway ? enumLabel("baseMapHighway", highway, HIGHWAY_LABEL[highway] ?? highway, i18n) : ""} />
      <Row label={tr("popup.baseMap.oneway")} value={oneway ? tr("popup.common.yes") : ""} />
      <Row field="speedLimit" value={maxspeed} />
      <Row label={tr("popup.baseMap.lanes")} value={lanes} />
      <Row label={tr("popup.baseMap.surface")} value={surface} />
      <Row label={tr("popup.baseMap.bridge")} value={bridge && bridge !== "no" ? bridge : ""} />
      <Row label={tr("popup.baseMap.tunnel")} value={tunnel && tunnel !== "no" ? tunnel : ""} />
      <Row field="source" value="OpenStreetMap" />
    </div>
  );
}
