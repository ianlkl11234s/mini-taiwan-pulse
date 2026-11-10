/**
 * 圖層 ↔ pulse-data 登記簿對照（ADR-0024 R1c，owner-local）
 *
 * 登記簿（私有 repo pulse-data 的 registry/*.yaml）是來源追蹤的唯一總表。這支測試守住兩件事：
 *  1. LAYER_MANIFEST 每一層都出現在某條目的 consumers.pulse_layers（檔頭或檔尾 warehouse 區塊皆可），
 *     或列在 registry/_no_upstream.yaml（手繪、衍生、前端直連外部服務等真的沒有上游的圖層）。
 *  2. 反向：登記簿裡出現、但 manifest 已沒有的圖層 key 一律失敗——網站刪層或改名時登記要同步，
 *     否則更新清單、變更紀錄會對到不存在的圖層，殘留只會靜默累積。
 *
 * 讀取位置：env PULSE_DATA_ROOT 優先；否則 owner 模式（npm run test:owner）讀隔壁 ../pulse-data 主 checkout。
 * 在 .worktrees/<x> 裡跑時預設路徑會解到 .worktrees/pulse-data（不存在 → skip），所以 worktree 內請帶 PULSE_DATA_ROOT。
 * CI 沒有 pulse-data：未設 env 且非 owner 模式 → skip；env 指到的位置沒有 registry/ → 直接報錯（避免設錯路徑卻靜默略過）。
 *
 * 不加 YAML 依賴：只解析 `pulse_layers:` 的 flow（[a, b]，可跨行）與 block（- a）兩種寫法，和 `_no_upstream.yaml` 的 `- layer: x`。
 *
 * 入倉守門（AG-13）：每層要「入倉」（登記條目有 warehouse 區塊，或 dataset 在 stats_observations），
 * 或列在 `_no_upstream.yaml`／`_display_only.yaml`（reason＋unlock），否則必須在只減不增的 `_warehouse_baseline.yaml`。
 * 規則與 pulse-data `scripts/check_layer_coverage.py` (d)(e) 相同；解析與分類在 scripts/research/layer-warehouse-status.mjs。
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { LAYER_MANIFEST } from "../layerManifest";
import { OWNER_TESTS } from "../../test/ownerAssets";
import {
  BASELINE_FILE,
  DERIVED_FILES,
  DISPLAY_ONLY_FILE,
  NO_UPSTREAM_FILE,
  checkWarehouseGate,
  indexRegistry,
  parseLayerListKeys,
  parsePulseLayers,
} from "../../../scripts/research/layer-warehouse-status.mjs";

function resolveRegistryDir(): string | null {
  const envRoot = process.env.PULSE_DATA_ROOT;
  if (envRoot) {
    const dir = resolve(envRoot, "registry");
    if (!existsSync(dir)) throw new Error(`PULSE_DATA_ROOT does not contain registry/: ${dir}`);
    return dir;
  }
  if (!OWNER_TESTS) return null;
  const dir = resolve(__dirname, "../../../../pulse-data/registry");
  return existsSync(dir) ? dir : null;
}

const registryDir = resolveRegistryDir();

describe.skipIf(!registryDir)("layerManifest ↔ pulse-data registry coverage (owner-local)", () => {
  // describe.skipIf 仍會執行 describe 本體收集測試，所以讀檔放在 skip 判斷之後
  const dir = registryDir ?? "";
  const registered = new Map<string, string[]>(); // layer key -> 登記檔名
  const noUpstream: string[] = [];
  const files: { name: string; text: string }[] = [];
  if (registryDir) {
    for (const name of readdirSync(dir).sort()) {
      if (name.endsWith(".yaml")) files.push({ name, text: readFileSync(join(dir, name), "utf-8") });
      if (!name.endsWith(".yaml") || name.startsWith("_") || DERIVED_FILES.has(name)) continue;
      for (const key of parsePulseLayers(readFileSync(join(dir, name), "utf-8"))) {
        registered.set(key, [...(registered.get(key) ?? []), name]);
      }
    }
    const noUpstreamPath = join(dir, NO_UPSTREAM_FILE);
    // 用保留重複的原始清單，下方 dup 檢查才有意義（review F072）
    if (existsSync(noUpstreamPath)) noUpstream.push(...parseLayerListKeys(readFileSync(noUpstreamPath, "utf-8")));
  }
  const manifestKeys = Object.keys(LAYER_MANIFEST);
  const manifestSet = new Set(manifestKeys);

  it("parses a non-trivial registry (guards against a silently broken parser)", () => {
    expect(registered.size).toBeGreaterThan(manifestKeys.length / 2);
  });

  it("every LAYER_MANIFEST key is registered or listed in _no_upstream.yaml", () => {
    const covered = new Set([...registered.keys(), ...noUpstream]);
    const missing = manifestKeys.filter((k) => !covered.has(k));
    expect(
      missing,
      `${missing.length} 個圖層沒有對到 pulse-data 登記：到 pulse-data registry 的對應條目 consumers.pulse_layers 登記，` +
        `或（真的沒有上游時）加進 registry/_no_upstream.yaml：${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("registry and _no_upstream.yaml reference no layer key missing from LAYER_MANIFEST", () => {
    const stale = [
      ...[...registered.entries()].filter(([k]) => !manifestSet.has(k)).map(([k, files]) => `${k}（${files.join("、")}）`),
      ...noUpstream.filter((k) => !manifestSet.has(k)).map((k) => `${k}（${NO_UPSTREAM_FILE}）`),
    ];
    expect(stale, `pulse-data 登記了網站已不存在的圖層，請改名或移除（並同步匯入腳本 EXCLUDED_LAYERS）：${stale.join(", ")}`).toEqual([]);
  });

  it("no layer is both registered and listed as no-upstream; _no_upstream.yaml has no duplicates", () => {
    const both = noUpstream.filter((k) => registered.has(k));
    const dup = noUpstream.filter((k, i) => noUpstream.indexOf(k) !== i);
    expect({ both, dup }).toEqual({ both: [], dup: [] });
  });

  it("AG-13: every layer is in the warehouse, exempt, DISPLAY_ONLY (with unlock) or in the shrink-only baseline", () => {
    const index = indexRegistry(files);
    const layers = Object.values(LAYER_MANIFEST).map((entry) => ({
      key: entry.key,
      datasets: (entry.upstream?.datasets ?? []).map((d) => d.datasetId),
    }));
    const gate = checkWarehouseGate(layers, index);
    expect(
      gate.violations,
      `${gate.violations.length} 個圖層沒入倉、也沒標 DISPLAY_ONLY：先在 pulse-data 登記並發包入倉（warehouse 區塊），` +
        `真的只做展示才加進 registry/${DISPLAY_ONLY_FILE}（reason＋unlock）；${BASELINE_FILE} 只減不增，不可加新層：${gate.violations.join(", ")}`,
    ).toEqual([]);
    expect(gate.incompleteDisplayOnly, `${DISPLAY_ONLY_FILE} 每層都要寫 reason 與 unlock（解鎖條件）`).toEqual([]);
    expect(
      gate.staleBaseline,
      `${BASELINE_FILE} 只減不增：這些層已入倉、已豁免或已不在 manifest，請刪掉該行：${gate.staleBaseline.join(", ")}`,
    ).toEqual([]);
  });
});
