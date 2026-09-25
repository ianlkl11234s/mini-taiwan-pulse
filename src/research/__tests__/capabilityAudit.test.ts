import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("capability audit P0 ledger", () => {
  it("keeps every manifest layer while retaining the unknown queue reconciliation", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "pulse-capability-audit-"));
    const auditBase = join(outputDir, "audit");
    const ledgerBase = join(outputDir, "ledger");
    try {
      execFileSync("npx", ["vite-node", "--script", "scripts/research/capability-audit.mjs", "--date", "2026-09-25", "--output-base", auditBase, "--family-ledger-base", ledgerBase], {
        cwd: process.cwd(), stdio: "pipe",
      });
      const audit = JSON.parse(readFileSync(`${auditBase}.json`, "utf8"));
      const ledger = JSON.parse(readFileSync(`${ledgerBase}.json`, "utf8"));
      const csvLines = readFileSync(`${ledgerBase}.unknown.csv`, "utf8").trimEnd().split("\n");
      const unknown = ledger.entries.filter((entry: { candidateClass: string }) => entry.candidateClass === "unknown_or_unavailable");
      const queryable = ledger.entries.filter((entry: { candidateClass: string; status: string }) => entry.candidateClass === "registered_queryable" && entry.status === "QUERYABLE_REGISTERED");

      expect(ledger.counts.allLayers).toBe(audit.counts.manifestLayers);
      expect(ledger.entries).toHaveLength(audit.counts.manifestLayers);
      expect(new Set(ledger.entries.map((entry: { layerKey: string }) => entry.layerKey)).size).toBe(ledger.counts.allLayers);
      expect(ledger.counts.candidateLayers).toBe(audit.counts.layersUnknownOrUnavailable + audit.counts.lazyGeojsonCandidates);
      expect(unknown).toHaveLength(audit.counts.layersUnknownOrUnavailable);
      expect(csvLines).toHaveLength(ledger.counts.unknownOrUnavailable + 1);
      expect(ledger.csvQueueSamples).toHaveLength(10);
      expect(queryable).toHaveLength(audit.counts.layersWithQueryableDatasets);
      for (const entry of ledger.entries) expect(entry.evidence).toEqual(expect.objectContaining({ localAsset: expect.any(Object), remoteVersion: expect.any(Object), query: expect.any(Object), displayed: expect.any(Object) }));
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  }, 30_000);
});
