/**
 * Phase 2 — 自動配對 (mechanical, evidence-based)
 *
 * Inputs:
 *   - scratchpad/audit/pulse_layers.csv    (Phase 1 output, 227 rows)
 *   - scratchpad/audit/catalog_datasets.csv (Phase 1 output, 261 rows)
 *
 * Output:
 *   - scratchpad/audit/match_proposal.csv
 *   - scratchpad/audit/02_proposal_report.md
 *
 * Rules (priority high → low):
 *   R0  catalog.frontend_target basename == pulse.source_url basename     → HIGH
 *   R1  pulse.rpc_name (normalized) == catalog.supabase_table (normalized) → HIGH
 *   R2  pulse.source_url basename == catalog.paths_processed basename     → HIGH
 *   R3  pulse.loader/hook file path appears in catalog.collectors[]       → HIGH
 *   R4  layer_key normalized == dataset_id normalized                     → MED
 *   —   else                                                              → UNMATCHED
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRATCH = "/private/tmp/claude-501/-Users-migu-Desktop-----gen-ai-try-ichef-----GIS-mini-taiwan-pulse/6c00383b-969d-4fee-96d3-b7971926a182/scratchpad/audit";

// ── Minimal CSV parser (handles quoted fields with commas/quotes) ──
function parseCsv(text: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const lines = text.split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return rows;
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i]!;
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQ = false;
        else cur += c;
      } else {
        if (c === ",") { out.push(cur); cur = ""; }
        else if (c === '"') inQ = true;
        else cur += c;
      }
    }
    out.push(cur);
    return out;
  };
  const header = parseLine(lines[0]!);
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]!);
    const row: Record<string, string> = {};
    header.forEach((h, j) => { row[h] = cells[j] ?? ""; });
    rows.push(row);
  }
  return rows;
}

const pulseRows = parseCsv(readFileSync(join(SCRATCH, "pulse_layers.csv"), "utf-8"));
const catalogRows = parseCsv(readFileSync(join(SCRATCH, "catalog_datasets.csv"), "utf-8"));

console.log(`Loaded pulse rows:     ${pulseRows.length}`);
console.log(`Loaded catalog rows:   ${catalogRows.length}`);

// ── Normalization helpers ──
function normalizeKey(s: string): string {
  return (s || "").toLowerCase()
    .replace(/[._\-]/g, "")
    .replace(/^(get|fetch)/, "")
    .replace(/(daily|stations|station|layer|frames|raster|imagery)$/, "")
    .trim();
}
function basenameNoExt(p: string): string {
  if (!p) return "";
  const clean = p.replace(/[,;)\s]+$/, "");
  const b = basename(clean);
  return b.replace(/\.(pmtiles|geojson|json|csv|parquet|md)$/i, "");
}

// ── Build lookup indices ──
// frontend_target → dataset_id (R0)
const ftIndex = new Map<string, string[]>();
for (const c of catalogRows) {
  const ft = c.frontend_target;
  if (!ft) continue;
  const key = basenameNoExt(ft);
  if (!key) continue;
  if (!ftIndex.has(key)) ftIndex.set(key, []);
  ftIndex.get(key)!.push(c.dataset_id);
}

// supabase_table → dataset_id (R1)
const tableIndex = new Map<string, string[]>();
for (const c of catalogRows) {
  const t = c.supabase_table;
  if (!t) continue;
  const key = normalizeKey(t);
  if (!tableIndex.has(key)) tableIndex.set(key, []);
  tableIndex.get(key)!.push(c.dataset_id);
}

// paths_processed basename → dataset_id (R2)
const pathIndex = new Map<string, string[]>();
for (const c of catalogRows) {
  const p = c.paths_processed;
  if (!p) continue;
  const key = basenameNoExt(p.replace(/\/$/, ""));
  if (!key) continue;
  if (!pathIndex.has(key)) pathIndex.set(key, []);
  pathIndex.get(key)!.push(c.dataset_id);
}

// collector path tail → dataset_id (R3)
const collectorIndex = new Map<string, string[]>();
for (const c of catalogRows) {
  const cols = c.collectors;
  if (!cols) continue;
  for (const path of cols.split("|")) {
    const tail = basename(path).replace(/\.py$/, "").toLowerCase();
    if (!tail) continue;
    if (!collectorIndex.has(tail)) collectorIndex.set(tail, []);
    collectorIndex.get(tail)!.push(c.dataset_id);
  }
}

// dataset_id normalized → dataset_id (R4)
const datasetByNormId = new Map<string, string[]>();
for (const c of catalogRows) {
  const k = normalizeKey(c.dataset_id);
  if (!k) continue;
  if (!datasetByNormId.has(k)) datasetByNormId.set(k, []);
  datasetByNormId.get(k)!.push(c.dataset_id);
}

// ── Apply rules ──
interface MatchRow {
  layer_key: string;
  theme: string;
  chinese_label: string;
  source_type: string;
  source_url: string;
  rpc_names: string;
  loader_file: string;
  hook_file: string;
  dataset_id: string;
  rule: string;
  confidence: string;
  evidence: string;
  alt_candidates: string;
}

const matches: MatchRow[] = [];

for (const p of pulseRows) {
  const candidates: { dataset: string; rule: string; conf: string; evidence: string }[] = [];

  // R0: frontend_target basename match against each pulse source_url
  for (const url of p.source_url.split("|").filter(Boolean)) {
    const b = basenameNoExt(url);
    const hits = ftIndex.get(b) ?? [];
    for (const ds of hits) {
      candidates.push({ dataset: ds, rule: "R0", conf: "HIGH", evidence: `frontend_target basename=${b} <=> pulse url=${url}` });
    }
  }

  // R1: rpc_name vs supabase_table
  for (const rpc of p.rpc_names.split("|").filter(Boolean)) {
    const nk = normalizeKey(rpc);
    const hits = tableIndex.get(nk) ?? [];
    for (const ds of hits) {
      candidates.push({ dataset: ds, rule: "R1", conf: "HIGH", evidence: `rpc=${rpc} (norm=${nk}) <=> supabase_table` });
    }
    // also try without 'public.' prefix or extra parts
    const variant = nk.replace(/^public/, "");
    if (variant !== nk) {
      for (const ds of tableIndex.get(variant) ?? []) {
        candidates.push({ dataset: ds, rule: "R1", conf: "HIGH", evidence: `rpc=${rpc} variant=${variant}` });
      }
    }
  }

  // R2: pulse source_url basename vs paths_processed basename
  for (const url of p.source_url.split("|").filter(Boolean)) {
    const b = basenameNoExt(url);
    const hits = pathIndex.get(b) ?? [];
    for (const ds of hits) {
      candidates.push({ dataset: ds, rule: "R2", conf: "HIGH", evidence: `pulse url basename=${b} <=> catalog paths.processed` });
    }
  }

  // R3: loader/hook file tail vs collectors
  for (const f of [...p.loader_file.split("|"), ...p.hook_file.split("|")].filter(Boolean)) {
    const tail = basename(f).replace(/\.(ts|tsx|py)$/, "").toLowerCase();
    const hits = collectorIndex.get(tail) ?? [];
    for (const ds of hits) {
      candidates.push({ dataset: ds, rule: "R3", conf: "HIGH", evidence: `pulse file=${tail} <=> catalog collector` });
    }
  }

  // R4: layer_key vs dataset_id normalized
  const nk = normalizeKey(p.layer_key);
  for (const ds of datasetByNormId.get(nk) ?? []) {
    candidates.push({ dataset: ds, rule: "R4", conf: "MED", evidence: `layer_key=${p.layer_key} (norm=${nk}) <=> dataset_id (norm match)` });
  }

  // R5: token-overlap fuzzy match (LOW confidence — must be verified in Phase 3)
  // Require ≥2 shared tokens of length ≥4 OR 1 shared token of length ≥7
  const NOISE = new Set(["data","real","time","info","list","table","city","town","year","stop","stat","layer","frames","raster","imagery","station","stations","wholesale","companies","points","point","areas","area","zone","zones","map","public","county","national","facilities","facility","facoffshore","status","current","records","records","global","measurements","observations","positions","events","sites","centers","offices","schools","monthly","yearly","weekly","daily","hourly","trails","routes","stops"]);
  function tokens(s: string): Set<string> {
    const out = new Set<string>();
    if (!s) return out;
    for (const t of s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
      if (t.length >= 4 && !NOISE.has(t)) out.add(t);
    }
    for (const t of s.split(/(?=[A-Z])/).map((x) => x.toLowerCase()).filter(Boolean)) {
      if (t.length >= 4 && !NOISE.has(t)) out.add(t);
    }
    return out;
  }
  const layerTokens = new Set<string>();
  for (const t of tokens(p.layer_key)) layerTokens.add(t);
  for (const rpc of p.rpc_names.split("|").filter(Boolean)) {
    const stripped = rpc.replace(/^(get|fetch)_/, "").replace(/_(day|dates|latest|at|timeseries|frames|batch|window|recent)$/, "");
    for (const t of tokens(stripped)) layerTokens.add(t);
  }
  for (const url of p.source_url.split("|").filter(Boolean)) {
    for (const t of tokens(basenameNoExt(url))) layerTokens.add(t);
  }
  if (layerTokens.size > 0) {
    for (const c of catalogRows) {
      const dsTokens = tokens(c.dataset_id);
      const shared = [...layerTokens].filter((t) => dsTokens.has(t));
      if (shared.length >= 2) {
        candidates.push({
          dataset: c.dataset_id,
          rule: "R5",
          conf: "LOW",
          evidence: `shared tokens [${shared.join(",")}] (layer tokens: ${[...layerTokens].join(",")})`,
        });
      }
    }
  }

  // Pick best: dedup by dataset, keep highest priority rule
  const byDataset = new Map<string, typeof candidates[0]>();
  const priority: Record<string, number> = { R0: 6, R1: 5, R2: 4, R3: 3, R4: 2, R5: 1 };
  for (const c of candidates) {
    const prev = byDataset.get(c.dataset);
    if (!prev || (priority[c.rule] ?? 0) > (priority[prev.rule] ?? 0)) {
      byDataset.set(c.dataset, c);
    }
  }
  const unique = [...byDataset.values()].sort((a, b) => (priority[b.rule] ?? 0) - (priority[a.rule] ?? 0));

  const best = unique[0];
  const alt = unique.slice(1).map((c) => `${c.dataset}(${c.rule})`).join("|");

  matches.push({
    layer_key: p.layer_key,
    theme: p.theme,
    chinese_label: p.chinese_label,
    source_type: p.source_type,
    source_url: p.source_url,
    rpc_names: p.rpc_names,
    loader_file: p.loader_file,
    hook_file: p.hook_file,
    dataset_id: best?.dataset ?? "",
    rule: best?.rule ?? "NONE",
    confidence: best?.conf ?? "UNMATCHED",
    evidence: best?.evidence ?? "",
    alt_candidates: alt,
  });
}

// ── Write CSV ──
function csvEscape(s: string): string {
  if (s == null) return "";
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
const header = ["layer_key", "theme", "chinese_label", "source_type", "source_url", "rpc_names", "loader_file", "hook_file", "dataset_id", "rule", "confidence", "evidence", "alt_candidates"];
const lines = [header.join(",")];
for (const m of matches) {
  lines.push(header.map((h) => csvEscape((m as any)[h] ?? "")).join(","));
}
writeFileSync(join(SCRATCH, "match_proposal.csv"), lines.join("\n") + "\n");

// ── Self-verification (Gate 2) ──
console.log("\n═══ Phase 2 — Match Proposal Report ═══\n");
const ruleCounts = new Map<string, number>();
const confCounts = new Map<string, number>();
for (const m of matches) {
  ruleCounts.set(m.rule, (ruleCounts.get(m.rule) ?? 0) + 1);
  confCounts.set(m.confidence, (confCounts.get(m.confidence) ?? 0) + 1);
}
console.log("Rule breakdown:");
for (const r of ["R0", "R1", "R2", "R3", "R4", "R5", "NONE"]) {
  console.log(`  ${r.padEnd(6)} ${ruleCounts.get(r) ?? 0}`);
}
console.log("\nConfidence breakdown:");
for (const c of ["HIGH", "MED", "LOW", "UNMATCHED"]) {
  console.log(`  ${c.padEnd(12)} ${confCounts.get(c) ?? 0}`);
}
const total = matches.length;
const matched = matches.filter((m) => m.dataset_id).length;
console.log(`\nMatched:   ${matched} / ${total}  (${(matched / total * 100).toFixed(1)}%)`);
console.log(`Unmatched: ${total - matched}`);

// Hot datasets (assigned to multiple layers)
const datasetHitCount = new Map<string, string[]>();
for (const m of matches) {
  if (!m.dataset_id) continue;
  if (!datasetHitCount.has(m.dataset_id)) datasetHitCount.set(m.dataset_id, []);
  datasetHitCount.get(m.dataset_id)!.push(m.layer_key);
}
const hot = [...datasetHitCount.entries()].filter(([_, ls]) => ls.length > 1).sort((a, b) => b[1].length - a[1].length);
console.log(`\nDatasets assigned >1 layer: ${hot.length}`);
for (const [d, ls] of hot.slice(0, 10)) {
  console.log(`  ${d.padEnd(40)} ${ls.length}× : ${ls.slice(0, 5).join(", ")}${ls.length > 5 ? "..." : ""}`);
}

console.log(`\n✓ CSV written: ${join(SCRATCH, "match_proposal.csv")}`);
