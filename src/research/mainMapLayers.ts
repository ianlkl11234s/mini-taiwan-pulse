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

/**
 * Split a scene's desired layers into the ones this map can apply and the ignored keys
 * (unknown, or locked while requested on). The gateway merges every acked patch into the
 * study scene and each later command renders that merged scene, so one bad key (e.g.
 * `bus` instead of `busLive`) used to fail every subsequent command. Inherited bad keys are
 * skipped; only keys sent by the current command count as `rejected` for that command.
 */
export function planMainMapLayers(
  layers: Record<string, boolean> | undefined,
  patchLayers: Record<string, boolean> | undefined,
  known: ReadonlySet<string>,
  locked: ReadonlySet<string>,
): { usable: Record<string, boolean>; ignored: string[]; rejected: string[] } {
  const usable: Record<string, boolean> = {};
  const ignored: string[] = [];
  for (const [key, on] of Object.entries(layers ?? {})) {
    if (known.has(key) && typeof on === "boolean" && !(on && locked.has(key))) usable[key] = on;
    else ignored.push(key);
  }
  const rejected = ignored.filter(key => patchLayers !== undefined && Object.prototype.hasOwnProperty.call(patchLayers, key));
  return { usable, ignored, rejected };
}

/** Keep tracked keys on manual camera changes; read current switches to avoid replaying stale values. */
export function captureLayerOverrides(previous: Record<string, boolean> | undefined, visibleKeys: string[]): Record<string, boolean> {
  const visible = new Set(visibleKeys);
  return Object.fromEntries(Object.keys(previous ?? {}).map(key => [key, visible.has(key)]));
}
