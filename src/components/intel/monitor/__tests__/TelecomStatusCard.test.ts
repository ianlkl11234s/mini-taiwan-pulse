import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  aggregateInternetHealthRows,
  type InternetHealthTimelineSummary,
} from "../../../../data/internetHealthLoader";
import {
  RipeTimelineView,
  TelecomStatusCardView,
  completeMaskFrom,
  isCompleteProbeCount,
  hourlyCompleteSeries,
  toSparkline,
  type AtlasDaySummaries,
} from "../TelecomStatusCard";
import { MonitorStyleContext } from "../monitorStyle";

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
    expect(html).toContain("RIPE 量測可用");
    expect(html).not.toContain("RIPE 量測中");
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

  it("keeps the prior observation visible after refresh error without calling it CURRENT", () => {
    const summary = aggregateInternetHealthRows([{
      ...freshRow("ripe_atlas"), evidence_family: "ripe_atlas",
      signal: "ping_success_ratio_ipv4", value: 1, unit: "ratio", sample_count: 18,
    }]);
    const html = renderCard(summary, "error");
    expect(html).toContain("RIPE 量測更新中斷");
    expect(html).toContain("保留最後成功量測");
    expect(html).toContain("1/14");
    expect(html).toContain("100.0%");
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

  it("keeps the same query's last successful curve visible when its next refresh fails", () => {
    const html = renderToStaticMarkup(createElement(RipeTimelineView, {
      summary: timelineSummary,
      phase: "error",
      range: "24h",
      source: "ripe_atlas",
      metric: "ping_success_ratio",
      nowTs: 1_788_060_000,
    }));
    expect(html).toContain("歷史量測暫時無法更新");
    expect(html).toContain("IPv4 coverage 67%");
    expect(html).toContain("<svg");
  });
});

// ── v2（N-A）：殘缺桶、即時值取完整桶、怎麼看 ──
const T0 = 1_788_055_200; // 2026-08-30 10:00 Asia/Taipei
const atlasDaySummary = (
  metric: InternetHealthTimelineSummary["metric"],
  unit: InternetHealthTimelineSummary["unit"],
  v4: [number, number][],
  v6: [number, number][],
): InternetHealthTimelineSummary => {
  const pts = (rows: [number, number][]) => rows.map(([value, sampleCount], i) => ({
    at: T0 + i * 300, value, state: "ready" as const, sampleCount,
  }));
  return {
    ...timelineSummary,
    metric,
    unit,
    from: T0 - 86_100,
    to: T0 + 900,
    ipv4: { ...timelineSummary.ipv4, signal: `${metric}_ipv4` as never, points: pts(v4) },
    ipv6: { ...timelineSummary.ipv6, signal: `${metric}_ipv6` as never, points: pts(v6) },
  };
};
// 第 2 桶（12:05）探針數 10／12，低於 80% × 預期（79／39）→ 殘缺
const pingDay = atlasDaySummary(
  "ping_success_ratio", "ratio",
  [[0.99, 83], [0.5, 10], [0.98, 82]],
  [[0.88, 39], [1, 12], [0.87, 38]],
);
const atlasDay: AtlasDaySummaries = {
  ping_success_ratio: pingDay,
  median_rtt_ms: atlasDaySummary("median_rtt_ms", "milliseconds", [[4.4, 80], [28, 9], [4.6, 80]], [[5.5, 35], [23, 10], [5.7, 34]]),
  probe_connectivity_ratio: atlasDaySummary("probe_connectivity_ratio", "ratio", [[0.95, 83], [0.12, 10], [0.94, 82]], [[0.95, 39], [0.24, 12], [0.93, 38]]),
  reachable_asn_ratio: atlasDaySummary("reachable_asn_ratio", "ratio", [[0.97, 33], [0.3, 10], [0.96, 33]], [[0.8, 18], [0.4, 6], [0.78, 18]]),
};

const renderV2 = (node: ReturnType<typeof createElement>) => renderToStaticMarkup(
  createElement(MonitorStyleContext.Provider, { value: "v2" }, node),
);

