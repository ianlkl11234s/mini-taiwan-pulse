/**
 * Layer 黃金快照護欄（AR-22 Phase 0）
 * ══════════════════════════════════════════════════════════════════
 *
 * 為什麼要有這支：Layer Manifest 工程要把 14 個接觸點裡的「登記簿類」逐批改成
 * 由單一 manifest 派生。搬移過程中最危險的不是「編不過」（tsc 會擋），而是
 * **編得過但值悄悄變了** —— 少一個 labelMobile、icon 換了一顆、paint 的 dark 分支
 * 走到另一條、GIS_LAYERS 順序被 append 打亂（first-hit-wins 語意直接改變）。
 * 這些全部不會報錯，只會在瀏覽器上「看起來怪怪的」。
 *
 * 本測試把「搬移前」的全部登記資料凍結成 committed fixture，之後每一批搬移都必須
 * 逐位元對得起來 —— **等價證明**。
 *
 * ── fixture 紅了怎麼辦 ────────────────────────────────────────────
 *   1. 先看失敗訊息指的是哪個 section 與哪個字元位置。
 *   2. 若是**非預期**的差異 → 是搬移搬壞了，回去修程式，不要動 fixture。
 *   3. 若是**有意**的變更（真的新增/修改了 layer 登記資料）→
 *        npx vite-node scripts/preprocess/dump-layer-golden.ts
 *      然後 `git diff` 逐行 review 再 commit。無腦重跑 = 把護欄拆掉。
 *
 * ── 護欄的護欄 ────────────────────────────────────────────────────
 *   最後一條 test 是**突變自測**：把抽取結果的記憶體副本改掉一個顏色值，
 *   斷言比對函式真的會回報差異。證明「這個護欄會叫」，而不是一個永遠綠的裝飾。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

import {
  extractGolden, canonicalJson, diffGolden, allLayerKeys, paramsCaseKeys,
  FIXTURE_PATH, SECTION_NAMES,
  type GoldenSnapshot,
} from "./layerGoldenExtract";
import { PENALTY_YEAR_MAX } from "../pollutionTypes";

const REGEN = "npx vite-node scripts/preprocess/dump-layer-golden.ts";

// 抽取一次共用（重跑一次 hook + 求值全 registry 的成本不低）
const actual = extractGolden();
const actualJson = canonicalJson(actual);

const fixtureExists = existsSync(FIXTURE_PATH);
const expected: GoldenSnapshot | null = fixtureExists
  ? (JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as GoldenSnapshot)
  : null;

describe("layer 黃金快照", () => {
  it("fixture 存在（不存在代表護欄根本沒生效）", () => {
    expect(fixtureExists, `找不到 ${FIXTURE_PATH} → 跑 ${REGEN}`).toBe(true);
  });

  // 逐 section 比對 —— 整檔 byte-diff 在 1.3MB 規模下沒法用人眼收斂，
  // 先讓失敗訊息指到「是哪一張登記簿變了」。
  for (const section of SECTION_NAMES) {
    it(`section「${section}」與 fixture 一致`, () => {
      expect(expected, `fixture 缺失 → ${REGEN}`).not.toBeNull();
      const a = (actual as unknown as Record<string, unknown>)[section];
      const b = (expected as unknown as Record<string, unknown>)[section];
      expect(
        a,
        `登記簿「${section}」與黃金快照不一致。\n` +
        `→ 非預期 = 搬移把值改掉了，回去修程式；有意變更 = 跑 ${REGEN} 並逐行 review diff`,
      ).toEqual(b);
    });
  }

  it("整份 canonical JSON 逐位元一致（含 meta / 順序 / 格式）", () => {
    expect(fixtureExists).toBe(true);
    const expectedJson = readFileSync(FIXTURE_PATH, "utf8");
    // 先用 diffGolden 給出人類可讀的定位，再做全字串斷言
    const diffs = diffGolden(actual, expected);
    expect(
      diffs.map((d) => `${d.section}: ${d.reason}`),
      `黃金快照有差異（逐 section 定位如上）→ ${REGEN} 或回去修程式`,
    ).toEqual([]);
    expect(actualJson.length, "canonical JSON 長度不一致（可能是格式/換行漂移）")
      .toBe(expectedJson.length);
    expect(actualJson === expectedJson, "canonical JSON 逐位元不一致").toBe(true);
  });

  it("抽取是決定性的（同一次進程跑兩遍結果相同）", () => {
    // 抓「迭代順序不穩／隨機值／時間相依」——這類 bug 會讓護欄變成每天亂叫的狼來了
    const second = extractGolden();
    expect(diffGolden(second, actual), "兩次抽取結果不同 → 抽取器有非決定性來源")
      .toEqual([]);
  });
});

describe("黃金快照覆蓋度", () => {
  it("涵蓋全部 348 個 layer key", () => {
    const keys = allLayerKeys();
    expect(keys.length).toBe(348);
    expect(Object.keys(actual.colors as object)).toHaveLength(keys.length);
    expect(Object.keys(actual.icons as object)).toHaveLength(keys.length);
    expect(Object.keys(actual.upstream as object)).toHaveLength(keys.length);
    expect(Object.keys(actual.params as object)).toHaveLength(keys.length);
  });

  it("每個 key 都拿得到真實的 icon 名稱（拿不到就是 displayName 機制壞了）", () => {
    const broken = Object.entries(actual.icons as Record<string, string>)
      .filter(([, v]) => !v || v.startsWith("__"))
      .map(([k, v]) => `${k}=${v}`);
    expect(broken, "這些 key 的 lucide icon 讀不到 displayName → 抽取器需改用其他識別方式")
      .toEqual([]);
  });

  it("useLayerParamsRuntime 每個 case key 都真的被抽到控件（證明 getControls 全掃有效）", () => {
    // ExpandableLayerKey 是 type-only、runtime 無法迭代 → 抽取器改對 348 key 全掃。
    // 這兩條雙向斷言證明「全掃」確實等價於「照 case 清單逐一呼叫」。
    const layerKeys = new Set(allLayerKeys() as string[]);
    const { all, emptyByDesign } = paramsCaseKeys();
    const cases = all.filter((k) => layerKeys.has(k));
    const byDesign = new Set(emptyByDesign);
    const controls = actual.params as Record<string, unknown[]>;

    const shouldHave = cases.filter((k) => !byDesign.has(k));
    const missing = shouldHave.filter((k) => !Array.isArray(controls[k]) || controls[k].length === 0);
    expect(
      missing,
      "這些 key 在 useLayerParamsRuntime 有 case 但抽不到控件 → getControls 入口或抽取器對不上",
    ).toEqual([]);

    // 反向：抽到控件的 key 一定在 case 清單裡（防抽取器從別的來源撿到幽靈控件）
    const phantom = Object.entries(controls)
      .filter(([k, v]) => Array.isArray(v) && v.length > 0 && !cases.includes(k))
      .map(([k]) => k);
    expect(phantom, "這些 key 抽到控件但原始碼沒有對應 case → 抽取來源不對").toEqual([]);

    expect(cases.length).toBeGreaterThan(100);
  });

  it("沒有函式殘留在快照裡（有 = 某個函式型欄位漏求值）", () => {
    expect(actualJson.includes("__FN__"), "快照含 __FN__ → 有函式型欄位沒被求值").toBe(false);
    expect(actualJson.includes("__EVAL_ERROR__"), "快照含求值錯誤 → 某層 paint/layout/filter 會 throw").toBe(false);
  });

  it("pollutionPenaltyYear 的今年預設仍被 PENALTY_YEAR_MAX 夾住（防 fixture 跨年爆掉）", () => {
    // useLayerParamsRuntime: useState(min(MAX, max(MIN, new Date().getFullYear())))
    // 只要 MAX ≤ 今年，這個預設值就恆等於 MAX = 決定性。MAX 被調高到未來年份時
    // 這條會先紅，提醒去抽取器補正規化，而不是等 fixture 在跨年那天無預警爆掉。
    expect(
      PENALTY_YEAR_MAX,
      "PENALTY_YEAR_MAX 超過今年 → pollutionPenaltyYear 預設值會隨系統時間漂移，" +
      "請在 layerGoldenExtract 的 sanitize 加正規化",
    ).toBeLessThanOrEqual(new Date().getFullYear());
  });
});

describe("突變自測（護欄的護欄）", () => {
  it("改掉一個顏色值 → 比對函式必須回報 colors section 有差異", () => {
    const mutated = structuredClone(actual) as GoldenSnapshot;
    const colors = mutated.colors as Record<string, string>;
    const victim = allLayerKeys()[0] as string;
    const before = colors[victim];
    colors[victim] = "#000000-MUTATED";
    expect(colors[victim]).not.toBe(before);

    const diffs = diffGolden(mutated, actual);
    expect(
      diffs.map((d) => d.section),
      "改了顏色但比對函式沒回報差異 → 這個護欄是假的（永遠不會叫）",
    ).toEqual(["colors"]);
    // 訊息要真的把改掉的值指出來，否則凌晨三點看到「colors 不一致」等於沒說
    expect(diffs[0]?.reason).toContain("#000000-MUTATED");
  });

  it("刪掉一個 GIS_LAYERS 條目 / 打亂順序 → 都必須被抓到", () => {
    // GIS_LAYERS 是 first-hit-wins，順序改變 = 點擊行為改變，但值的集合沒變
    // → 專門驗一條「集合相同、順序不同」也會紅。
    const dropped = structuredClone(actual) as GoldenSnapshot;
    (dropped.gisLayers as unknown[]).splice(0, 1);
    expect(diffGolden(dropped, actual).map((d) => d.section)).toEqual(["gisLayers"]);

    const reordered = structuredClone(actual) as GoldenSnapshot;
    const arr = reordered.gisLayers as unknown[];
    const head = arr.shift();
    arr.push(head);
    expect(
      diffGolden(reordered, actual).map((d) => d.section),
      "GIS_LAYERS 順序被打亂卻沒紅 → first-hit-wins 語意失去保護",
    ).toEqual(["gisLayers"]);
  });

  it("改掉一個 overlay paint 的 dark 分支 → overlays section 必須紅", () => {
    const mutated = structuredClone(actual) as GoldenSnapshot;
    const overlays = mutated.overlays as { layers: { paint: { dark: unknown } }[] }[];
    const first = overlays[0]?.layers?.[0];
    expect(first, "overlays fixture 形狀變了 → 突變自測需同步更新").toBeTruthy();
    first!.paint.dark = { mutated: true };
    expect(diffGolden(mutated, actual).map((d) => d.section)).toEqual(["overlays"]);
  });
});
