import { describe, expect, it } from "vitest";
import {
  aggregateInternetHealthRows,
  aggregateInternetHealthTimelineRows,
  parseInternetHealthEvidence,
  planInternetHealthTimelineChunks,
} from "../internetHealthLoader";

const row = (overrides: Record<string, unknown> = {}) => ({
  row_type: "status",
  source_observation_id: "observation-1",
  entity_type: "country",
  entity_id: "TW",
  entity_name: "臺灣",
  source: "cloudflare_radar",
  evidence_family: "traffic",
  signal: "http_requests",
  reported_status: "normal",
  effective_status: "normal",
  incident_kind: null,
  value: 0.98,
  unit: "normalized",
  baseline_value: 1,
  change_ratio: -0.02,
  confidence: "high",
  sample_count: 20,
  observed_at: "2026-08-30T04:00:00Z",
  source_updated_at: "2026-08-30T04:02:00Z",
  collected_at: "2026-08-30T04:03:00Z",
  age_seconds: 60,
  is_stale: false,
  active_incident_id: null,
  incident_status: null,
  metadata: {},
  ...overrides,
});

const timelineRow = (overrides: Record<string, unknown> = {}) => ({
  observation_id: null,
  source: "ripe_atlas",
  evidence_family: "ripe_atlas",
  entity_type: "country",
  entity_id: "TW",
  entity_name: "Taiwan",
  signal: "ping_success_ratio_ipv4",
  observed_at: "2026-08-31T23:35:00Z",
  window_start: "2026-08-31T23:30:00Z",
  window_end: "2026-08-31T23:35:00Z",
  value: 0.9,
  unit: "ratio",
  baseline_value: null,
  change_ratio: null,
  reported_status: "unknown",
  incident_kind: null,
  confidence: null,
  sample_count: 10,
  source_updated_at: "2026-08-31T23:36:00Z",
  collected_at: "2026-08-31T23:36:30Z",
  quality_flags: {},
  metadata: { address_family: 4, measurement_state: "ready" },
  ...overrides,
});