describe("TelecomStatusCardView v2 (N-A)", () => {
  it("drops buckets whose reporting probe count is below 80% of expected", () => {
    const mask = completeMaskFrom(pingDay)!;
    expect([...mask[4]]).toEqual([T0, T0 + 600]);
    expect([...mask[6]]).toEqual([T0, T0 + 600]);
    // RTT／ASN 的殘缺桶沿用 ping 的探針數判定，不看自己的 sample_count
    const rtt = toSparkline(atlasDay.median_rtt_ms!, 4, mask);
    expect(rtt.map((p) => p.v)).toEqual([4.4, 4.6]);
    expect(toSparkline(pingDay, 6, mask).map((p) => p.v)).toEqual([88, 87]);
    // 7D／30D（非 5 分鐘桶）不逐桶篩
    expect(completeMaskFrom({ ...pingDay, bucketSeconds: 1800 })).toBeNull();
  });

  it("aggregates 24H into hourly points from complete buckets only", () => {
    const mask = completeMaskFrom(pingDay)!;
    // at＝桶結束：10:00 結束的桶屬 09–10 時；10:05（殘缺）、10:10 屬 10–11 時，殘缺的不參與
    const v4 = hourlyCompleteSeries(pingDay, 4, mask);
    expect(v4.map((p) => p.t)).toEqual([T0, T0 + 900]); // 進行中的小時不超過圖右界（to）
    expect(v4.map((p) => p.v)).toEqual([99, 98]);
    // 同一小時多個完整桶：樣本數加權
    const twoComplete = atlasDaySummary("ping_success_ratio", "ratio", [[0.5, 83], [0.99, 83], [0.5, 10], [0.98, 82]], [[0.9, 39], [0.9, 39], [0.9, 39], [0.9, 39]]);
    const twoMask = completeMaskFrom(twoComplete)!;
    const hour = hourlyCompleteSeries(twoComplete, 4, twoMask)[1]!;
    expect(hour.v).toBeCloseTo((99 * 83 + 98 * 82) / (83 + 82), 6);
    // RTT 對齊 7D／30D 取中位數
    const rttDay = atlasDaySummary("median_rtt_ms", "milliseconds", [[9, 80], [4.4, 80], [28, 9], [4.6, 80], [4.5, 80]], [[5, 35], [5, 35], [5, 35], [5, 35], [5, 35]]);
    expect(hourlyCompleteSeries(rttDay, 4, completeMaskFrom(twoComplete)!)[1]!.v).toBeCloseTo(4.5, 6);
    // 整小時都沒有完整桶 → 沒有點（缺值，不補）
    const allPartial = atlasDaySummary("ping_success_ratio", "ratio", [[0.97, 40], [0.98, 35]], [[0.9, 20], [0.85, 22]]);
    const none = completeMaskFrom(allPartial)!;
    expect(hourlyCompleteSeries(allPartial, 4, none)).toEqual([]);
    expect(hourlyCompleteSeries(allPartial, 6, none)).toEqual([]);
  });

  it("uses the latest complete bucket when the live bucket is incomplete", () => {
    const summary = aggregateInternetHealthRows([
      {
        ...freshRow("ripe_atlas"), evidence_family: "ripe_atlas",
        signal: "ping_success_ratio_ipv4", value: 0.5, unit: "ratio", sample_count: 11,
      },
      {
        ...freshRow("ripe_atlas"), evidence_family: "ripe_atlas",
        signal: "probe_connectivity_ratio_ipv4", value: 0.126, unit: "ratio", sample_count: 11,
      },
    ]);
    const html = renderV2(createElement(TelecomStatusCardView, {
      summary, phase: "ready", nowTs: 1_788_060_000, atlasDay,
    }));
    expect(html).toContain("2/14");
    expect(html).toContain("項即時");
    // 即時值 50%／12.6% 是殘缺桶，改用 12:10 的完整桶
    expect(html).toContain("98.0／87.0");
    expect(html).toContain("94.0／93.0");
    expect(html).not.toContain("50.0／");
    expect(html).not.toContain("12.6");
    expect(html).toContain("以最近完整量測（10:10）計");
    expect(html).toContain("建議正常 IPv4 97–100%；IPv6 83–92%");
    expect(html).toContain('data-testid="monitor-rows"');
    // 狀態小字搬進提示，不再是值底下的三行
    expect(html).not.toContain("probes=");
    expect(html).not.toContain("OBSERVATION ONLY");
  });

  it("keeps a complete live bucket and shows RIS as one line plus how-to-read", () => {
    const summary = aggregateInternetHealthRows([
      {
        ...freshRow("ripe_atlas"), evidence_family: "ripe_atlas",
        signal: "ping_success_ratio_ipv4", value: 0.979, unit: "ratio", sample_count: 83,
      },
      {
        ...freshRow("ripe_ris_live"), evidence_family: "ripe_ris",
        signal: "origin_change_count_ipv4", value: 0, unit: "count", sample_count: 875,
      },
      {
        ...freshRow("ripe_ris_live"), evidence_family: "ripe_ris",
        signal: "prefix_visibility_ratio_ipv4", value: null, unit: "ratio", sample_count: 875,
      },
    ]);
    const html = renderV2(createElement(TelecomStatusCardView, {
      summary, phase: "ready", nowTs: 1_788_060_000, atlasDay,
    }));
    expect(html).toContain("97.9／87.0");
    expect(html).toContain("量測可用");
    expect(html).toContain("RIS 路由觀測：即時");
    expect(html).toContain("BGP 訊息 875");
    expect(html).not.toContain("RIB 基準建立中");
    expect(html).toContain("目前未設定，故不列出");
    expect(html).toContain("<details");
    expect(html).toContain("怎麼看");
    expect(html).toContain("IPv6 正常約 85–90%");
    expect(html).toContain("每小時只取探針數足夠的完整量測平均");
    expect(html).toContain("整小時都沒有完整量測才畫斜線");
    expect(html).toContain("連續 15 分鐘以上");
    expect(html).toContain("IODA 或 Cloudflare Radar");
    expect(html).not.toContain("http");
  });

  it("shows a dash instead of an incomplete value when no complete bucket exists", () => {
    const summary = aggregateInternetHealthRows([{
      ...freshRow("ripe_atlas"), evidence_family: "ripe_atlas",
      signal: "ping_success_ratio_ipv4", value: 0.5, unit: "ratio", sample_count: 11,
    }]);
    const html = renderV2(createElement(TelecomStatusCardView, {
      summary, phase: "ready", nowTs: 1_788_060_000, atlasDay: null,
    }));
    expect(html).toContain("—／—");
    expect(html).not.toContain("50.0");
  });
});

