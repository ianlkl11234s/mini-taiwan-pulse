/**
 * Layer 黃金快照護欄（AR-22 Phase 0，Phase 4 縮編）
 * ══════════════════════════════════════════════════════════════════
 *
 * 為什麼要有這支：Layer Manifest 工程要把 14 個接觸點裡的「登記簿類」逐批改成
 * 由單一 manifest 派生。搬移過程中最危險的不是「編不過」（tsc 會擋），而是
 * **編得過但值悄悄變了** —— 少一個 labelMobile、icon 換了一顆、paint 的 dark 分支
 * 走到另一條、GIS_LAYERS 順序被 append 打亂（first-hit-wins 語意直接改變）。
 * 這些全部不會報錯，只會在瀏覽器上「看起來怪怪的」。
 *
 * ── ⚠️ Phase 4 縮編：12 section → 3（`FIXTURE_SECTIONS`）────────────
 *   搬移收官後，12 個 section 裡有 9 個已被 `layerManifest.test.ts` 逐 key
 *   **雙向**焊死（manifest 宣告 ⇔ 下游登記簿實際值）。同一件事凍兩份的後果是
 *   **每加一層就要重跑 REGEN 改一份 1.35MB 的 fixture，而那份 diff 沒有保護價值**
 *   —— 純 churn 訓練出「無腦重跑」的習慣，那正是本檔開頭警告的拆護欄行為。
 *
 *   留下的 3 個是「沒有別的護欄在守、而且由共用機制 fan-out」的：
 *   `overlays`（factory 改 5 行可靜默改掉 28 層 paint）／
 *   `params`（改一個 spec builder 可靜默改掉 336 層控件的 default）／
 *   `gisLayers`（跨 key 的 first-hit-wins 全域順序）。判準完整版見
 *   `layerGoldenExtract.ts` 的 `FIXTURE_SECTIONS` 註解。
 *
 *   ⚠️ 抽取器**沒有**跟著縮：`layerManifest.test.ts` 仍吃全 12 section，
 *   下方的覆蓋度與決定性測試也仍看全貌。縮的只有「凍進 repo 的那份」。
 *
 * ── fixture 紅了怎麼辦 ────────────────────────────────────────────
 *   1. 先看失敗訊息指的是哪個 section 與哪個字元位置。
 *   2. 若是**非預期**的差異 → 是搬移／重構把值改壞了，回去修程式，不要動 fixture。
 *   3. 若是**有意**的變更（真的新增/修改了 layer 的 paint / 控件 / 點擊順序）→
 *        npx vite-node scripts/preprocess/dump-layer-golden.ts
 *      然後 `git diff` 逐行 review 再 commit。無腦重跑 = 把護欄拆掉。
 *
 * ── 護欄的護欄 ────────────────────────────────────────────────────
 *   最後三條 test 是**突變自測**：把抽取結果的記憶體副本改掉一個值，
 *   斷言比對函式真的會回報差異。證明「這個護欄會叫」，而不是一個永遠綠的裝飾。
 *   ⚠️ 三條都只打**留在 fixture 裡的 section** —— 拿一個已經不受保護的 section
 *   去證明「護欄會叫」，證出來的是假的。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

import {
  extractGolden, canonicalJson, diffGolden, allLayerKeys,
  pickFixture, FIXTURE_PATH, FIXTURE_SECTIONS, SECTION_NAMES,
} from "./layerGoldenExtract";
import { MIGRATED_PARAMS_KEYS } from "../layerParamsSpec";
import { PENALTY_YEAR_MAX } from "../pollutionTypes";

const REGEN = "npx vite-node scripts/preprocess/dump-layer-golden.ts";

// 抽取一次共用（重跑一次 hook + 求值全 registry 的成本不低）
const full = extractGolden();
const actual = pickFixture(full);
const actualJson = canonicalJson(actual);

const fixtureExists = existsSync(FIXTURE_PATH);
const expected: Record<string, unknown> | null = fixtureExists
  ? (JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Record<string, unknown>)
  : null;

describe("layer 黃金快照", () => {
  it("fixture 存在（不存在代表護欄根本沒生效）", () => {
    expect(fixtureExists, `找不到 ${FIXTURE_PATH} → 跑 ${REGEN}`).toBe(true);
  });

  it("fixture 自我描述的 section 清單與 FIXTURE_SECTIONS 一致", () => {
    // 防「縮編後有人手改 fixture 或跑了舊版 dump 腳本」——
    // 少一個 section 的 fixture 會讓下方逐 section 比對整段靜默略過。
    const meta = expected?.meta as { sections?: string[] } | undefined;
    expect(meta?.sections, `fixture 的 meta.sections 與程式碼不符 → ${REGEN}`)
      .toEqual(FIXTURE_SECTIONS);
  });

  // 逐 section 比對 —— 整檔 byte-diff 在數十萬字元規模下沒法用人眼收斂，
  // 先讓失敗訊息指到「是哪一張登記簿變了」。
  for (const section of FIXTURE_SECTIONS) {
    it(`section「${section}」與 fixture 一致`, () => {
      expect(expected, `fixture 缺失 → ${REGEN}`).not.toBeNull();
      expect(
        actual[section],
        `登記簿「${section}」與黃金快照不一致。\n` +
        `→ 非預期 = 重構把值改掉了，回去修程式；有意變更 = 跑 ${REGEN} 並逐行 review diff`,
      ).toEqual(expected![section]);
    });
  }

  it("整份 canonical JSON 逐位元一致（含 meta / 順序 / 格式）", () => {
    expect(fixtureExists).toBe(true);
    const expectedJson = readFileSync(FIXTURE_PATH, "utf8");
    // 先用 diffGolden 給出人類可讀的定位，再做全字串斷言
    const diffs = diffGolden(actual, expected, FIXTURE_SECTIONS);
    expect(
      diffs.map((d) => `${d.section}: ${d.reason}`),
      `黃金快照有差異（逐 section 定位如上）→ ${REGEN} 或回去修程式`,
    ).toEqual([]);
    expect(actualJson.length, "canonical JSON 長度不一致（可能是格式/換行漂移）")
      .toBe(expectedJson.length);
    expect(actualJson === expectedJson, "canonical JSON 逐位元不一致").toBe(true);
  });

  it("抽取是決定性的（同一次進程跑兩遍結果相同）", () => {
    // 抓「迭代順序不穩／隨機值／時間相依」——這類 bug 會讓護欄變成每天亂叫的狼來了。
    // ⚠️ 比的是**全 12 section**（不只入檔的 3 個）：`layerManifest.test.ts` 吃的是
    //    全份抽取，非決定性出現在任何一個 section 都會讓契約測試變成擲骰子。
    const second = extractGolden();
    expect(diffGolden(second, full, SECTION_NAMES), "兩次抽取結果不同 → 抽取器有非決定性來源")
      .toEqual([]);
  });
});

describe("黃金快照覆蓋度", () => {
  it("涵蓋全部 387 個 layer key", () => {
    const keys = allLayerKeys();
    // 2026-08-12：+1 = vesselWatch（特殊船舶）。這個數字是 ratchet，加層時一起加。
    // 2026-08-13：+1 = maritimeBoundary（領海界線）。
    // 2026-08-18：+3 = companyPoints / companyCapitalGrid / manufacturingCompanyPoints。
    // 2026-08-18：+3 = factoryLocations / industrialParkBoundaries / regulatedFacilities。
    // 2026-08-18：+1 = industrialParkComparison。
    // 2026-08-18：+1 = internetExchangePoints（全球 IXP 點位）；+1 ANFR；+1 OSM 通訊候選點；+1 RIPE Atlas 量測節點；+2 Ookla 效能格網。
    // 2026-08-19：+1 = animalAdoption（每日待認養收容所摘要）；+1 = animalShelterPressure（官方月報縣市壓力）。
    // 2026-08-20：+1 = animalWelfarePoints（7 類動物福利服務據點）。
    // 2026-08-23：+1 = isobath（海底等深線 GEBCO 2025，等深線 11 級 + 深度分帶 12 級）。
    // 2026-08-24：+3 = jpReligionGsi / jpReligionOsm / jpReligionWikidata（日本宗教設施三獨立源）。
    // 2026-08-24：+2 = aisstreamVessels / gfwVesselPresence（全球海事兩個獨立來源）。
    // 2026-08-25：+1 = gfwHourlyGrid（GFW HOURLY/HIGH 時間軸格網）。
    // 2026-08-25：+1 = gfwHourlyTracks（GFW 抽樣近似航跡時間軸拖尾）。
    // 2026-08-25：+1 = gfwDarkVessels（GFW SAR 未與 AIS 匹配偵測）。
    // 2026-08-26：+2 = ooklaMobileTaiwan / ooklaFixedTaiwan（台灣 z14/z16 PMTiles）。
    // 2026-08-27：+2 = marineObservationCwa / marineObservationIsohe（固定站觀測分源）。
    expect(keys.length).toBe(389);
    expect(Object.keys(full.colors as object)).toHaveLength(keys.length);
    expect(Object.keys(full.icons as object)).toHaveLength(keys.length);
    expect(Object.keys(full.upstream as object)).toHaveLength(keys.length);
    expect(Object.keys(full.params as object)).toHaveLength(keys.length);
  });

  it("每個 key 都拿得到真實的 icon 名稱（拿不到就是 displayName 機制壞了）", () => {
    const broken = Object.entries(full.icons as Record<string, string>)
      .filter(([, v]) => !v || v.startsWith("__"))
      .map(([k, v]) => `${k}=${v}`);
    expect(broken, "這些 key 的 lucide icon 讀不到 displayName → 抽取器需改用其他識別方式")
      .toEqual([]);
  });

  it("抽到控件的 key 集合 ＝ LAYER_PARAMS_SPEC 的 key 集合（證明 getControls 全掃有效）", () => {
    // ExpandableLayerKey 是 type-only、runtime 無法迭代 → 抽取器改對 348 key 全掃。
    // 本條雙向斷言證明「全掃」確實等價於「照規格清單逐一呼叫」。
    //
    // ⚠️ Phase 4 前這裡比的是 `paramsCaseKeys()`（掃 hook 原始碼的 `case "key"` 字面
    //    ＋ `emptyByDesign` 的 `return []` 字面）。那個判準寄生在字面上，
    //    連註解都會被掃到（P3-3 憑空生出幽靈 key）。現在兩邊都是 runtime 真值：
    //      左＝實跑 hook 抽到的控件、右＝`LAYER_PARAMS_SPEC` 的 key。
    //    「有意沒有控件」的表達搬到 manifest 的 `params: null`
    //    （見 layerConsistency.test.ts 的 NO_PARAMS_LEDGER）。
    const layerKeys = new Set(allLayerKeys() as string[]);
    const controls = full.params as Record<string, unknown[]>;

    const withControls = Object.keys(controls)
      .filter((k) => Array.isArray(controls[k]) && controls[k]!.length > 0)
      .sort();
    const declared = ([...MIGRATED_PARAMS_KEYS] as string[])
      .filter((k) => layerKeys.has(k)).sort();

    const missing = declared.filter((k) => !withControls.includes(k));
    expect(
      missing,
      "這些 key 在 LAYER_PARAMS_SPEC 有規格但抽不到控件 → getControls 入口或 buildParamControls 對不上",
    ).toEqual([]);

    // 反向：抽到控件的 key 一定在規格裡（防抽取器從別的來源撿到幽靈控件）
    const phantom = withControls.filter((k) => !declared.includes(k));
    expect(phantom, "這些 key 抽到控件但 LAYER_PARAMS_SPEC 沒有宣告 → 抽取來源不對").toEqual([]);

    expect(declared.length).toBeGreaterThan(100);
  });

  it("沒有函式殘留在快照裡（有 = 某個函式型欄位漏求值）", () => {
    // ⚠️ 掃**全份**（不只入檔的 3 個 section）—— 漏求值的欄位若落在
    //    已移出 fixture 的 section，`layerManifest.test.ts` 會拿到一個字串 marker 去對帳。
    const fullJson = canonicalJson(full);
    expect(fullJson.includes("__FN__"), "快照含 __FN__ → 有函式型欄位沒被求值").toBe(false);
    expect(fullJson.includes("__EVAL_ERROR__"), "快照含求值錯誤 → 某層 paint/layout/filter 會 throw").toBe(false);
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
  it("改掉一個控件的 default → 比對函式必須回報 params section 有差異", () => {
    // Phase 4 前這條打的是 colors；colors 已移出 fixture（由 layerManifest.test.ts
    // 逐 key 焊死），改打 params —— 它正是「改一個 spec builder 靜默改掉 336 層」的那條路。
    const mutated = structuredClone(actual) as Record<string, unknown>;
    const params = mutated.params as Record<string, { value?: unknown }[]>;
    const victim = Object.keys(params).find((k) => (params[k]?.length ?? 0) > 0);
    expect(victim, "params fixture 形狀變了 → 突變自測需同步更新").toBeTruthy();
    params[victim!]![0]!.value = "__MUTATED__";

    const diffs = diffGolden(mutated, actual, FIXTURE_SECTIONS);
    expect(
      diffs.map((d) => d.section),
      "改了控件值但比對函式沒回報差異 → 這個護欄是假的（永遠不會叫）",
    ).toEqual(["params"]);
    // 訊息要真的把改掉的值指出來，否則凌晨三點看到「params 不一致」等於沒說
    expect(diffs[0]?.reason).toContain("__MUTATED__");
  });

  it("刪掉一個 GIS_LAYERS 條目 / 打亂順序 → 都必須被抓到", () => {
    // GIS_LAYERS 是 first-hit-wins，順序改變 = 點擊行為改變，但值的集合沒變
    // → 專門驗一條「集合相同、順序不同」也會紅。
    const dropped = structuredClone(actual) as Record<string, unknown>;
    (dropped.gisLayers as unknown[]).splice(0, 1);
    expect(diffGolden(dropped, actual, FIXTURE_SECTIONS).map((d) => d.section)).toEqual(["gisLayers"]);

    const reordered = structuredClone(actual) as Record<string, unknown>;
    const arr = reordered.gisLayers as unknown[];
    const head = arr.shift();
    arr.push(head);
    expect(
      diffGolden(reordered, actual, FIXTURE_SECTIONS).map((d) => d.section),
      "GIS_LAYERS 順序被打亂卻沒紅 → first-hit-wins 語意失去保護",
    ).toEqual(["gisLayers"]);
  });

  it("改掉一個 overlay paint 的 dark 分支 → overlays section 必須紅", () => {
    const mutated = structuredClone(actual) as Record<string, unknown>;
    const overlays = mutated.overlays as { layers: { paint: { dark: unknown } }[] }[];
    const first = overlays[0]?.layers?.[0];
    expect(first, "overlays fixture 形狀變了 → 突變自測需同步更新").toBeTruthy();
    first!.paint.dark = { mutated: true };
    expect(diffGolden(mutated, actual, FIXTURE_SECTIONS).map((d) => d.section)).toEqual(["overlays"]);
  });
});
