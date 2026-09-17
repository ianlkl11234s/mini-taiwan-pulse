import type { FeatureInfo } from "../types";

export function isAllenCoralPrivateFeature(feature: FeatureInfo | null): boolean {
  return feature?.layerType === "allenCoralAtlas";
}

/** Never render an Allen private selection after its layer is hidden or access is revoked. */
export function coralSafeFeatureInfo(
  feature: FeatureInfo | null,
  allenAllowed: boolean,
  allenVisible: boolean,
): FeatureInfo | null {
  if (isAllenCoralPrivateFeature(feature)) return allenAllowed && allenVisible ? feature : null;
  return feature;
}
