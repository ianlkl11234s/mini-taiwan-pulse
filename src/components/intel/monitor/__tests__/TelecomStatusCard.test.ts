import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { aggregateInternetHealthRows } from "../../../../data/internetHealthLoader";
import { TelecomStatusCardView } from "../TelecomStatusCard";

const freshNormal = (source: string) => ({
  row_type: "status",
  source_observation_id: `${source}-1`,
  entity_type: "country",
  entity_id: "TW",
  entity_name: "臺灣",
  source,
  evidence_family: "network",
  signal: "reachability",
  reported_status: "normal",
  effective_status: "normal",
  incident_kind: null,
  value: null,
  unit: null,
  baseline_value: null,
  change_ratio: null,
  confidence: "high",
  sample_count: 12,
  observed_at: "2026-08-30T04:00:00Z",
  source_updated_at: "2026-08-30T04:01:00Z",
  collected_at: "2026-08-30T04:02:00Z",
  age_seconds: 60,
  is_stale: false,
  active_incident_id: null,
  incident_status: null,
  metadata: {},
});

const normalDetector = () => freshNormal("internet_health_detector_v1") satisfies Record<string, unknown>;

const renderCard = (
  summary: ReturnType<typeof aggregateInternetHealthRows>,
  phase: "loading" | "ready" | "error",
) => renderToStaticMarkup(createElement(TelecomStatusCardView, {
  summary, phase, nowTs: 1_788_060_000,
}));

describe("TelecomStatusCardView", () => {
  it("renders missing data as unknown, not a green normal state", () => {
    const html = renderCard(aggregateInternetHealthRows([]), "ready");
    expect(html).toContain("資料不足");
    expect(html).toContain("Cloudflare Radar");
    expect(html).toContain("internet-health-source-cloudflare");
    expect(html).toContain("RIPE Atlas");
    expect(html).toContain("RIPE RIS Live");
    expect(html).toContain("LIMITED");
    expect(html).not.toContain("目前正常");
  });

  it("shows normal only with a fresh detector quorum and exposes restricted freshness", () => {
    const detector = normalDetector();
    const html = renderCard(
      aggregateInternetHealthRows([
        {
          ...detector,
          evidence_family: "composite",
          signal: "internet_health",
          confidence: 0.91,
          metadata: {
            normal_quorum_met: true,
            fresh_evidence_families: ["cloudflare", "ioda", "ripe_atlas", "ripe_ris"],
            restricted_evidence_families: ["ioda", "ripe_atlas", "ripe_ris"],
          },
        },
        { ...freshNormal("cloudflare_radar"), confidence: 0.86, sample_count: 24 },
      ]),
      "ready",
    );
    expect(html).toContain("目前正常");
    expect(html).toContain("confidence high 91%");
    expect(html).toContain("1/2");
    expect(html).toContain("PASS");
    expect(html).toContain("LIMITED");
    expect(html).toContain("n=24");
    expect(html).toContain("confidence high 86%");
    expect(html).toContain("NCDR");
    expect(html).toContain("未通報／無資料");
  });

  it("renders RIPE measurements as primary cards without promoting perfect or zero values to normal", () => {
    const summary = aggregateInternetHealthRows([
      {
        ...freshNormal("ripe_atlas"), evidence_family: "ripe_atlas",
        signal: "ping_success_ratio_ipv4", effective_status: "unknown",
        reported_status: "unknown", value: 1, unit: "ratio", sample_count: 18,
      },
      {
        ...freshNormal("ripe_atlas"), evidence_family: "ripe_atlas",
        signal: "median_rtt_ms_ipv4", effective_status: "unknown",
        reported_status: "unknown", value: 23.4, unit: "milliseconds", sample_count: 17,
      },
      {
        ...freshNormal("ripe_atlas"), evidence_family: "ripe_atlas",
        signal: "reachable_asn_ratio_ipv4", effective_status: "unknown",
        reported_status: "unknown", value: 0.8, unit: "ratio", sample_count: 4,
      },
      {
        ...freshNormal("ripe_ris_live"), evidence_family: "ripe_ris",
        signal: "prefix_visibility_ratio_ipv4", effective_status: "unknown",
        reported_status: "unknown", value: null, unit: "ratio", sample_count: 1292,
      },
      {
        ...freshNormal("ripe_ris_live"), evidence_family: "ripe_ris",
        signal: "withdrawn_prefix_ratio_ipv4", effective_status: "unknown",
        reported_status: "unknown", value: 0, unit: "ratio", sample_count: 1292,
      },
      {
        ...freshNormal("ripe_ris_live"), evidence_family: "ripe_ris",
        signal: "origin_change_count_ipv4", effective_status: "unknown",
        reported_status: "unknown", value: 0, unit: "count", sample_count: 1292,
      },
    ]);
    const html = renderCard(summary, "ready");
    expect(html).toContain("建立基準中");
    expect(html).toContain("UNKNOWN · BASELINE BUILDING");
    expect(html).toContain("internet-health-measurements-ripe_atlas");
    expect(html).toContain("internet-health-measurements-ripe_ris");
    expect(html).toContain("Ping 成功率");
    expect(html).toContain("100.0%");
    expect(html).toContain("23.4 ms");
    expect(html).toContain("RIB 基準建立中");
    expect(html).toContain("0.0%");
    expect(html).toContain("probes=18");
    expect(html).toContain("RTT samples=17");
    expect(html).toContain("ASNs=4");
    expect(html).toContain("BGP messages=1,292");
    expect(html).not.toContain("n=1292");
    expect(html).toContain("Atlas 與 RIS 同屬 RIPE NCC");
    expect(html).not.toContain("目前正常");
  });

  it("shows partial or untimed RIPE rows as unavailable instead of current", () => {
    const summary = aggregateInternetHealthRows([
      {
        ...freshNormal("ripe_ris_live"), evidence_family: "ripe_ris",
        signal: "origin_change_count_ipv4", effective_status: "unknown",
        reported_status: "unknown", value: 0, sample_count: 0,
        source_updated_at: null, metadata: { measurement_state: "partial" },
      },
    ]);
    const html = renderCard(summary, "ready");
    expect(html).toContain("PARTIAL");
    expect(html).toContain("UNAVAILABLE · BGP messages=0");
    expect(html).toContain("— · confidence high");
    expect(html).not.toContain("CURRENT");
  });

  it("labels watch as suspected and distinguishes stale public evidence", () => {
    const summary = aggregateInternetHealthRows([
      {
        ...freshNormal("internet_health_detector_v1"),
        evidence_family: "composite",
        effective_status: "watch",
        metadata: { normal_quorum_met: false, stale_evidence_families: ["ripe_ris"] },
      },
      { ...freshNormal("cloudflare_radar"), is_stale: true },
    ]);
    const html = renderCard(summary, "ready");
    expect(html).toContain("疑似異常");
    expect(html).toContain("資料逾時");
    expect(html).toContain("LIMITED");
  });

  it("a refresh error overrides a previous normal snapshot", () => {
    const detector = normalDetector();
    const summary = aggregateInternetHealthRows([{
      ...detector,
      evidence_family: "composite",
      metadata: { normal_quorum_met: true },
    }]);
    const html = renderCard(summary, "error");
    expect(html).toContain("資料不足");
    expect(html).toContain("本次更新失敗");
    expect(html).not.toContain("目前正常");
  });
});
