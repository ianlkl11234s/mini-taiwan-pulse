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
  inspection_location_point: "原始檢測紀錄座標點；非橋軸或橋面",
  official_registered_point: "官方登錄點；非隧道線形或洞口",
  source_signal_location_point: "來源號誌位置點；非路口中心",
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
    : props.geometry_role === "source_signal_location_point"
      ? "HTTP Last-Modified 檔案時間，非逐點巡檢日期"
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

export function TainanBridgeInspectionsPanel({ props }: { props: Record<string, unknown> }) {
  return <>
    <Title color="#a855f7">{text(props.name, "臺南橋梁檢測紀錄")}</Title>
    <Row label="檢測年度" value={isMissing(props.inspection_year_roc) ? "未提供" : `民國 ${text(props.inspection_year_roc)} 年（未提供確切日期）`} />
    <Row label="檢測員意見" value={text(props.inspection_comment)} />
    <Row label="行政區" value={text(props.town)} />
    <Row label="主管機關" value={text(props.competent_authority)} />
    <Row label="管理維護機關" value={text(props.maintenance_authority)} />
    <Row label="登錄總長" value={numberText(props.bridge_total_length_m, " m")} />
    <Row label="登錄淨寬" value={numberText(props.bridge_clear_width_m, " m")} />
    <GeometryRow role={props.geometry_role} />
    <Row label="資料限制" value="這是歷史檢測紀錄，來源無橋梁系統 ID、分數或即時通行狀態；無法直接與其他橋梁清冊合併。" />
    <SourceRows props={props} />
  </>;
}

export function OfficialBridgeHsinchuPanel({ props }: { props: Record<string, unknown> }) {
  return <>
    <Title color="#22d3ee">{text(props.name, "新竹市橋梁")}</Title>
    <Row label="路線" value={text(props.route)} />
    <Row label="登錄長度" value={numberText(props.official_length_m, " m")} />
    <Row label="清冊 ID" value="來源未提供；地圖識別碼僅供本次資料重現" />
    <GeometryRow role={props.geometry_role} />
    <Row label="資料限制" value="橋頭尾連線是近似位置，非實際橋身；未與檢測紀錄建立權威配對，也不表示結構安全狀態。" />
    <SourceRows props={props} />
  </>;
}

export function TaipeiRoadTunnelPanel({ props }: { props: Record<string, unknown> }) {
  return <>
    <Title color="#f59e0b">{text(props.name, "臺北市道路隧道")}</Title>
    <Row label="官方隧道 ID" value={text(props.official_tunnel_id)} />
    <Row label="隧道類型" value={text(props.tunnel_kind)} />
    <Row label="管理單位" value={text(props.manager)} />
    <Row label="路線" value={text(props.route_description)} />
    <Row label="方向明細" value={numberText(props.direction_count, " 筆")} />
    <Row label="方向登錄長度合計" value={numberText(props.directional_length_sum_m, " m")} />
    <GeometryRow role={props.geometry_role} />
    <Row label="資料限制" value="僅顯示官方登錄點；方向長度為各方向合計，非隧道總長。部分端點距離與登錄長度不一致，未繪製假定隧道線。來源未提供資料日期或即時通行狀態。" />
    <SourceRows props={props} />
  </>;
}

export function TainanRoadTunnelPanel({ props }: { props: Record<string, unknown> }) {
  return <>
    <Title color="#fb923c">{text(props.name, "臺南市道路隧道")}</Title>
    <Row label="道路編號" value={text(props.route_ref)} />
    <Row label="方向" value={text(props.directionality)} />
    <Row label="登錄長度" value={numberText(props.official_length_m, " m")} />
    <Row label="登錄寬度" value={numberText(props.official_width_m, " m")} />
    <Row label="車道數" value={numberText(props.lane_count)} />
    <GeometryRow role={props.geometry_role} />
    <Row label="座標與時間限制" value="來源未宣告 CRS，WGS84 僅依數值範圍推定；未提供資料日期或即時通行狀態。" />
    <SourceRows props={props} />
  </>;
}

export function ChanghuaTrafficSignalPanel({ props }: { props: Record<string, unknown> }) {
  return <>
    <Title color="#84cc16">{text(props.name, "彰化縣道路號誌")}</Title>
    <Row label="來源編號" value={text(props.source_record_id)} />
    <Row label="號誌種類" value={text(props.signal_kind)} />
    <Row label="權責單位" value={text(props.responsible_authority)} />
    <Row label="地區" value={text(props.district)} />
    <GeometryRow role={props.geometry_role} />
    <Row label="資料限制" value="一筆是號誌清冊點，不等於獨立路口；無即時燈態、秒數或故障資訊。" />
    <SourceRows props={props} />
  </>;
}
