import { FONT_SIZE } from "../../styles/designTokens";
import { CARRIER_KINDS, MATCH_STATUSES, NETWORK_STRUCTURES_COLORS } from "../../data/networkStructuresTypes";
import { Row } from "./shared";
import { useFeatureTheme } from "./featureTheme";

const isMissing = (value: unknown) => value == null || value === "" || value === "null";
const text = (value: unknown, fallback = "未提供") => isMissing(value) ? fallback : String(value);

function numberText(value: unknown, unit = "", fallback = "未提供") {
  if (isMissing(value)) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toLocaleString()}${unit}` : fallback;
}

const GEOMETRY_LABELS: Record<string, string> = {
  carrier_segment: "OSM 承載路段",
  native_footprint: "OSM 原生橋梁外框",
  approximate_axis: "官方端點連線（近似軸線）",
  coincident_endpoints: "原始重合端點；無可評估軸線",
};
const METRIC_LABELS: Record<string, string> = {
  distance_m: "線段距離（m）",
  bearing_difference_deg: "方位差（度）",
  carrier_length_m: "OSM 路段長度（m）",
  name_equal: "名稱一致",
  reason: "原因",
  osm_id: "OSM ID",
  score: "候選評分",
};

function listItem(value: unknown): string {
  if (value == null) return "未提供";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (Array.isArray(value)) return value.map(listItem).join("、");
  if (typeof value === "object") {
    return Object.entries(value).map(([key, item]) =>
      `${METRIC_LABELS[key] ?? key}：${listItem(item)}`,
    ).join("；");
  }
  return String(value);
}

function jsonList(value: unknown) {
  if (typeof value !== "string") return listItem(value);
  try { return listItem(JSON.parse(value)); } catch { return value; }
}

function Title({ color, children }: { color: string; children: string }) {
  return <div style={{ color, fontSize: FONT_SIZE.lg, fontWeight: 700, marginBottom: 6 }}>{children}</div>;
}

function SourceRows({ props }: { props: Record<string, unknown> }) {
  const theme = useFeatureTheme();
  let sourceUrl = "";
  try {
    const url = new URL(text(props.source_url, ""));
    if (url.protocol === "https:" || url.protocol === "http:") sourceUrl = url.toString();
  } catch { /* Missing or unsafe URLs remain plain source labels. */ }
  const dateMeaning = props.osm_type
    ? "OSM 快照截止時間"
    : "官方詮釋資料更新時間，非實測日期";
  return <>
    <Row label="來源" value={text(props.source_name)} />
    <Row label="資料日期" value={text(props.source_date)} />
    <Row label="日期意義" value={isMissing(props.source_date) ? "未提供" : dateMeaning} />
    <Row label="擷取時間" value={text(props.retrieved_at)} />
    {sourceUrl && <div style={{ marginTop: 6 }}>
      <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
        style={{ color: theme.link, fontSize: FONT_SIZE.sm, textDecoration: "underline", wordBreak: "break-all" }}>
        原始資料 ↗
      </a>
    </div>}
  </>;
}

function GeometryRow({ role }: { role: unknown }) {
  return <Row label="幾何" value={GEOMETRY_LABELS[String(role)] ?? text(role)} />;
}

export function OsmBridgeCarrierPanel({ props }: { props: Record<string, unknown> }) {
  return <>
    <Title color={NETWORK_STRUCTURES_COLORS.carriers}>{text(props.name, "OSM 橋梁承載線")}</Title>
    <Row label="OSM ID" value={`${text(props.osm_type)} / ${text(props.osm_id)}`} />
    <Row label="承載類型" value={CARRIER_KINDS.find((kind) => kind.value === props.carrier_kind)?.label ?? text(props.carrier_kind)} />
    <Row label="道路" value={text(props.highway)} />
    <Row label="鐵道" value={text(props.railway)} />
    <Row label="水道" value={text(props.waterway)} />
    <Row label="橋梁標記" value={text(props.bridge)} />
    <GeometryRow role={props.geometry_role} />
    <Row label="注意" value="每筆是 OSM way 路段；同一座橋可能包含多筆。" />
    <SourceRows props={props} />
  </>;
}

export function OsmBridgeFootprintPanel({ props }: { props: Record<string, unknown> }) {
  return <>
    <Title color={NETWORK_STRUCTURES_COLORS.footprint}>{text(props.name, "OSM 橋梁輪廓")}</Title>
    <Row label="OSM ID" value={`${text(props.osm_type)} / ${text(props.osm_id)}`} />
    <GeometryRow role={props.geometry_role} />
    <Row label="注意" value="原生外框，未以緩衝區補全；沒有外框不代表沒有橋。" />
    <SourceRows props={props} />
  </>;
}

export function OfficialBridgeNewTaipeiPanel({ props }: { props: Record<string, unknown> }) {
  return <>
    <Title color={NETWORK_STRUCTURES_COLORS.official}>{text(props.name, "新北市轄管橋梁")}</Title>
    <Row label="官方 ID" value={text(props.official_id)} />
    <Row label="行政區" value={text(props.town)} />
    <Row label="等級" value={text(props.grade)} />
    <Row label="登錄長度" value={numberText(props.official_length_m, " m")} />
    <GeometryRow role={props.geometry_role} />
    {props.geometry_role !== "coincident_endpoints" &&
      <Row label="注意" value="端點連線為近似位置；登錄長度沿用官方數值。" />}
    <SourceRows props={props} />
  </>;
}

export function BridgeComparisonNewTaipeiPanel({ props }: { props: Record<string, unknown> }) {
  const status = MATCH_STATUSES.find((item) => item.value === props.match_status);
  const scoreMissing = props.match_status === "NOT_EVALUATED" ? "未評估（缺值）" : "未計算（缺值）";
  return <>
    <Title color={status?.color ?? NETWORK_STRUCTURES_COLORS.notEvaluated}>{text(props.name, "橋梁比對候選")}</Title>
    <Row label="官方 ID" value={text(props.official_id)} />
    <Row label="比對狀態" value={status?.label ?? text(props.match_status)} />
    <Row label="方法" value={text(props.match_method)} />
    <Row label="原因" value={jsonList(props.match_reasons)} />
    <Row label="OSM way" value={jsonList(props.osm_way_ids)} />
    <Row label="候選評分" value={numberText(props.match_confidence, "", scoreMissing)} />
    <GeometryRow role={props.geometry_role} />
    <Row label="注意" value="候選比對，非權威配對；僅 OSM 表示此官方清冊未找到候選，不代表官方漏報。" />
    <SourceRows props={props} />
  </>;
}
