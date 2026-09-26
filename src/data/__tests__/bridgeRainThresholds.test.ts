import { describe, expect, it } from "vitest";
import { assessBridgeRain, BRIDGE_RAIN_DEFINITIONS } from "../bridgeRainThresholds";
import type { RainGaugeLatestRow } from "../rainGaugeLoader";

const now = Date.parse("2026-09-23T04:00:00Z");
const bridge = BRIDGE_RAIN_DEFINITIONS.find((row) => row.id === "101")!;
const reading = (p24: number | null, observed_at = "2026-09-23T03:50:00Z"): RainGaugeLatestRow => ({
  station_id: "C0A890", station_name: "雙溪", observed_at,
  precipitation_1hr: 0, precipitation_3hr: 0, precipitation_6hr: 0, precipitation_24hr: p24,
});

describe("一級監控橋梁參考雨量", () => {
  it("只在指定站的新鮮值達到官方門檻時標記雨量觸發", () => {
    expect(assessBridgeRain(bridge, new Map([["C0A890", reading(400)]]), now)).toMatchObject({ status: "triggered", label: "行動1雨量", matchedStation: "C0A890" });
    expect(assessBridgeRain(bridge, new Map([["C0A890", reading(199)]]), now).status).toBe("below");
  });

  it("缺測、超過 30 分鐘與未覆核門檻均維持未知", () => {
    expect(assessBridgeRain(bridge, new Map(), now).status).toBe("unknown");
    expect(assessBridgeRain(bridge, new Map([["C0A890", reading(null)]]), now).status).toBe("unknown");
    expect(assessBridgeRain(bridge, new Map([["C0A890", reading(400, "2026-09-23T03:20:00Z")]]), now).status).toBe("unknown");
    const unreviewed = BRIDGE_RAIN_DEFINITIONS.find((row) => row.id === "203")!;
    expect(assessBridgeRain(unreviewed, new Map(), now).status).toBe("unknown");
  });

  it("雙測站任一站達標可標雨量觸發，其餘情況缺一站仍未知", () => {
    const doubleStation = BRIDGE_RAIN_DEFINITIONS.find((row) => row.id === "301")!;
    const row: RainGaugeLatestRow = { ...reading(200), station_id: "C1V220" };
    expect(assessBridgeRain(doubleStation, new Map([["C1V220", row]]), now)).toMatchObject({ status: "triggered", matchedStation: "C1V220" });
    expect(assessBridgeRain(doubleStation, new Map([["C1V220", { ...row, precipitation_24hr: 0 }]]), now).status).toBe("unknown");
  });
});
