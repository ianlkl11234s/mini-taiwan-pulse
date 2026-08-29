export interface GfwHourlyGridVessel {
  vesselId: string;
  mmsi: string | null;
  shipName: string | null;
  vesselType: string | null;
  flag: string | null;
  /** v4 full-member fields. Undefined means the legacy v2/v3 five-field contract. */
  imo?: string | null;
  callsign?: string | null;
  dataset?: string | null;
  geartype?: string | null;
  firstTransmissionDate?: string | null;
  lastTransmissionDate?: string | null;
  hours?: number;
  entryTimestamp?: string;
  exitTimestamp?: string;
}

/** v4 0.1° polygon grid: vessel-count classes shared by Mapbox paint and legend. */
export const GFW_HOURLY_GRID_V4_COLOR_BANDS = [
  { min: 1, max: 1, label: "1 艘", color: "#7c2d12" },
  { min: 2, max: 3, label: "2–3 艘", color: "#9a3412" },
  { min: 4, max: 7, label: "4–7 艘", color: "#c2410c" },
  { min: 8, max: 15, label: "8–15 艘", color: "#ea580c" },
  { min: 16, max: 49, label: "16–49 艘", color: "#fb923c" },
  { min: 50, max: null, label: "50+ 艘", color: "#ffedd5" },
] as const;

/** Mapbox `step` stops: [2, 4, 8, 16, 50]. Keep in lockstep with the bands above. */
export const GFW_HOURLY_GRID_V4_FILL_COLOR_EXPRESSION = [
  "step", ["to-number", ["get", "vessel_count"], 1],
  GFW_HOURLY_GRID_V4_COLOR_BANDS[0].color,
  2, GFW_HOURLY_GRID_V4_COLOR_BANDS[1].color,
  4, GFW_HOURLY_GRID_V4_COLOR_BANDS[2].color,
  8, GFW_HOURLY_GRID_V4_COLOR_BANDS[3].color,
  16, GFW_HOURLY_GRID_V4_COLOR_BANDS[4].color,
  50, GFW_HOURLY_GRID_V4_COLOR_BANDS[5].color,
] as const;

export const GFW_HOURLY_GRID_V3_FILL_OPACITY = 0.24;

/** v4 polygon outline colour; kept here so the composed rgba expression stays in lockstep. */
export const GFW_HOURLY_GRID_V4_OUTLINE_COLOR = "#7c2d12";
export const GFW_HOURLY_GRID_V4_OUTLINE_OPACITY = 0.65;

/**
 * v4 polygon density remains continuously legible within the six colour classes.
 *
 * This expression is data-driven, so it must only ever appear inside a paint property that
 * is written **once** at addLayer time. mapbox-gl 3.18.1 returns `requiresRelayout = true`
 * from `StyleLayer.setPaintProperty` whenever the new *or* previous value is data-driven,
 * which forces a full source-cache reload (re-parse + re-tessellate of every loaded tile).
 * During playback that turns a per-tick opacity write into a per-tick relayout, so density
 * lives in the colour alpha channel and the per-tick multiplier stays a plain number.
 */
export const GFW_HOURLY_GRID_V4_DENSITY_OPACITY_EXPRESSION = [
  "interpolate", ["linear"], ["to-number", ["get", "vessel_count"], 1],
  1, 0.28,
  2, 0.34,
  4, 0.40,
  8, 0.47,
  16, 0.54,
  50, 0.62,
  200, 0.68,
  1161, 0.72,
] as const;

function hexChannel(hex: string, index: 0 | 1 | 2): number {
  return Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
}

/** Same `step` stops as the fill colour scale, split into one numeric channel for `rgba`. */
function bandChannelExpression(index: 0 | 1 | 2): unknown[] {
  return [
    "step", ["to-number", ["get", "vessel_count"], 1],
    hexChannel(GFW_HOURLY_GRID_V4_COLOR_BANDS[0].color, index),
    2, hexChannel(GFW_HOURLY_GRID_V4_COLOR_BANDS[1].color, index),
    4, hexChannel(GFW_HOURLY_GRID_V4_COLOR_BANDS[2].color, index),
    8, hexChannel(GFW_HOURLY_GRID_V4_COLOR_BANDS[3].color, index),
    16, hexChannel(GFW_HOURLY_GRID_V4_COLOR_BANDS[4].color, index),
    50, hexChannel(GFW_HOURLY_GRID_V4_COLOR_BANDS[5].color, index),
  ];
}