describe("isCompleteProbeCount expected probes", () => {
  it("uses the bucket's own expected probe count when given, else the hard-coded roster value", () => {
    // 寫死值 IPv4 79：80% = 63.2；IPv6 39：80% = 31.2
    expect(isCompleteProbeCount(4, 63)).toBe(false);
    expect(isCompleteProbeCount(4, 64)).toBe(true);
    // 該桶預期 100 支：80 才算完整
    expect(isCompleteProbeCount(4, 79, 100)).toBe(false);
    expect(isCompleteProbeCount(4, 80, 100)).toBe(true);
    // 預期值缺／非法 → 退回寫死值
    expect(isCompleteProbeCount(6, 32, null)).toBe(true);
    expect(isCompleteProbeCount(6, 31, 0)).toBe(false);
    expect(isCompleteProbeCount(4, null, 100)).toBe(false);
  });

  it("completeMaskFrom reads expectedProbeCount from each point", () => {
    const T0 = 1_788_000_000;
    const mk = (sampleCount: number, expectedProbeCount?: number) => ({
      at: T0, value: 0.9, state: "ready" as const, sampleCount,
      ...(expectedProbeCount ? { expectedProbeCount } : {}),
    });
    const series = (points: ReturnType<typeof mk>[], family: 4 | 6) => ({
      addressFamily: family, signal: `ping_success_ratio_ipv${family}` as const,
      points, coverage: 1, readyBuckets: points.length, totalBuckets: points.length,
    });
    const summary = {
      range: "24h", source: "ripe_atlas", metric: "ping_success_ratio", unit: "ratio",
      from: T0 - 300, to: T0 + 300, bucketSeconds: 300,
      ipv4: series([mk(70, 100)], 4), ipv6: series([mk(70)], 6),
      coverage: 1, latestAt: T0, truncated: false, partial: false, empty: false,
    } as unknown as InternetHealthTimelineSummary;
    const mask = completeMaskFrom(summary)!;
    expect(mask[4].has(T0)).toBe(false); // 70 < 80%×100
    expect(mask[6].has(T0)).toBe(true); // 70 ≥ 80%×39（退回寫死值）
  });
});
