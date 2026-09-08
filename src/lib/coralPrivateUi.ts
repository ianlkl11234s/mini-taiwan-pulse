import type { FeatureInfo } from "../types";

export function isCoralPrivateFeature(feature: FeatureInfo | null): boolean {
  return feature?.layerType === "coralReefDistribution";
}

/** Never render a private Coral selection after its layer is hidden or access is revoked. */
export function coralSafeFeatureInfo(
  feature: FeatureInfo | null,
  allowed: boolean,
  visible: boolean,
): FeatureInfo | null {
  if (!isCoralPrivateFeature(feature)) return feature;
  return allowed && visible ? feature : null;
}