/**
 * Six-band colour scale with the density ramp folded into the alpha channel.
 *
 * Rendering is unchanged: mapbox-gl uploads paint colours premultiplied and both the fill
 * and line fragment shaders compute `out_color *= opacity`, so `rgba(R, G, B, density) *
 * multiplier` and `rgba(R, G, B, 1) * (multiplier * density)` produce the same pixel.
 */
export const GFW_HOURLY_GRID_V4_FILL_COLOR_WITH_DENSITY_EXPRESSION = [
  "rgba",
  bandChannelExpression(0),
  bandChannelExpression(1),
  bandChannelExpression(2),
  GFW_HOURLY_GRID_V4_DENSITY_OPACITY_EXPRESSION,
] as const;

export const GFW_HOURLY_GRID_V4_OUTLINE_COLOR_WITH_DENSITY_EXPRESSION = [
  "rgba",
  hexChannel(GFW_HOURLY_GRID_V4_OUTLINE_COLOR, 0),
  hexChannel(GFW_HOURLY_GRID_V4_OUTLINE_COLOR, 1),
  hexChannel(GFW_HOURLY_GRID_V4_OUTLINE_COLOR, 2),
  GFW_HOURLY_GRID_V4_DENSITY_OPACITY_EXPRESSION,
] as const;

/** One retained v4 PMTiles slot as seen by the playback planner. */
export interface GfwHourlyGridSlotReadiness {
  readonly sourceId: string;
  /** UTC hour currently mounted in this slot, or null when the slot is vacant. */
  readonly hour: string | null;
  /**
   * Sticky: the slot has completed at least one real tile load since it was mounted.
   *
   * This must NOT be derived from `map.isSourceLoaded` alone. `SourceCache.loaded()` returns
   * true whenever no tile request is outstanding — which includes the moment right after
   * `addSource`, before any tile has even been requested. Treating that as ready lets the
   * crossfade ramp a freshly mounted slot to full opacity while it still paints nothing.
   */
  readonly ready: boolean;
  /**
   * Live `map.isSourceLoaded`: false while the slot has tile requests in flight. A ready slot
   * keeps rendering its existing tiles during a reload, so this only downgrades a slot from
   * "crossfade into it" to "keep it as a fallback". Undefined means unknown → treated as true.
   */
  readonly loaded?: boolean;
}

/** Half-open `[startMs, endMsExclusive)` span actually covered by the release. */
export interface GfwHourlyGridDataWindow {
  readonly startMs: number;
  readonly endMsExclusive: number;
}

export interface GfwHourlyGridPlaybackInput {
  readonly timeSeconds: number;
  readonly slots: readonly GfwHourlyGridSlotReadiness[];
  /** Manifest-backed hour for `floor(timeSeconds)`, or null when the release has no such hour. */
  readonly currentHour: string | null;
  readonly nextHour: string | null;
  readonly dataWindow: GfwHourlyGridDataWindow | null;
  readonly fadeSeconds?: number;
}

export interface GfwHourlyGridPlaybackPlan {
  /** sourceId → 0..1 weight, before the user opacity slider is applied. */
  readonly weights: ReadonlyMap<string, number>;
  readonly dominantHour: string | null;
  /** Hour whose slot must survive slot rotation because it is the only thing on screen. */
  readonly retainHour: string | null;
  readonly dataWindowStatus: "in-window" | "out-of-window";
  readonly windowFade: number;
  readonly holding: boolean;
}

/**
 * Timeline seconds over which the layer fades out once the timeline leaves the release
 * window. Deliberately expressed in timeline time (not wall clock) so the plan stays a pure
 * function of the tick; tune here if the fade reads too slow at 1x.
 */
export const GFW_HOURLY_GRID_V4_WINDOW_FADE_SECONDS = 900;

function hourMs(hour: string | null): number {
  return hour === null ? Number.NaN : Date.parse(hour);
}

/**
 * Decide, for one timeline tick, which retained slot is visible and at what weight.
 *
 * Two behaviours beyond a plain crossfade:
 * - **hold-last-ready**: when playback overtakes loading and the current hour has not
 *   produced its first tile yet, the newest already-ready hour stays on screen instead of
 *   the layer blanking. `retainHour` tells the slot rotation not to recycle it.
 * - **data window**: outside the release's own hours the layer fades to hidden rather than
 *   snapping to invisible. Layer-local only — the global timeline is never clamped.
 */
