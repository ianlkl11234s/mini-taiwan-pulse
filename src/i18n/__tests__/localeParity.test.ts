import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LAYER_MANIFEST } from "../../data/layerManifest";
import { HEADER_LABELS } from "../../components/featureInfo/registry";
import { DEFAULT_LOCALE, LOCALES, SUPPORTED_LOCALES, matchLocale, type Locale } from "../locales";
import { DYNAMIC_NAMESPACES } from "../keys";
import { renderKeysModule } from "./keysCodegen";
import { translate } from "../translate";
import { localizeLayerName, localizeSectionTitle } from "../layerText";
import { collectParamTexts } from "./paramTexts";

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
const NAME_FILES = ["layers.json", "themes.json", "qualifiers.json", "enums.json", "popupHeaders.json", "params.json"];
/** 名稱對照檔也可依主題拆：enums.<domain>.json（只在外文語系） */
const isNameFile = (file: string) => NAME_FILES.includes(file) || /^enums\.[\w-]+\.json$/.test(file);

describe("locale parity", () => {
  it("每個支援語系都有資料夾", () => {
    const dirs = readdirSync(LOCALES_DIR);
    for (const locale of SUPPORTED_LOCALES) expect(dirs).toContain(locale);
  });

  for (const file of UI_FILES) {
    const base = Object.keys(readLocaleFile(DEFAULT_LOCALE, file)).sort();
    for (const locale of SUPPORTED_LOCALES.filter((l) => l !== DEFAULT_LOCALE)) {
      const keys = Object.keys(readLocaleFile(locale, file));
      it(`${locale}/${file} 沒有預設語系不存在的 key`, () => {
        expect(keys.filter((k) => !base.includes(k)), "多出來的 key（預設語系已刪或打錯）").toEqual([]);
      });
      it(`${locale}/${file} 缺字檢查（${LOCALES[locale].status}）`, () => {
        const missing = base.filter((k) => !keys.includes(k));
        if (LOCALES[locale].status === "complete") expect(missing, "complete 語系不可缺字").toEqual([]);
        else if (missing.length) console.info(`[i18n] ${locale}/${file} 尚缺 ${missing.length}/${base.length} 個 key（partial，走 fallback）`);
      });
    }
  }

  it("檔名即命名空間：common.json 以外，key 必須以「檔名.」開頭", () => {
    for (const file of UI_FILES.filter((f) => f !== "common.json")) {
      const ns = file.replace(/\.json$/, "");
      const bad = Object.keys(readLocaleFile(DEFAULT_LOCALE, file)).filter((k) => !k.startsWith(`${ns}.`));
      expect(bad, `${file} 的 key 要以 ${ns}. 開頭`).toEqual([]);
    }
  });

  it("keys.generated.ts 是最新的（改了 zh-TW JSON 請跑 npx tsx scripts/i18n/gen-keys.ts）", () => {
    const root = join(__dirname, "..", "..", "..");
    expect(readFileSync(join(root, "src/i18n/keys.generated.ts"), "utf8")).toBe(renderKeysModule(root));
  });

  it("沒有沒人用的 key（動態命名空間除外）", () => {
    const sources: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, name.name);
        if (name.isDirectory()) { if (name.name !== "locales") walk(full); }
        // keys.generated.ts 列出所有 key，算進去會讓每個 key 都像「有人用」
        else if (/\.(ts|tsx)$/.test(name.name) && !/\.test\.tsx?$/.test(name.name) && name.name !== "keys.generated.ts") sources.push(readFileSync(full, "utf8"));
      }
    };
    walk(join(__dirname, "..", ".."));
    const code = sources.join("\n");
    // 一次收集程式裡所有引號包住的 key 形字串（逐 key 全文搜尋在 key 數上千後會超過 5 秒）
    const quoted = new Set<string>();
    for (const m of code.matchAll(/["'`]([A-Za-z0-9_.-]+)["'`]/g)) quoted.add(m[1]!);
    const fieldRefs = new Set<string>();
    for (const m of code.matchAll(/field="([A-Za-z0-9_]+)"/g)) fieldRefs.add(m[1]!);
    const dynamic = DYNAMIC_NAMESPACES.map((ns) => `${ns}.`);
    const unused = new Set<string>();
    for (const file of UI_FILES) {
      for (const key of Object.keys(readLocaleFile(DEFAULT_LOCALE, file))) {
        const base = key.replace(/_(zero|one|two|few|many|other)$/, "");
        if (dynamic.some((p) => base.startsWith(p))) continue;
        // popup.field.* 由 <Row field="x"> 間接使用（shared.tsx 的 Row 自己翻譯）
        const fieldRef = base.startsWith("popup.field.") && fieldRefs.has(base.slice("popup.field.".length));
        if (!fieldRef && !quoted.has(base)) unused.add(base);
      }
    }
    expect([...unused], "程式裡找不到的 key：刪掉，或改用動態命名空間").toEqual([]);
  });

  it("預設語系不放名稱對照檔（中文名以 manifest 為準）", () => {
    expect(UI_FILES.filter(isNameFile)).toEqual([]);
  });

  it("layers.json 只能用 manifest 上存在、有名稱的 key", () => {
    const named = new Set(Object.values(LAYER_MANIFEST).filter((e) => e.section).map((e) => `layer.${e.key}`));
    for (const locale of SUPPORTED_LOCALES) {
      const unknown = Object.keys(readLocaleFile(locale, "layers.json")).filter((k) => !named.has(k));
      expect(unknown, `${locale}/layers.json 有不存在的圖層 key`).toEqual([]);
    }
  });

  it("popupHeaders.json 只能用說明框有的 layerType", () => {
    const types = new Set(Object.keys(HEADER_LABELS).map((k) => `popupHeader.${k}`));
    for (const locale of SUPPORTED_LOCALES) {
      const unknown = Object.keys(readLocaleFile(locale, "popupHeaders.json")).filter((k) => !types.has(k));
      expect(unknown, `${locale}/popupHeaders.json 有不存在的 layerType`).toEqual([]);
    }
  });

  it("params.json 不留孤兒：key 必須是設定面板現有的中文，或現有控件的覆寫（param.<layerKey>.<參數名>）", () => {
    const { texts, targets } = collectParamTexts();
    for (const locale of SUPPORTED_LOCALES) {
      const entries = Object.entries(readLocaleFile(locale, "params.json"));
      const orphan = entries.map(([k]) => k).filter((k) => !texts.has(k.slice("param.".length)) && !targets.has(k.slice("param.".length)));
      expect(orphan, `${locale}/params.json 的中文在 layerParamsSpec 找不到（中文改過？把譯文的 key 一起改）`).toEqual([]);
      expect(entries.filter(([, v]) => !v.trim()).map(([k]) => k), `${locale}/params.json 有空字串`).toEqual([]);
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
  const ctx = (active: Locale, dict: Record<string, string> = {}) => ({ active, lookup: (key: string) => dict[key] ?? null });

  it("中文介面原樣顯示；外文介面優先翻譯檔、其次合語系的外文名、最後中文", () => {
    const name = { zh: "公車站", alt: "Bus Stops" };
    expect(localizeLayerName("busStops", name, ctx("zh-TW", {}))).toEqual({ primary: "公車站", secondary: "Bus Stops", qualifier: undefined });
    expect(localizeLayerName("busStops", name, ctx("en", {})).primary).toBe("Bus Stops");
    expect(localizeLayerName("busStops", name, ctx("en", {})).secondary).toBe("公車站");
    expect(localizeLayerName("busStops", name, ctx("ja", {})).primary).toBe("公車站");
    expect(localizeLayerName("busStops", name, ctx("ja", { "layer.busStops": "バス停" })).primary).toBe("バス停");
    expect(localizeLayerName("jpDam", { zh: "水壩", alt: "ダム" }, ctx("ja", {})).primary).toBe("ダム");
    expect(localizeLayerName("x", { zh: "人口", qualifier: "縣市" }, ctx("en", { "qualifier.縣市": "County/city" })).qualifier).toBe("County/city");
    expect(localizeLayerName("x", { zh: "人口", qualifier: "2014" }, ctx("en", {})).qualifier).toBe("2014");
  });

  it("主題標題：英文介面取「中文 English」後半", () => {
    expect(localizeSectionTitle("交通 Move", ctx("en", {}))).toBe("Move");
    expect(localizeSectionTitle("交通 Move", ctx("ja", { "theme.交通 Move": "交通" }))).toBe("交通");
    expect(localizeSectionTitle("航港獎補助", ctx("en", {}))).toBe("航港獎補助");
  });
});
