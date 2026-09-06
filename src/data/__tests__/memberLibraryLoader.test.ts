import { describe, expect, it, vi } from "vitest";
import type { MemberSceneSnapshot } from "../../lib/memberSchema";

const api = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("../../lib/supabase", () => ({ supabase: api }));

import { MemberLibraryError, memberLibraryLoader } from "../memberLibraryLoader";

const scene: MemberSceneSnapshot = {
  version: 1,
  camera: { lng: 121.5, lat: 25.04, zoom: 10, pitch: 0, bearing: 0 },
  basemap: "standard", layers: ["aqi"], params: { aqi: { opacity: 0.8 } },
  time: { mode: "realtime", cursorISO: "2026-09-06T00:00:00.000Z", windowDays: 1 },
};
const validScene = { id: "scene-ok", user_id: "u1", name: "可重開場景", snapshot_version: 1, snapshot: scene, created_at: "2026-09-06T00:00:00Z", updated_at: "2026-09-06T00:00:00Z" };
const validPlace = { id: "place-ok", user_id: "u1", name: "可重開地點", geometry: { type: "Point", coordinates: [121.5, 25.04] }, source_kind: "manual", precision: "user_selected", created_at: "2026-09-06T00:00:00Z", updated_at: "2026-09-06T00:00:00Z" };

function readBuilder(result: unknown) {
  const builder = {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(),
  } as { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; order: ReturnType<typeof vi.fn>; limit: ReturnType<typeof vi.fn> };
  builder.select.mockReturnValue(builder); builder.eq.mockReturnValue(builder); builder.order.mockReturnValue(builder); builder.limit.mockResolvedValue(result);
  return builder;
}

describe("memberLibraryLoader", () => {
  it("隔離格式不相容的 scene/place，仍載入其他可用保存內容", async () => {
    const favorites = readBuilder({ data: [{ layer_key: "cctv" }], error: null });
    const scenes = readBuilder({ data: [validScene, { ...validScene, id: "scene-bad", name: "舊場景", snapshot_version: 99 }], error: null });
    const places = readBuilder({ data: [validPlace, { ...validPlace, id: "place-bad", name: "壞地點", geometry: { type: "Point", coordinates: [999, 25] } }], error: null });
    api.from.mockImplementation((table: string) => ({ user_layer_favorites: favorites, user_scenes: scenes, user_places: places })[table]);

    const library = await memberLibraryLoader.load("u1");
    expect(library.favorites).toEqual(["cctv"]);
    expect(library.scenes.map((row) => row.id)).toEqual(["scene-ok"]);
    expect(library.places.map((row) => row.id)).toEqual(["place-ok"]);
    expect(library.unavailableItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "scene-bad", table: "user_scenes" }),
      expect.objectContaining({ id: "place-bad", table: "user_places" }),
    ]));
  });

  it("更新 scene 會帶 CAS updated_at，空回應明確是衝突", async () => {
    const builder = {
      update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as { update: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn>; maybeSingle: ReturnType<typeof vi.fn> };
    builder.update.mockReturnValue(builder); builder.eq.mockReturnValue(builder); builder.select.mockReturnValue(builder);
    api.from.mockReturnValue(builder);

    await expect(memberLibraryLoader.saveScene("u1", "新版", scene, validScene)).rejects.toMatchObject({ kind: "conflict" } satisfies Partial<MemberLibraryError>);
    expect(builder.eq).toHaveBeenCalledWith("updated_at", validScene.updated_at);
    expect(builder.eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("資料表尚未建立時，回報 unavailable 而非一般保存成功", async () => {
    const builder = { upsert: vi.fn().mockResolvedValue({ error: { code: "42P01" } }) };
    api.from.mockReturnValue(builder);
    await expect(memberLibraryLoader.favorite("u1", "cctv", true)).rejects.toMatchObject({ kind: "unavailable" } satisfies Partial<MemberLibraryError>);
  });
});