describe("internet health RPC contract", () => {
  it("requires a fresh composite with explicit quorum before overall normal", () => {
    const summary = aggregateInternetHealthRows([
      row({
        source: "internet_health_detector_v1",
        evidence_family: "composite",
        signal: "internet_health",
        confidence: 0.91,
        metadata: {
          normal_quorum_met: true,
          fresh_evidence_families: ["cloudflare", "ioda", "ripe_atlas", "ripe_ris"],
          restricted_evidence_families: ["ioda", "ripe_atlas", "ripe_ris"],
        },
      }),
      row({ source: "cloudflare_radar" }),
    ]);
    expect(summary.overall_status).toBe("normal");
    expect(summary.confidence_score).toBe(0.91);
    expect(summary.normal_quorum_met).toBe(true);
    expect(summary.fresh_source_count).toBe(1);
    expect(summary.public_source_total).toBe(2);
    expect(summary.source_total).toBe(5);
    expect(summary.sources.find((source) => source.key === "ripe_atlas")).toMatchObject({
      availability: "restricted", detector_fresh: true, fresh: false,
    });
    expect(summary.sources.find((source) => source.key === "ripe_ris")).toMatchObject({
      availability: "restricted", detector_fresh: true, fresh: false,
    });
    expect(summary.sources.find((source) => source.key === "ncdr")).toMatchObject({
      status: "unknown", fresh: false, availability: "missing", value: null,
    });
  });

  it("does not accept provider-only normal or a composite without quorum metadata", () => {
    expect(aggregateInternetHealthRows([row()]).overall_status).toBe("unknown");
    expect(aggregateInternetHealthRows([
      row({ source: "internet_health_detector_v1", evidence_family: "composite" }),
    ]).overall_status).toBe("unknown");
    expect(aggregateInternetHealthRows([
      row({
        source: "internet_health_detector_v1",
        evidence_family: "composite",
        metadata: { normal_quorum_met: false },
      }),
    ]).overall_status).toBe("unknown");
  });

  it("recognizes RIPE source aliases but protects restricted provider detail", () => {
    const summary = aggregateInternetHealthRows([
      row({
        source: "internet_health_detector_v1",
        evidence_family: "composite",
        effective_status: "watch",
        metadata: {
          normal_quorum_met: false,
          fresh_evidence_families: ["ripe_atlas"],
          stale_evidence_families: ["ripe_ris"],
          restricted_evidence_families: ["ripe_atlas", "ripe_ris"],
        },
      }),
      row({
        source_observation_id: "private-atlas-observation",
        source: "ripe_atlas",
        evidence_family: "ripe_atlas",
        signal: "private_probe_success_ratio",
        value: 0.123456,
        unit: "private_ratio",
        sample_count: 42,
        observed_at: "2026-08-30T03:42:01Z",
        source_updated_at: "2026-08-30T03:42:02Z",
      }),
      row({
        source_observation_id: "private-ris-observation",
        source: "ripe_ris_live",
        evidence_family: "ripe_ris",
        signal: "private_prefix_visibility",
        value: 0.654321,
        confidence: 0.74,
        observed_at: "2026-08-30T03:43:01Z",
        source_updated_at: "2026-08-30T03:43:02Z",
      }),
    ]);
    expect(summary.overall_status).toBe("watch");
    expect(summary.evidence).toHaveLength(1);
    expect(summary.evidence[0]).toMatchObject({ row_type: "detector", signal: "http_requests" });
    expect(summary.evidence.some((item) => item.source_key === "ripe_atlas" || item.source_key === "ripe_ris")).toBe(false);
    expect(summary.sources.find((source) => source.key === "ripe_atlas")).toMatchObject({
      availability: "restricted", detector_fresh: true, signal: null, value: null,
      sample_count: null, observed_at: null, source_updated_at: null,
      confidence: "unknown", confidence_score: null, evidence_count: 0,
    });
    expect(summary.sources.find((source) => source.key === "ripe_ris")).toMatchObject({
      availability: "restricted", detector_stale: true, signal: null, value: null,
      sample_count: null, observed_at: null, source_updated_at: null,
      confidence: "unknown", confidence_score: null, evidence_count: 0,
    });
    const publicModel = JSON.stringify(summary);
    expect(publicModel).not.toContain("private-atlas-observation");
    expect(publicModel).not.toContain("private-ris-observation");
    expect(publicModel).not.toContain("private_probe_success_ratio");
    expect(publicModel).not.toContain("private_prefix_visibility");
    expect(publicModel).not.toContain("private_ratio");
    expect(publicModel).not.toContain("0.123456");
    expect(publicModel).not.toContain("0.654321");
    expect(publicModel).not.toContain("0.74");
    expect(publicModel).not.toContain("2026-08-30T03:42:01Z");
    expect(publicModel).not.toContain("2026-08-30T03:43:02Z");
  });

  it("exposes only allowlisted RIPE measurements while keeping the assessment unknown", () => {
    const summary = aggregateInternetHealthRows([
      row({
        source_observation_id: "atlas-private-id",
        source: "ripe_atlas",
        evidence_family: "ripe_atlas",
        signal: "ping_success_ratio_ipv4",
        effective_status: "unknown",
        reported_status: "unknown",
        value: 1,
        unit: "provider_ratio",
        sample_count: 18,
        confidence: 0.82,
        metadata: { measurement_ids: [1234], target_groups: ["secret-target"] },
      }),
      row({
        source_observation_id: "ris-private-id",
        source: "ripe_ris_live",
        evidence_family: "ripe_ris",
        signal: "withdrawn_prefix_ratio_ipv4",
        effective_status: "unknown",
        reported_status: "unknown",
        value: 0,
        unit: "provider_ratio",
        sample_count: 1292,
        metadata: { subscription_sha256: "private-sha", raw_archive_prefix: "private-path" },
      }),
      row({
        source: "ripe_atlas",
        evidence_family: "ripe_atlas",
        signal: "not_public_probe_identifier",
        value: 999,
        metadata: { secret: "must-not-leak" },
      }),
    ]);

    expect(summary.overall_status).toBe("unknown");
    expect(summary.assessment_phase).toBe("baseline_building");
    expect(summary.summary).toContain("基準建立中");
    expect(summary.fresh_source_count).toBe(2);
    expect(summary.public_source_total).toBe(4);
    expect(summary.measurements).toEqual([
      expect.objectContaining({
        source_key: "ripe_atlas", dependency_group: "ripe_ncc",
        signal: "ping_success_ratio_ipv4", value: 1, unit: "ratio",
        address_family: 4, freshness: "fresh", state: "available", sample_count: 18,
      }),
      expect.objectContaining({
        source_key: "ripe_ris", dependency_group: "ripe_ncc",
        signal: "withdrawn_prefix_ratio_ipv4", value: 0, unit: "ratio",
        address_family: 4, freshness: "fresh", state: "available", sample_count: 1292,
      }),
    ]);
    expect(summary.evidence).toHaveLength(0);
    expect(summary.sources.find((source) => source.key === "ripe_atlas")).toMatchObject({
      availability: "fresh", fresh: true, status: "unknown", dependency_group: "ripe_ncc",
    });
    const publicModel = JSON.stringify(summary);
    for (const forbidden of [
      "atlas-private-id", "ris-private-id", "measurement_ids", "secret-target",
      "subscription_sha256", "private-sha", "private-path", "must-not-leak",
      "not_public_probe_identifier", "999", "provider_ratio",
    ]) expect(publicModel).not.toContain(forbidden);
  });

  it("keeps null RIS visibility as a baseline-building null and stale measurements stale", () => {
    const summary = aggregateInternetHealthRows([
      row({
        source: "ripe_ris_live", evidence_family: "ripe_ris",
        signal: "prefix_visibility_ratio_ipv6", effective_status: "unknown",
        value: null, unit: "ratio", is_stale: false,
      }),
      row({
        source: "ripe_atlas", evidence_family: "ripe_atlas",
        signal: "median_rtt_ms_ipv6", effective_status: "unknown",
        value: 37.5, unit: "milliseconds", is_stale: true,
      }),
    ]);
    expect(summary.overall_status).toBe("unknown");
    expect(summary.measurements).toEqual([
      expect.objectContaining({
        signal: "prefix_visibility_ratio_ipv6", value: null,
        freshness: "unavailable", state: "baseline_building",
      }),
      expect.objectContaining({
        signal: "median_rtt_ms_ipv6", value: 37.5,
        freshness: "stale", state: "available",
      }),
    ]);
    expect(summary.sources.find((source) => source.key === "ripe_atlas")).toMatchObject({
      availability: "stale", fresh: false,
    });
  });

  it("requires an explicit ready state before exposing non-null prefix visibility", () => {
    const summary = aggregateInternetHealthRows([
      row({
        source: "ripe_ris_live", evidence_family: "ripe_ris",
        signal: "prefix_visibility_ratio_ipv4", effective_status: "unknown",
        value: 0.97, sample_count: 300, metadata: {},
      }),
      row({
        source: "ripe_ris_live", evidence_family: "ripe_ris",
        signal: "prefix_visibility_ratio_ipv6", effective_status: "unknown",
        value: 0.91, sample_count: 240,
        metadata: { measurement_state: "ready", subscription_sha256: "must-not-leak" },
      }),
    ]);
    expect(summary.measurements).toEqual([
      expect.objectContaining({
        signal: "prefix_visibility_ratio_ipv4", value: null,
        quality_state: null, state: "baseline_building", freshness: "unavailable",
      }),
      expect.objectContaining({
        signal: "prefix_visibility_ratio_ipv6", value: 0.91,
        quality_state: "ready", state: "available", freshness: "fresh",
      }),
    ]);
    expect(JSON.stringify(summary)).not.toContain("subscription_sha256");
    expect(JSON.stringify(summary)).not.toContain("must-not-leak");
  });

  it("does not call stream gaps, empty samples, or missing provider timestamps current", () => {
    const summary = aggregateInternetHealthRows([
      row({
        source: "ripe_ris_live", evidence_family: "ripe_ris",
        signal: "origin_change_count_ipv4", effective_status: "unknown",
        value: 0, sample_count: 0, source_updated_at: null,
        observed_at: "2026-08-30T04:00:00Z",
        metadata: { quality_state: "stream_gap" },
      }),
      row({
        source: "ripe_atlas", evidence_family: "ripe_atlas",
        signal: "ping_success_ratio_ipv4", effective_status: "unknown",
        value: 1, sample_count: 12, source_updated_at: null,
        observed_at: "2026-08-30T04:00:00Z",
        metadata: { quality_state: "ready" },
      }),
    ]);
    expect(summary.measurements).toEqual([
      expect.objectContaining({
        signal: "origin_change_count_ipv4", value: null, freshness: "unavailable",
        state: "unavailable", quality_state: "unavailable", sample_count: 0,
      }),
      expect.objectContaining({
        signal: "ping_success_ratio_ipv4", value: null, freshness: "unavailable",
        state: "unavailable", quality_state: "ready", source_updated_at: null,
      }),
    ]);
    expect(summary.fresh_source_count).toBe(0);
    expect(summary.last_updated_at).toBeNull();
  });

  it("fails closed on invalid values and non-integer or negative sample counts", () => {
    const summary = aggregateInternetHealthRows([
      row({
        source: "ripe_atlas", evidence_family: "ripe_atlas",
        signal: "ping_success_ratio_ipv4", effective_status: "unknown",
        value: 1.01, sample_count: 2.5,
      }),
      row({
        source: "ripe_atlas", evidence_family: "ripe_atlas",
        signal: "median_rtt_ms_ipv4", effective_status: "unknown",
        value: -0.1, sample_count: -1,
      }),
      row({
        source: "ripe_ris_live", evidence_family: "ripe_ris",
        signal: "origin_change_count_ipv6", effective_status: "unknown",
        value: 1.5, sample_count: 20,
      }),
      row({
        source: "ripe_ris_live", evidence_family: "ripe_ris",
        signal: "withdrawn_prefix_ratio_ipv4", effective_status: "unknown",
        value: 0, sample_count: 0,
      }),
    ]);
    expect(summary.measurements).toEqual([
      expect.objectContaining({ value: null, sample_count: null, freshness: "unavailable", state: "unavailable" }),
      expect.objectContaining({ value: null, sample_count: null, freshness: "unavailable", state: "unavailable" }),
      expect.objectContaining({ value: null, sample_count: 20, freshness: "unavailable", state: "missing" }),
      expect.objectContaining({ value: null, sample_count: 0, freshness: "unavailable", state: "unavailable" }),
    ]);
  });

  it("does not treat NCDR no-alert row as proof of normal internet", () => {
    const summary = aggregateInternetHealthRows([
      row({ source: "ncdr", signal: "mobile_outage_alerts", value: 0, unit: "alerts" }),
    ]);
    expect(summary.overall_status).toBe("unknown");
    expect(summary.summary).toContain("無法判斷");
  });

  it("stale overrides effective_status and cannot become outage or normal", () => {
    const parsed = parseInternetHealthEvidence(row({
      effective_status: "outage",
      is_stale: true,
      value: null,
      change_ratio: null,
    }));
    expect(parsed).toMatchObject({ status: "unknown", is_stale: true, value: null, change_ratio: null });

    const summary = aggregateInternetHealthRows([row({ effective_status: "outage", is_stale: true })]);
    expect(summary.overall_status).toBe("unknown");
    expect(summary.fresh_source_count).toBe(0);
  });

  it("missing is_stale is conservative unknown for an older RPC shape", () => {
    const input: Record<string, unknown> = { ...row() };
    Reflect.deleteProperty(input, "is_stale");
    expect(parseInternetHealthEvidence(input)?.status).toBe("unknown");
  });

  it("uses effective_status rather than reported_status and preserves active incident scope as text", () => {
    const summary = aggregateInternetHealthRows([
      row({
        source: "cloudflare_radar",
        entity_type: "asn",
        entity_id: "AS3462",
        entity_name: "HiNet",
        reported_status: "outage",
        effective_status: "degraded",
        incident_kind: "single_asn_outage",
        active_incident_id: "incident-1",
        incident_status: "open",
        confidence: "medium",
      }),
    ]);
    expect(summary.overall_status).toBe("degraded");
    expect(summary.incidents).toEqual([
      expect.objectContaining({
        id: "incident-1",
        entity_type: "asn",
        entity_id: "AS3462",
        entity_name: "HiNet",
        severity: "degraded",
      }),
    ]);
    expect(JSON.stringify(summary.incidents)).not.toContain("geometry");
  });

  it("uses a fresh detector composite as overall truth when evidence rows are included", () => {
    const summary = aggregateInternetHealthRows([
      row({
        row_type: "status",
        source: "multi_source_detector",
        evidence_family: "composite",
        reported_status: "outage",
        effective_status: "watch",
        confidence: 0.65,
      }),
      row({ source: "cloudflare_radar", effective_status: "degraded" }),
      row({ source: "ioda", effective_status: "normal" }),
    ]);
    expect(summary.overall_status).toBe("watch");
    expect(summary.confidence).toBe("medium");
    expect(summary.evidence[0]).toMatchObject({
      row_type: "detector",
      source_observation_id: "observation-1",
    });
  });

  it("maps numeric RPC confidence and active official evidence conservatively", () => {
    const summary = aggregateInternetHealthRows([
      row({
        row_type: "status",
        source: "internet_health_detector_v1",
        evidence_family: "composite",
        effective_status: "normal",
        confidence: 0.9,
        metadata: { normal_quorum_met: true },
      }),
      row({
        row_type: "official_evidence",
        source: "ncdr",
        evidence_family: "official",
        signal: "mobile_network_outage_alert",
        reported_status: "outage",
        effective_status: "outage",
        incident_kind: "telecom_service_disruption",
        confidence: null,
      }),
    ]);
    expect(summary.overall_status).toBe("outage");
    expect(summary.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ row_type: "detector", confidence: "high" }),
      expect.objectContaining({ row_type: "official", confidence: "unknown" }),
    ]));
    expect(summary.incidents).toEqual([
      expect.objectContaining({
        id: "official:observation-1",
        kind: "telecom_service_disruption",
        severity: "outage",
        source: "ncdr",
      }),
    ]);
  });

  it("keeps null metrics as null instead of inventing zero", () => {
    const parsed = parseInternetHealthEvidence(row({
      value: null,
      baseline_value: null,
      change_ratio: null,
      sample_count: null,
      observed_at: null,
    }));
    expect(parsed).toMatchObject({
      value: null,
      baseline_value: null,
      change_ratio: null,
      sample_count: null,
      observed_at: null,
    });
  });
});

