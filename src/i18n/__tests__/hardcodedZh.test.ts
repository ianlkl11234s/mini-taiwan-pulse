import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { I18N_AREAS, countZhLines, scanHardcodedZh } from "./hardcodedZhScan";

const root = join(__dirname, "..", "..", "..");
const baseline: Record<string, number> = JSON.parse(readFileSync(join(__dirname, "hardcodedZh.baseline.json"), "utf8"));

describe("寫死中文防倒退（i18n ROADMAP）", () => {
  const now = scanHardcodedZh(root);
  for (const area of I18N_AREAS) {
    it(`${area.phase} ${area.label}：不得比基準多`, () => {
      // 紅燈：新程式碼請用 t("key")，中文放 src/i18n/locales/zh-TW/*.json；不要調高基準
      expect(now[area.id] ?? 0).toBeLessThanOrEqual(baseline[area.id] ?? 0);
    });
  }

  it("計數口徑：註解不算", () => {
    expect(countZhLines(`// 中文註解\nconst a = 1; /* 區塊\n註解 */\nconst b = "中文";`)).toBe(1);
    expect(countZhLines(`const url = "https://x.tw/路徑";`)).toBe(1);
  });
});
