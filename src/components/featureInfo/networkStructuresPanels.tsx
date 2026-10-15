import { FONT_SIZE } from "../../styles/designTokens";
import { CARRIER_KINDS, MATCH_STATUSES, NETWORK_STRUCTURES_COLORS } from "../../data/networkStructuresTypes";
import { BSS_BRIDGE_V5_CLASS_LABELS, BSS_BRIDGE_V5_LINE_COLORS } from "../../data/bssBridgeTypes";
import { PopupDetails, PopupScroll, Row, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import { displayRocYear, enumLabel } from "../../i18n/dataText";

type L = ReturnType<typeof useLocale>;

const isMissing = (value: unknown) => value == null || value === "" || value === "null";
const textWith = ({ t }: L) => (value: unknown, fallback: string = t("popup.common.notProvided")) => isMissing(value) ? fallback : String(value);

const numberTextWith = ({ t, formatNumber }: L) => (value: unknown, unit = "", fallback: string = t("popup.common.notProvided")) => {
  if (isMissing(value)) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? `${formatNumber(number)}${unit}` : fallback;
};

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
const STAGE1_SOURCE_GROUP_LABELS: Record<string, string> = {
  osm_bridge_tagged_candidate_exact_match: "目前參考線可精確對上 OSM 橋梁標記",
  ordinary_route_proxy: "普通道路推估",
  point_only: "僅點位",
  unresolved_reference: "來源對照待補",
  supplemental_aligned_osm_direction_candidate: "附近橋線同向推估（新增方向候選）",
  official_approximate_axis: "新北官方頭尾近似軸",
};
const FACILITY_CLASS_LABELS: Record<string, string> = {
  road_bridge_carrier_candidate: "一般道路橋候選（仍須驗證身份、通行與連通）",
  road_elevated_or_expressway_review: "高架／快速道路路廊待查（暫不列入地方車行分析）",
  road_unresolved: "道路類型未判定",
  foot_or_rail_register_only: "人行／鐵道（不列入汽車分析）",
};

function candidateWayIds(value: unknown, { t }: L): string {
  try {
    const ids: unknown = JSON.parse(String(value));
    return Array.isArray(ids) && ids.every((id) => typeof id === "string") ? ids.join(t("popup.common.listSeparator")) : t("popup.common.notProvided");
  } catch {
    return t("popup.common.notProvided");
  }
}

function listItem(value: unknown, i18n: L): string {
  const { t } = i18n;
  if (value == null) return t("popup.common.notProvided");
  if (typeof value === "boolean") return value ? t("popup.common.yes") : t("popup.common.no");
  if (Array.isArray(value)) return value.map((item) => listItem(item, i18n)).join(t("popup.common.listSeparator"));
  if (typeof value === "object") {
    return Object.entries(value).map(([key, item]) =>
      t("popup.networkStructures.kv", { key: enumLabel("networkMetric", key, METRIC_LABELS[key] ?? key, i18n), value: listItem(item, i18n) }),
    ).join(t("popup.common.semicolon"));
  }
  return String(value);
}

function jsonList(value: unknown, i18n: L) {
  if (typeof value !== "string") return listItem(value, i18n);
  try { return listItem(JSON.parse(value), i18n); } catch { return value; }
}

function SourceRows({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const text = textWith(i18n);
  const theme = useFeatureTheme();
  let sourceUrl = "";
  try {
    const url = new URL(text(props.source_url, ""));
    if (url.protocol === "https:" || url.protocol === "http:") sourceUrl = url.toString();
  } catch { /* Missing or unsafe URLs remain plain source labels. */ }
  const dateMeaning = props.osm_type
    ? t("popup.networkStructures.dateMeaningOsm")
    : props.geometry_role === "source_signal_location_point"
      ? t("popup.networkStructures.dateMeaningSignal")
      : t("popup.networkStructures.dateMeaningOfficial");
  return <>
    <Row field="source" value={text(props.source_name)} />
    <Row field="dataDate" value={text(props.source_date)} />
    <Row label={t("popup.networkStructures.dateMeaning")} value={isMissing(props.source_date) ? t("popup.common.notProvided") : dateMeaning} />
    <Row label={t("popup.networkStructures.retrievedAt")} value={text(props.retrieved_at)} />
    {sourceUrl && <div style={{ marginTop: 6 }}>
      <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
        style={{ color: theme.link, fontSize: FONT_SIZE.sm, textDecoration: "underline", wordBreak: "break-all" }}>
        {t("popup.networkStructures.originalLink")}
      </a>
    </div>}
  </>;
}

function GeometryRow({ role }: { role: unknown }) {
  const i18n = useLocale();
  const { t } = i18n;
  const text = textWith(i18n);
  return <Row label={t("popup.networkStructures.geometry")} value={enumLabel("networkGeometry", String(role), GEOMETRY_LABELS[String(role)] ?? text(role), i18n)} />;
}

export function OsmBridgeCarrierPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const text = textWith(i18n);
  const carrierKind = CARRIER_KINDS.find((kind) => kind.value === props.carrier_kind);
  return <>
    <Title color={NETWORK_STRUCTURES_COLORS.carriers}>{text(props.name, t("popup.networkStructures.carrierTitle"))}</Title>
    <Row field="osmId" value={`${text(props.osm_type)} / ${text(props.osm_id)}`} />
    <Row label={t("popup.networkStructures.carrierKind")} value={carrierKind ? enumLabel("networkCarrierKind", carrierKind.value, carrierKind.label, i18n) : text(props.carrier_kind)} />
    <Row label={t("popup.networkStructures.road")} value={text(props.highway)} />
    <Row label={t("popup.networkStructures.rail")} value={text(props.railway)} />
    <Row label={t("popup.networkStructures.waterway")} value={text(props.waterway)} />
    <Row label={t("popup.networkStructures.bridgeTag")} value={text(props.bridge)} />
    <GeometryRow role={props.geometry_role} />
    <Row field="caution" value={t("popup.networkStructures.carrierCaution")} />
    <SourceRows props={props} />
  </>;
}

export function OsmBridgeFootprintPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const text = textWith(i18n);
  return <>
    <Title color={NETWORK_STRUCTURES_COLORS.footprint}>{text(props.name, t("popup.networkStructures.footprintTitle"))}</Title>
    <Row field="osmId" value={`${text(props.osm_type)} / ${text(props.osm_id)}`} />
    <GeometryRow role={props.geometry_role} />
    <Row field="caution" value={t("popup.networkStructures.footprintCaution")} />
    <SourceRows props={props} />
  </>;
}

export function BssNationalBridgePreviewPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const text = textWith(i18n);
  const numberText = numberTextWith(i18n);
  const qaPassed = props.qa_status === "independently_verified"
    && typeof props.qa_release_id === "string" && props.qa_release_id.length > 0;
  const stage1Release = typeof props.stage1_release_id === "string" && props.stage1_release_id.length > 0;
  const stage1Supported = props.stage1_status === "supported" && stage1Release;
  const stage1SupportText = (value: unknown) => value === "true" ? t("popup.networkStructures.supported") : value === "false" ? t("popup.networkStructures.negativeObs") : t("popup.networkStructures.undetermined");
  const groupCode = String(props.stage1_source_group);
  const stage1SourceGroupText = STAGE1_SOURCE_GROUP_LABELS[groupCode]
    ? enumLabel("bssStage1SourceGroup", groupCode, STAGE1_SOURCE_GROUP_LABELS[groupCode], i18n)
    : t("popup.networkStructures.sourceGroupMissing");
  const stage1StatusText = stage1Supported ? t("popup.networkStructures.stage1Supported")
    : props.stage1_status === "supported" ? t("popup.networkStructures.stage1MissingRelease")
      : props.stage1_status === "negative" ? t("popup.networkStructures.negativeObs")
        : props.stage1_status === "unresolved" ? t("popup.networkStructures.evidenceUndetermined")
          : t("popup.networkStructures.notReviewed");
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
  const drawnLength = isFixedDirectionGlyph ? t("popup.networkStructures.fixedGlyph") : isOrdinaryRoute || isWaterwayCrossing || isMultiBridgeCrossing ? t("popup.networkStructures.maxGlyph") : numberText(props.line_drawn_length_m, " m");
  const pointTierText = text(props.line_tier, text(props.unified_tier, t("popup.networkStructures.pointNoLine")));
  const showPointReason = !isLine && props.point_only_reason != null;
  const isOsmEntityLine = isLine && props.line_source_kind === "osm_bridge_entity";
  const lineSourceKindText = props.line_source_kind === "osm_bridge_entity" ? t("popup.networkStructures.osmEntityWhole") : text(props.line_source_kind);
  const facilityCode = String(props.facility_class_candidate);
  const v5Code = String(props.v5_class);
  const v5ClassText = BSS_BRIDGE_V5_CLASS_LABELS[v5Code]
    ? enumLabel("bssV5Class", v5Code, BSS_BRIDGE_V5_CLASS_LABELS[v5Code], i18n)
    : t("popup.common.notProvided");
  const v5LineColor = isLine ? BSS_BRIDGE_V5_LINE_COLORS[String(props.v5_class) as keyof typeof BSS_BRIDGE_V5_LINE_COLORS] : undefined;
  return <>
    <Title color={v5LineColor ?? (isNoCrossingNearestRoute ? "#f472b6" : isNoWaterwayCarrierConsensus ? "#60a5fa" : isTiedRouteConsensus ? "#fb7185" : isMultiBridgeCrossing ? "#bef264" : isWaterwayCrossing ? "#e879f9" : isCurvedLocal ? "#2dd4bf" : isOrdinaryRoute ? "#a78bfa" : isOffset ? "#f97316" : isLine ? "#22d3ee" : "#facc15")}>{text(props.bss_name, t("popup.networkStructures.bssTitle"))}</Title>
    <PopupScroll>
      <Row field="status" value={t("popup.networkStructures.statusValue")} />
      <Row label={t("popup.networkStructures.stage1")} value={stage1StatusText} />
      <Row label={t("popup.networkStructures.countyType")} value={`${text(props.county_memberships)}・${text(props.bridge_type)}`} />
      <Row field="length" value={isLine ? t("popup.networkStructures.lengthValueLine", { registered: registeredLength, drawn: drawnLength }) : t("popup.networkStructures.lengthValuePoint", { registered: registeredLength })} />
      {isLine
        ? <Row label={t("popup.networkStructures.lineBasis")} value={stage1SourceGroupText} />
        : showPointReason
          ? <Row label={t("popup.networkStructures.pointOnlyReason")} value={text(props.point_only_reason)} />
          : <Row label={t("popup.networkStructures.directionTier")} value={pointTierText} />}
      <Row label={t("popup.networkStructures.v5Class")} value={v5ClassText} />
      <PopupDetails summary={t("popup.networkStructures.reviewAndSource")}>
        <Row label={t("popup.networkStructures.stage1Support")} value={t("popup.networkStructures.stage1SupportValue", { location: stage1SupportText(props.stage1_location_supported), direction: stage1SupportText(props.stage1_direction_supported) })} />
        {!!props.stage1_reason && <Row label={t("popup.networkStructures.stage1Reason")} value={text(props.stage1_reason)} />}
        {!!props.stage1_evidence_basis && <Row label={t("popup.networkStructures.stage1Evidence")} value={text(props.stage1_evidence_basis)} />}
        {stage1Release && <Row label={t("popup.networkStructures.stage1Release")} value={shortId(props.stage1_release_id)} title={idTitle(props.stage1_release_id)} />}
        {!isLine && <Row label={t("popup.networkStructures.lineBasis")} value={stage1SourceGroupText} />}
        {!!props.stage1_source_reference && <Row label={t("popup.networkStructures.sourceReference")} value={text(props.stage1_source_reference)} />}
        {props.stage1_source_distance_m != null && <Row label={t("popup.networkStructures.sourceDistance")} value={t("popup.networkStructures.sourceDistanceValue", { distance: numberText(props.stage1_source_distance_m, " m") })} />}
        {!!props.stage1_source_release_id && <Row label={t("popup.networkStructures.sourceReleaseId")} value={shortId(props.stage1_source_release_id)} title={idTitle(props.stage1_source_release_id)} />}
        <Row label={t("popup.networkStructures.accessScreen")} value={FACILITY_CLASS_LABELS[facilityCode] ? enumLabel("bssFacilityClass", facilityCode, FACILITY_CLASS_LABELS[facilityCode], i18n) : t("popup.common.unclassified")} />
        <Row label={t("popup.networkStructures.classReason")} value={text(props.classification_reason)} />
        {!!props.osm_highway_tag_for_class && <Row label={t("popup.networkStructures.osmHighwayHint")} value={text(props.osm_highway_tag_for_class)} />}
        <Row label={t("popup.networkStructures.identityReview")} value={text(props.identity_review_status, "not_reviewed")} />
        <Row label={t("popup.networkStructures.elevatedForm")} value={props.facility_form_review_hint === "elevated_form_review" ? t("popup.networkStructures.elevatedHint") : t("popup.networkStructures.formUndetermined")} />
        {!!props.facility_form_hint_evidence && <Row label={t("popup.networkStructures.formHint")} value={text(props.facility_form_hint_evidence)} />}
        <Row label={t("popup.networkStructures.connectivity")} value={text(props.network_connectivity_status, "not_evaluated")} />
        <Row label="BSS source key" value={text(props.source_key)} />
        <Row label={t("popup.networkStructures.entityId")} value={text(props.entity_id)} />
        <Row label={t("popup.networkStructures.matchScore")} value={numberText(props.match_score)} />
        <Row label={t("popup.networkStructures.nameSimilarity")} value={numberText(props.name_similarity)} />
        <Row label={t("popup.networkStructures.lengthRatio")} value={numberText(props.length_ratio)} />
        <Row label={t("popup.networkStructures.entityMatchCount")} value={numberText(props.entity_match_count)} />
        <Row label={t("popup.networkStructures.axisBearingDiff")} value={numberText(props.official_axis_bearing_diff_deg, "°")} />
        {isLine && <>
          <Row label={t("popup.networkStructures.directionTier")} value={isStage1LocalDirectionCandidate ? t("popup.networkStructures.tierStage1Local") : isNoCrossingNearestRoute ? t("popup.networkStructures.tierNoCrossing") : isNoWaterwayCarrierConsensus ? t("popup.networkStructures.tierNoWaterwayConsensus") : isTiedRouteConsensus ? t("popup.networkStructures.tierTiedConsensus") : isMultiBridgeCrossing ? t("popup.networkStructures.tierMultiBridge") : isWaterwayCrossing ? t("popup.networkStructures.tierWaterway") : isCurvedLocal ? t("popup.networkStructures.tierCurved") : isOrdinaryRoute ? t("popup.networkStructures.tierOrdinary") : isOffset ? t("popup.networkStructures.tierOffset") : isOsmEntityLine ? t("popup.networkStructures.tierOsmEntity") : t("popup.networkStructures.tierOriginal")} />
          <Row label={t("popup.networkStructures.dirSource")} value={isNoCrossingNearestRoute ? t("popup.networkStructures.dirSourceNoCrossing") : isTiedRouteConsensus ? t("popup.networkStructures.dirSourceTied") : isNoWaterwayCarrierConsensus ? t("popup.networkStructures.dirSourceNoWaterway") : lineSourceKindText} />
          {isStage1LocalDirectionCandidate && <Row label={t("popup.networkStructures.nearbyBridgeLines")} value={t("popup.networkStructures.nearbyBridgeLinesValue", { ids: text(props.carrier_ids_json) })} />}
          {!isLowConfidenceConsensus && !isNoCrossingNearestRoute && <Row label={t("popup.networkStructures.dirFeatureId")} value={text(props.line_source_feature_id)} />}
          {!isLowConfidenceConsensus && !isNoCrossingNearestRoute && <Row label={t("popup.networkStructures.dirUrl")} value={text(props.line_source_url)} />}
          <Row label={t("popup.networkStructures.dirDate")} value={text(props.line_source_date_or_snapshot)} />
          <Row label={t("popup.networkStructures.dirLicense")} value={text(props.line_source_license_label)} />
          {props.selected_osm_way_shared != null && <>
            <Row label={t("popup.networkStructures.sameWayCount")} value={text(props.selected_osm_way_record_count)} />
            <Row label={t("popup.networkStructures.sharedSource")} value={props.selected_osm_way_shared ? t("popup.networkStructures.sharedYes") : t("popup.networkStructures.sharedNo")} />
            {!!props.representative_way_only && <Row label={t("popup.networkStructures.multiLineSameDir")} value={t("popup.networkStructures.representativeWayOnly")} />}
          </>}
        </>}
        {!isLine && showPointReason && <Row label={t("popup.networkStructures.directionTier")} value={pointTierText} />}
        {!isLine && props.ordinary_route_trial_outcome != null && <Row label={t("popup.networkStructures.ordinaryTrial")} value={text(props.ordinary_route_trial_outcome)} />}
        {!isLine && props.supplemental_direction_available != null && <Row label={t("popup.networkStructures.supplementalDir")} value={props.supplemental_direction_available === true || props.supplemental_direction_available === "true" ? t("popup.networkStructures.supplementalYes") : t("popup.common.none")} />}
        {!isLine && props.selected_osm_way_shared != null && <>
          <Row label={t("popup.networkStructures.sameWayCount")} value={text(props.selected_osm_way_record_count)} />
          <Row label={t("popup.networkStructures.sharedSource")} value={props.selected_osm_way_shared ? t("popup.networkStructures.sharedYes") : t("popup.networkStructures.sharedNo")} />
        </>}
        {isOffset && <>
          <Row label={t("popup.networkStructures.offsetDistance")} value={numberText(props.offset_distance_m, " m")} />
          <Row label="OSM way ID" value={text(props.line_source_feature_id)} />
        </>}
        {isOrdinaryRoute && <>
          <Row label={t("popup.networkStructures.routeDistance")} value={numberText(props.offset_distance_m, " m")} />
          <Row label={t("popup.networkStructures.routeAxisAngle")} value={numberText(props.axis_degrees_from_east_mod_180, t("popup.networkStructures.axisUnit"))} />
          <Row label={t("popup.networkStructures.trialClass")} value={text(props.ordinary_route_trial_outcome)} />
        </>}
        {(isCurvedLocal || isWaterwayCrossing || isMultiBridgeCrossing) && <>
          <Row label={t("popup.networkStructures.pointToRef")} value={numberText(props.offset_distance_m, " m")} />
          <Row label={t("popup.networkStructures.trialResult")} value={text(props.direction_context_outcome)} />
          {(isWaterwayCrossing || isMultiBridgeCrossing) && <Row label={t("popup.networkStructures.crossingWaterwayWay")} value={text(props.secondary_osm_waterway_way_id)} />}
          <Row label={t("popup.networkStructures.lineRole")} value={t("popup.networkStructures.lineRoleValue")} />
        </>}
        {isLowConfidenceConsensus && <>
          <Row label={t("popup.networkStructures.candidateWayIds")} value={candidateWayIds(isTiedRouteConsensus ? props.candidate_osm_way_ids_json : props.candidate_osm_carrier_ids_json, i18n)} />
          <Row label={t("popup.networkStructures.commonAxisAngle")} value={numberText(props.axis_degrees_from_east_mod_180, t("popup.networkStructures.axisUnit"))} />
          <Row label={t("popup.networkStructures.axisSpread")} value={numberText(props.candidate_axis_spread_degrees, "°")} />
          <Row field="limits" value={t("popup.networkStructures.limitsConsensus")} />
        </>}
        {isNoCrossingNearestRoute && <>
          <Row label={t("popup.networkStructures.nearestRouteWay")} value={text(props.candidate_osm_way_id)} />
          <Row label={t("popup.networkStructures.routeDistance")} value={numberText(props.nearest_route_distance_m, " m")} />
          <Row label={t("popup.networkStructures.nearestMargin")} value={numberText(props.nearest_route_margin_m, " m")} />
          <Row label={t("popup.networkStructures.axisAngle")} value={numberText(props.axis_degrees_from_east_mod_180, t("popup.networkStructures.axisUnit"))} />
          <Row label={t("popup.networkStructures.sameWayCount")} value={text(props.selected_way_trial_record_count)} />
          {!!props.shared_selected_way_needs_identity_review && <Row label={t("popup.networkStructures.sharedSource")} value={t("popup.networkStructures.sharedYes")} />}
          <Row field="limits" value={t("popup.networkStructures.limitsNearest")} />
        </>}
      </PopupDetails>
      <PopupDetails summary={t("popup.networkStructures.legacyQaSection")}>
        <Row label={t("popup.networkStructures.legacyQa")} value={qaPassed ? t("popup.networkStructures.legacyQaPassed") : props.qa_status === "failed" ? t("popup.networkStructures.legacyQaFailed") : props.qa_status === "unknown" ? t("popup.networkStructures.legacyQaUnknown") : t("popup.networkStructures.legacyQaNone")} />
        {!!props.qa_reason && <Row label={t("popup.networkStructures.legacyQaRecord")} value={text(props.qa_reason)} />}
        {qaPassed && <Row label={t("popup.networkStructures.legacyQaRelease")} value={shortId(props.qa_release_id)} title={idTitle(props.qa_release_id)} />}
        {!!props.qa_sample_set && <Row label={t("popup.networkStructures.legacyQaSample")} value={props.qa_sample_set === "risk" ? t("popup.networkStructures.sampleRisk") : props.qa_sample_set === "acceptance" ? t("popup.networkStructures.sampleAcceptance") : text(props.qa_sample_set)} />}
        {!!props.qa_reference_date && <Row label={t("popup.networkStructures.legacyQaDate")} value={text(props.qa_reference_date)} />}
        {!!props.qa_evidence_reference && <Row label={t("popup.networkStructures.legacyQaImagery")} value={text(props.qa_evidence_reference)} />}
      </PopupDetails>
      <PopupDetails summary={t("popup.common.notesAndLimits")}>
        <Row label={t("popup.networkStructures.stage1Scope")} value={t("popup.networkStructures.stage1ScopeValue")} />
        <Row label={t("popup.networkStructures.stage1Overall")} value={t("popup.networkStructures.stage1OverallValue")} />
        <Row label={t("popup.networkStructures.networkEdgeStatus")} value={t("popup.networkStructures.networkEdgeStatusValue")} />
        {isLine && <Row label={t("popup.networkStructures.lengthMeaning")} value={isFixedDirectionGlyph ? t("popup.networkStructures.lenFixed") : isMultiBridgeCrossing ? t("popup.networkStructures.lenMultiBridge") : isWaterwayCrossing ? t("popup.networkStructures.lenWaterway") : isCurvedLocal ? t("popup.networkStructures.lenCurved") : isOrdinaryRoute ? t("popup.networkStructures.lenOrdinary") : isOsmEntityLine ? t("popup.networkStructures.lenOsmEntity") : t("popup.networkStructures.lenDefault")} />}
        <Row field="limits" value={t("popup.networkStructures.v5Limits")} />
        <Row label={t("popup.networkStructures.bssSource")} value={text(props.bss_source_url)} />
        <Row label={t("popup.networkStructures.bssRetrieved")} value={text(props.bss_retrieved_at_utc)} />
        <Row label={t("popup.networkStructures.bssReuse")} value={text(props.bss_source_license_status)} />
      </PopupDetails>
    </PopupScroll>
  </>;
}

export function OfficialBridgeNewTaipeiPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const text = textWith(i18n);
  const numberText = numberTextWith(i18n);
  return <>
    <Title color={NETWORK_STRUCTURES_COLORS.official}>{text(props.name, t("popup.networkStructures.ntTitle"))}</Title>
    <Row label={t("popup.networkStructures.officialId")} value={text(props.official_id)} />
    <Row field="district" value={text(props.town)} />
    <Row field="level" value={text(props.grade)} />
    <Row label={t("popup.networkStructures.registeredLength")} value={numberText(props.official_length_m, " m")} />
    <GeometryRow role={props.geometry_role} />
    {props.geometry_role !== "coincident_endpoints" &&
      <Row field="caution" value={t("popup.networkStructures.ntCaution")} />}
    <SourceRows props={props} />
  </>;
}

export function BridgeComparisonNewTaipeiPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const text = textWith(i18n);
  const numberText = numberTextWith(i18n);
  const status = MATCH_STATUSES.find((item) => item.value === props.match_status);
  const scoreMissing = props.match_status === "NOT_EVALUATED" ? t("popup.networkStructures.cmpNotEvaluated") : t("popup.networkStructures.cmpNotComputed");
  return <>
    <Title color={status?.color ?? NETWORK_STRUCTURES_COLORS.notEvaluated}>{text(props.name, t("popup.networkStructures.cmpTitle"))}</Title>
    <Row label={t("popup.networkStructures.officialId")} value={text(props.official_id)} />
    <Row label={t("popup.networkStructures.matchStatus")} value={status ? enumLabel("networkMatchStatus", status.value, status.label, i18n) : text(props.match_status)} />
    <Row field="method" value={text(props.match_method)} />
    <Row label={t("popup.networkStructures.reasons")} value={jsonList(props.match_reasons, i18n)} />
    <Row label="OSM way" value={jsonList(props.osm_way_ids, i18n)} />
    <Row label={t("popup.networkStructures.matchConfidence")} value={numberText(props.match_confidence, "", scoreMissing)} />
    <GeometryRow role={props.geometry_role} />
    <Row field="caution" value={t("popup.networkStructures.cmpCaution")} />
    <SourceRows props={props} />
  </>;
}

export function TainanBridgeInspectionsPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const text = textWith(i18n);
  const numberText = numberTextWith(i18n);
  return <>
    <Title color="#a855f7">{text(props.name, t("popup.networkStructures.tnTitle"))}</Title>
    <Row label={t("popup.networkStructures.inspectionYear")} value={isMissing(props.inspection_year_roc) ? t("popup.common.notProvided") : t("popup.networkStructures.inspectionYearValue", { year: displayRocYear(text(props.inspection_year_roc), i18n) })} />
    <Row label={t("popup.networkStructures.inspectorComment")} value={text(props.inspection_comment)} />
    <Row field="district" value={text(props.town)} />
    <Row field="authority" value={text(props.competent_authority)} />
    <Row label={t("popup.networkStructures.maintenanceAuthority")} value={text(props.maintenance_authority)} />
    <Row label={t("popup.networkStructures.totalLength")} value={numberText(props.bridge_total_length_m, " m")} />
    <Row label={t("popup.networkStructures.clearWidth")} value={numberText(props.bridge_clear_width_m, " m")} />
    <GeometryRow role={props.geometry_role} />
    <Row field="dataLimits" value={t("popup.networkStructures.tnLimits")} />
    <SourceRows props={props} />
  </>;
}

export function OfficialBridgeHsinchuPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const text = textWith(i18n);
  const numberText = numberTextWith(i18n);
  return <>
    <Title color="#22d3ee">{text(props.name, t("popup.networkStructures.hcTitle"))}</Title>
    <Row field="route" value={text(props.route)} />
    <Row label={t("popup.networkStructures.registeredLength")} value={numberText(props.official_length_m, " m")} />
    <Row label={t("popup.networkStructures.registerId")} value={t("popup.networkStructures.registerIdValue")} />
    <GeometryRow role={props.geometry_role} />
    <Row field="dataLimits" value={t("popup.networkStructures.hcLimits")} />
    <SourceRows props={props} />
  </>;
}

export function TaipeiRoadTunnelPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const text = textWith(i18n);
  const numberText = numberTextWith(i18n);
  return <>
    <Title color="#f59e0b">{text(props.name, t("popup.networkStructures.tpTitle"))}</Title>
    <Row label={t("popup.networkStructures.tunnelId")} value={text(props.official_tunnel_id)} />
    <Row label={t("popup.networkStructures.tunnelKind")} value={text(props.tunnel_kind)} />
    <Row field="managingAgency" value={text(props.manager)} />
    <Row field="route" value={text(props.route_description)} />
    <Row label={t("popup.networkStructures.directionDetail")} value={numberText(props.direction_count, t("popup.networkStructures.unitRecord"))} />
    <Row label={t("popup.networkStructures.directionalLengthSum")} value={numberText(props.directional_length_sum_m, " m")} />
    <GeometryRow role={props.geometry_role} />
    <Row field="dataLimits" value={t("popup.networkStructures.tpLimits")} />
    <SourceRows props={props} />
  </>;
}

export function TainanRoadTunnelPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const text = textWith(i18n);
  const numberText = numberTextWith(i18n);
  return <>
    <Title color="#fb923c">{text(props.name, t("popup.networkStructures.tnrTitle"))}</Title>
    <Row label={t("popup.networkStructures.routeRef")} value={text(props.route_ref)} />
    <Row field="direction" value={text(props.directionality)} />
    <Row label={t("popup.networkStructures.registeredLength")} value={numberText(props.official_length_m, " m")} />
    <Row label={t("popup.networkStructures.registeredWidth")} value={numberText(props.official_width_m, " m")} />
    <Row label={t("popup.networkStructures.laneCount")} value={numberText(props.lane_count)} />
    <GeometryRow role={props.geometry_role} />
    <Row label={t("popup.networkStructures.crsLimit")} value={t("popup.networkStructures.crsLimitValue")} />
    <SourceRows props={props} />
  </>;
}

export function ChanghuaTrafficSignalPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const text = textWith(i18n);
  return <>
    <Title color="#84cc16">{text(props.name, t("popup.networkStructures.chTitle"))}</Title>
    <Row label={t("popup.networkStructures.sourceRecordId")} value={text(props.source_record_id)} />
    <Row label={t("popup.networkStructures.signalKind")} value={text(props.signal_kind)} />
    <Row label={t("popup.networkStructures.responsibleAuthority")} value={text(props.responsible_authority)} />
    <Row label={t("popup.networkStructures.district")} value={text(props.district)} />
    <GeometryRow role={props.geometry_role} />
    <Row field="dataLimits" value={t("popup.networkStructures.chLimits")} />
    <SourceRows props={props} />
  </>;
}
