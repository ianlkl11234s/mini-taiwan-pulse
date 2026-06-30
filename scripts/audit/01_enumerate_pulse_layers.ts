/**
 * Phase 1 — pulse layer 盤點
 *
 * Inputs:
 *   - src/components/sidebar/layerCatalog.ts (THEMES, SECTIONS, LAYER_COLORS)
 *   - src/map/overlayRegistry.ts (text grep — id + sourceUrl pairs)
 *   - src/types/index.ts (LayerVisibility keys via grep)
 *   - src/data/*Loader.ts + src/hooks/use*Layer.ts (grep for supabase.rpc calls)
 *
 * Output:
 *   - scratchpad/audit/pulse_layers.csv
 *   - prints summary to stdout
 *
 * Run: pnpm tsx scripts/audit/01_enumerate_pulse_layers.ts
 *
 * Triangulation strategy (for Gate 1 self-verification):
 *   1. import THEMES at runtime → authoritative layer list with section/label
 *   2. import LAYER_COLORS keys → independent count (must equal THEMES flatten)
 *   3. grep layerCatalog.ts for `key:` to triple-count
 *   If any 2 of 3 disagree, fail loud.
 */
import { THEMES, LAYER_COLORS } from "../../src/components/sidebar/layerCatalog";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..", "..");
const OUT_DIR = "/private/tmp/claude-501/-Users-migu-Desktop-----gen-ai-try-ichef-----GIS-mini-taiwan-pulse/6c00383b-969d-4fee-96d3-b7971926a182/scratchpad/audit";
const OUT_CSV = join(OUT_DIR, "pulse_layers.csv");

// ── Walk THEMES → flat layer list with section ──
interface LayerRow {
  layer_key: string;
  theme: string;
  section: string;
  chinese_label: string;
  label_mobile: string;
  source_url: string;
  source_type: string;
  loader_file: string;
  rpc_names: string;
  hook_file: string;
}

const rows: LayerRow[] = [];
for (const theme of THEMES) {
  for (const group of theme.groups) {
    for (const layer of group.layers) {
      rows.push({
        layer_key: layer.key,
        theme: theme.title,
        section: group.title,
        chinese_label: layer.label,
        label_mobile: layer.labelMobile ?? "",
        source_url: "",
        source_type: "",
        loader_file: "",
        rpc_names: "",
        hook_file: "",
      });
    }
  }
}

// ── Cross-check counts ──
const themesKeys = new Set(rows.map((r) => r.layer_key));
const colorsKeys = new Set(Object.keys(LAYER_COLORS));

const onlyInThemes = [...themesKeys].filter((k) => !colorsKeys.has(k));
const onlyInColors = [...colorsKeys].filter((k) => !themesKeys.has(k));

