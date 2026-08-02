/**
 * 點擊接線 ratchet —— `useMapInteraction` 的 GIS_LAYERS 引用的每個 Mapbox layer id
 * 都必須真的存在。
 *
 * 為什麼要有這支：layer id 是**手寫字串**（`"mountain-huts-circle"`），拼錯的話
 * `queryRenderedFeatures` 只會回空陣列 —— **popup 靜默失效，不報錯、不當機**，
 * 要在瀏覽器上點半天才會發現「怎麼點不出來」。tsc 也擋不住（就是個 string）。
 *
 * 判準（兩者其一即通過）：
 *   1. 由 OVERLAY_REGISTRY 算得出來（`${sourceId}-${suffix}`）—— 涵蓋工廠產生的層
 *      （sports / livestock / religion…），因為 registry 在 import 時就已展開。
 *   2. 該字面字串在 src/ 其他檔案出現過（hook / CustomLayer 自建的層，如
 *      `eq-replay-station-circle`、`road-congestion-hit`）。
 *
 * 兩條都不中 = 這個 id 只存在於 useMapInteraction 自己 → 幾乎必然是拼錯或殘留。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";

const INTERACTION_FILE = "src/hooks/useMapInteraction.ts";
const source = readFileSync(INTERACTION_FILE, "utf8");

/** GIS_LAYERS 陣列裡每個 `layers: [...]` 的字串字面 */
function referencedLayerIds(): string[] {
  const ids = new Set<string>();
  for (const block of source.matchAll(/layers:\s*\[([^\]]*)\]/gs)) {
    for (const s of (block[1] ?? "").matchAll(/"([^"]+)"/g)) ids.add(s[1] as string);
  }
  return [...ids];
}

/** registry 能組出來的所有 layer id（含工廠展開後的） */
function registryLayerIds(): Set<string> {
  const out = new Set<string>();
  for (const config of OVERLAY_REGISTRY) {
    for (const spec of config.layers) out.add(`${config.sourceId}-${spec.suffix}`);
  }
  return out;
}

/** 遞迴收集 src/ 下所有 ts/tsx 原始碼（排除 useMapInteraction 自己與測試檔） */
function otherSources(dir = "src"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__") continue;
      out.push(...otherSources(full));
    } else if (/\.tsx?$/.test(entry) && full !== INTERACTION_FILE) {
      out.push(readFileSync(full, "utf8"));
    }
  }
  return out;
}

describe("useMapInteraction 點擊層 id", () => {
  it("引用的每個 layer id 都真的被建立（否則 popup 靜默失效）", () => {
    const fromRegistry = registryLayerIds();
    const others = otherSources().join("\n");
    const orphans = referencedLayerIds().filter(
      (id) => !fromRegistry.has(id) && !others.includes(`"${id}"`) && !others.includes(`\`${id}\``),
    );
    expect(
      orphans,
      `這些 layer id 只出現在 ${INTERACTION_FILE}，沒有任何地方建立它們 —— ` +
      `點擊會靜默無反應：\n  ${orphans.join("\n  ")}\n` +
      `→ 對照 overlayRegistry 的 sourceId + suffix，或該層所屬的 hook/CustomLayer`,
    ).toEqual([]);
  });

  it("registry 的 id 命名規則沒有漂移（sourceId-suffix）", () => {
    // 若哪天 overlayManager 改了 layerId() 的組法，本測試的判準 1 會整批失效
    // （變成全靠判準 2 的字串搜尋兜底，保護力大幅下降）→ 固定住這個契約。
    const managerSource = readFileSync("src/map/overlayManager.ts", "utf8");
    expect(
      managerSource,
      "overlayManager.layerId() 的組法變了 → 請同步更新 mapInteractionLayers 測試的判準 1",
    ).toContain("`${config.sourceId}-${suffix}`");
  });
});
