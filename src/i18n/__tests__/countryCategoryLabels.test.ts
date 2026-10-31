/**
 * 英國、南韓共用同一個中文類別名（小學、地鐵、太陽光電、生質能／廢棄物、抽蓄水力），英日譯法各國不同。
 * 英國用 `param.<layerKey>.<中文>` 單層覆寫，南韓沿用通用 `param.<中文>`；這裡鎖住兩國面板實際顯示的譯名。
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildParamControls, type MultiSelectConfig } from "../../state/layerParamsControls";
import type { MessageKey } from "../keys";
import type { Locale } from "../locales";

function localeI18n(active: Locale) {
  const file = path.resolve(__dirname, "../locales", active, "params.json");
  const messages = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, string>;
  const lookup = (key: MessageKey) => messages[key] ?? null;
  return { active, lookup, t: (key: MessageKey) => lookup(key) ?? key };
}

function categoryLabel(layerKey: string, value: string, active: Locale): string | undefined {
  const controls = buildParamControls(layerKey, undefined, localeI18n(active))!;
  const multi = controls.filter((c): c is MultiSelectConfig => c.type === "multiSelect");
  return multi.flatMap((c) => c.options).find((o) => o.value === value)?.label;
}

const CASES: Array<[layerKey: string, zh: string, en: string, ja: string]> = [
  // 英國
  ["gbSchools", "小學", "Primary", "初等学校"],
  ["gbLondonRailLines", "地鐵", "Underground", "地下鉄"],
  ["gbPowerPlants", "太陽光電", "Solar PV", "太陽光"],
  ["gbPowerPlants", "生質能／廢棄物", "Bioenergy / waste", "バイオマス・廃棄物"],
  ["gbPowerPlants", "抽蓄水力", "Pumped hydro", "揚水発電"],
  // 南韓（維持現狀）
  ["krChildProtectionZones", "小學", "Elementary school", "小学校"],
  ["krRailLines", "地鐵", "Subway", "地下鉄"],
  ["krPowerPlants", "太陽光電", "Solar", "太陽光"],
  ["krPowerPlants", "生質能／廢棄物", "Biomass / waste", "バイオマス・廃棄物"],
  ["krPowerPlants", "抽蓄水力", "Pumped hydro", "揚水発電"],
  ["krRenewables", "太陽光電", "Solar", "太陽光"],
];

describe("英國／南韓共用中文類別名的各國譯名", () => {
  it.each(CASES)("%s「%s」→ en %s／ja %s", (layerKey, zh, en, ja) => {
    const zhControls = buildParamControls(layerKey)!;
    const multi = zhControls.filter((c): c is MultiSelectConfig => c.type === "multiSelect");
    const option = multi.flatMap((c) => c.options).find((o) => o.label === zh);
    expect(option, `${layerKey} 沒有「${zh}」選項`).toBeDefined();
    expect(categoryLabel(layerKey, option!.value, "en")).toBe(en);
    expect(categoryLabel(layerKey, option!.value, "ja")).toBe(ja);
  });
});
