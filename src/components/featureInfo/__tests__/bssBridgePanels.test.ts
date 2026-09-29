import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BssNationalBridgePreviewPanel } from "../networkStructuresPanels";

describe("全臺橋梁研究（進行中）popup 語意", () => {
  it("BSS 第一階段支持保留未驗證實橋與舊綜合 QA 界線", () => {
    const html = renderToStaticMarkup(createElement(BssNationalBridgePreviewPanel, { props: {
      geometry_role: "point", stage1_status: "supported", stage1_release_id: "location-direction-v1",
      stage1_location_supported: "true", stage1_direction_supported: "true", stage1_reason: "局部 crossing 可見",
      stage1_evidence_basis: "PHOTO2025 + EMAP", qa_status: "independently_verified", qa_release_id: "review-v1",
      identity_review_status: "not_reviewed", qa_reference_date: "2026-09-27", qa_sample_set: "risk",
    } }));
    expect(html).toContain("位置與無向局部方向有支持");
    expect(html).toContain("PHOTO2025 + EMAP");
    expect(html).toContain("完整形狀非必要");
    expect(html).toContain("正式 300：103 支持、2 負向、195 未定");
    expect(html).toContain("舊綜合 QA（非本期位置／方向門檻）");
    expect(html).toContain("曾通過來源點對應、局部方向與分類查核");
    expect(html).toContain("風險分層查核（不加入正式抽驗比例）");
    expect(html).toContain("2026-09-27");
    expect(html).toContain("3% 尚未證明");
    expect(html).toContain("具名實橋、分類或實體去重");
    expect(html).toContain("站主限定");
    const missingRelease = renderToStaticMarkup(createElement(BssNationalBridgePreviewPanel, { props: {
      geometry_role: "point", stage1_status: "supported",
    } }));
    expect(missingRelease).toContain("標示為支持但缺 stage1 release，維持待確認");
    expect(missingRelease).toContain("尚未完成舊綜合查核");
  });

  it("BSS road:10926 可有第一階段支持而保留舊綜合 QA 負向觀察", () => {
    const html = renderToStaticMarkup(createElement(BssNationalBridgePreviewPanel, { props: {
      source_key: "road:10926", geometry_role: "original_direction_line",
      stage1_status: "supported", stage1_release_id: "location-direction-v1",
      stage1_location_supported: "true", stage1_direction_supported: "true",
      qa_status: "failed", qa_release_id: "legacy-qa-v4",
    } }));
    expect(html).toContain("位置與無向局部方向有支持");
    expect(html).toContain("舊綜合 QA（非本期位置／方向門檻）");
    expect(html).toContain("有負向觀察，仍待處理");
  });

  it("BSS road:3150 的舊風險抽驗通過不會成為第一階段支持", () => {
    const html = renderToStaticMarkup(createElement(BssNationalBridgePreviewPanel, { props: {
      source_key: "road:3150", geometry_role: "original_direction_line",
      stage1_status: "not_reviewed", stage1_location_supported: "unknown", stage1_direction_supported: "unknown",
      qa_status: "independently_verified", qa_release_id: "legacy-risk-v4", qa_sample_set: "risk",
    } }));
    expect(html).toContain("尚未審視");
    expect(html).toContain("曾通過來源點對應、局部方向與分類查核");
    expect(html).toContain("風險分層查核（不加入正式抽驗比例）");
  });

  it("BSS 來源精確對照不會升格第一階段負向或舊風險 QA", () => {
    const html = renderToStaticMarkup(createElement(BssNationalBridgePreviewPanel, { props: {
      bss_name: "來源對照案例", geometry_role: "point",
      stage1_status: "negative", stage1_release_id: "location-direction-v2",
      stage1_location_supported: "false", stage1_direction_supported: "false",
      stage1_source_group: "osm_bridge_tagged_candidate_exact_match",
      stage1_source_reference: "osm:way/123", stage1_source_distance_m: 4.2,
      stage1_source_release_id: "source-support-v2",
      qa_status: "independently_verified", qa_release_id: "risk-v1", qa_sample_set: "risk",
    } }));
    expect(html).toContain("有負向觀察");
    expect(html).toContain("目前參考線可精確對上 OSM 橋梁標記");
    expect(html).toContain("清冊點至參考線");
    expect(html).toContain("非精度誤差");
    expect(html).toContain("風險分層查核（不加入正式抽驗比例）");
    expect(html).not.toContain("位置與無向局部方向有支持");
  });

  it("BSS 補充方向候選保留多個附近橋線 ID，且不升格為影像支持", () => {
    const line = renderToStaticMarkup(createElement(BssNationalBridgePreviewPanel, { props: {
      bss_name: "補充方向線", geometry_role: "stage1_local_direction_candidate",
      stage1_status: "not_reviewed", stage1_source_group: "supplemental_aligned_osm_direction_candidate",
      carrier_ids_json: '["osm:way/101", "osm:way/202"]', line_drawn_length_m: 30,
    } }));
    expect(line).toContain("附近橋線同向推估（新增方向候選）");
    expect(line).toContain("固定 30 m 方向示意，不是橋長");
    expect(line).toContain("osm:way/101");
    expect(line).toContain("osm:way/202");
    expect(line).toContain("可有多值，不代表唯一 reference");
    expect(line).toContain("尚未審視");
    expect(line).not.toContain("位置與無向局部方向有支持");

    const point = renderToStaticMarkup(createElement(BssNationalBridgePreviewPanel, { props: {
      bss_name: "補充方向點", geometry_role: "point", stage1_status: "not_reviewed",
      supplemental_direction_available: "true",
    } }));
    expect(point).toContain("補充方向候選");
    expect(point).toContain("有新增 30 m 方向標記；未列入影像支持");
  });

  it("全臺 BSS 預覽保留 HOLD、offset 與未評估連通性語意", () => {
    const html = renderToStaticMarkup(createElement(BssNationalBridgePreviewPanel, { props: {
      bss_name: "示例橋", source_key: "road:1", bridge_type: "road", county_memberships: "臺中市",
      bss_registered_length_m: 42, geometry_role: "offset_direction_line", line_drawn_length_m: 36,
      line_source_kind: "offset_osm_carrier_proxy", line_source_feature_id: "way/123",
      offset_distance_m: 8.5, selected_osm_way_shared: true, selected_osm_way_record_count: 3,
      identity_review_status: "not_reviewed",
      network_connectivity_status: "not_evaluated", line_source_date_or_snapshot: "2026-09-25",
      line_source_license_label: "ODbL",
    } }));
    expect(html).toContain("站主限定");
    expect(html).toContain("offset 低把握度候選");
    expect(html).toContain("8.5 m");
    expect(html).toContain("way/123");
    expect(html).toContain("同一 OSM way 候選紀錄數");
    expect(html).toContain("不能據此當成不同橋座");
    expect(html).toContain("not_evaluated");
    expect(html).toContain("不可據此計算橋座數、橋長、道路連通或可通行性");
    const multi = renderToStaticMarkup(createElement(BssNationalBridgePreviewPanel, { props: {
      bss_name: "多線示例", geometry_role: "original_direction_line", line_source_kind: "osm_multi_consensus",
      selected_osm_way_shared: true, selected_osm_way_record_count: 50, representative_way_only: true,
    } }));
    expect(multi).toContain("此 ID 只是選出的代表 way");
    const point = renderToStaticMarkup(createElement(BssNationalBridgePreviewPanel, { props: {
      bss_name: "點位示例", geometry_role: "point", line_tier: "point_only", point_only_reason: "waterway_crossing_ambiguous",
      selected_osm_way_shared: true, selected_osm_way_record_count: 2,
    } }));
    expect(point).toContain("同一 OSM way 候選紀錄數");
    expect(point).toContain("waterway_crossing_ambiguous");
    expect(point).toContain("不能據此當成不同橋座");
    const official = renderToStaticMarkup(createElement(BssNationalBridgePreviewPanel, { props: {
      bss_name: "官方示例", geometry_role: "original_direction_line", line_source_kind: "official",
      selected_osm_way_shared: null,
    } }));
    expect(official).not.toContain("同一 OSM way 候選紀錄數");
    const route = renderToStaticMarkup(createElement(BssNationalBridgePreviewPanel, { props: {
      bss_name: "路網方向示例", geometry_role: "ordinary_route_direction_context",
      line_source_kind: "ordinary_osm_route_not_bridge_tag", line_source_feature_id: "w123",
      offset_distance_m: 13.4, axis_degrees_from_east_mod_180: 42,
      ordinary_route_trial_outcome: "within_25m_unique_route_direction_context_medium_confidence",
      selected_osm_way_shared: true, selected_osm_way_record_count: 2,
    } }));
    expect(route).toContain("普通路網方向參考；不是已辨識橋線");
    expect(route).toContain("最多 30 m 固定方向示意，不是橋長");
    expect(route).toContain("13.4 m");
    expect(route).toContain("不能據此當成不同橋座");
    const curved = renderToStaticMarkup(createElement(BssNationalBridgePreviewPanel, { props: {
      bss_name: "局部方向示例", geometry_role: "near_curved_carrier_local_direction_context",
      line_drawn_length_m: 30, offset_distance_m: 6.2,
      direction_context_outcome: "local_near_osm_bridge_direction_context_unreviewed",
    } }));
    expect(curved).toContain("可能是引道");
    expect(curved).toContain("6.2 m");
    const crossing = renderToStaticMarkup(createElement(BssNationalBridgePreviewPanel, { props: {
      bss_name: "水系交會示例", geometry_role: "waterway_crossing_direction_context",
      offset_distance_m: 36.4, secondary_osm_waterway_way_id: "w456",
    } }));
    expect(crossing).toContain("未確認是橋");
    expect(crossing).toContain("36.4 m");
    expect(crossing).toContain("w456");
    const multiCrossing = renderToStaticMarkup(createElement(BssNationalBridgePreviewPanel, { props: {
      bss_name: "多候選橋線示例", geometry_role: "multi_near_carrier_waterway_direction_context",
      offset_distance_m: 21.81, secondary_osm_waterway_way_id: "w789",
      facility_form_review_hint: "elevated_form_review",
      facility_form_hint_evidence: "selected_OSM_carrier_bridge_viaduct_from_topology",
    } }));
    expect(multiCrossing).toContain("未確認同橋");
    expect(multiCrossing).toContain("21.81 m");
    expect(multiCrossing).toContain("w789");
    expect(multiCrossing).toContain("仍待複核");
  });
});
