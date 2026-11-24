/**
 * G2-4：外國時間圖層 hook 讀「本側時鐘」——掛在右圖（SideClockContext＝rightClock）時用右側時間，
 * 而且時間走訂閱、不進 deps（切到當地同時刻時 effect 不重跑，靠訂閱拿到新時間）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  slots: [] as { current?: unknown; deps?: unknown[]; cleanup?: unknown }[],
  cursor: 0,
  effectRuns: 0,
  context: null as unknown,
  requested: [] as number[],
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useContext: () => h.context,
  useRef: (value: unknown) => { const i = h.cursor++; return (h.slots[i] ??= { current: value }); },
  useEffect: (effect: () => unknown, deps: unknown[]) => {
    const i = h.cursor++;
    const old = h.slots[i];
    if (old && deps.every((v, j) => Object.is(v, old.deps?.[j]))) return;
    if (typeof old?.cleanup === "function") (old.cleanup as () => void)();
    h.effectRuns++;
    h.slots[i] = { deps, cleanup: effect() };
  },
}));

vi.mock("../../data/jmaLiveLoaders", () => ({
  jmaTimeRequest: (key: string, tSec: number) => {
    h.requested.push(tSec);
    return { key, cacheKey: String(tSec), history: false, at: null, coverageLayer: null, emptyIsUncovered: false };
  },
  fetchJmaTimeCoverage: () => Promise.resolve(new Map()),
  getJmaLiveStatus: () => ({}),
  setJmaLiveStatus: () => undefined,
  jmaCoverageGate: () => "ok",
  jmaHumanError: () => "",
}));

import { useJmaTimeDriver } from "../useJmaTimeDriver";
import { leftClock, rightClock } from "../../state/sideClock";
import { compareStore } from "../../state/compareStore";
import { countryStore } from "../../state/countryStore";
import { timeStore } from "../../state/timeStore";

const T = Date.parse("2026-01-15T00:00:00Z") / 1000; // 台北 08:00

function render() {
  h.cursor = 0;
  useJmaTimeDriver({
    visible: true,
    key: "jmaAmedas",
    pollMs: 60_000,
    fetch: () => Promise.resolve({ value: null, status: {} }),
    invalidate: () => undefined,
    apply: () => undefined,
  });
}

describe("useJmaTimeDriver 讀本側時鐘", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { setTimeout, clearTimeout, setInterval, clearInterval });
    h.slots = []; h.effectRuns = 0; h.requested = [];
    countryStore.reset();
    compareStore.reset();
    timeStore.setTime(T);
  });
  afterEach(() => {
    for (const slot of h.slots) if (typeof slot?.cleanup === "function") (slot.cleanup as () => void)();
    compareStore.reset();
    vi.unstubAllGlobals();
  });

  it("右圖：當地同時刻（台北 08:00 → 東京 08:00）用早 1 小時的時刻；切換靠訂閱，不重跑 effect", () => {
    h.context = rightClock;
    compareStore.hydrate({ enabled: true, mode: "countries", rightCountry: "JP" });
    render();
    expect(h.requested).toEqual([T]);
    expect(h.effectRuns).toBe(1);

    compareStore.setTimeAlign("local");
    expect(h.requested[h.requested.length - 1]).toBe(T - 3600);
    render(); // 重新 render：clock 身分不變，effect 不重跑
    expect(h.effectRuns).toBe(1);
  });

  it("主地圖（左）：永遠是時間軸的時刻", () => {
    h.context = leftClock;
    compareStore.hydrate({ enabled: true, mode: "countries", rightCountry: "JP", timeAlign: "local" });
    render();
    expect(h.requested).toEqual([T]);
  });
});
