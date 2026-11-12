/**
 * W6-3 網格預算（TS，kernel 只在 TS）：
 *   aviation：public/sound-atlas/grid/aviation-src-<D>.json → aviation-<D>.{class.bin,meta.json}
 *             每 10 分一幀＝aviationIntervalCodes（區間 30 秒細取樣的最大值，同 queryAviationInterval）
 *   canopy  ：scratch 30 m 樹冠格網（build-sound-grid-sources.py --canopy-out）→ canopy-cells-v1.{bin,meta.json}
 *             每格＝canopyCover(格心)（同 windVegetationAdapter）
 *
 * 用法（worktree 根目錄）：
 *   npx vite-node scripts/preprocess/sound/build-sound-grid-packs.ts -- aviation 2026-11-09 2026-10-24
 *   npx vite-node scripts/preprocess/sound/build-sound-grid-packs.ts -- canopy <scratch>/canopy-beibei-30m.i16
 */
import { createHash } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { flightRowsToFlights, type FlightTrailRow } from "../../../src/data/flightTrails";
import { gateFamilyRecords } from "../../../src/sound/engines/receiverQuery";
import { aviationIntervalCodes, scopeMask } from "../../../src/sound/grid/aviationGrid";
import { cellCenter, GRID_CELLS, GRID_SPEC, GRID_UNKNOWN } from "../../../src/sound/grid/gridSpec";
import { POTENTIAL_CODE_MAX, POTENTIAL_CODE_SCALE, binLookup, minCodeForPotential } from "../../../src/sound/grid/potentialCode";
import { POTENTIAL_FRAME_STEP_S, POTENTIAL_PACK_SCHEMA } from "../../../src/sound/grid/potentialPack";
import { CANOPY_CELLS_SCHEMA } from "../../../src/sound/grid/gridSources";
import { AVIATION_GATE_LADDER, AVIATION_PACK_EDGES } from "../../../src/sound/grid/aviationGates";
import { MODEL_VERSION, COMMON, WIND_VEGETATION } from "../../../src/sound/model/soundProfiles";
import { loadAviation, type AviationRecord } from "../../../src/sound/sourceAdapters/aviationAdapter";
import { CANOPY_CELL_NOT_SAMPLED, canopyCellCode, canopyCover, type CanopyGrid } from "../../../src/sound/sourceAdapters/windVegetationAdapter";
import { taipeiMidnightMs } from "../../../src/lib/taipeiDay";

const ROOT = path.resolve(import.meta.dirname ?? __dirname, "../../..");
const OUT = path.join(ROOT, "public/sound-atlas/grid");
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const gridMeta = () => ({ id: GRID_SPEC.id, west: GRID_SPEC.west, north: GRID_SPEC.north, dLon: GRID_SPEC.dLon, dLat: GRID_SPEC.dLat, cols: GRID_SPEC.cols, rows: GRID_SPEC.rows });

function writeAtomic(file: string, data: Uint8Array | string): void {
  writeFileSync(`${file}.part`, data);
  renameSync(`${file}.part`, file);
}