describe("internet health RIPE timeline", () => {
  const to = "2026-09-01T00:00:00Z";

  it("plans continuous half-open chunks and splits 30d below the RPC cap", () => {
    const chunks = planInternetHealthTimelineChunks({
      range: "30d", source: "ripe_atlas", metric: "ping_success_ratio", to,
    });
    expect(chunks).toHaveLength(5);
    expect(chunks[0]?.from).toBe("2026-08-02T00:00:00.000Z");
    expect(chunks[chunks.length - 1]?.to).toBe("2026-09-01T00:00:00.000Z");
    for (let index = 1; index < chunks.length; index++) {
      expect(chunks[index]?.from).toBe(chunks[index - 1]?.to);
    }
    expect(planInternetHealthTimelineChunks({
      range: "7d", source: "ripe_atlas", metric: "median_rtt_ms", to,
    })).toHaveLength(1);
  });

  it("builds IPv4 and IPv6 series and sample-weights ratio buckets", () => {
    const summary = aggregateInternetHealthTimelineRows([{ rows: [
      timelineRow({ value: 0.4, sample_count: 10 }),
      timelineRow({ observed_at: "2026-08-31T23:40:00Z", value: 1, sample_count: 30 }),
      timelineRow({
        signal: "ping_success_ratio_ipv6",
        observed_at: "2026-08-31T23:40:00Z",
        value: 0.5,
        sample_count: 20,
        metadata: { address_family: 6, measurement_state: "ready" },
      }),
    ] }], { range: "7d", source: "ripe_atlas", metric: "ping_success_ratio", to });

    expect(summary.bucketSeconds).toBe(1800);
    expect(summary.ipv4.points).toHaveLength(336);
    expect(summary.ipv6.points).toHaveLength(336);
    expect(summary.ipv4.points.find((point) => point.value !== null)).toMatchObject({
      value: 0.85, state: "partial", sampleCount: 40,
    });
    expect(summary.ipv6.points.find((point) => point.value !== null)).toMatchObject({
      value: 0.5, state: "partial", sampleCount: 20,
    });
    expect(summary.coverage).toBeCloseTo(3 / 4032);
    expect(summary.latestAt).toBe(Date.parse("2026-08-31T23:36:00Z") / 1000);
    expect(summary.empty).toBe(false);
    expect(summary.partial).toBe(true);
  });

  it("uses median-of-medians for RTT and preserves null buckets", () => {
    const summary = aggregateInternetHealthTimelineRows([{ rows: [
      timelineRow({
        signal: "median_rtt_ms_ipv4", value: 10, unit: "milliseconds", sample_count: 2,
      }),
      timelineRow({
        signal: "median_rtt_ms_ipv4", observed_at: "2026-08-31T23:40:00Z",
        value: 100, unit: "milliseconds", sample_count: 2,
      }),
      timelineRow({
        signal: "median_rtt_ms_ipv4", observed_at: "2026-08-31T23:45:00Z",
        value: 20, unit: "milliseconds", sample_count: 2,
      }),
    ] }], { range: "30d", source: "ripe_atlas", metric: "median_rtt_ms", to });

    expect(summary.bucketSeconds).toBe(7200);
    expect(summary.ipv4.points.find((point) => point.value !== null)).toMatchObject({
      value: 20, state: "partial", sampleCount: 6,
    });
    expect(summary.ipv6.points.every((point) => point.value === null && point.state === "empty")).toBe(true);
  });

  it("sums count buckets but uses the latest ready visibility value", () => {
    const countSummary = aggregateInternetHealthTimelineRows([{ rows: [
      timelineRow({
        source: "ripe_ris_live", evidence_family: "ripe_ris",
        signal: "origin_change_count_ipv4", value: 2, unit: "count",
      }),
      timelineRow({
        source: "ripe_ris_live", evidence_family: "ripe_ris",
        signal: "origin_change_count_ipv4", observed_at: "2026-08-31T23:40:00Z",
        value: 3, unit: "count",
      }),
    ] }], { range: "7d", source: "ripe_ris", metric: "origin_change_count", to });
    expect(countSummary.ipv4.points.find((point) => point.value !== null)?.value).toBe(5);

    const visibilitySummary = aggregateInternetHealthTimelineRows([{ rows: [
      timelineRow({
        source: "ripe_ris_live", evidence_family: "ripe_ris",
        signal: "prefix_visibility_ratio_ipv4", value: 0.9,
      }),
      timelineRow({
        source: "ripe_ris_live", evidence_family: "ripe_ris",
        signal: "prefix_visibility_ratio_ipv4", observed_at: "2026-08-31T23:40:00Z", value: 0.7,
      }),
    ] }], { range: "7d", source: "ripe_ris", metric: "prefix_visibility_ratio", to });
    expect(visibilitySummary.ipv4.points.find((point) => point.value !== null)?.value).toBe(0.7);
  });

  it("keeps partial, missing timestamps and zero samples null instead of zero/current", () => {
    const summary = aggregateInternetHealthTimelineRows([{ rows: [
      timelineRow({
        value: 1,
        metadata: { address_family: 4, measurement_state: "partial" },
      }),
      timelineRow({
        signal: "ping_success_ratio_ipv6",
        observed_at: "2026-08-31T23:40:00Z",
        value: 1,
        sample_count: 0,
        source_updated_at: null,
        metadata: { address_family: 6, measurement_state: "ready" },
      }),
    ] }], { range: "24h", source: "ripe_atlas", metric: "ping_success_ratio", to });

    expect(summary.ipv4.points.find((point) => point.state === "partial")).toMatchObject({
      value: null, sampleCount: null,
    });
    expect(summary.ipv6.points.find((point) => point.state === "unavailable")).toMatchObject({
      value: null, sampleCount: null,
    });
    expect(summary.ipv4.points.some((point) => point.value === 0)).toBe(false);
    expect(summary.latestAt).toBe(Date.parse("2026-08-31T23:36:00Z") / 1000);
  });

  it("strictly allows country/TW RIPE rows and never retains unknown metadata", () => {
    const summary = aggregateInternetHealthTimelineRows([{ rows: [
      timelineRow({ entity_id: "US", value: 0.1 }),
      timelineRow({ source: "cloudflare_radar", value: 0.2 }),
      timelineRow({ signal: "private_probe_id", value: 999 }),
      timelineRow({ metadata: { address_family: 6, measurement_state: "ready" }, value: 0.3 }),
      timelineRow({
        metadata: {
          address_family: 4,
          measurement_state: "ready",
          probe_ids: [1234],
          archive_path: "private/archive.json",
        },
      }),
    ] }], { range: "24h", source: "ripe_atlas", metric: "ping_success_ratio", to });

    expect(summary.ipv4.readyBuckets).toBe(1);
    const serialized = JSON.stringify(summary);
    for (const forbidden of [
      "private_probe_id", "999", "probe_ids", "1234", "archive_path", "private/archive.json",
      "cloudflare_radar",
    ]) expect(serialized).not.toContain(forbidden);
  });

  it("fails timeline values and unknown quality states closed", () => {
    const summary = aggregateInternetHealthTimelineRows([{ rows: [
      timelineRow({ value: 1.2 }),
      timelineRow({
        signal: "ping_success_ratio_ipv6",
        value: 0.9,
        metadata: { address_family: 6, measurement_state: "future_state" },
      }),
    ] }], { range: "24h", source: "ripe_atlas", metric: "ping_success_ratio", to });

    expect(summary.ipv4.points.find((point) => point.state === "unavailable")).toMatchObject({ value: null });
    expect(summary.ipv6.points.find((point) => point.state === "unavailable")).toMatchObject({ value: null });
    expect(summary.coverage).toBe(0);
    expect(summary.ipv4.points.some((point) => point.value === 1.2)).toBe(false);
    expect(JSON.stringify(summary)).not.toContain("future_state");
  });

  it("deduplicates chunk boundaries and excludes the half-open upper boundary", () => {
    const duplicate = timelineRow({
      source: "ripe_ris_live", evidence_family: "ripe_ris",
      signal: "origin_change_count_ipv4", value: 2, unit: "count",
    });
    const upperBoundary = timelineRow({
      source: "ripe_ris_live", evidence_family: "ripe_ris",
      signal: "origin_change_count_ipv4", observed_at: to, value: 9, unit: "count",
    });
    const summary = aggregateInternetHealthTimelineRows([
      { rows: [duplicate] },
      { rows: [duplicate, upperBoundary] },
    ], { range: "24h", source: "ripe_ris", metric: "origin_change_count", to });

    expect(summary.ipv4.points.filter((point) => point.value !== null)).toHaveLength(1);
    expect(summary.ipv4.points.find((point) => point.value !== null)?.value).toBe(2);
  });

  it("marks a 5,000-row RPC response truncated without inventing complete coverage", () => {
    const from = Date.parse("2026-08-02T00:00:00Z");
    const rows = Array.from({ length: 5000 }, (_, index) => {
      const observedAt = new Date(from + index * 5 * 60_000).toISOString();
      return timelineRow({ observed_at: observedAt, source_updated_at: observedAt });
    });
    const summary = aggregateInternetHealthTimelineRows(
      [{ rows }],
      { range: "30d", source: "ripe_atlas", metric: "ping_success_ratio", to },
    );
    expect(summary.truncated).toBe(true);
    expect(summary.partial).toBe(true);
    expect(summary.coverage).toBeLessThan(1);
  });

  it("returns explicit empty dual series and rejects a mismatched source/metric", () => {
    const summary = aggregateInternetHealthTimelineRows(
      [{ rows: [] }],
      { range: "24h", source: "ripe_atlas", metric: "ping_success_ratio", to },
    );
    expect(summary).toMatchObject({ empty: true, partial: false, truncated: false, latestAt: null });
    expect(summary.ipv4.points).toHaveLength(288);
    expect(summary.ipv6.points).toHaveLength(288);
    expect(summary.ipv4.points.every((point) => point.value === null)).toBe(true);
    expect(() => planInternetHealthTimelineChunks({
      range: "24h", source: "ripe_ris", metric: "ping_success_ratio", to,
    })).toThrow(/source\/metric/);
  });
});
