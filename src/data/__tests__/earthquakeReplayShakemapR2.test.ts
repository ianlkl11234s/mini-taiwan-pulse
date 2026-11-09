import { afterEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const from = vi.fn();
vi.mock("../../lib/supabase", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => from(...a) } }));

import {
  SHAKEMAP_INDEX_URL,
  fetchReplayDetail,
  fetchReplayEvents,
  matchShakemapIndex,
  parseShakemapEventFile,
} from "../earthquakeReplayLoader";

const entries = [
  { event_time: "2026-07-27T02:15:00Z", key: "events/shakemap/20260727T021500Z.json" },
  { event_time: "2026-08-26T21:47:00Z", key: "events/shakemap/20260826T214700Z.json" },
];

describe("matchShakemapIndex", () => {
  it("±90 秒內取最近的事件", () => {
    expect(matchShakemapIndex("2026-07-27T10:16:20+08:00", entries)?.key).toBe(entries[0]!.key);
    expect(matchShakemapIndex("2026-08-26T21:45:31Z", entries)?.key).toBe(entries[1]!.key);
  });
  it("超過 90 秒或時間無效回 null", () => {
    expect(matchShakemapIndex("2026-07-27T02:16:31Z", entries)).toBeNull();
    expect(matchShakemapIndex("not-a-date", entries)).toBeNull();
  });
});

describe("parseShakemapEventFile", () => {
  it("只留 intensity > 0 的格，依 columns 取欄", () => {
    const cells = parseShakemapEventFile({
      columns: ["lon", "lat", "pga", "pgv", "intensity"],
      cells: [[120, 22, 0, 0, 0], [121, 23, 8.5, 1, 3], [121.1, 23.1, 1, 0.1, null]],
    });
    expect(cells).toEqual([{ lon: 121, lat: 23, pga: 8.5, intensity: 3 }]);
  });
  it("格式不符要報錯", () => {
    expect(() => parseShakemapEventFile({ cells: [] })).toThrow();
  });
});

describe("清單與明細改讀 R2", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("配對到 R2 事件就從 R2 讀網格、不查 DB 網格表", async () => {
    rpc.mockResolvedValue({
      data: [
        { event_id: "e1", occurred_at: "2026-07-27T02:15:40Z", magnitude: 5, depth_km: 10, epicenter_lat: 23.2, epicenter_lng: 120.5,
          location: "台南", station_count: 3, has_town: false, town_origin_time: null, has_grid: false, grid_event_time: null,
          has_tensor: false, tensor_origin_utc: null },
      ],
      error: null,
    });
    const fetched: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      fetched.push(url);
      if (url === SHAKEMAP_INDEX_URL) return Response.json({ events: entries });
      if (url.endsWith(entries[0]!.key)) {
        return Response.json({ columns: ["lon", "lat", "pga", "pgv", "intensity"], cells: [[120.5, 23.2, 10, 1, 4], [119, 21, 0, 0, 0]] });
      }
      return new Response("nf", { status: 404 });
    }));
    from.mockImplementation((table: string) => {
      if (table === "earthquake_shakemap_grid") throw new Error("不該查 DB 網格表");
      const chain = { select: () => chain, eq: () => chain, order: () => Promise.resolve({ data: [], error: null }) };
      return chain;
    });

    const [ev] = await fetchReplayEvents();
    expect(ev!.has_grid).toBe(true);
    expect(ev!.grid_key).toBe(entries[0]!.key);
    const detail = await fetchReplayDetail(ev!);
    expect(detail.grid).toHaveLength(1);
    expect(detail.grid[0]!.intensity).toBe(4);
    expect(fetched.some((u) => u.endsWith(entries[0]!.key))).toBe(true);
  });
});
