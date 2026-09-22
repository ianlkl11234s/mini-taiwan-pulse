import { describe, expect, it } from "vitest";

import {
  RELEVANCE_THRESHOLD,
  batchCandidates,
  buildBatchRequest,
  collectCandidates,
  parseLayerScreeningRunPayload,
  parseNoulAnswers,
  requestBytes,
  runLayerScreening,
  type ScreeningCandidate,
} from "../jev-layer-screening-run";

const candidates: readonly ScreeningCandidate[] = [
  { key: "schools", label: "學校", description: "教育設施", topics: ["教育"], theme: "社會", group: "教育", sourceKinds: ["geojson"], sourceStatus: "verified" },
  { key: "hospitals", label: "醫院", description: "醫療設施", topics: ["醫療"], theme: "社會", group: "醫療", sourceKinds: ["geojson"], sourceStatus: "verified" },
  { key: "parks", label: "公園", description: "休憩空間", topics: ["休閒"], theme: "生活", group: "公園", sourceKinds: ["custom"], sourceStatus: "pulse_only" },
];

describe("jev layer screening runner", () => {
  it("accepts only a bounded non-empty local run query", () => {
    expect(parseLayerScreeningRunPayload({ query: "  教育資源分佈  " })).toEqual({ query: "教育資源分佈", relevanceThreshold: 0.7 });
    expect(parseLayerScreeningRunPayload({ query: "教育", relevanceThreshold: 0.85 })).toEqual({ query: "教育", relevanceThreshold: 0.85 });
    expect(() => parseLayerScreeningRunPayload({ query: "教育", relevanceThreshold: 1.1 })).toThrow(/0 to 1/);
    expect(() => parseLayerScreeningRunPayload({ query: "" })).toThrow(/1-500/);
    expect(() => parseLayerScreeningRunPayload({ query: "x".repeat(501) })).toThrow(/1-500/);
    expect(() => parseLayerScreeningRunPayload({ prompt: "教育" })).toThrow(/query string/);
  });

  it("packs requests by measured serialized bytes instead of a fixed count", () => {
    const query = "教育資源分佈";
    const oneQuestionBytes = requestBytes(query, candidates.slice(0, 1));
    const plans = batchCandidates(query, candidates, oneQuestionBytes + 50);
    expect(plans.length).toBeGreaterThan(1);
    expect(plans.every((plan) => plan.requestBytes <= oneQuestionBytes + 50)).toBe(true);
    expect(plans.flatMap((plan) => plan.candidates).map((candidate) => candidate.key)).toEqual(candidates.map((candidate) => candidate.key));
  });

  it("excludes locked index items fail-closed before candidates are sent", () => {
    const index = [
      { key: "medHospital" as const, label: "公開", description: "x", topics: [], aliases: [], theme: null, group: null, upstream: { status: "verified" as const, datasetIds: [] }, sourceKinds: ["custom" as const], sourceIds: [], source: "", score: 0 },
      { key: "medClinic" as const, label: "私有", description: "x", topics: [], aliases: [], theme: null, group: null, upstream: { status: "verified" as const, datasetIds: [] }, sourceKinds: ["custom" as const], sourceIds: [], source: "", score: 0 },
    ];
    const result = collectCandidates(index, new Set(["medClinic"]));
    expect(result.lockedExcludedCount).toBe(1);
    expect(result.candidates.map((candidate) => candidate.key)).toEqual(["medHospital"]);
    expect(JSON.stringify(buildBatchRequest("測試", result.candidates))).not.toContain("medClinic");
  });

  it("redacts prohibited query material before it enters provider state", () => {
    const request = JSON.stringify(buildBatchRequest("教育 https://example.test/a /private/path SELECT * FROM x {\"type\":\"FeatureCollection\",\"features\":[]}", candidates.slice(0, 1)));
    expect(request).not.toMatch(/https:\/\/|\/private\/path|SELECT \* FROM|FeatureCollection/);
    expect(request).toContain("[redacted-url]");
    expect(request).toContain("[redacted-geojson]");
  });

  it("rejects missing, extra, non-noul, and out-of-range answers", () => {
    const ids = ["layer__schools"];
    expect(() => parseNoulAnswers({ answers: { layer__schools: { type: "noul", noul: 1.01 } } }, ids)).toThrow(/invalid noul/i);
    expect(() => parseNoulAnswers({ answers: { layer__schools: { type: "choice", noul: 0.9 } } }, ids)).toThrow(/invalid noul/i);
    expect(() => parseNoulAnswers({ answers: { layer__schools: { type: "noul", noul: 0.9 }, extra: { type: "noul", noul: 0.1 } } }, ids)).toThrow(/question IDs/i);
  });

  it("keeps dry-run decisions unknown and never turns a mock fetch into a real result", async () => {
    const fetcher = async () => Response.json({ answers: {} });
    const receipt = await runLayerScreening({ query: "教育資源", dryRun: true, fetcher, requestByteBudget: 4_000 });
    expect(receipt.mode).toBe("dry-run");
    expect(receipt.layers.every((layer) => layer.decision.status === "unknown" && layer.decision.probability === null && layer.decision.confidence === null)).toBe(true);
    expect(receipt.batches.every((batch) => batch.status === "planned" && batch.requestId === null)).toBe(true);
    expect(receipt.websiteReady).toBe(false);
    expect(RELEVANCE_THRESHOLD).toBe(0.7);
  });

  it("marks a malformed provider batch unknown with a safe diagnostic code", async () => {
    const receipt = await runLayerScreening({
      query: "教育資源",
      apiKey: "test-key-not-a-real-secret",
      requestByteBudget: 12_000,
      fetcher: async () => Response.json({ id: "test-request", answers: {} }),
    });
    expect(receipt.batches.every((batch) => batch.status === "error" && batch.error === "QUESTION_ID_MISMATCH")).toBe(true);
    expect(receipt.layers.every((layer) => layer.decision.status === "unknown" && layer.decision.probability === null)).toBe(true);
  });
});
