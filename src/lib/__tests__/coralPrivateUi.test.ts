import { describe, expect, it } from "vitest";
import type { FeatureInfo } from "../../types";
import { coralSafeFeatureInfo, isAllenCoralPrivateFeature, isCoralPrivateFeature } from "../coralPrivateUi";

const coral = { layerType: "coralReefDistribution", properties: { id: "cr-v4.1-04805" }, coords: [121, 23] } as FeatureInfo;
const other = { layerType: "worldTrashDebris", properties: {}, coords: [121, 23] } as FeatureInfo;
const allen = { layerType: "allenCoralAtlas", properties: { feature_id: "aca-1" }, coords: [121, 23] } as FeatureInfo;

describe("coral private UI state", () => {
  it("identifies only the private Coral selection", () => {
    expect(isCoralPrivateFeature(coral)).toBe(true);
    expect(isCoralPrivateFeature(other)).toBe(false);
    expect(isAllenCoralPrivateFeature(allen)).toBe(true);
  });

  it.each([
    [false, true],
    [true, false],
    [false, false],
  ])("removes Coral popup and halo state when allowed=%s, visible=%s", (allowed, visible) => {
    expect(coralSafeFeatureInfo(coral, allowed, visible)).toBeNull();
  });

  it("does not clear another layer's selection", () => {
    expect(coralSafeFeatureInfo(other, false, false)).toBe(other);
  });

  it("clears Allen selection independently when its owner access or visibility is absent", () => {
    expect(coralSafeFeatureInfo(allen, true, true, false, true)).toBeNull();
    expect(coralSafeFeatureInfo(allen, true, true, true, false)).toBeNull();
    expect(coralSafeFeatureInfo(allen, false, false, true, true)).toBe(allen);
  });
});
