import { beforeAll, describe, expect, it } from "vitest";
import { localeStore } from "../../state/localeStore";
import { localizeLoadingLabel, layerKeyForLoadingTask } from "../loadingLabel";
import { statusText } from "../../components/LoadingStatus";
import type { Locale } from "../../i18n/locales";

async function ctx(locale: Locale) {
  await localeStore.ready(locale);
  localeStore.set(locale);
  await localeStore.ready(locale);
  return localeStore.getSnapshot();
}

describe("localizeLoadingLabel", () => {
  beforeAll(async () => { await localeStore.ready("en"); await localeStore.ready("ja"); });

  it("同一筆載入在三種語系各顯示什麼（圖層 id 對得到）", async () => {
    const id = "caDams:render";
    const label = "加拿大水壩載入中";
    expect(layerKeyForLoadingTask(id)).toBe("caDams");
    expect(localizeLoadingLabel(id, label, await ctx("zh-TW"))).toBe(label);
    expect(localizeLoadingLabel(id, label, await ctx("en"))).toBe("Dams (BC, ON) (Canada)");
    expect(localizeLoadingLabel(id, label, await ctx("ja"))).toBe("ダム（BC・ON）（カナダ）");
  });

  it("動態的年份、日期保留", async () => {
    const en = await ctx("en");
    expect(localizeLoadingLabel("caDams:2024", "加拿大水壩 2024", en)).toBe("Dams (BC, ON) (Canada) 2024");
    expect(localizeLoadingLabel("disaster-alerts:2026-04-08", "災害示警 2026-04-08", en)).toMatch(/2026-04-08$/);
  });

  it("對不到圖層：取拉丁字，再不行用通用字", async () => {
    const en = await ctx("en");
    expect(localizeLoadingLabel("zz-unknown-a", "LASS 渲染中", en)).toBe("LASS");
    expect(localizeLoadingLabel("zz-unknown-b", "某某資料載入中", en)).toBe("Data");
    expect(localizeLoadingLabel("zz-unknown-c", "某某資料 2025", en)).toBe("Data 2025");
    expect(localizeLoadingLabel("zz-unknown-b", "某某資料載入中", await ctx("ja"))).toBe("データ");
  });

  it("非圖層任務依 id 形狀給通用名稱", async () => {
    const en = await ctx("en");
    expect(localizeLoadingLabel("research:cycling-routes", "讀取自行車道路線", en)).toBe("Analysis data");
    expect(localizeLoadingLabel("zz:private-access", "驗證某某私人圖層存取權", en)).toBe("Checking layer access");
    expect(localizeLoadingLabel("analysis-card-publish", "發布分析卡", await ctx("ja"))).toBe("分析カード");
  });

  it("本來就沒有中文的名稱原樣顯示", async () => {
    expect(localizeLoadingLabel("x", "Bus routes", await ctx("en"))).toBe("Bus routes");
  });

  it("狀態列整句在英日文都不含中文原文", async () => {
    for (const locale of ["en", "ja"] as const) {
      const label = localizeLoadingLabel("caDams:render", "加拿大水壩載入中", await ctx(locale));
      const text = statusText({ visible: true, phase: "done", label, extra: 0, count: 1 });
      expect(text.main).not.toContain("加拿大");
      expect(text.main).not.toContain("載入");
    }
    await ctx("en");
    expect(statusText({ visible: true, phase: "done", label: "Dams", extra: 0, count: 1 }).main).toBe("Loaded · Dams");
  });
});
