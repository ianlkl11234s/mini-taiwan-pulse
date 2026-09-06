import { describe, expect, it } from "vitest";
import { normalizePlace, validatePlace, validateScene } from "../memberSchema";

const point = { type: "Point", coordinates: [121.5, 25.04] };
const scene = { version: 1, camera: { lng: 121.5, lat: 25.04, zoom: 10, pitch: 0, bearing: 0 }, basemap: "standard", layers: ["aqi"], params: { aqi: { opacity: 0.8 } }, time: { mode: "historical", playback: "replay", cursorISO: "2026-09-06T00:00:00.000Z", windowDays: 7, historical: { year: 2026, month: 9, day: 6, granularity: "day" } } };

describe("memberSchema", () => {
  it("正規化可保存的地點內容", () => expect(normalizePlace({ name: "  家  ", geometry: point, source_kind: "map", precision: "user_selected" })).toEqual({ ok: true, value: { name: "家", geometry: point, source_kind: "map", precision: "user_selected" } }));
  it("拒絕非有限或越界地點座標", () => expect(validatePlace({ name: "x", geometry: { type: "Point", coordinates: [Infinity, 99] }, source_kind: "manual", precision: "user_selected" }).ok).toBe(false));
  it("拒絕未封閉 Polygon", () => expect(validatePlace({ name: "x", geometry: { type: "Polygon", coordinates: [[[121, 25], [122, 25], [122, 26], [121, 26]]] }, source_kind: "manual", precision: "user_selected" }).ok).toBe(false));
  it("接受含歷史控制狀態的 v1 scene", () => expect(validateScene(scene).ok).toBe(true));
  it("拒絕未知欄位、未來 version 與 null param", () => {
    expect(validateScene({ ...scene, extra: true }).ok).toBe(false);
    expect(validateScene({ ...scene, version: 2 }).ok).toBe(false);
    expect(validateScene({ ...scene, params: { aqi: { opacity: null } } }).ok).toBe(false);
    expect(validateScene({ ...scene, time: { ...scene.time, mode: null } }).ok).toBe(false);
    expect(validateScene({ ...scene, time: { ...scene.time, playback: null } }).ok).toBe(false);
    expect(validateScene({ ...scene, time: { ...scene.time, historical: { ...scene.time.historical, granularity: null } } }).ok).toBe(false);
  });
  it("以 capture/restore 提供的 allowlist 過濾 scene", () => {
    expect(validateScene(scene, { allowedLayerKeys: new Set(["aqi"]), allowedParams: new Map([["aqi", new Set(["opacity"])]] ) }).ok).toBe(true);
    expect(validateScene({ ...scene, params: { aqi: { unknown: 1 } } }, { allowedParams: new Map([["aqi", new Set(["opacity"])]] ) }).ok).toBe(false);
  });
});
