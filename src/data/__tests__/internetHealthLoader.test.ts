import { describe, expect, it } from "vitest";
import {
  aggregateInternetHealthRows,
  parseInternetHealthEvidence,
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

describe("internet health RPC contract", () => {
  it("requires Cloudflare + IODA fresh normal evidence before overall normal", () => {
    const summary = aggregateInternetHealthRows([
      row(),
      row({ source: "ioda", evidence_family: "active_probing", signal: "reachability" }),
    ]);
    expect(summary.overall_status).toBe("normal");
    expect(summary.fresh_source_count).toBe(2);
    expect(summary.source_total).toBe(3);
    expect(summary.sources.find((source) => source.key === "ncdr")).toMatchObject({
      status: "unknown", fresh: false, value: null,
    });
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
        source: "ioda",
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
