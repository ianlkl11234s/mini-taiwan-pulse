import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_IMAGERY_CDN_BASE,
  IMAGERY_CDN_BASE,
  imageryManifestUrl,
  loadImageryManifestFrames,
  manifestFramesToFrames,
  utcDaysInWindow,
} from "../imageryManifestLoader";

const frame = (product: string, observedAt: string, over: Record<string, unknown> = {}) => ({
  product,
  observed_at: observedAt,
  key: `imagery/aqi/${product}/${observedAt.slice(0, 10).replace(/-/g, "")}/${observedAt.slice(11, 19).replace(/:/g, "")}.png`,
  mime_type: "image/png",
  image_size: 100,
  bbox: [120, 21.9, 122, 25.3],
  ...over,
});

function stubManifests(byDay: Record<string, unknown[] | number>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    calls.push(input);
    const day = /manifest-(\d{4}-\d{2}-\d{2})\.json$/.exec(input)?.[1] ?? "";
    const v = byDay[day];
    if (v === undefined) return new Response("not found", { status: 404 });
    if (typeof v === "number") return new Response("err", { status: v });
    return Response.json({ version: 1, frames: v });
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("imageryManifestLoader", () => {
  it("未設 env 時用正式 R2 網域（部署漏帶 VITE_IMAGERY_CDN_BASE 也不會整條失效）", () => {
    expect(DEFAULT_IMAGERY_CDN_BASE).toBe("https://data.itsmigu.com");
    expect(IMAGERY_CDN_BASE).not.toBe("");
    expect(imageryManifestUrl("precip", "2026-11-07", "https://x")).toBe("https://x/imagery/precip/manifest-2026-11-07.json");
  });

  it("utcDaysInWindow：台北一天跨兩個 UTC 日；until 為開區間", () => {
    const since = new Date("2026-11-07T00:00:00+08:00").getTime();
    expect(utcDaysInWindow(since, since + 86_400_000)).toEqual(["2026-11-06", "2026-11-07"]);
    expect(utcDaysInWindow(Date.parse("2026-11-07T00:00:00Z"), Date.parse("2026-11-08T00:00:00Z"))).toEqual(["2026-11-07"]);
    expect(utcDaysInWindow(10, 10)).toEqual([]);
  });

  it("manifestFramesToFrames：拼 URL、bbox 拆欄，壞列略過不補 0", () => {
    const out = manifestFramesToFrames([
      frame("AQI", "2026-11-07T08:00:00Z") as never,
      frame("AQI", "bad-time") as never,
      frame("AQI", "2026-11-07T09:00:00Z", { bbox: [1, 2, 3] }) as never,
      frame("AQI", "2026-11-07T10:00:00Z", { key: "" }) as never,
    ], "https://cdn");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      url: "https://cdn/imagery/aqi/AQI/20261107/080000.png",
      lonMin: 120, latMin: 21.9, lonMax: 122, latMax: 25.3, imageSize: 100,
    });
  });

  it("讀涵蓋時間窗的 UTC 日 manifest，依 product 與時間窗過濾、升序", async () => {
    const calls = stubManifests({
      "2026-11-06": [frame("AQI", "2026-11-06T15:00:00Z"), frame("AQI", "2026-11-06T17:00:00Z"), frame("PM25", "2026-11-06T17:00:00Z")],
      "2026-11-07": [frame("AQI", "2026-11-07T15:00:00Z"), frame("AQI", "2026-11-07T01:00:00Z")],
    });
    const frames = await loadImageryManifestFrames({
      source: "aqi", products: ["AQI"],
      sinceIso: "2026-11-07T00:00:00+08:00", untilIso: "2026-11-08T00:00:00+08:00",
      loadingKey: "t", loadingLabel: "t", silent: true,
    });
    expect(calls.map((u) => u.replace(/^.*\/imagery\//, ""))).toEqual(["aqi/manifest-2026-11-06.json", "aqi/manifest-2026-11-07.json"]);
    // 06T15:00Z 早於台北 11/7 00:00（=06T16:00Z）；07T15:00Z 落在 until 之外（07T16:00Z 前）→ 保留
    expect(frames!.map((f) => f.observedAtIso)).toEqual(["2026-11-06T17:00:00Z", "2026-11-07T01:00:00Z", "2026-11-07T15:00:00Z"]);
  });

  it("stepMinutes 抽稀（與 RPC p_step_minutes 同義）", async () => {
    stubManifests({ "2026-11-07": [frame("X", "2026-11-07T01:00:00Z"), frame("X", "2026-11-07T01:10:00Z"), frame("X", "2026-11-07T01:30:00Z")] });
    const frames = await loadImageryManifestFrames({
      source: "cwa", products: ["X"], sinceIso: "2026-11-07T00:00:00Z", untilIso: "2026-11-08T00:00:00Z",
      stepMinutes: 30, loadingKey: "t", loadingLabel: "t", silent: true,
    });
    expect(frames!.map((f) => f.observedAtIso)).toEqual(["2026-11-07T01:00:00Z", "2026-11-07T01:30:00Z"]);
  });

  it("時間窗內一份 manifest 都沒有 → null（呼叫端退回 RPC）；有一份就用 R2", async () => {
    stubManifests({});
    const q = { source: "precip" as const, products: ["ch1"], sinceIso: "2026-11-06T12:00:00Z", untilIso: "2026-11-07T12:00:00Z", loadingKey: "t", loadingLabel: "t", silent: true };
    expect(await loadImageryManifestFrames(q)).toBeNull();
    stubManifests({ "2026-11-07": [frame("ch1", "2026-11-07T08:00:00Z")] });
    expect((await loadImageryManifestFrames(q))!.map((f) => f.product)).toEqual(["ch1"]);
  });

  it("讀取失敗（5xx）當成該日沒有：全部失敗 → null 退回 RPC，其他日照用", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const q = { source: "aqi" as const, products: ["AQI"], sinceIso: "2026-11-06T12:00:00Z", untilIso: "2026-11-07T12:00:00Z", loadingKey: "t", loadingLabel: "t", silent: true };
    stubManifests({ "2026-11-06": 500, "2026-11-07": 503 });
    expect(await loadImageryManifestFrames(q)).toBeNull();
    stubManifests({ "2026-11-06": 500, "2026-11-07": [frame("AQI", "2026-11-07T08:00:00Z")] });
    expect((await loadImageryManifestFrames(q))!).toHaveLength(1);
  });
});
