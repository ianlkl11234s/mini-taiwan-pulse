import { FONT_SIZE } from "../../styles/designTokens";
import { CARRIER_KINDS, MATCH_STATUSES, NETWORK_STRUCTURES_COLORS } from "../../data/networkStructuresTypes";
import { BSS_BRIDGE_V5_CLASS_LABELS, BSS_BRIDGE_V5_LINE_COLORS } from "../../data/bssBridgeTypes";
import { PopupDetails, PopupScroll, Row, Title } from "./shared";
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

function candidateWayIds(value: unknown): string {
  try {
    const ids: unknown = JSON.parse(String(value));
    return Array.isArray(ids) && ids.every((id) => typeof id === "string") ? ids.join("、") : "未提供";
  } catch {
    return "未提供";
  }
}


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

export function BssNationalBridgePreviewPanel({ props }: { props: Record<string, unknown> }) {
  const qaPassed = props.qa_status === "independently_verified"
    && typeof props.qa_release_id === "string" && props.qa_release_id.length > 0;
  const stage1Release = typeof props.stage1_release_id === "string" && props.stage1_release_id.length > 0;
  const stage1Supported = props.stage1_status === "supported" && stage1Release;
  const stage1SupportText = (value: unknown) => value === "true" ? "有支持" : value === "false" ? "有負向觀察" : "未定";
  const stage1SourceGroupText = {
    osm_bridge_tagged_candidate_exact_match: "目前參考線可精確對上 OSM 橋梁標記",
    ordinary_route_proxy: "普通道路推估",
    point_only: "僅點位",
    unresolved_reference: "來源對照待補",
    supplemental_aligned_osm_direction_candidate: "附近橋線同向推估（新增方向候選）",
    official_approximate_axis: "新北官方頭尾近似軸",
  }[String(props.stage1_source_group)] ?? "來源分組未提供";
  const stage1StatusText = stage1Supported ? "位置與無向局部方向有支持"
    : props.stage1_status === "supported" ? "標示為支持但缺 stage1 release，維持待確認"
      : props.stage1_status === "negative" ? "有負向觀察"
        : props.stage1_status === "unresolved" ? "證據未定"
          : "尚未審視";
  const role = String(props.geometry_role);
  const isOriginal = role === "original_direction_line";
  const isOffset = role === "offset_direction_line";
  const isOrdinaryRoute = role === "ordinary_route_direction_context";
  const isCurvedLocal = role === "near_curved_carrier_local_direction_context";
  const isWaterwayCrossing = role === "waterway_crossing_direction_context";
  const isMultiBridgeCrossing = role === "multi_near_carrier_waterway_direction_context";
  const isTiedRouteConsensus = role === "tied_route_consensus_direction_context";
  const isNoWaterwayCarrierConsensus = role === "no_waterway_carrier_consensus_direction_context";
  const isNoCrossingNearestRoute = role === "no_crossing_nearest_route_direction_context";
  const isStage1LocalDirectionCandidate = role === "stage1_local_direction_candidate";
  const isLowConfidenceConsensus = isTiedRouteConsensus || isNoWaterwayCarrierConsensus;
  const isFixedDirectionGlyph = isLowConfidenceConsensus || isNoCrossingNearestRoute || isStage1LocalDirectionCandidate;
  const isLine = isOriginal || isOffset || isOrdinaryRoute || isCurvedLocal || isWaterwayCrossing || isMultiBridgeCrossing || isFixedDirectionGlyph;
  const shortId = (value: unknown) => {
    const full = text(value);
    return /^[0-9a-f]{40,}$/i.test(full) ? `${full.slice(0, 12)}…` : full;
  };
  const idTitle = (value: unknown) => /^[0-9a-f]{40,}$/i.test(String(value ?? "")) ? String(value) : undefined;
  const registeredLength = numberText(props.bss_registered_length_m, " m");
  const drawnLength = isFixedDirectionGlyph ? "固定 30 m 方向示意，不是橋長" : isOrdinaryRoute || isWaterwayCrossing || isMultiBridgeCrossing ? "最多 30 m 固定方向示意，不是橋長" : numberText(props.line_drawn_length_m, " m");
  const pointTierText = text(props.line_tier, text(props.unified_tier, "未提供；點位不代表有方向線"));
  const showPointReason = !isLine && props.point_only_reason != null;
  const isOsmEntityLine = isLine && props.line_source_kind === "osm_bridge_entity";
  const lineSourceKindText = props.line_source_kind === "osm_bridge_entity" ? "OSM 橋實體（整段）" : text(props.line_source_kind);
  const v5ClassText = BSS_BRIDGE_V5_CLASS_LABELS[String(props.v5_class)] ?? "未提供";
  const v5LineColor = isLine ? BSS_BRIDGE_V5_LINE_COLORS[String(props.v5_class) as keyof typeof BSS_BRIDGE_V5_LINE_COLORS] : undefined;
  return <>
    <Title color={v5LineColor ?? (isNoCrossingNearestRoute ? "#f472b6" : isNoWaterwayCarrierConsensus ? "#60a5fa" : isTiedRouteConsensus ? "#fb7185" : isMultiBridgeCrossing ? "#bef264" : isWaterwayCrossing ? "#e879f9" : isCurvedLocal ? "#2dd4bf" : isOrdinaryRoute ? "#a78bfa" : isOffset ? "#f97316" : isLine ? "#22d3ee" : "#facc15")}>{text(props.bss_name, "BSS 橋梁研究（進行中）")}</Title>
    <PopupScroll>
      <Row label="狀態" value="進行中・站主限定；不是已確認橋身或路網" />
      <Row label="第一階段" value={stage1StatusText} />
      <Row label="行政區・類型" value={`${text(props.county_memberships)}・${text(props.bridge_type)}`} />
      <Row label="長度" value={isLine ? `登錄 ${registeredLength}・繪製 ${drawnLength}` : `登錄 ${registeredLength}`} />
      {isLine
        ? <Row label="線的來源依據" value={stage1SourceGroupText} />
        : showPointReason
          ? <Row label="目前僅留點原因" value={text(props.point_only_reason)} />
          : <Row label="方向線層級" value={pointTierText} />}
      <Row label="v5 分類" value={v5ClassText} />
      <PopupDetails summary="審核與來源">
        <Row label="第一階段支持" value={`位置：${stage1SupportText(props.stage1_location_supported)}；無向局部方向：${stage1SupportText(props.stage1_direction_supported)}`} />
        {!!props.stage1_reason && <Row label="第一階段理由" value={text(props.stage1_reason)} />}
        {!!props.stage1_evidence_basis && <Row label="第一階段證據" value={text(props.stage1_evidence_basis)} />}
        {stage1Release && <Row label="第一階段版本" value={shortId(props.stage1_release_id)} title={idTitle(props.stage1_release_id)} />}
        {!isLine && <Row label="線的來源依據" value={stage1SourceGroupText} />}
        {!!props.stage1_source_reference && <Row label="來源參考" value={text(props.stage1_source_reference)} />}
        {props.stage1_source_distance_m != null && <Row label="清冊點至參考線" value={`${numberText(props.stage1_source_distance_m, " m")}；非精度誤差`} />}
        {!!props.stage1_source_release_id && <Row label="來源依據版本" value={shortId(props.stage1_source_release_id)} title={idTitle(props.stage1_source_release_id)} />}
        <Row label="交通可及性初篩" value={{ road_bridge_carrier_candidate: "一般道路橋候選（仍須驗證身份、通行與連通）", road_elevated_or_expressway_review: "高架／快速道路路廊待查（暫不列入地方車行分析）", road_unresolved: "道路類型未判定", foot_or_rail_register_only: "人行／鐵道（不列入汽車分析）" }[String(props.facility_class_candidate)] ?? "未分類"} />
        <Row label="分類依據" value={text(props.classification_reason)} />
        {!!props.osm_highway_tag_for_class && <Row label="OSM 道路等級線索" value={text(props.osm_highway_tag_for_class)} />}
        <Row label="實體身份審核" value={text(props.identity_review_status, "not_reviewed")} />
        <Row label="高架形態" value={props.facility_form_review_hint === "elevated_form_review" ? "有高架線索，仍待複核" : "未判定"} />
        {!!props.facility_form_hint_evidence && <Row label="形態線索" value={text(props.facility_form_hint_evidence)} />}
        <Row label="網路連通性" value={text(props.network_connectivity_status, "not_evaluated")} />
        <Row label="BSS source key" value={text(props.source_key)} />
        <Row label="橋實體 ID" value={text(props.entity_id)} />
        <Row label="配對分數" value={numberText(props.match_score)} />
        <Row label="名稱相似度" value={numberText(props.name_similarity)} />
        <Row label="長度比（登錄÷實體）" value={numberText(props.length_ratio)} />
        <Row label="同實體紀錄數" value={numberText(props.entity_match_count)} />
        <Row label="官方軸方向差" value={numberText(props.official_axis_bearing_diff_deg, "°")} />
        {isLine && <>
          <Row label="方向線層級" value={isStage1LocalDirectionCandidate ? "附近橋線同向推估的新增方向候選；未確認唯一 reference" : isNoCrossingNearestRoute ? "無水系交會；最近一般路線有距離優勢的方向參考，低把握度" : isNoWaterwayCarrierConsensus ? "多條已標橋承載線的共同方向；無可用水系交會，低把握度" : isTiedRouteConsensus ? "多條普通路線水系交會的共同方向；低把握度" : isMultiBridgeCrossing ? "多候選已標橋線與水系交會方向參考；未確認同橋" : isWaterwayCrossing ? "普通路線與水系交會方向參考；未確認是橋" : isCurvedLocal ? "已標橋線局部方向參考；未確認橋跨方向" : isOrdinaryRoute ? "普通路網方向參考；不是已辨識橋線" : isOffset ? "offset 低把握度候選" : isOsmEntityLine ? "OSM 橋實體整段幾何（v5 配對）；身份仍待審核" : "original 原始候選"} />
          <Row label="方向來源" value={isNoCrossingNearestRoute ? "OSM 未標橋的一般路線（距離優勢）" : isTiedRouteConsensus ? "OSM 多條普通路線（方向一致）" : isNoWaterwayCarrierConsensus ? "OSM 多條已標橋承載線（方向一致）" : lineSourceKindText} />
          {isStage1LocalDirectionCandidate && <Row label="附近橋線候選" value={`${text(props.carrier_ids_json)}；可有多值，不代表唯一 reference`} />}
          {!isLowConfidenceConsensus && !isNoCrossingNearestRoute && <Row label="方向來源 feature ID" value={text(props.line_source_feature_id)} />}
          {!isLowConfidenceConsensus && !isNoCrossingNearestRoute && <Row label="方向來源網址" value={text(props.line_source_url)} />}
          <Row label="方向來源日期／快照" value={text(props.line_source_date_or_snapshot)} />
          <Row label="方向來源授權" value={text(props.line_source_license_label)} />
          {props.selected_osm_way_shared != null && <>
            <Row label="同一 OSM way 候選紀錄數" value={text(props.selected_osm_way_record_count)} />
            <Row label="共用來源待核對" value={props.selected_osm_way_shared ? "是；不能據此當成不同橋座" : "未發現共用；身份仍未核對"} />
            {!!props.representative_way_only && <Row label="多線同向來源" value="此 ID 只是選出的代表 way，並非完整候選集合" />}
          </>}
        </>}
        {!isLine && showPointReason && <Row label="方向線層級" value={pointTierText} />}
        {!isLine && props.ordinary_route_trial_outcome != null && <Row label="普通路網試驗" value={text(props.ordinary_route_trial_outcome)} />}
        {!isLine && props.supplemental_direction_available != null && <Row label="補充方向候選" value={props.supplemental_direction_available === true || props.supplemental_direction_available === "true" ? "有新增 30 m 方向標記；未列入影像支持" : "無"} />}
        {!isLine && props.selected_osm_way_shared != null && <>
          <Row label="同一 OSM way 候選紀錄數" value={text(props.selected_osm_way_record_count)} />
          <Row label="共用來源待核對" value={props.selected_osm_way_shared ? "是；不能據此當成不同橋座" : "未發現共用；身份仍未核對"} />
        </>}
        {isOffset && <>
          <Row label="offset 距離" value={numberText(props.offset_distance_m, " m")} />
          <Row label="OSM way ID" value={text(props.line_source_feature_id)} />
        </>}
        {isOrdinaryRoute && <>
          <Row label="路線距登錄點" value={numberText(props.offset_distance_m, " m")} />
          <Row label="路線方向角" value={numberText(props.axis_degrees_from_east_mod_180, "°（東向起算、無向軸）")} />
          <Row label="試驗分類" value={text(props.ordinary_route_trial_outcome)} />
        </>}
        {(isCurvedLocal || isWaterwayCrossing || isMultiBridgeCrossing) && <>
          <Row label="登錄點至參考線／交會" value={numberText(props.offset_distance_m, " m")} />
          <Row label="試驗結果" value={text(props.direction_context_outcome)} />
          {(isWaterwayCrossing || isMultiBridgeCrossing) && <Row label="交會 OSM 水系 way" value={text(props.secondary_osm_waterway_way_id)} />}
          <Row label="線形角色" value="僅方向參考；不是已驗證路網邊" />
        </>}
        {isLowConfidenceConsensus && <>
          <Row label="候選 OSM way ID（未選單一線）" value={candidateWayIds(isTiedRouteConsensus ? props.candidate_osm_way_ids_json : props.candidate_osm_carrier_ids_json)} />
          <Row label="共同方向角" value={numberText(props.axis_degrees_from_east_mod_180, "°（東向起算、無向軸）")} />
          <Row label="候選最大方向差" value={numberText(props.candidate_axis_spread_degrees, "°")} />
          <Row label="限制" value="只作點位方向示意；未選定哪條路線或承載線、未核對同橋或高架形態，不能用於路網連通分析。" />
        </>}
        {isNoCrossingNearestRoute && <>
          <Row label="最近一般路線 OSM way" value={text(props.candidate_osm_way_id)} />
          <Row label="路線距登錄點" value={numberText(props.nearest_route_distance_m, " m")} />
          <Row label="比次近路線近" value={numberText(props.nearest_route_margin_m, " m")} />
          <Row label="方向角" value={numberText(props.axis_degrees_from_east_mod_180, "°（東向起算、無向軸）")} />
          <Row label="同一 OSM way 候選紀錄數" value={text(props.selected_way_trial_record_count)} />
          {!!props.shared_selected_way_needs_identity_review && <Row label="共用來源待核對" value="是；不能據此當成不同橋座" />}
          <Row label="限制" value="最近路線僅供方向參考；未確認它就是橋身、橋頭尾或可通行邊。" />
        </>}
      </PopupDetails>
      <PopupDetails summary="舊綜合 QA">
        <Row label="舊綜合 QA（非本期位置／方向門檻）" value={qaPassed ? "曾通過來源點對應、局部方向與分類查核" : props.qa_status === "failed" ? "有負向觀察，仍待處理" : props.qa_status === "unknown" ? "已查看但證據不足，仍待查" : "尚未完成舊綜合查核"} />
        {!!props.qa_reason && <Row label="舊綜合 QA 查核紀錄" value={text(props.qa_reason)} />}
        {qaPassed && <Row label="舊綜合 QA 版本" value={shortId(props.qa_release_id)} title={idTitle(props.qa_release_id)} />}
        {!!props.qa_sample_set && <Row label="舊綜合 QA 樣本" value={props.qa_sample_set === "risk" ? "風險分層查核（不加入正式抽驗比例）" : props.qa_sample_set === "acceptance" ? "固定隨機正式抽驗" : text(props.qa_sample_set)} />}
        {!!props.qa_reference_date && <Row label="舊綜合 QA 查核日期（非拍攝日期）" value={text(props.qa_reference_date)} />}
        {!!props.qa_evidence_reference && <Row label="舊綜合 QA 獨立影像來源" value={text(props.qa_evidence_reference)} />}
      </PopupDetails>
      <PopupDetails summary="說明與限制">
        <Row label="第一階段範圍" value="完整形狀非必要；局部方向不是橋頭尾、工程長度或路網邊，也不確認具名實橋、分類或實體去重" />
        <Row label="第一階段整體（v4 抽驗）" value="正式 300：103 支持、2 負向、195 未定；3% 尚未證明，不能外推全臺；未對 v5 線重抽" />
        <Row label="路網邊狀態" value="未驗證，不能直接用於可及性計算" />
        {isLine && <Row label="長度語意" value={isFixedDirectionGlyph ? "以登錄點為中心的固定方向短線；不是橋身、端點或工程橋長" : isMultiBridgeCrossing ? "多候選 OSM 橋線在水系交會附近的短線；不代表同橋身份、端點或工程橋長" : isWaterwayCrossing ? "水系交會處的普通 OSM 路線短線，不代表橋身、端點或工程橋長" : isCurvedLocal ? "已標橋 OSM way 的局部短線，可能是引道；不代表橋身或工程橋長" : isOrdinaryRoute ? "普通 OSM 路線的局部短線，不代表橋身、端點或工程橋長" : isOsmEntityLine ? "OSM 橋實體成員路段總長（含各車道、未裁切到登錄範圍），不是 BSS 登錄或工程橋長" : "繪製方向候選，不是登錄、量測或工程橋長"} />}
        <Row label="限制" value="v5 共 23,276 條線（OSM 橋實體整段 17,830、新北官方頭尾近似軸 206、路網推估 5,240）均不是已審核實體橋身；不可據此計算橋座數、橋長、道路連通或可通行性。" />
        <Row label="BSS 來源" value={text(props.bss_source_url)} />
        <Row label="BSS 擷取時間" value={text(props.bss_retrieved_at_utc)} />
        <Row label="BSS 重用狀態" value={text(props.bss_source_license_status)} />
      </PopupDetails>
    </PopupScroll>
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
