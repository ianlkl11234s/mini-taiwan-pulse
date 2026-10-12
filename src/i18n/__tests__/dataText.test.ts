import { describe, expect, it } from "vitest";
import { enumLabel, localizedField } from "../dataText";
import type { Locale } from "../locales";

const ctx = (active: Locale, dict: Record<string, string> = {}) => ({ active, lookup: (key: string) => dict[key] ?? null });

describe("localizedField", () => {
  const fields = { zh: "name", en: "name_en" };
  it("有外文欄位就用，沒有回退中文並標記", () => {
    expect(localizedField({ name: "山竹", name_en: "Mangkhut" }, fields, ctx("en"))).toEqual({ text: "Mangkhut", isFallback: false });
    expect(localizedField({ name: "山竹", name_en: " " }, fields, ctx("en"))).toEqual({ text: "山竹", isFallback: true });
    expect(localizedField({ name: "山竹" }, fields, ctx("ja"))).toEqual({ text: "山竹", isFallback: true });
    expect(localizedField({ name: "山竹", name_en: "Mangkhut" }, fields, ctx("zh-TW"))).toEqual({ text: "山竹", isFallback: false });
  });
  it("缺資料回 null，不變成空字串", () => {
    expect(localizedField({ name: null }, fields, ctx("en"))).toBeNull();
  });
});

describe("enumLabel", () => {
  it("中文介面用原對照表；外文查 enum.<domain>.<code>，沒有回退中文", () => {
    expect(enumLabel("news", "disaster", "災害", ctx("zh-TW", { "enum.news.disaster": "Disaster" }))).toBe("災害");
    expect(enumLabel("news", "disaster", "災害", ctx("en", { "enum.news.disaster": "Disaster" }))).toBe("Disaster");
    expect(enumLabel("news", "other", "其他", ctx("en"))).toBe("其他");
  });
});
