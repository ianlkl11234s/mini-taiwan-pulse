import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GB_STATISTICS_TAB_THEMES,
  STATISTICS_DATA_THEMES,
  STATISTICS_TAB_THEMES,
  THEMES,
  type ThemeDef,
} from "../../components/sidebar/layerCatalog";

const LOCALES_DIR = join(__dirname, "..", "locales");
const readThemes = (locale: string): Record<string, string> =>
  JSON.parse(readFileSync(join(LOCALES_DIR, locale, "themes.json"), "utf8"));

/** 圖層入口、資料來源總覽、統計入口會顯示的所有主題與群組名 */
function allSectionTitles(): string[] {
  const titles = new Set<string>();
  const themes: ThemeDef[] = [...THEMES, ...STATISTICS_DATA_THEMES, ...STATISTICS_TAB_THEMES, ...GB_STATISTICS_TAB_THEMES];
  for (const theme of themes) {
    titles.add(theme.title);
    for (const group of theme.groups ?? []) titles.add(group.title);
  }
  return [...titles].sort();
}

describe("主題與群組名的 en／ja 翻譯涵蓋", () => {
  const en = readThemes("en");
  const ja = readThemes("ja");

  it("英文：有 theme.<名稱> 翻譯，或名稱本身是「中文 English」格式（取後半）", () => {
    const missing = allSectionTitles().filter(
      (title) => !en[`theme.${title}`] && !/^[^\sA-Za-z]+\s+[A-Za-z]/.test(title),
    );
    expect(missing, "en/themes.json 缺這些主題或群組名（新增主題或群組後請補 theme.<名稱>）").toEqual([]);
  });

  it("日文：每個主題與群組名都要有 theme.<名稱> 翻譯", () => {
    const missing = allSectionTitles().filter((title) => !ja[`theme.${title}`]);
    expect(missing, "ja/themes.json 缺這些主題或群組名（缺譯時日文介面會顯示英文副標或中文）").toEqual([]);
  });
});
