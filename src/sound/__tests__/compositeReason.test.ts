/**
 * W6-8 綜合聲景白話原因（滑過提示與點選面板共用 compositeReason）：用真的中文字串驗白話句。
 * 七族順序＝COMPOSITE_FAMILIES：雨、道路、飛機、鐵道、風、浪、河。
 */
import { describe, expect, it } from "vitest";
import zh from "../../i18n/locales/zh-TW/soundAtlas.json";
import { translate } from "../../i18n/translate";
import type { MessageKey } from "../../i18n/keys";
import { compositeReason } from "../../components/sound/compositeReason";
import { compositeCell, COMPOSITE_FAMILIES, packLevels, unpackLevels } from "../grid/compositeGrid";

const t = (key: MessageKey, vars?: Record<string, string | number>) => translate([zh as Record<string, string>], "zh-TW", key, vars);
const reason = (m: Record<string, number>, v: "a" | "b" | "c") => {
  const r = compositeCell(COMPOSITE_FAMILIES.map((f) => m[f] ?? 255));
  const x = compositeReason(t, unpackLevels(packLevels(r.terms)), v, { a: r.codeA, b: r.codeB, c: r.codeC });
  return `${x.head}：${x.detail}`;
};

describe("綜合聲景白話原因", () => {
  it("熱鬧：列出偏活躍的族（分級高的在前）", () => {
    expect(reason({ rain: 0, road_traffic: 2, aviation: 61, rail: 160, wind_vegetation: 0, coastal_wave: 0, river_water: 0 }, "a")).toBe("熱鬧：鐵道（很高）、道路車流（中）、飛機（中）");
  });
  it("平靜：七種都偏低；有無法判斷的族要寫出來（不當成沒有）", () => {
    expect(reason({ rain: 0, road_traffic: 0, aviation: 0, rail: 0, wind_vegetation: 0, coastal_wave: 0, river_water: 0 }, "a")).toBe("平靜：七種聲源都偏低");
    expect(reason({ rain: 0, road_traffic: 0, aviation: 0, rail: 0, wind_vegetation: 0 }, "a")).toBe("平靜：有資料的 5 種都偏低（2 種無法判斷）");
    // 點選面板（另有「無法判斷：…」一行）不帶括號
    const r = compositeCell(COMPOSITE_FAMILIES.map((f) => ({ rain: 0, road_traffic: 0, aviation: 0, rail: 0, wind_vegetation: 0 } as Record<string, number>)[f] ?? 255));
    expect(compositeReason(t, r.terms.map((x) => x?.level ?? null), "a", { a: r.codeA, b: r.codeB, c: r.codeC }, false).detail).toBe("有資料的 5 種都偏低");
  });
  it("無法判斷：可判斷族不足", () => {
    expect(reason({ rain: 0, road_traffic: 0, rail: 0 }, "a")).toBe("無法判斷：只有 3／7 種有資料");
    expect(reason({ rain: 0, road_traffic: 0, rail: 0 }, "c")).toBe("無法判斷：只有 3／7 種有資料");
  });
  it("丙：主因＋另有；只有小雨也算主因", () => {
    expect(reason({ rain: 1, road_traffic: 0, aviation: 0, rail: 160, wind_vegetation: 0, coastal_wave: 0, river_water: 0 }, "c")).toBe("主因：鐵道（很高）：另有 雨（小雨）");
    expect(reason({ rain: 1, road_traffic: 0, aviation: 0, rail: 0, wind_vegetation: 0, coastal_wave: 0, river_water: 0 }, "c")).toBe("主因：雨（小雨）：只有這一種");
  });
});