// grep-based independent count
const catalogSrc = readFileSync(
  join(ROOT, "src/components/sidebar/layerCatalog.ts"),
  "utf-8"
);
const keyRegex = /\{\s*key:\s*"([a-zA-Z0-9_]+)"/g;
const grepKeys = new Set<string>();
for (const m of catalogSrc.matchAll(keyRegex)) grepKeys.add(m[1]!);

const onlyInGrep = [...grepKeys].filter((k) => !themesKeys.has(k));
const themesOnly = [...themesKeys].filter((k) => !grepKeys.has(k));

// ── Parse overlayRegistry.ts for id + nearby sourceUrl ──
const overlaySrc = readFileSync(
  join(ROOT, "src/map/overlayRegistry.ts"),
  "utf-8"
);
const overlayLines = overlaySrc.split("\n");
const overlayEntries = new Map<string, string[]>(); // layer_key -> [sourceUrl, ...]
const overlayIds = new Set<string>();
for (let i = 0; i < overlayLines.length; i++) {
  const m = overlayLines[i]!.match(/id:\s*"([a-zA-Z0-9_]+)"/);
  if (!m) continue;
  const key = m[1]!;
  overlayIds.add(key);
  // Look ahead 30 lines for sourceUrl
  let url = "";
  for (let j = i; j < Math.min(i + 30, overlayLines.length); j++) {
    const u = overlayLines[j]!.match(/sourceUrl:\s*([^,\n]+)/);
    if (u) {
      url = u[1]!.trim().replace(/^['"`]|['"`]$/g, "").replace(/[,\s]+$/, "");
      break;
    }
  }
  if (!overlayEntries.has(key)) overlayEntries.set(key, []);
  if (url) overlayEntries.get(key)!.push(url);
}

// ── For each layer_key, full src/ grep to find any reference signal ──
function grepSrcForKey(key: string): { files: string[]; hasGeojson: boolean; hasPmtiles: boolean; hasRpc: boolean; hasThree: boolean; extractedUrls: string[] } {
  const files: string[] = [];
  try {
    const out = execSync(
      `grep -rlE "[\\"']${key}[\\"']" ${join(ROOT, "src")} 2>/dev/null || true`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    );
    for (const f of out.trim().split("\n").filter(Boolean)) files.push(f);
  } catch {}
  let hasGeojson = false, hasPmtiles = false, hasRpc = false, hasThree = false;
  const extractedUrls = new Set<string>();
  for (const f of files) {
    try {
      const src = readFileSync(f, "utf-8");
      // Find ALL occurrences of "key" and check nearby URLs for each
      let pos = 0;
      while ((pos = src.indexOf(`"${key}"`, pos)) >= 0) {
        // Wider window for signals (file-level detection)
        const wideStart = Math.max(0, pos - 2000);
        const wideEnd = Math.min(src.length, pos + 2000);
        const wide = src.slice(wideStart, wideEnd);
        if (/\.geojson/i.test(wide)) hasGeojson = true;
        if (/\.pmtiles/i.test(wide)) hasPmtiles = true;
        if (/\.rpc\(/i.test(wide) || /supabase/i.test(wide)) hasRpc = true;
        if (/three|CustomLayer|webgl|gl\.create/i.test(wide)) hasThree = true;
        // Tight window for URL attribution (avoid false positives)
        const tightStart = Math.max(0, pos - 400);
        const tightEnd = Math.min(src.length, pos + 400);
        const tight = src.slice(tightStart, tightEnd);
        for (const m of tight.matchAll(/["'`]([^"'`\s]*?(?:\.pmtiles|\.geojson|\.json))["'`]/g)) {
          const url = m[1]!;
          if (url.includes("node_modules") || url.length > 200) continue;
          extractedUrls.add(url);
        }
        pos += key.length + 2;
      }
    } catch {}
  }
  return { files, hasGeojson, hasPmtiles, hasRpc, hasThree, extractedUrls: [...extractedUrls] };
}

// ── Grep src/data/*Loader.ts + src/hooks/use*Layer.ts ──
const dataDir = join(ROOT, "src/data");
const hooksDir = join(ROOT, "src/hooks");
const loaderFiles = readdirSync(dataDir).filter((f) => f.endsWith("Loader.ts"));
const hookFiles = readdirSync(hooksDir).filter((f) => f.match(/^use\w+Layer\.ts$/));

// Map layer_key → loader/hook file by name heuristic
function keyToLoaderCandidates(key: string): string[] {
  const lower = key.toLowerCase();
  const candidates: string[] = [];
  for (const f of loaderFiles) {
    const fLow = f.toLowerCase().replace("loader.ts", "");
    if (fLow.includes(lower) || lower.includes(fLow)) candidates.push(f);
  }
  return candidates;
}
function keyToHookCandidates(key: string): string[] {
  const cap = key.charAt(0).toUpperCase() + key.slice(1);
  const exact = `use${cap}Layer.ts`;
  if (hookFiles.includes(exact)) return [exact];
  const lower = key.toLowerCase();
  return hookFiles.filter((f) => f.toLowerCase().includes(lower));
}

// Extract RPC names from a loader file
function extractRpcNames(filePath: string): string[] {
  try {
    const src = readFileSync(filePath, "utf-8");
    const rpcs = new Set<string>();
    for (const m of src.matchAll(/\.rpc\(\s*["']([a-zA-Z0-9_]+)["']/g)) {
      rpcs.add(m[1]!);
    }
    return [...rpcs];
  } catch {
    return [];
  }
}

for (const row of rows) {
  const urls = overlayEntries.get(row.layer_key) ?? [];
  row.source_url = urls.join("|");

  const loaders = keyToLoaderCandidates(row.layer_key);
  row.loader_file = loaders.join("|");

  const hooks = keyToHookCandidates(row.layer_key);
  row.hook_file = hooks.join("|");

  const rpcs = new Set<string>();
  for (const f of [...loaders, ...hooks]) {
    const full = loaders.includes(f) ? join(dataDir, f) : join(hooksDir, f);
    for (const r of extractRpcNames(full)) rpcs.add(r);
  }

  // Full src grep fallback
  const sig = grepSrcForKey(row.layer_key);
  if (!row.loader_file && !row.hook_file) {
    const interesting = sig.files
      .map((f) => f.replace(ROOT + "/", ""))
      .filter((f) => f.startsWith("src/data/") || f.startsWith("src/hooks/") || f.startsWith("src/three/") || f.startsWith("src/map/"))
      .slice(0, 3);
    row.hook_file = interesting.join("|");
  }
  // Also scan referenced files for RPCs
  for (const f of sig.files) {
    if (f.includes("/src/data/") || f.includes("/src/hooks/")) {
      for (const r of extractRpcNames(f)) rpcs.add(r);
    }
  }
  row.rpc_names = [...rpcs].join("|");

  // Merge URLs from grep into source_url
  const mergedUrls = new Set<string>([...urls, ...sig.extractedUrls]);
  row.source_url = [...mergedUrls].join("|");

  // Derive source_type (priority order)
  if (urls.some((u) => u.endsWith(".pmtiles")) || sig.hasPmtiles) row.source_type = "pmtiles";
  else if (urls.some((u) => u.endsWith(".geojson")) || sig.hasGeojson) row.source_type = "static_geojson";
  else if (row.rpc_names || sig.hasRpc) row.source_type = "supabase_rpc";
  else if (sig.hasThree) row.source_type = "three_only";
  else if (row.loader_file || row.hook_file || sig.files.length) row.source_type = "external_api_or_dynamic";
  else row.source_type = "unknown";
}

// ── Write CSV ──
function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n"))
    return `"${s.replace(/"/g, '""')}"`;
  return s;
}
const header = [
  "layer_key", "theme", "section", "chinese_label", "label_mobile",
  "source_url", "source_type", "loader_file", "rpc_names", "hook_file",
];
const csvLines = [header.join(",")];
for (const r of rows) {
  csvLines.push(header.map((h) => csvEscape((r as any)[h] ?? "")).join(","));
}
writeFileSync(OUT_CSV, csvLines.join("\n") + "\n");

// ── Self-verification (Gate 1) ──
console.log("═══ Phase 1 — Pulse Layers Enumeration ═══\n");
console.log(`Rows written:           ${rows.length}`);
console.log(`LAYER_COLORS keys:      ${colorsKeys.size}`);
console.log(`THEMES keys (unique):   ${themesKeys.size}`);
console.log(`Grep 'key:' matches:    ${grepKeys.size}`);
console.log(`overlayRegistry ids:    ${overlayIds.size}`);
console.log();

console.log("─── Cross-check (Gate 1) ───");
if (onlyInThemes.length) {
  console.log(`⚠ In THEMES but not LAYER_COLORS (${onlyInThemes.length}):`, onlyInThemes.slice(0, 10));
}
if (onlyInColors.length) {
  console.log(`⚠ In LAYER_COLORS but not THEMES (${onlyInColors.length}):`, onlyInColors.slice(0, 10));
}
if (themesOnly.length) {
  console.log(`⚠ In THEMES but grep missed (${themesOnly.length}):`, themesOnly.slice(0, 10));
}
if (onlyInGrep.length) {
  console.log(`⚠ Grep found but not in THEMES (${onlyInGrep.length}):`, onlyInGrep.slice(0, 10));
}
if (!onlyInThemes.length && !onlyInColors.length && !themesOnly.length && !onlyInGrep.length) {
  console.log("✓ All three sources agree on layer keys.");
}

console.log();
console.log("─── Source type distribution ───");
const typeCounts = new Map<string, number>();
for (const r of rows) {
  typeCounts.set(r.source_type, (typeCounts.get(r.source_type) ?? 0) + 1);
}
for (const [t, c] of [...typeCounts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${t.padEnd(28)} ${c}`);
}

console.log();
console.log("─── Theme distribution ───");
const themeCounts = new Map<string, number>();
for (const r of rows) {
  themeCounts.set(r.theme, (themeCounts.get(r.theme) ?? 0) + 1);
}
for (const [t, c] of themeCounts) {
  console.log(`  ${t.padEnd(28)} ${c}`);
}

console.log();
console.log(`✓ CSV written: ${OUT_CSV}`);
