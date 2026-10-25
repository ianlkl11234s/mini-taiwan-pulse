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
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { LAYER_MANIFEST } from "../layerManifest";
import { OWNER_TESTS } from "../../test/ownerAssets";

const NO_UPSTREAM_FILE = "_no_upstream.yaml";
/** 衍生檔（由登記簿產生），不算登記 */
const DERIVED_FILES = new Set(["watchlist.yaml"]);

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

const unquote = (s: string) => s.trim().replace(/^['"]|['"]$/g, "");

/** 一個 YAML 檔裡所有 pulse_layers 清單的圖層 key */
function parsePulseLayers(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/^[ \t]+pulse_layers:[ \t]*\[([^\]]*)\]/gm)) {
    out.push(...(m[1] ?? "").split(",").map(unquote).filter(Boolean));
  }
  for (const m of text.matchAll(/^([ \t]+)pulse_layers:[ \t]*(?:#.*)?\n((?:\1[ \t]*- .*(?:\n|$))+)/gm)) {
    for (const line of (m[2] ?? "").split("\n")) {
      const item = line.match(/^[ \t]*- (.+?)\s*(?:#.*)?$/);
      if (item?.[1]) out.push(unquote(item[1]));
    }
  }
  return out;
}

function parseNoUpstream(text: string): string[] {
  return [...text.matchAll(/^[ \t]*-[ \t]+layer:[ \t]*(\S+)/gm)].map((m) => unquote(m[1] ?? ""));
}

const registryDir = resolveRegistryDir();

describe.skipIf(!registryDir)("layerManifest ↔ pulse-data registry coverage (owner-local)", () => {
  // describe.skipIf 仍會執行 describe 本體收集測試，所以讀檔放在 skip 判斷之後
  const dir = registryDir ?? "";
  const registered = new Map<string, string[]>(); // layer key -> 登記檔名
  const noUpstream: string[] = [];
  if (registryDir) {
    for (const name of readdirSync(dir).sort()) {
      if (!name.endsWith(".yaml") || name === NO_UPSTREAM_FILE || DERIVED_FILES.has(name)) continue;
      for (const key of parsePulseLayers(readFileSync(join(dir, name), "utf-8"))) {
        registered.set(key, [...(registered.get(key) ?? []), name]);
      }
    }
    const noUpstreamPath = join(dir, NO_UPSTREAM_FILE);
    if (existsSync(noUpstreamPath)) noUpstream.push(...parseNoUpstream(readFileSync(noUpstreamPath, "utf-8")));
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
});
