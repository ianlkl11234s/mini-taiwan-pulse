#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LAYER_MANIFEST, MANIFEST_KEYS } from "../../src/data/layerManifest.ts";
import { RESEARCH_QUERY_EXECUTOR, registeredDatasetsForLayer } from "../../src/research/researchDatasets.ts";
import { describeRegisteredLayer } from "../../src/research/registeredLayerReader.ts";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const DEFAULT_AUDIT_DATE = "2026-09-23";
const DEFAULT_OUTPUT_BASE = "docs/features/general-analysis/capability-audit-20260923";

function options(argv) {
  let date = DEFAULT_AUDIT_DATE;
  let outputBase = null;
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    const value = argv[index + 1];
    if (option === "--date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) throw new Error("INVALID_AUDIT_DATE");
      date = value;
      index += 1;
    } else if (option === "--output-base") {
      if (!value) throw new Error("MISSING_OUTPUT_BASE");
      outputBase = value;
      index += 1;
    } else if (option === "--help") {
      console.log("Usage: npx vite-node --script scripts/research/capability-audit.mjs [--date YYYY-MM-DD] [--output-base path-without-extension]");
      process.exit(0);
    } else {
      throw new Error(`UNKNOWN_OPTION:${option}`);
    }
  }
  return {
    date,
    outputBase: resolve(root, outputBase ?? DEFAULT_OUTPUT_BASE),
  };
}

const auditOptions = options(process.argv.slice(2));
const outputBase = auditOptions.outputBase;

function sourceKinds(source) {
  return [...new Set((Array.isArray(source) ? source : [source]).map(item => item.kind))].sort();
}

function descriptorSummary(descriptor) {
  return {
    datasetId: descriptor.datasetId,
    layerRefs: [...descriptor.layerRefs],
    kind: descriptor.kind,
    recordGrain: descriptor.recordGrain,
    adapterId: descriptor.adapterId,
    access: {
      mode: descriptor.access.mode,
      method: descriptor.access.method,
      queryEnabled: descriptor.access.query.enabled,
      requiredParameters: (descriptor.parameters ?? []).filter(item => item.required).map(item => item.name).sort(),
    },
    geometry: {
      type: descriptor.geometry.type,
      role: descriptor.geometry.role,
      spatialAnalysisEligible: descriptor.geometry.spatialAnalysisEligible,
    },
    supportedOperations: [...descriptor.supportedOperations].sort(),
    versions: descriptor.versions.length,
  };
}

function layerCapability(key) {
  const entry = LAYER_MANIFEST[key];
  const descriptors = registeredDatasetsForLayer(key);
  const queryable = descriptors.filter(item => item.access.query.enabled);
  const analyzable = descriptors.filter(item => item.access.query.enabled && item.supportedOperations.length > 0);
  const onDemandGeojson = descriptors.length === 0 && describeRegisteredLayer(key) !== null;
  return {
    layerKey: key,
    label: entry.section === null ? key : entry.label,
    dataClass: entry.dataClass,
    sourceKinds: sourceKinds(entry.source),
    discoverable: true,
    datasetIds: descriptors.map(item => item.datasetId).sort(),
    readable: queryable.length > 0 ? "registered" : onDemandGeojson ? "metadata_candidate_requires_readback" : "unknown_or_unavailable",
    analyzable: analyzable.length > 0 ? "registered_operations" : onDemandGeojson ? "metadata_candidate_requires_readback" : "unknown_or_unavailable",
    descriptors: descriptors.map(descriptorSummary),
    geometryKinds: [...new Set(descriptors.map(item => item.geometry.type))].sort(),
    geometryRoles: [...new Set(descriptors.map(item => item.geometry.role))].sort(),
    spatialAnalysisEligibleDatasetIds: descriptors.filter(item => item.geometry.spatialAnalysisEligible).map(item => item.datasetId).sort(),
    evidenceBasis: descriptors.length > 0 ? "researchDatasets runtime registry" : onDemandGeojson ? "registeredLayerReader path candidate only; not hydrated and geometry not verified" : "manifest only; no reader descriptor",
  };
}

const layers = MANIFEST_KEYS.map(layerCapability).sort((a, b) => a.layerKey.localeCompare(b.layerKey));
const sourceKindLayerCounts = Object.fromEntries(
  ["custom", "geojson", "pmtiles", "supabase"].map(kind => [kind, layers.filter(layer => layer.sourceKinds.includes(kind)).length]),
);
const sourceKindAssignments = Object.values(sourceKindLayerCounts).reduce((total, count) => total + count, 0);
const independentDatasets = RESEARCH_QUERY_EXECUTOR.descriptors().filter(item => item.layerRefs.length === 0).map(descriptorSummary);
const datasets = [...new Map([...layers.flatMap(item => item.descriptors), ...independentDatasets].map(item => [item.datasetId, item])).values()]
  .sort((a, b) => a.datasetId.localeCompare(b.datasetId));
