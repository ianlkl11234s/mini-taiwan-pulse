import { describe, expect, it } from "vitest";
import { isLayerLocked, normalizeLayerGate, tierRank, type LayerGate, type LayerGates } from "../layerGates";
import type { LayerVisibility } from "../../types";

const key = "powerPlants" as keyof LayerVisibility;
const gates = (gate?: LayerGate): LayerGates => new Map(gate ? [[key, gate]] : []);

describe("layer gate fail-closed behavior", () => {
  it("keeps static sensitive layers owner-locked after a successful empty gate response", () => {
    expect(isLayerLocked(key, null, gates())).toBe(true);
    expect(isLayerLocked(key, "member", gates())).toBe(true);
    expect(isLayerLocked(key, "owner", gates())).toBe(false);
  });

  it("keeps a static sensitive key owner-locked when it is missing from a populated response", () => {
    const response: LayerGates = new Map([["aviationRestrictedGlow", { required_tier: "member", enabled: true, lock_type: "ui" }]]);
    expect(isLayerLocked(key, "member", response)).toBe(true);
  });

  it("keeps disabled full gates at the owner floor", () => {
    expect(isLayerLocked(key, "member", gates({ required_tier: "free", enabled: false, lock_type: "full" }))).toBe(true);
    expect(isLayerLocked(key, "owner", gates({ required_tier: "free", enabled: false, lock_type: "full" }))).toBe(false);
  });

  it("honors explicit valid full and ui gates", () => {
    expect(isLayerLocked(key, null, gates({ required_tier: "free", enabled: true, lock_type: "full" }))).toBe(false);
    const uiMember = gates({ required_tier: "member", enabled: true, lock_type: "ui" });
    expect(isLayerLocked(key, null, uiMember)).toBe(true);
    expect(isLayerLocked(key, "free", uiMember)).toBe(true);
    expect(isLayerLocked(key, "member", uiMember)).toBe(false);
  });

  it("does not treat invalid gate data as public", () => {
    expect(isLayerLocked(key, "member", gates({ required_tier: "unknown", enabled: true, lock_type: "full" }))).toBe(true);
    expect(isLayerLocked(key, "member", gates({ required_tier: "free", enabled: true, lock_type: "unknown" as "full" }))).toBe(true);
  });
  it("normalizes malformed RPC rows before they can imply public access", () => {
    const gate = normalizeLayerGate({ required_tier: "free", enabled: true });
    expect(isLayerLocked(key, "member", gates(gate))).toBe(true);
    expect(normalizeLayerGate({ required_tier: "free", enabled: true, lock_type: "ui" })).toMatchObject({ required_tier: "free", lock_type: "ui" });
    expect(tierRank("__proto__")).toBe(0);
    expect(tierRank("constructor")).toBe(0);
    expect(isLayerLocked(key, "constructor", null)).toBe(true);
  });

});
