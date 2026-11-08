/**
 * 監控卡片的輪詢與資料狀態一律走共用的 useMonitorResource ＋ MonitorDataStatus。
 * 原本以字串比對卡片原始碼；改成實際 render 卡片，記錄 hook 呼叫與畫出的狀態列。
 * 卡片不得自己 setInterval／let cancelled：由 ESLint pulse/monitor-no-manual-polling 檢查。
 */
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => [] as { queryKey: string; open: boolean }[]);

vi.mock("../../../../hooks/useMonitorResource", async () => {
  const { initialIntelQueryState } = await import("../../../../hooks/useIntelPollingQuery");
  return {
    useMonitorResource: ({ open, queryKey, emptyData }: { open: boolean; queryKey: string; emptyData: unknown }) => {
      calls.push({ queryKey, open });
      return initialIntelQueryState(emptyData, queryKey);
    },
  };
});
vi.mock("../MonitorDataStatus", () => ({
  MonitorDataStatus: ({ query }: { query: { queryKey: string } }) => `[status:${query.queryKey}]`,
}));

import { AirportPaxCard } from "../AirportPaxCard";
import { ERCard } from "../ERCard";
import { PlaBoard } from "../PlaBoard";
import { VesselZoneCard } from "../VesselZoneCard";
import { FoodPriceBoard } from "../FoodPriceBoard";
import { TraDelayBoard } from "../TraDelayBoard";
import { EarthquakeCard, LightningCard, RadiationCard, TyphoonCard } from "../HazardCards";

const CARDS: [string, ComponentType<{ open: boolean; nowTs: number }>][] = [
  ["AirportPaxCard", AirportPaxCard],
  ["ERCard", ERCard],
  ["PlaBoard", PlaBoard],
  ["VesselZoneCard", VesselZoneCard],
  ["FoodPriceBoard", FoodPriceBoard],
  ["TraDelayBoard", TraDelayBoard],
  ["TyphoonCard", TyphoonCard],
  ["EarthquakeCard", EarthquakeCard],
  ["RadiationCard", RadiationCard],
  ["LightningCard", LightningCard],
];

const render = (Card: ComponentType<{ open: boolean; nowTs: number }>) =>
  renderToStaticMarkup(createElement(Card, { open: true, nowTs: Date.UTC(2026, 10, 8) }));

describe("Monitor resource cards", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it.each(CARDS)("%s 的輪詢走 useMonitorResource，並用 MonitorDataStatus 顯示資料狀態", (_name, Card) => {
    const markup = render(Card);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.open)).toBe(true);
    expect(markup).toMatch(/\[status:[^\]]+\]/);
  });

  it("急診三份資料各自輪詢、各自顯示狀態（一份失敗不拖垮其他兩份）", () => {
    const markup = render(ERCard);
    const keys = calls.map((c) => c.queryKey);
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(3);
    for (const key of keys) expect(markup).toContain(`[status:${key}]`);
  });
});
