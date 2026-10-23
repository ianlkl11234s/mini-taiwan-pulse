import { describe, expect, it } from "vitest";
import { LOCALE_STORAGE_KEY } from "../../state/localeStore";
import { SUPPORTED_LOCALES } from "../../i18n/locales";
import { PRIVACY_LOCALE_STORAGE_KEY, privacyHref, resolvePrivacyLocale } from "../privacyLocale";
import { PRIVACY_DOCS } from "../privacyContent";

const storage = (value: string | null) => ({ getItem: () => value });

describe("隱私頁語言選擇", () => {
  it("與主站共用同一個語系 localStorage key", () => {
    expect(PRIVACY_LOCALE_STORAGE_KEY).toBe(LOCALE_STORAGE_KEY);
  });

  it("?lang= ＞ localStorage ＞ 中文", () => {
    expect(resolvePrivacyLocale("?lang=ja", storage("en"))).toBe("ja");
    expect(resolvePrivacyLocale("?lang=en-GB", null)).toBe("en");
    expect(resolvePrivacyLocale("", storage("en"))).toBe("en");
    expect(resolvePrivacyLocale("?lang=fr", storage("ja"))).toBe("ja");
    expect(resolvePrivacyLocale("", storage("fr"))).toBe("zh-TW");
    expect(resolvePrivacyLocale("", null)).toBe("zh-TW");
  });

  it("storage 丟錯時退回中文", () => {
    expect(resolvePrivacyLocale("", { getItem: () => { throw new Error("blocked"); } })).toBe("zh-TW");
  });

  it("主站連結：中文不帶參數，其他語系帶 ?lang=", () => {
    expect(privacyHref("zh-TW")).toBe("/privacy");
    expect(privacyHref("en")).toBe("/privacy?lang=en");
    expect(privacyHref("ja")).toBe("/privacy?lang=ja");
  });
});

describe("隱私頁內文", () => {
  const zh = PRIVACY_DOCS["zh-TW"];
  it("三語段落一致（同樣的段落、同樣的清單長度）", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const doc = PRIVACY_DOCS[locale];
      expect(doc.sections.map((s) => s.id), locale).toEqual(zh.sections.map((s) => s.id));
      doc.sections.forEach((section, i) => {
        const base = zh.sections[i]!;
        expect(section.paragraphs.length, `${locale}/${section.id}`).toBe(base.paragraphs.length);
        expect(section.items?.length ?? 0, `${locale}/${section.id}`).toBe(base.items?.length ?? 0);
        expect(section.notes?.length ?? 0, `${locale}/${section.id}`).toBe(base.notes?.length ?? 0);
        for (const text of [...section.paragraphs, ...(section.items ?? []), ...(section.notes ?? [])]) expect(text.trim()).not.toBe("");
      });
    }
  });

  it("涵蓋必要段落", () => {
    expect(zh.sections.map((s) => s.id)).toEqual(["about", "sign-in", "member-data", "usage", "ai", "third-parties", "storage", "delete", "contact"]);
  });
});