export function planGfwHourlyGridPlayback(input: GfwHourlyGridPlaybackInput): GfwHourlyGridPlaybackPlan {
  const fadeSeconds = input.fadeSeconds ?? GFW_HOURLY_GRID_V4_WINDOW_FADE_SECONDS;
  const hourSeconds = Math.floor(input.timeSeconds / 3600) * 3600;
  const progress = Math.max(0, Math.min(1, (input.timeSeconds - hourSeconds) / 3600));
  const timelineHourMs = hourSeconds * 1000;
  const timeMs = input.timeSeconds * 1000;

  const window = input.dataWindow;
  const inWindow = !window || (timeMs >= window.startMs && timeMs < window.endMsExclusive);
  let windowFade = 1;
  if (window && !inWindow) {
    const beyondMs = timeMs < window.startMs ? window.startMs - timeMs : timeMs - window.endMsExclusive;
    windowFade = fadeSeconds > 0 ? Math.max(0, Math.min(1, 1 - beyondMs / (fadeSeconds * 1000))) : 0;
  }

  const weights = new Map<string, number>();
  for (const slot of input.slots) weights.set(slot.sourceId, 0);
  // `ready` means "has real content"; `renderable` additionally means "not mid-reload".
  // Only a renderable slot may be crossfaded into — fading toward a slot whose tiles are
  // still in flight is exactly how the layer ends up at full opacity over nothing.
  const isRenderable = (slot: GfwHourlyGridSlotReadiness) => slot.ready && slot.loaded !== false;
  const slotFor = (hour: string | null, predicate: (slot: GfwHourlyGridSlotReadiness) => boolean) =>
    hour === null ? undefined : input.slots.find((slot) => slot.hour === hour && predicate(slot));

  const currentSlot = slotFor(input.currentHour, isRenderable);
  const nextSlot = slotFor(input.nextHour, isRenderable);
  let dominantHour: string | null = null;
  let retainHour: string | null = null;
  let holding = false;

  if (currentSlot) {
    weights.set(currentSlot.sourceId, nextSlot ? 1 - progress : 1);
    if (nextSlot) weights.set(nextSlot.sourceId, progress);
    dominantHour = nextSlot && progress >= 0.5 ? input.nextHour : input.currentHour;
  } else {
    // Playback overtook loading (or the timeline left the release window): keep the newest
    // renderable hour that is not in the future rather than showing nothing.
    let held: GfwHourlyGridSlotReadiness | null = null;
    for (const slot of input.slots) {
      if (!isRenderable(slot) || slot.hour === null) continue;
      const ms = hourMs(slot.hour);
      if (!Number.isFinite(ms) || ms > timelineHourMs) continue;
      if (!held || hourMs(held.hour) < ms) held = slot;
    }
    // Nothing renderable behind us: a current slot that merely reloads still paints its
    // existing tiles, so it beats blanking the layer.
    const reloadingCurrent = held ? null : slotFor(input.currentHour, (slot) => slot.ready);
    if (reloadingCurrent) {
      weights.set(reloadingCurrent.sourceId, nextSlot ? 1 - progress : 1);
      if (nextSlot) weights.set(nextSlot.sourceId, progress);
      dominantHour = nextSlot && progress >= 0.5 ? input.nextHour : input.currentHour;
    } else if (held) {
      weights.set(held.sourceId, 1);
      dominantHour = held.hour;
      retainHour = held.hour;
      holding = true;
    } else if (input.currentHour === null && nextSlot) {
      // Leading edge of the window: H is missing entirely, H+1 already covers the screen.
      weights.set(nextSlot.sourceId, 1);
      dominantHour = input.nextHour;
    } else {
      // Nothing ready yet at all. The current slot stays fully painted so a slot that never
      // reports readiness cannot deadlock the layer into permanent invisibility.
      const mounted = input.slots.find((slot) => slot.hour !== null && slot.hour === input.currentHour);
      if (mounted) {
        weights.set(mounted.sourceId, 1);
        dominantHour = input.currentHour;
      }
    }
  }

  if (windowFade !== 1) {
    for (const [sourceId, weight] of weights) weights.set(sourceId, weight * windowFade);
    // Fully faded out means nothing is on screen, so nothing may claim clicks either.
    if (windowFade === 0) dominantHour = null;
  }

  return {
    weights,
    dominantHour,
    retainHour,
    dataWindowStatus: inWindow ? "in-window" : "out-of-window",
    windowFade,
    holding,
  };
}

