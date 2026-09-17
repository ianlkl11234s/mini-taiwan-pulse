import { describe, expect, it } from "vitest";
import type { FeatureInfo } from "../../types";
import { coralSafeFeatureInfo, isAllenCoralPrivateFeature } from "../coralPrivateUi";

const coral = { layerType: "coralReefDistribution", properties: { id: "cr-v4.1-04805" }, coords: [121, 23] } as FeatureInfo;
const other = { layerType: "worldTrashDebris", properties: {}, coords: [121, 23] } as FeatureInfo;
const allen = { layerType: "allenCoralAtlas", properties: { feature_id: "aca-1" }, coords: [121, 23] } as FeatureInfo;

describe("Allen private UI state", () => {
  it("identifies only the private Allen selection", () => {
    expect(isAllenCoralPrivateFeature(allen)).toBe(true);
  });

  it("keeps the public Coral selection", () => {
    expect(coralSafeFeatureInfo(coral, false, false)).toBe(coral);
  });

  it("does not clear another layer's selection", () => {
    expect(coralSafeFeatureInfo(other, false, false)).toBe(other);
  });

  it("clears Allen selection independently when its owner access or visibility is absent", () => {
    expect(coralSafeFeatureInfo(allen, false, true)).toBeNull();
    expect(coralSafeFeatureInfo(allen, true, false)).toBeNull();
    expect(coralSafeFeatureInfo(allen, true, true)).toBe(allen);
  });
});
