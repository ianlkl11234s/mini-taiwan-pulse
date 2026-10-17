import { describe, expect, it } from "vitest";
import { buildParamControls, type SelectConfig, type SliderConfig } from "../../state/layerParamsControls";
import type { MessageKey } from "../keys";
import type { Locale } from "../locales";
import { paramText } from "../paramText";

function fakeI18n(active: Locale, messages: Record<string, string>) {
  const lookup = (key: MessageKey) => messages[key] ?? null;
  return { active, lookup, t: (key: MessageKey) => lookup(key) ?? key };
}

const en = fakeI18n("en", {
  "param.透明度": "Opacity",
  "param.高度": "Height",
  "param.軌道": "Track",
  "param.（列車平面時用 2D）": " (2D while trains are flat)",
  "param.rail.railTrainVisible": "Trains",
});

describe("paramText", () => {
  it("中文介面、沒有 i18n、不含中文的字都原樣回傳", () => {
    expect(paramText("透明度", undefined)).toBe("透明度");
    expect(paramText("透明度", fakeI18n("zh-TW", { "param.透明度": "X" }))).toBe("透明度");
    expect(paramText("min", en)).toBe("min");
  });

  it("單一控件覆寫優先於中文原文 key；都沒有時回退中文", () => {
    expect(paramText("列車", en, { layerKey: "rail", name: "railTrainVisible" })).toBe("Trains");
    expect(paramText("透明度", en, { layerKey: "rail", name: "x" })).toBe("Opacity");
    expect(paramText("沒翻的字", en)).toBe("沒翻的字");
  });
});

describe("buildParamControls 的顯示層翻譯", () => {
  it("沒傳 i18n 時輸出與原本一致（Agent 與黃金快照讀中文）", () => {
    const zh = buildParamControls("flights", {})!;
    const withZh = buildParamControls("flights", {}, fakeI18n("zh-TW", {}))!;
    const strip = (cs: typeof zh) => JSON.stringify(cs, (_k, v) => (typeof v === "function" ? undefined : v));
    expect(strip(withZh)).toBe(strip(zh));
  });

  it("滑桿先拆結尾運算符號再翻名稱（`高度 +` → `Height +`）", () => {
    const slider = buildParamControls("flights", {}, en)!.find((c) => !c.type && (c as SliderConfig).label.startsWith("Height")) as SliderConfig;
    expect(slider.name).toBe("Height");
    expect(slider.valueText.startsWith("+")).toBe(true);
  });

  it("select 的停用原因分開翻，不拿「選項＋原因」整串當 key", () => {
    const track = buildParamControls("rail", { railTrain3D: false }, en)!.find((c) => c.type === "select" && c.label === "Track") as SelectConfig;
    expect(track.options.find((o) => o.value === "3d")).toMatchObject({ label: "3D (2D while trains are flat)", disabled: true });
  });
});
