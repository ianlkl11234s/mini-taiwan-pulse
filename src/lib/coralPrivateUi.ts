import type { FeatureInfo } from "../types";

export function isCoralPrivateFeature(feature: FeatureInfo | null): boolean {
  return feature?.layerType === "coralReefDistribution";
}

export function isAllenCoralPrivateFeature(feature: FeatureInfo | null): boolean {
  return feature?.layerType === "allenCoralAtlas";
}

/** Never render a private Coral selection after its layer is hidden or access is revoked. */
export function coralSafeFeatureInfo(
  feature: FeatureInfo | null,
  coralAllowed: boolean,
  coralVisible: boolean,
  allenAllowed = false,
  allenVisible = false,
): FeatureInfo | null {
  if (isCoralPrivateFeature(feature)) return coralAllowed && coralVisible ? feature : null;
  if (isAllenCoralPrivateFeature(feature)) return allenAllowed && allenVisible ? feature : null;
  return feature;
}