async function buildAviation(date: string): Promise<void> {
  const srcFile = `aviation-src-${date}.json`;
  const bytes = readFileSync(path.join(OUT, srcFile));
  const src = JSON.parse(bytes.toString("utf-8")) as { schema: string; rows: FlightTrailRow[] };
  if (src.schema !== "pulse-sound-aviation-src-v1") throw new Error(`${srcFile}: schema ${src.schema}`);
  const set = await loadAviation({ date, nowUnix: Date.now() / 1000 }, async () => ({ flights: flightRowsToFlights(src.rows).flights }));
  const day0 = taipeiMidnightMs(date) / 1000;
  const scope = scopeMask();
  const frames = 144;
  const raw = new Uint8Array(frames * GRID_CELLS);
  const buf = new Uint8Array(GRID_CELLS);
  const binLut = binLookup(AVIATION_PACK_EDGES);
  const gateMin = AVIATION_GATE_LADDER.map((g) => minCodeForPotential(g));
  const gateCounts = AVIATION_GATE_LADDER.map(() => 0);
  const gatePeak = AVIATION_GATE_LADDER.map(() => 0);
  let known = 0, active = 0, unknown = 0, inScopeFrames = 0, activePeak = 0, gated = 0;
  const t0 = performance.now();
  for (let k = 0; k < frames; k++) {
    const b = day0 + k * POTENTIAL_FRAME_STEP_S;
    const gate = gateFamilyRecords("aviation", [set], b, b + POTENTIAL_FRAME_STEP_S - 1e-6);
    if (gate.kind !== "ok") { buf.fill(GRID_UNKNOWN); gated++; }
    else aviationIntervalCodes(gate.records as AviationRecord[], b, b + POTENTIAL_FRAME_STEP_S - 1e-6, buf, scope);
    for (let c = 0; c < GRID_CELLS; c++) buf[c] = binLut[buf[c]!]!;
    raw.set(buf, k * GRID_CELLS);
    const frameGate = AVIATION_GATE_LADDER.map(() => 0);
    let frameActive = 0;
    for (let c = 0; c < GRID_CELLS; c++) {
      if (!scope[c]) continue;
      inScopeFrames++;
      const v = buf[c]!;
      if (v === GRID_UNKNOWN) { unknown++; continue; }
      known++;
      if (v > 0) { active++; frameActive++; }
      gateMin.forEach((m, i) => { if (v >= m) { gateCounts[i]!++; frameGate[i]!++; } });
    }
    activePeak = Math.max(activePeak, frameActive);
    frameGate.forEach((n, i) => { gatePeak[i] = Math.max(gatePeak[i]!, n); });
    if (k % 24 === 23) console.log(`  ${date} frame ${k + 1}/144 (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
  }
  const cellsInScope = inScopeFrames / frames;
  const gz = gzipSync(raw, { level: 9 });
  const name = `aviation-${date}`;
  const meta = {
    schema: POTENTIAL_PACK_SCHEMA,
    family: "aviation",
    date_taiwan: date,
    model_version: MODEL_VERSION,
    grid: gridMeta(),
    payload: { file: `${name}.class.bin`, encoding: "gzip", dtype: "uint8", layout: "frame-major (frame*cells + row*cols + col)", bytes: gz.length, raw_bytes: raw.length, sha256: sha(gz) },
    frames: { count: frames, step_s: POTENTIAL_FRAME_STEP_S, first_slot_utc: new Date(day0 * 1000).toISOString(), rule: "frame k＝[first_slot+600k, +600)；值＝該區間 queryAviationInterval 規則的最大潛勢（每 30 秒取樣）" },
    code: { scale: POTENTIAL_CODE_SCALE, max: POTENTIAL_CODE_MAX, unknown: GRID_UNKNOWN, bin_edges: [...AVIATION_PACK_EDGES], rule: "0＝候選半徑 20 km 內沒有航機；其餘＝潛勢所在箱的下緣碼（箱界 bin_edges；碼 k ↔ 潛勢 (k−1)/200；(0, 0.02) 記 1）；255＝無法判斷或範圍外" },
    source: { file: srcFile, sha256: sha(bytes), schema: src.schema, flights: src.rows.length },
    receiver_height_m: COMMON.receiverDefaultHeightM.value,
    stats: {
      in_scope_cells: cellsInScope,
      cell_frames_known: known,
      cell_frames_unknown: unknown,
      frames_gated_unknown: gated,
      share_active_any: +(active / Math.max(1, known)).toFixed(4),
      peak_frame_active_share: +(activePeak / cellsInScope).toFixed(4),
      gates: AVIATION_GATE_LADDER.map((g, i) => ({ potential: g, share_cell_frames: +(gateCounts[i]! / Math.max(1, known)).toFixed(4), peak_frame_share: +(gatePeak[i]! / cellsInScope).toFixed(4) })),
      build_s: +((performance.now() - t0) / 1000).toFixed(1),
    },
    generated_at: new Date().toISOString(),
  };
  writeAtomic(path.join(OUT, `${name}.class.bin`), gz);
  writeAtomic(path.join(OUT, `${name}.meta.json`), JSON.stringify(meta, null, 1));
  console.log(`${name}: ${gz.length.toLocaleString()} B gzip (raw ${raw.length.toLocaleString()}), ${meta.stats.build_s} s`);
  console.log(JSON.stringify(meta.stats));
}

function buildCanopy(fineFile: string): void {
  const m = JSON.parse(readFileSync(`${fineFile}.json`, "utf-8")) as { bbox: [number, number, number, number]; nx: number; ny: number; origin: string; cell_m: number };
  const b = readFileSync(fineFile);
  const heights = new Int16Array(b.buffer, b.byteOffset, b.length / 2);
  if (heights.length !== m.nx * m.ny) throw new Error("canopy fine grid size mismatch");
  const grid: CanopyGrid = { bbox: m.bbox, nx: m.nx, ny: m.ny, heights: heights as unknown as number[], origin: m.origin };
  const scope = scopeMask();
  const codes = new Uint8Array(GRID_CELLS).fill(CANOPY_CELL_NOT_SAMPLED);
  const t0 = performance.now();
  const hist = { masked: 0, notSampled: 0, zero: 0, some: 0 };
  for (let c = 0; c < GRID_CELLS; c++) {
    if (!scope[c]) continue;
    const [lon, lat] = cellCenter(c);
    const v = canopyCellCode(canopyCover(grid, lon, lat));
    codes[c] = v;
    if (v === 253) hist.masked++; else if (v === 254) hist.notSampled++; else if (v === 0) hist.zero++; else hist.some++;
  }
  const gz = gzipSync(codes, { level: 9 });
  const meta = {
    schema: CANOPY_CELLS_SCHEMA,
    grid: gridMeta(),
    origin: m.origin,
    cover_scale: 250,
    rule: `每格＝canopyCover(格心, ${WIND_VEGETATION.canopyRadiusM.value} m, ≥${WIND_VEGETATION.minCanopyHeightM.value} m)×250 四捨五入；253＝範圍內全部遮罩（無樹／海／無資料分不出）、254＝沒取樣或範圍外`,
    fine_grid: { bbox: m.bbox, nx: m.nx, ny: m.ny, cell_m: m.cell_m },
    payload: { file: "canopy-cells-v1.bin", encoding: "gzip", bytes: gz.length, raw_bytes: codes.length, sha256: sha(gz) },
    stats: hist,
    build_s: +((performance.now() - t0) / 1000).toFixed(1),
    generated_at: new Date().toISOString(),
  };
  writeAtomic(path.join(OUT, "canopy-cells-v1.bin"), gz);
  writeAtomic(path.join(OUT, "canopy-cells-v1.meta.json"), JSON.stringify(meta, null, 1));
  console.log(`canopy-cells-v1: ${gz.length.toLocaleString()} B gzip`, JSON.stringify(hist), `${meta.build_s} s`);
}

const [cmd, ...args] = process.argv.slice(2).filter((a) => a !== "--");
if (cmd === "aviation") {
  for (const d of args) await buildAviation(d);
} else if (cmd === "canopy") {
  buildCanopy(args[0]!);
} else {
  console.error("usage: aviation <date...> | canopy <fine.i16>");
  process.exit(1);
}