const byKind = Object.fromEntries(["point", "line", "polygon", "grid", "event", "admin_statistic", "unknown"].map(kind => {
  const rows = layers.filter(layer => {
    if (kind === "unknown") return layer.descriptors.length === 0;
    return layer.descriptors.some(descriptor => descriptor.kind === kind);
  });
  return [kind, {
    manifestLayerCount: rows.length,
    registeredDatasetCount: datasets.filter(dataset => dataset.kind === kind).length,
    independentDatasetIds: datasets.filter(dataset => dataset.kind === kind && dataset.layerRefs.length === 0).map(dataset => dataset.datasetId),
    layerKeys: rows.map(row => row.layerKey),
  }];
}));
const datasetsByKind = kind => datasets.filter(dataset => dataset.kind === kind);
const standalonePopulation = datasets.filter(dataset => /(^|[:_])(population|resident_population|registered_population)([:_]|$)/i.test(dataset.datasetId));
const support = {
  point: { status: datasetsByKind("point").length > 0 ? "partial" : "gap_or_unknown", evidence: `${datasetsByKind("point").length} registered point dataset(s); manifest layers without descriptors remain unknown; metadata-only GeoJSON candidates require source readback.` },
  line: { status: datasetsByKind("line").length > 0 ? "partial" : "gap_or_unknown", evidence: `${datasetsByKind("line").length} registered line dataset(s) in the runtime registry; display line geometry alone is not proof of readable or analyzable geometry.` },
  polygon: { status: datasetsByKind("polygon").length > 0 || datasetsByKind("admin_statistic").length > 0 ? "partial" : "gap_or_unknown", evidence: `${datasetsByKind("polygon").length} polygon and ${datasetsByKind("admin_statistic").length} admin-statistic dataset(s) are registered; display PMTiles/custom polygons without descriptors remain unknown.` },
  grid: { status: datasetsByKind("grid").length > 0 ? "partial" : "gap_or_unknown", evidence: `${datasetsByKind("grid").length} registered grid dataset(s); independent datasets are not one-to-one with manifest layers, and generalized/occupied-only semantics remain explicit.` },
  event: { status: datasetsByKind("event").length > 0 ? "partial" : "gap_or_unknown", evidence: `${datasetsByKind("event").length} registered event dataset(s); event parameters and geometry role come from descriptors, not display layers.` },
  population: { status: standalonePopulation.length > 0 ? "candidate" : "gap_or_unknown", evidence: standalonePopulation.length > 0 ? `Standalone population candidates: ${standalonePopulation.map(dataset => dataset.datasetId).join(", ")}. Verify denominator contract before use.` : "No descriptor currently matches a standalone population dataset identity; population-derived indicators are not an independent denominator." },
};
const report = {
  schemaVersion: `pulse-research-capability-audit/${auditOptions.date}`,
  auditDate: auditOptions.date,
  generatedBy: "scripts/research/capability-audit.mjs",
  evidence: {
    manifest: "src/data/layerManifest.ts:LAYER_MANIFEST/MANIFEST_KEYS",
    datasetRegistry: "src/research/researchDatasets.ts:RESEARCH_QUERY_EXECUTOR/registeredDatasetsForLayer",
    lazyReader: "src/research/registeredLayerReader.ts:readRegisteredLayer",
    descriptorContract: "src/research/dataContracts.ts:DatasetDescriptor",
    note: "No source assets are fetched; this audit reports runtime registration and declared contracts only.",
  },
  counts: {
    manifestLayers: layers.length,
    registeredDatasets: datasets.length,
    layersWithRegisteredDatasets: layers.filter(item => item.descriptors.length > 0).length,
    layersWithQueryableDatasets: layers.filter(item => item.readable === "registered").length,
    layersWithRegisteredOperations: layers.filter(item => item.analyzable === "registered_operations").length,
    lazyGeojsonCandidates: layers.filter(item => item.readable === "metadata_candidate_requires_readback").length,
    layersWithoutDescriptor: layers.filter(item => item.descriptors.length === 0).length,
    layersWithDescriptorsButNotQueryable: layers.filter(item => item.descriptors.length > 0 && item.readable !== "registered").length,
    layersUnknownOrUnavailable: layers.filter(item => item.readable === "unknown_or_unavailable").length,
    sourceKindLayerCounts,
    sourceKindAssignments,
  },
  support,
  byKind,
  datasets,
  layers,
};

