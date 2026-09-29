import { describe, expect, it } from "vitest";
import { parseCardSlug, validateCardPayload } from "../cardPayload";
import { areaPayload, pointsPayload } from "./cardFixtures";

describe("validateCardPayload（對照 migration 414 validator）", () => {
  it("接受完整的面與點 payload", () => {
    expect(validateCardPayload(areaPayload()).ok).toBe(true);
    const points = validateCardPayload(pointsPayload());
    expect(points.ok).toBe(true);
    if (points.ok) expect(points.payload.map).toBeNull();
  });

  it("拒絕未知 schema_version", () => {
    expect(validateCardPayload({ ...areaPayload(), schema_version: 2 })).toEqual({ ok: false, reason: "UNKNOWN_SCHEMA_VERSION" });
    const { schema_version: _drop, ...noVersion } = areaPayload();
    expect(validateCardPayload(noVersion).ok).toBe(false);
  });

  it("任何深度的禁止欄位都拒絕（address、properties、coordinates），map.geometry 參照除外", () => {
    const withAddress = areaPayload() as unknown as { top: Record<string, unknown>[] };
    withAddress.top[0]!.address = "某路 1 號";
    expect(validateCardPayload(withAddress).ok).toBe(false);
    expect(validateCardPayload({ ...areaPayload(), caveats: [{ properties: {} }] }).ok).toBe(false);
    expect(validateCardPayload({ ...pointsPayload(), query_scope: { center: [121.5, 25.04], radius_m: 500, geometry: { type: "Point", coordinates: [1, 2] } } }).ok).toBe(false);
  });

  it("top[].code 選填，格式不對拒絕；點位名稱上限 40 字", () => {
    const payload = areaPayload();
    expect(validateCardPayload({ ...payload, top: [{ ...payload.top[0]!, code: "63000" }] }).ok).toBe(true);
    expect(validateCardPayload({ ...payload, top: [{ ...payload.top[0]!, code: "x".repeat(17) }] }).ok).toBe(false);
    const points = pointsPayload();
    expect(validateCardPayload({ ...points, points: { ...points.points!, items: [{ name: "字".repeat(41), lnglat: [121.5, 25.04], class_index: null }] } }).ok).toBe(false);
  });

  it("超出上限或不認得的欄位拒絕", () => {
    const payload = areaPayload();
    expect(validateCardPayload({ ...payload, stats: [...payload.stats, payload.stats[0]] }).ok).toBe(false);
    expect(validateCardPayload({ ...payload, extra: 1 }).ok).toBe(false);
    expect(validateCardPayload({ ...payload, sources: [] }).ok).toBe(false);
    expect(validateCardPayload({ ...payload, title: "字".repeat(81) }).ok).toBe(false);
    expect(validateCardPayload({ ...payload, caveats: ["x".repeat(40_000)] }).ok).toBe(false);
  });

  it("界線只接受 statistics CDN 內容雜湊檔，且不收村里層級", () => {
    const payload = areaPayload();
    expect(validateCardPayload({ ...payload, map: { ...payload.map!, geometry: { ...payload.map!.geometry, resource_url: "https://evil.example/x.geojson" } } }).ok).toBe(false);
    expect(validateCardPayload({ ...payload, map: { ...payload.map!, geometry: { ...payload.map!.geometry, level: "village" } } }).ok).toBe(false);
  });
});

describe("parseCardSlug", () => {
  it("只接受 /card/ 加 16 字元 URL-safe slug", () => {
    expect(parseCardSlug("/card/AbCdEfGh_-123456")).toBe("AbCdEfGh_-123456");
    expect(parseCardSlug("/card/AbCdEfGh_-123456/")).toBe("AbCdEfGh_-123456");
    expect(parseCardSlug("/card/short")).toBeNull();
    expect(parseCardSlug("/card/AbCdEfGh_-1234567")).toBeNull();
    expect(parseCardSlug("/card/AbCdEfGh.-123456")).toBeNull();
    expect(parseCardSlug("/card/")).toBeNull();
  });
});
