import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  aggregateInternetHealthRows,
  type InternetHealthTimelineSummary,
} from "../../../../data/internetHealthLoader";
import { RipeTimelineView, TelecomStatusCardView } from "../TelecomStatusCard";

const freshRow = (source: string) => ({
  row_type: "status",
  source_observation_id: `${source}-1`,
  entity_type: "country",
  entity_id: "TW",
  entity_name: "臺灣",
  source,
  evidence_family: "network",
  signal: "reachability",
  reported_status: "unknown",
  effective_status: "unknown",
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

const renderCard = (
  summary: ReturnType<typeof aggregateInternetHealthRows>,
  phase: "loading" | "ready" | "error",
) => renderToStaticMarkup(createElement(TelecomStatusCardView, {
  summary, phase, nowTs: 1_788_060_000,
}));

const timelineSummary: InternetHealthTimelineSummary = {
  range: "24h",
  source: "ripe_atlas",
  metric: "ping_success_ratio",
  unit: "ratio",
  from: 1_787_973_600,
  to: 1_788_060_000,
  bucketSeconds: 300,
  ipv4: {
    addressFamily: 4,
    signal: "ping_success_ratio_ipv4",
    points: [
      { at: 1_788_055_200, value: 0.99, state: "ready", sampleCount: 10 },
      { at: 1_788_055_500, value: null, state: "partial", sampleCount: 0 },
      { at: 1_788_055_800, value: 1, state: "ready", sampleCount: 12 },
    ],
    coverage: 2 / 3,
    readyBuckets: 2,
    totalBuckets: 3,
  },
  ipv6: {
    addressFamily: 6,
    signal: "ping_success_ratio_ipv6",
    points: [
      { at: 1_788_055_200, value: 0.96, state: "ready", sampleCount: 20 },
      { at: 1_788_055_500, value: 0.97, state: "ready", sampleCount: 22 },
      { at: 1_788_055_800, value: 0.98, state: "ready", sampleCount: 25 },
    ],
    coverage: 1,
    readyBuckets: 3,
    totalBuckets: 3,
  },
  coverage: 5 / 6,
  latestAt: 1_788_055_800,
  truncated: false,
  partial: true,
  empty: false,
};

describe("TelecomStatusCardView", () => {
  it("is RIPE-only and keeps missing measurements as observation wait state", () => {
    const html = renderCard(aggregateInternetHealthRows([]), "ready");
    expect(html).toContain("RIPE NCC 網路觀察");
    expect(html).toContain("等待 RIPE 量測");
    expect(html).toContain("OBSERVATION ONLY · BASELINE BUILDING");
    expect(html).toContain("RIPE Atlas");
    expect(html).toContain("RIPE RIS Live");
    expect(html).not.toContain("Cloudflare Radar");
    expect(html).not.toContain("IODA");
    expect(html).not.toContain("NCDR");
    expect(html).not.toContain("SUPPORTING EVIDENCE");
    expect(html).not.toContain("ACTIVE INCIDENTS");
    expect(html).not.toContain("目前正常");
  });

  it("does not render non-RIPE evidence even when the status RPC returns it", () => {
    const summary = aggregateInternetHealthRows([
      { ...freshRow("cloudflare_radar"), evidence_family: "cloudflare", effective_status: "normal" },
      { ...freshRow("ncdr_cap"), evidence_family: "official", effective_status: "outage", active_incident_id: "ncdr-1" },
      {
        ...freshRow("ripe_atlas"), evidence_family: "ripe_atlas",
        signal: "ping_success_ratio_ipv4", value: 1, unit: "ratio", sample_count: 18,
      },
    ]);
    const html = renderCard(summary, "ready");
    expect(html).toContain("RIPE Atlas");
    expect(html).not.toContain("Cloudflare Radar");
    expect(html).not.toContain("NCDR");
    expect(html).not.toContain("ncdr-1");
    expect(html).not.toContain("ACTIVE INCIDENTS");
    expect(html).not.toContain("中斷訊號");
  });

  it("renders fresh RIPE values without promoting perfect or zero values to normal", () => {
    const summary = aggregateInternetHealthRows([
      {
        ...freshRow("ripe_atlas"), evidence_family: "ripe_atlas",
        signal: "ping_success_ratio_ipv4", value: 1, unit: "ratio", sample_count: 18,
      },
      {
        ...freshRow("ripe_atlas"), evidence_family: "ripe_atlas",
        signal: "median_rtt_ms_ipv4", value: 23.4, unit: "milliseconds", sample_count: 17,
      },
      {
        ...freshRow("ripe_atlas"), evidence_family: "ripe_atlas",
        signal: "reachable_asn_ratio_ipv4", value: 0.8, unit: "ratio", sample_count: 4,
      },
      {
        ...freshRow("ripe_ris_live"), evidence_family: "ripe_ris",
        signal: "prefix_visibility_ratio_ipv4", value: null, unit: "ratio", sample_count: 1292,
      },
      {
        ...freshRow("ripe_ris_live"), evidence_family: "ripe_ris",
        signal: "withdrawn_prefix_ratio_ipv4", value: 0, unit: "ratio", sample_count: 1292,
      },
      {
        ...freshRow("ripe_ris_live"), evidence_family: "ripe_ris",
        signal: "origin_change_count_ipv4", value: 0, unit: "count", sample_count: 1292,
      },
    ]);
    const html = renderCard(summary, "ready");
    expect(html).toContain("RIPE 量測中");
    expect(html).toContain("5/14");
    expect(html).toContain("2/2");
    expect(html).toContain("100.0%");
    expect(html).toContain("23.4 ms");
    expect(html).toContain("RIB 基準建立中");
    expect(html).toContain("0.0%");
    expect(html).toContain("probes=18");
    expect(html).toContain("RTT samples=17");
    expect(html).toContain("ASNs=4");
    expect(html).toContain("BGP messages=1,292");
    expect(html).toContain("只算一個來源群組");
    expect(html).not.toContain("目前正常");
  });

  it("shows partial or untimed RIPE rows as unavailable instead of current", () => {
    const summary = aggregateInternetHealthRows([{
      ...freshRow("ripe_ris_live"), evidence_family: "ripe_ris",
      signal: "origin_change_count_ipv4", value: 0, sample_count: 0,
      source_updated_at: null, metadata: { measurement_state: "partial" },
    }]);
    const html = renderCard(summary, "ready");
    expect(html).toContain("PARTIAL");
    expect(html).toContain("UNAVAILABLE · BGP messages=0");
    expect(html).toContain("0/14");
    expect(html).toContain(">PARTIAL</span>");
  });

  it("does not keep a previous snapshot current after refresh error", () => {
    const summary = aggregateInternetHealthRows([{
      ...freshRow("ripe_atlas"), evidence_family: "ripe_atlas",
      signal: "ping_success_ratio_ipv4", value: 1, unit: "ratio", sample_count: 18,
    }]);
    const html = renderCard(summary, "error");
    expect(html).toContain("RIPE 量測暫時無法更新");
    expect(html).toContain("不沿用舊資料");
    expect(html).toContain("0/14");
    expect(html).not.toContain("100.0%");
  });
});

describe("RipeTimelineView", () => {
  it("renders 24H, 7D and 30D controls with IPv4/IPv6 history and coverage", () => {
    const html = renderToStaticMarkup(createElement(RipeTimelineView, {
      summary: timelineSummary,
      phase: "ready",
      range: "24h",
      source: "ripe_atlas",
      metric: "ping_success_ratio",
      nowTs: 1_788_060_000,
    }));
    expect(html).toContain("RIPE 歷史量測");
    expect(html).toContain("24H");
    expect(html).toContain("7D");
    expect(html).toContain("30D");
    expect(html).toContain("RIPE Atlas");
    expect(html).toContain("RIPE RIS Live");
    expect(html).toContain("IPv4 coverage 67%");
    expect(html).toContain("IPv6 coverage 100%");
    expect(html).toContain("含缺口／部分資料");
    expect(html).toContain("<svg");
    // IPv4 ready → partial → ready 會成為兩個單點 circle，不得跨缺口連成 polyline。
    expect(html.match(/<circle/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("keeps an empty history explicit instead of drawing zero", () => {
    const empty = {
      ...timelineSummary,
      ipv4: { ...timelineSummary.ipv4, points: [], coverage: 0, readyBuckets: 0, totalBuckets: 288 },
      ipv6: { ...timelineSummary.ipv6, points: [], coverage: 0, readyBuckets: 0, totalBuckets: 288 },
      coverage: 0,
      latestAt: null,
      partial: false,
      empty: true,
    } satisfies InternetHealthTimelineSummary;
    const html = renderToStaticMarkup(createElement(RipeTimelineView, {
      summary: empty,
      phase: "ready",
      range: "24h",
      source: "ripe_atlas",
      metric: "ping_success_ratio",
      nowTs: 1_788_060_000,
    }));
    expect(html).toContain("空白不是 0，也不代表異常");
    expect(html).not.toContain("<svg");
  });

  it("does not show a previous source summary under newly selected controls", () => {
    const html = renderToStaticMarkup(createElement(RipeTimelineView, {
      summary: timelineSummary,
      phase: "error",
      range: "24h",
      source: "ripe_ris",
      metric: "prefix_visibility_ratio",
      nowTs: 1_788_060_000,
    }));
    expect(html).toContain("歷史量測暫時無法更新");
    expect(html).toContain("IPv4 coverage —");
    expect(html).toContain("IPv6 coverage —");
    expect(html).not.toContain("coverage 67%");
    expect(html).not.toContain("coverage 100%");
  });
});