/** Popup-facing wire contract: the parser intentionally accepts producer-style snake_case only. */
export function serializeGfwHourlyGridVessels(vessels: readonly GfwHourlyGridVessel[]): string {
  return JSON.stringify(vessels.map((vessel) => ({
    vessel_id: vessel.vesselId,
    mmsi: vessel.mmsi,
    ship_name: vessel.shipName,
    vessel_type: vessel.vesselType,
    flag: vessel.flag,
    ...(vessel.imo !== undefined ? { imo: vessel.imo } : {}),
    ...(vessel.callsign !== undefined ? { callsign: vessel.callsign } : {}),
    ...(vessel.dataset !== undefined ? { dataset: vessel.dataset } : {}),
    ...(vessel.geartype !== undefined ? { geartype: vessel.geartype } : {}),
    ...(vessel.firstTransmissionDate !== undefined ? { first_transmission_date: vessel.firstTransmissionDate } : {}),
    ...(vessel.lastTransmissionDate !== undefined ? { last_transmission_date: vessel.lastTransmissionDate } : {}),
    ...(vessel.hours !== undefined ? { hours: vessel.hours } : {}),
    ...(vessel.entryTimestamp !== undefined ? { entry_timestamp: vessel.entryTimestamp } : {}),
    ...(vessel.exitTimestamp !== undefined ? { exit_timestamp: vessel.exitTimestamp } : {}),
  })));
}

function optionalString(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" ? value : undefined;
}

function utcTimestamp(value: unknown): value is string {
  return typeof value === "string" && /(?:Z|[+]00:00)$/.test(value) && Number.isFinite(Date.parse(value));
}

export function parseGfwHourlyGridVessels(raw: unknown): GfwHourlyGridVessel[] | null {
  let decoded: unknown = raw;
  if (typeof raw === "string") {
    try { decoded = JSON.parse(raw); } catch { return null; }
  }
  if (!Array.isArray(decoded)) return null;
  const vessels: GfwHourlyGridVessel[] = [];
  for (const item of decoded) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return null;
    const o = item as Record<string, unknown>;
    const vesselId = optionalString(o.vessel_id);
    const mmsi = optionalString(o.mmsi);
    const shipName = optionalString(o.ship_name);
    const vesselType = optionalString(o.vessel_type);
    const flag = optionalString(o.flag);
    if (!vesselId || mmsi === undefined || shipName === undefined || vesselType === undefined || flag === undefined) return null;
    const vessel: GfwHourlyGridVessel = { vesselId, mmsi, shipName, vesselType, flag };
    const extendedKeys = [
      "imo", "callsign", "dataset", "geartype", "first_transmission_date",
      "last_transmission_date", "hours", "entry_timestamp", "exit_timestamp",
    ];
    if (extendedKeys.some((key) => key in o)) {
      if (!extendedKeys.every((key) => key in o)) return null;
      const imo = optionalString(o.imo);
      const callsign = optionalString(o.callsign);
      const dataset = optionalString(o.dataset);
      const geartype = optionalString(o.geartype);
      const firstTransmissionDate = optionalString(o.first_transmission_date);
      const lastTransmissionDate = optionalString(o.last_transmission_date);
      if (
        imo === undefined || callsign === undefined || dataset === undefined || geartype === undefined ||
        firstTransmissionDate === undefined || lastTransmissionDate === undefined ||
        typeof o.hours !== "number" || !Number.isFinite(o.hours) || o.hours < 0 ||
        !utcTimestamp(o.entry_timestamp) || !utcTimestamp(o.exit_timestamp) ||
        (firstTransmissionDate !== null && !utcTimestamp(firstTransmissionDate)) ||
        (lastTransmissionDate !== null && !utcTimestamp(lastTransmissionDate))
      ) return null;
      Object.assign(vessel, {
        imo, callsign, dataset, geartype, firstTransmissionDate, lastTransmissionDate,
        hours: o.hours, entryTimestamp: o.entry_timestamp, exitTimestamp: o.exit_timestamp,
      });
    }
    vessels.push(vessel);
  }
  return vessels;
}
