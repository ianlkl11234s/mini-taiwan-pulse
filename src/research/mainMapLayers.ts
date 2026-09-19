import type { MapBridge } from "../chat/types";

export function applyMainMapLayers(
  layers: Record<string, boolean>,
  known: ReadonlySet<string>,
  locked: ReadonlySet<string>,
  bridge: MapBridge,
): void {
  const entries = Object.entries(layers);
  // Validate the whole command before touching any existing switch.
  if (entries.length > 20 || entries.some(([key, on]) => !known.has(key) || typeof on !== "boolean" || (on && locked.has(key)))) {
    throw new Error("UNKNOWN_OR_LOCKED_LAYER");
  }
  for (const on of [false, true]) {
    const keys = entries.filter(([, value]) => value === on).map(([key]) => key);
    if (keys.length) bridge.bulkSetVisibility(keys, on);
  }
  const visible = new Set(bridge.getVisibleLayerKeys());
  if (entries.some(([key, on]) => visible.has(key) !== on)) throw new Error("LAYER_VISIBILITY_CONFLICT");
}

/** Keep tracked keys on manual camera changes; read current switches to avoid replaying stale values. */
export function captureLayerOverrides(previous: Record<string, boolean> | undefined, visibleKeys: string[]): Record<string, boolean> {
  const visible = new Set(visibleKeys);
  return Object.fromEntries(Object.keys(previous ?? {}).map(key => [key, visible.has(key)]));
}
