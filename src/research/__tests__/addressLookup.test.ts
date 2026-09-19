import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveOfflineLocation } from "../addressLookup";
import { loadingRegistry } from "../../lib/loadingRegistry";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe("offline address lookup", () => {
  it("accepts finite direct coordinates without reading an asset", async () => {
    const fetcher = vi.fn(); globalThis.fetch = fetcher;
    await expect(resolveOfflineLocation("121.57624, 24.986835")).resolves.toMatchObject({ status: "ok", candidates: [{ source: "coordinate_input", center: [121.57624, 24.986835] }] });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("resolves named camera presets locally", async () => {
    await expect(resolveOfflineLocation("台北")).resolves.toMatchObject({ status: "ok", candidates: [{ label: "台北", source: "camera_preset", matchedOn: "preset_name" }] });
  });

  it("matches only names or complete local addresses and preserves no-match", async () => {
    const school = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [121.5, 25.0] }, properties: { school_name: "測試國小", city: "臺北市", district: "中正區", address: "[100]忠孝東路1號" } }] };
    const library = { type: "FeatureCollection", features: [{ geometry: { type: "Point", coordinates: [121.5, 25] }, properties: { name: "測試圖書館", county: "測試縣" } }] };
    globalThis.fetch = vi.fn(async (path: RequestInfo | URL) => new Response(JSON.stringify(String(path).includes("schools") ? school : library), { status: 200 }));
    await expect(resolveOfflineLocation("台北市中正區忠孝東路1號")).resolves.toMatchObject({ status: "ok", candidates: [{ label: "測試國小", source: "local_public_school", matchedOn: "school_address" }] });
    await expect(resolveOfflineLocation("測試縣")).resolves.toMatchObject({ status: "no_match", candidates: [] });
    await expect(resolveOfflineLocation("台北市中正區忠孝東路")).resolves.toMatchObject({ status: "no_match", candidates: [] });
  });

  it("distinguishes unreadable local data from an unknown household address", async () => {
    globalThis.fetch = vi.fn(async () => new Response("unavailable", { status: 503 }));
    await expect(resolveOfflineLocation("臺北市中正區未知路999號")).resolves.toMatchObject({ status: "unavailable", candidates: [] });
  });

  it("registers asset loading and aborts both reads with the session signal", async () => {
    const signals: AbortSignal[] = [];
    globalThis.fetch = vi.fn((_path: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal as AbortSignal;
      signals.push(signal);
      signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }));
    const controller = new AbortController();
    const pending = resolveOfflineLocation("不存在的完整地點", controller.signal);
    await vi.waitFor(() => expect(loadingRegistry.snapshot()).toContainEqual({ id: "research:offline-location", label: "載入本機地點資料" }));
    controller.abort("SESSION_REVOKED");
    await expect(pending).resolves.toMatchObject({ status: "unavailable", candidates: [] });
    expect(signals).toHaveLength(2);
    expect(signals.every(signal => signal.aborted)).toBe(true);
    expect(loadingRegistry.snapshot()).toEqual([]);
  });
});