function markdown() {
  const c = report.counts;
  const lines = [
    `# General analysis capability audit (${auditOptions.date})`,
    "",
    "Generated by scripts/research/capability-audit.mjs from runtime manifest and research dataset registry. No source assets were fetched; this is registration/contract evidence, not payload health or production acceptance.",
    "",
    `- Manifest layers: **${c.manifestLayers}**; registered research datasets: **${c.registeredDatasets}**.`,
    `- Layers with registered dataset descriptors: **${c.layersWithRegisteredDatasets}**; queryable: **${c.layersWithQueryableDatasets}**; with declared operations: **${c.layersWithRegisteredOperations}**.`,
    `- Lazy single GeoJSON candidates: **${c.lazyGeojsonCandidates}**; unknown or unavailable: **${c.layersUnknownOrUnavailable}**; layers with no descriptor: **${c.layersWithoutDescriptor}**; descriptors without query access: **${c.layersWithDescriptorsButNotQueryable}**.`,
    "",
    "此快照為程式預設 registry，不含 DEV runtime 注入的本地人口 preview；配對瀏覽器實測與本地預覽另列驗收證據。",
    "",
    "## Evidence boundaries",
    "",
    "Discoverable means a key exists in `LAYER_MANIFEST`; readable means a registered descriptor declares query access. A single GeoJSON path is only a metadata candidate until source readback verifies bytes, schema and geometry. An adapter may serve multiple layers, and a layer may map to multiple datasets. Analyzable is based only on declared descriptor operations and geometry eligibility; rendered points, lines, polygons, PMTiles, or source counts do not establish runtime support. Metadata registration is not runtime success, payload health, source freshness, coverage, or production acceptance.",
    "",
    "## Manifest source families (per-layer deduplicated)",
    "",
    `- custom: **${c.sourceKindLayerCounts.custom}**; geojson: **${c.sourceKindLayerCounts.geojson}**; pmtiles: **${c.sourceKindLayerCounts.pmtiles}**; supabase: **${c.sourceKindLayerCounts.supabase}**.`,
    `- These are source-family assignments, not independent datasets: **${c.sourceKindAssignments}** assignments across **${c.manifestLayers}** layers because a mixed-source layer is counted once in each applicable family.`,
    "",
    "## Geometry and thematic support",
    "",
  ];
  for (const [kind, item] of Object.entries(support)) lines.push(`- **${kind}** — ${item.status}: ${item.evidence}`);
  lines.push("", "## Registry counts by dataset kind", "", "| kind | manifest layers | registered datasets |", "|---|---:|---:|");
  for (const kind of ["point", "line", "polygon", "grid", "event", "admin_statistic", "unknown"]) {
    const item = report.byKind[kind];
    lines.push(`| ${kind} | ${item.manifestLayerCount} | ${item.registeredDatasetCount} |`);
  }
  lines.push("", "## Registered dataset mappings", "", "| dataset | kind | adapter | layers | geometry | operations |", "|---|---|---|---|---|---|");
  for (const item of datasets) lines.push(`| ${item.datasetId} | ${item.kind} | ${item.adapterId} | ${item.layerRefs.join(", ") || "(independent)"} | ${item.geometry.type}/${item.geometry.role}/${item.geometry.spatialAnalysisEligible ? "eligible" : "ineligible"} | ${item.supportedOperations.join(", ") || "(none)"} |`);
  lines.push("", "## Gaps retained as unknown", "", `- ${support.population.evidence}`, `- ${support.line.evidence}`, "- PMTiles/custom/polygon display registration does not imply complete-source record access.", "- The schools grid is an independent occupied-only research dataset and is not a one-to-one layer mapping; omitted cells are not observed zero.", "- News events have a date/filter adapter and proxy township-cluster points; this does not establish exact event geometry or live freshness for all event layers.", "", "Re-run the legacy snapshot: `npx vite-node --script scripts/research/capability-audit.mjs`.", `Re-run this dated snapshot: \`npx vite-node --script scripts/research/capability-audit.mjs --date ${auditOptions.date} --output-base ${outputBase.replace(`${root}/`, "")}\`.`, "");
  return lines.join("\n");
}

await mkdir(dirname(outputBase), { recursive: true });
await writeFile(`${outputBase}.json`, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(`${outputBase}.md`, markdown());
console.log(JSON.stringify({ output: [`${outputBase}.json`, `${outputBase}.md`], counts: report.counts }, null, 2));
