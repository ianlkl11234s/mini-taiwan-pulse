import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, matchLocale } from "../locales";
import { translate } from "../translate";
import { localizeLayerName, localizeSectionTitle } from "../layerText";

const LOCALES_DIR = join(__dirname, "..", "locales");

function readLocaleFile(locale: string, file: string): Record<string, string> {
  try {
    return JSON.parse(readFileSync(join(LOCALES_DIR, locale, file), "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

/** 介面字串檔：每個語系都必須有完全相同的 key（缺字或多字都紅） */
const UI_FILES = readdirSync(join(LOCALES_DIR, DEFAULT_LOCALE)).filter((f) => f.endsWith(".json"));
/** 名稱對照檔：只有非預設語系才有，預設語系的名稱就在 manifest */
const NAME_FILES = ["layers.json", "themes.json", "qualifiers.json"];

describe("locale parity", () => {
  it("每個支援語系都有資料夾", () => {
    const dirs = readdirSync(LOCALES_DIR);
    for (const locale of SUPPORTED_LOCALES) expect(dirs).toContain(locale);
  });

  for (const file of UI_FILES) {
    const base = Object.keys(readLocaleFile(DEFAULT_LOCALE, file)).sort();
    for (const locale of SUPPORTED_LOCALES.filter((l) => l !== DEFAULT_LOCALE)) {
      it(`${locale}/${file} 與 ${DEFAULT_LOCALE} key 一致`, () => {
        expect(Object.keys(readLocaleFile(locale, file)).sort()).toEqual(base);
      });
    }
  }

  it("預設語系不放名稱對照檔（中文名以 manifest 為準）", () => {
    for (const file of NAME_FILES) expect(UI_FILES).not.toContain(file);
  });

  it("layers.json 只能用 manifest 上存在、有名稱的 key", () => {
    const named = new Set(Object.values(LAYER_MANIFEST).filter((e) => e.section).map((e) => `layer.${e.key}`));
    for (const locale of SUPPORTED_LOCALES) {
      const unknown = Object.keys(readLocaleFile(locale, "layers.json")).filter((k) => !named.has(k));
      expect(unknown, `${locale}/layers.json 有不存在的圖層 key`).toEqual([]);
    }
  });

  it("所有字串值非空、插值變數與預設語系一致", () => {
    for (const file of UI_FILES) {
      const base = readLocaleFile(DEFAULT_LOCALE, file);
      for (const locale of SUPPORTED_LOCALES) {
        for (const [key, value] of Object.entries(readLocaleFile(locale, file))) {
          expect(value.trim(), `${locale}/${file} ${key}`).not.toBe("");
          const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
          const baseKey = base[key] ?? base[key.replace(/_(zero|one|two|few|many|other)$/, "")];
          if (baseKey) expect(vars(value), `${locale}/${file} ${key}`).toEqual(vars(baseKey));
        }
      }
    }
  });
});

describe("translate", () => {
  it("回退鏈與複數", () => {
    const en = { "a_one": "{count} layer", "a_other": "{count} layers" };
    const zh = { a: "{count} 個圖層", b: "只有中文" };
    expect(translate([en, zh], "en-US", "a", { count: 1 })).toBe("1 layer");
    expect(translate([en, zh], "en-US", "a", { count: 3 })).toBe("3 layers");
    expect(translate([zh], "zh-TW", "a", { count: 3 })).toBe("3 個圖層");
    expect(translate([en, zh], "en-US", "b")).toBe("只有中文");
    expect(translate([en, zh], "en-US", "missing")).toBe("missing");
  });

  it("matchLocale", () => {
    expect(matchLocale("en-GB")).toBe("en");
    expect(matchLocale("ja-JP")).toBe("ja");
    expect(matchLocale("zh-Hant-TW")).toBe("zh-TW");
    expect(matchLocale("fr")).toBeNull();
  });
});

describe("layer / theme text", () => {
  const t = (dict: Record<string, string>) => (key: string) => dict[key] ?? key;

  it("中文介面原樣顯示；外文介面優先翻譯檔、其次合語系的外文名、最後中文", () => {
    const name = { zh: "公車站", alt: "Bus Stops" };
    expect(localizeLayerName("busStops", name, "zh-TW", t({}))).toEqual({ primary: "公車站", secondary: "Bus Stops", qualifier: undefined });
    expect(localizeLayerName("busStops", name, "en", t({})).primary).toBe("Bus Stops");
    expect(localizeLayerName("busStops", name, "en", t({})).secondary).toBe("公車站");
    expect(localizeLayerName("busStops", name, "ja", t({})).primary).toBe("公車站");
    expect(localizeLayerName("busStops", name, "ja", t({ "layer.busStops": "バス停" })).primary).toBe("バス停");
    expect(localizeLayerName("jpDam", { zh: "水壩", alt: "ダム" }, "ja", t({})).primary).toBe("ダム");
    expect(localizeLayerName("x", { zh: "人口", qualifier: "縣市" }, "en", t({ "qualifier.縣市": "County/city" })).qualifier).toBe("County/city");
    expect(localizeLayerName("x", { zh: "人口", qualifier: "2014" }, "en", t({})).qualifier).toBe("2014");
  });

  it("主題標題：英文介面取「中文 English」後半", () => {
    expect(localizeSectionTitle("交通 Move", "en", t({}))).toBe("Move");
    expect(localizeSectionTitle("交通 Move", "ja", t({ "theme.交通 Move": "交通" }))).toBe("交通");
    expect(localizeSectionTitle("航港獎補助", "en", t({}))).toBe("航港獎補助");
  });
});
