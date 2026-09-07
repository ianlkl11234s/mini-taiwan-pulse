import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock, fromMock } = vi.hoisted(() => ({ rpcMock: vi.fn(), fromMock: vi.fn() }));

vi.mock("../../lib/supabase", () => ({
  supabase: { rpc: rpcMock, from: fromMock },
  todayTaiwan: () => "2026-09-07",
}));
vi.mock("../../lib/loadingRegistry", () => ({
  withLoading: (_id: string, _label: string, request: Promise<unknown>) => Promise.resolve(request),
}));

import { fetchAirportHourlyPax } from "../airportPaxLoader";
import {
  fetchErHospital24hAll,
  fetchErHospitalLatest,
  fetchErWaitTotal14d,
} from "../erHospitalLoader";
import { fetchEarthquakeDaily } from "../earthquakeLoader";
import { fetchTyphoonProximityDaily } from "../typhoonTracksLoader";
import { fetchNuclearDaily, invalidateNuclearDaily } from "../nuclearLoader";
import {
  fetchLightningDaily, fetchLightningSummary, invalidateLightningDaily, invalidateLightningSummary,
} from "../lightningLoader";

describe("Monitor resource loaders", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    invalidateNuclearDaily();
    invalidateLightningDaily();
    invalidateLightningSummary();
  });

  it("keeps airport RPC failure distinct from a successful empty result", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "gateway timeout" } });
    await expect(fetchAirportHourlyPax("TPE")).rejects.toThrow("get_airport_hourly_pax: gateway timeout");
  });

  it.each([
    ["latest", fetchErHospitalLatest],
    ["24h", fetchErHospital24hAll],
    ["14d", fetchErWaitTotal14d],
  ])("keeps ER %s RPC failure rejected for query status", async (_label, load) => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    await expect(load()).rejects.toThrow("permission denied");
  });

  it.each([
    ["typhoon trend", fetchTyphoonProximityDaily],
    ["nuclear trend", fetchNuclearDaily],
    ["lightning trend", fetchLightningDaily],
  ])("keeps %s failure rejected instead of claiming an empty history", async (_label, load) => {
    const denied = { code: "42501", message: "permission denied" };
    rpcMock.mockResolvedValue({ data: null, error: denied });
    await expect(load()).rejects.toBe(denied);
  });

  it("keeps earthquake trend failure rejected instead of padding it as zero-event days", async () => {
    const denied = { code: "42501", message: "permission denied" };
    const response = Promise.resolve({ data: null, error: denied });
    fromMock.mockReturnValue({
      select: vi.fn(() => ({
        gte: vi.fn(() => ({ order: vi.fn(() => ({ limit: vi.fn(() => response) })) })),
      })),
    });
    await expect(fetchEarthquakeDaily()).rejects.toBe(denied);
  });

  it("lets the lightning summary reject with its original access error", async () => {
    const denied = { code: "42501", message: "permission denied" };
    const response = Promise.resolve({ data: null, error: denied });
    rpcMock.mockReturnValue(Object.assign(response, {
      gte: vi.fn(() => response),
      order: vi.fn(() => ({ limit: vi.fn(() => response) })),
    }));
    await expect(fetchLightningSummary()).rejects.toBe(denied);
  });
});
