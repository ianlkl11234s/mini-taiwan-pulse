#!/usr/bin/env node
// Run with: npx vite-node --script scripts/research/build-completion-queue.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LAYER_MANIFEST, MANIFEST_KEYS } from "../../src/data/layerManifest.ts";
import { WORLD_TAB_THEME_TITLES } from "../../src/components/sidebar/layerCatalog.ts";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const ledger = JSON.parse(readFileSync(resolve(root, "docs/features/general-analysis/p0-source-family-ledger-20260925-current.json"), "utf8"));
const byKey = new Map(ledger.entries.map(entry => [entry.layerKey, entry]));
const groups = ["taiwan_gis", "county_statistics", "global_gis", "japan_gis"];
const worldThemes = new Set(WORLD_TAB_THEME_TITLES);

function groupOf(key, manifest) {
  // These hidden research entries retain their geography even when absent from the visible Japan rail.
  if (key.startsWith("jp")) return "japan_gis";
  if (key.startsWith("stats") || /統計|Statistics/.test(manifest.section?.theme ?? "")) return "county_statistics";
  if (worldThemes.has(manifest.section?.theme)) return "global_gis";
  return "taiwan_gis";
}

function clusterOf(entry) {
  if (entry.layerKey === "pollutionFacility") return { key: "candidate:moenv:EMS_S_01:facilities", proof: "separate_facility_source_declared_raw_release_pending" };
  if (["noiseEnforcementEvents", "pollutionPenaltyCritical", "pollutionPenaltyGeneral", "pollutionPenaltyMobile"].includes(entry.layerKey))
    return { key: "candidate:moenv:EMS_P_46:penalties", proof: "shared_penalty_event_display_raw_release_pending" };
  if (entry.layerKey.startsWith("gasCoverage")) return { key: `derived:gas_coverage:${entry.layerKey}`, proof: "derived_distance_surface_not_raw_gas_station_points" };
  if (entry.verifiedRawFamilyKey) return { key: entry.verifiedRawFamilyKey, proof: "raw_lineage_inspected_display_alignment_pending" };
  if (entry.declaredContract?.key) return { key: entry.declaredContract.key, proof: "declared_contract_only_raw_family_unverified" };
  return { key: entry.familyKey, proof: "display_asset_or_unresolved_only_raw_family_unverified" };
}

function stepOf(entry) {
  if (entry.status === "RIGHTS_HOLD") return "verify_public_use_rights";
  if (entry.status === "VERSION_MISMATCH") return "align_exact_source_and_display_release";
  if (entry.status === "SOURCE_MISSING") return "find_raw_artifact_or_bounded_rpc";
  if (entry.declaredContract?.kind === "derived_statistics_recipe") return "audit_exact_numerator_denominator_release";
  if (entry.candidateClass === "metadata_geojson_candidate") return "verify_complete_raw_source_then_register_reader";
  return "verify_source_contract_then_register_reader";
}

function csvCell(value) {
  const string = String(value ?? "");
  return /[",\n\r]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

if (ledger.entries.length !== 778 || MANIFEST_KEYS.length !== 778 || byKey.size !== 778 ||
    MANIFEST_KEYS.some(key => !byKey.has(key)) || ledger.entries.some(entry => !LAYER_MANIFEST[entry.layerKey])) {
  throw new Error("778-layer manifest/ledger identity mismatch");
}

const all = MANIFEST_KEYS.map(key => {
  const entry = byKey.get(key);
  const group = groupOf(key, LAYER_MANIFEST[key]);
  const cluster = clusterOf(entry);
  const version = entry.verifiedRawFamilyKey ? ledger.verifiedRawFamilies[entry.verifiedRawFamilyKey]?.sourceVersion ?? "" : "";
  return { layerKey: key, group, uiTheme: LAYER_MANIFEST[key].section?.theme ?? "ORPHAN_NO_UI_SECTION",
    candidateClass: entry.candidateClass, status: entry.status, sourceCluster: cluster.key, clusterProof: cluster.proof,
    verifiedSourceVersion: version || "NOT_VERIFIED", sourceArtifact: entry.sourceArtifact ? JSON.stringify(entry.sourceArtifact) : "NOT_VERIFIED",
    upstreamDatasetIds: entry.upstream?.datasetIds?.join("|") ?? "", blocker: entry.primaryBlocker ?? "", currentStep: stepOf(entry),
    nextStep: entry.nextStep ?? "", acceptanceReceipt: entry.status === "QUERYABLE_REGISTERED" ? "see source-family-priority-rollout-20260925.md; gate level not inferred" : "NONE_YET" };
});
const counts = Object.fromEntries(groups.map(group => [group, { all: 0, registered: 0, pending: 0 }]));
for (const row of all) {
  const count = counts[row.group];
  count.all += 1;
  count[row.status === "QUERYABLE_REGISTERED" ? "registered" : "pending"] += 1;
}
if (Object.values(counts).reduce((sum, count) => sum + count.all, 0) !== 778 ||
    Object.values(counts).reduce((sum, count) => sum + count.pending, 0) !== ledger.counts.candidateLayers) {
  throw new Error("Group totals do not reconcile with the current 778-layer ledger");
}

const pending = all.filter(row => row.status !== "QUERYABLE_REGISTERED").sort((a, b) =>
  groups.indexOf(a.group) - groups.indexOf(b.group) ||
  Number(a.sourceCluster.startsWith("unresolved:")) - Number(b.sourceCluster.startsWith("unresolved:")) ||
  a.sourceCluster.localeCompare(b.sourceCluster) || a.layerKey.localeCompare(b.layerKey));
const columns = Object.keys(all[0]);
const csv = [columns.join(","), ...pending.map(row => columns.map(column => csvCell(row[column])).join(","))].join("\n") + "\n";
writeFileSync(resolve(root, "docs/features/general-analysis/completion-queue-20260925.csv"), csv);
writeFileSync(resolve(root, "docs/features/general-analysis/completion-queue-20260925-summary.json"),
  JSON.stringify({ schemaVersion: "pulse-research-completion-queue/2026-09-25", ledger: "p0-source-family-ledger-20260925-current.json",
    classification: "Primary operational group from manifest section and exact key; not a claim that every feature has Taiwan-only or county-only geographic coverage.",
    hiddenOrphanCount: all.filter(row => row.uiTheme === "ORPHAN_NO_UI_SECTION").length,
    counts, pending: pending.length, statuses: Object.fromEntries([...new Set(pending.map(row => row.status))].sort().map(status => [status, pending.filter(row => row.status === status).length])) }, null, 2) + "\n");
console.log(JSON.stringify({ counts, pending: pending.length }));
