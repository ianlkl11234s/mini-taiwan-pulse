import { useEffect, useRef } from "react";
import type { CircleLayer, GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { showTransientNotice } from "../components/TransientNotice";
import {
  GfwV4ShadowTracksLoader,
  isGfwV4ShadowRuntimeEnabled,
} from "../data/gfwV4ShadowTracksLoader";
import { buildTrackFrame } from "../gfw-v4-bench/frame";
import type { FrameHead, TrackBucket, TrackFrame, TrackPack, VesselMember } from "../gfw-v4-bench/types";
import {
  createGfwV4TrackCustomLayer,
  GFW_V4_TRACK_CUSTOM_LAYER_ID,
} from "../map/gfwV4TrackCustomLayer";
import { timeStore } from "../state/timeStore";
import { useMapReadyTick } from "./useMapReadyTick";

export const GFW_V4_TRACK_HIT_SOURCE_ID = "gfw-v4-shadow-track-hit-source";
export const GFW_V4_TRACK_HIT_LAYER_ID = "gfw-v4-shadow-track-hit";
export const GFW_V4_TRACK_CLICK_LAYERS = [GFW_V4_TRACK_HIT_LAYER_ID] as const;
export const GFW_V4_TRACK_BUDGET = Object.freeze({ maxHeads: 20_000, maxTrailVertices: 200_000 });

interface GfwV4ShadowState {
  enabled: boolean;
  status: "disabled" | "loading" | "ready" | "over-budget" | "error";
  displayDate: string | null;
  selectedEpoch: number | null;
  buckets: readonly TrackBucket[];
  visibleHeadGroups: number;
  visibleMembers: number;
  visibleTrailVertices: number;
  renderedHeadGroups: number;
  renderedTrailVertices: number;
  overBudgetHeads: number;
  overBudgetTrailVertices: number;
  transferBytes: number;
  fetchMs: number;
  decodeMs: number;
  assembleMs: number;
  cacheDays: number;
  cachePacks: number;
  error: string | null;
}

declare global {
  interface Window { readonly __GFW_V4_SHADOW_STATE__?: Readonly<GfwV4ShadowState> }
}

let shadowState: Readonly<GfwV4ShadowState> = Object.freeze({
  enabled: false, status: "disabled", displayDate: null, selectedEpoch: null, buckets: [],
  visibleHeadGroups: 0, visibleMembers: 0, visibleTrailVertices: 0,
  renderedHeadGroups: 0, renderedTrailVertices: 0, overBudgetHeads: 0, overBudgetTrailVertices: 0,
  transferBytes: 0, fetchMs: 0, decodeMs: 0, assembleMs: 0, cacheDays: 0, cachePacks: 0, error: null,
});

function publishShadowState(patch: Partial<GfwV4ShadowState>): void {
  shadowState = Object.freeze({ ...shadowState, ...patch });
  if (import.meta.env.DEV && (patch.status !== undefined || patch.error !== undefined)) {
    console.info(`[GFW v4 shadow tracks] ${JSON.stringify(shadowState)}`);
  }
  if (typeof window !== "undefined" && !("__GFW_V4_SHADOW_STATE__" in window)) {
    Object.defineProperty(window, "__GFW_V4_SHADOW_STATE__", { configurable: true, get: () => shadowState });
  }
}

export function getGfwV4ShadowState(): Readonly<GfwV4ShadowState> { return shadowState; }

export function gfwV4UtcDate(epoch: number): string { return new Date(epoch * 1_000).toISOString().slice(0, 10); }

/** Keep the global timeline clock-of-day while the one-day shadow POC is selected. */
export function gfwV4ShadowEpoch(epoch: number, displayDate: string): number {
  const source = new Date(epoch * 1_000);
  const start = Date.parse(`${displayDate}T00:00:00Z`) / 1_000;
  return start + source.getUTCHours() * 3_600 + source.getUTCMinutes() * 60 + source.getUTCSeconds();
}

function memberWire(member: VesselMember): Record<string, unknown> {
  const base = {
    vessel_id: member.vesselId, mmsi: member.mmsi, ship_name: member.shipName,
    vessel_type: member.vesselType, flag: member.flag,
  };
  const extended = [member.hours, member.entryTimestamp, member.exitTimestamp, member.imo, member.callsign,
    member.firstTransmissionDate, member.lastTransmissionDate, member.dataset, member.geartype];
  if (extended.every((value) => value === undefined)) return base;
  if (typeof member.hours !== "number" || !Number.isFinite(member.hours) || member.hours < 0 ||
    typeof member.entryTimestamp !== "string" || typeof member.exitTimestamp !== "string" ||
    !Number.isFinite(Date.parse(member.entryTimestamp)) || !Number.isFinite(Date.parse(member.exitTimestamp)) ||
    !/(?:Z|[+]00:00)$/.test(member.entryTimestamp) || !/(?:Z|[+]00:00)$/.test(member.exitTimestamp) ||
    member.imo === undefined || member.callsign === undefined || member.firstTransmissionDate === undefined ||
    member.lastTransmissionDate === undefined || member.dataset === undefined || member.geartype === undefined) {
    throw new Error(`GFW v4 popup member is neither legacy-5 nor complete-14: ${member.vesselId}`);
  }
  return {
    ...base, hours: member.hours, entry_timestamp: member.entryTimestamp, exit_timestamp: member.exitTimestamp,
    imo: member.imo, callsign: member.callsign,
    first_transmission_date: member.firstTransmissionDate, last_transmission_date: member.lastTransmissionDate,
    dataset: member.dataset, geartype: member.geartype,
  };
}

export function gfwV4HitCollection(
  heads: readonly FrameHead[],
  displayDate: string,
  selectedEpoch = Date.parse(`${displayDate}T00:00:00Z`) / 1_000,
  trailHours = 0.5,
): GeoJSON.FeatureCollection {
  const selectedTime = new Date(selectedEpoch * 1_000).toISOString();
  const startAt = new Date((selectedEpoch - Math.max(0.5, trailHours) * 3_600) * 1_000).toISOString();
  return {
    type: "FeatureCollection",
    features: heads.map((head, index) => ({
      type: "Feature",
      id: index,
      geometry: { type: "Point", coordinates: [head.lon, head.lat] },
      properties: (() => {
        const first = head.members[0];
        const vesselsJson = JSON.stringify(head.members.map(memberWire));
        const mixed = head.buckets.length > 1;
        return {
        source: "gfw-v4-shadow", display_date: displayDate,
        vessel_count: head.members.length, buckets: head.buckets.join(","),
        vessels_json: vesselsJson, members_json: vesselsJson,
        vessel_id: first?.vesselId ?? null, mmsi: first?.mmsi ?? null, ship_name: first?.shipName ?? null,
        vessel_type: first?.vesselType ?? null, flag: first?.flag ?? null,
        mixed_type: mixed ? 1 : 0, ship_type_bucket: mixed ? "mixed" : head.buckets[0] ?? "other",
        ship_type_label: mixed ? "混合船種 Mixed" : head.buckets[0] ?? "other",
        selected_time: selectedTime, start_at: startAt, end_at: selectedTime,
        point_count: 0, interpolated: 1, endpoint_grouped: 1,
        source_dataset: "public-global-presence", full_fidelity: 1,
        attribution_label: "Global Fishing Watch", attribution_href: "https://globalfishingwatch.org/",
      }; })(),
    })),
  };
}

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** DEV shadow only. Production builds and URLs without ?gfwV4Shadow=1 do nothing. */
export function useGfwV4ShadowTracksLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  visible: boolean,
  opacity: number,
  trailHours: number,
  enabledBuckets: readonly TrackBucket[],
  theme: "dark" | "light" | boolean,
): void {
  const runtimeEnabled = isGfwV4ShadowRuntimeEnabled(import.meta.env.DEV);
  const mapTick = useMapReadyTick(mapRef, visible && runtimeEnabled);
  const frameRef = useRef<TrackFrame | null>(null);
  const loaderRef = useRef<GfwV4ShadowTracksLoader | null>(null);
  const visibleRef = useRef(visible);
  const opacityRef = useRef(opacity);
  const themeRef = useRef(theme);
  visibleRef.current = visible;
  opacityRef.current = opacity;
  themeRef.current = theme;
  const bucketKey = enabledBuckets.join(",");

  useEffect(() => {
    if (!runtimeEnabled) return;
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer(GFW_V4_TRACK_HIT_LAYER_ID)) {
      map.setLayoutProperty(GFW_V4_TRACK_HIT_LAYER_ID, "visibility", visible ? "visible" : "none");
      map.setPaintProperty(GFW_V4_TRACK_HIT_LAYER_ID, "circle-opacity", Math.max(0, Math.min(1, opacity)));
    }
    map.triggerRepaint();
  }, [mapRef, mapTick, opacity, runtimeEnabled, theme, visible]);

  useEffect(() => {
    if (!runtimeEnabled) {
      publishShadowState({ enabled: false, status: "disabled" });
      return;
    }
    if (!visible) {
      publishShadowState({ enabled: true, status: "disabled" });
      return;
    }
    const map = mapRef.current;
    if (!map) return;
    const loader = loaderRef.current ??= new GfwV4ShadowTracksLoader();
    let disposed = false;
    let requestId = 0;
    let packs: TrackPack[] = [];
    let loadedDate: string | null = null;
    let loadKey = "";
    let customLayerOwned = false;
    let overBudgetNoticeKey = "";

    publishShadowState({ enabled: true, status: "loading", buckets: [...enabledBuckets], error: null });

    const setHitData = (data: GeoJSON.FeatureCollection) =>
      (map.getSource(GFW_V4_TRACK_HIT_SOURCE_ID) as GeoJSONSource | undefined)?.setData(data);

    const ensureMapLayers = () => {
      if (disposed) return;
      if (!map.getSource(GFW_V4_TRACK_HIT_SOURCE_ID)) {
        map.addSource(GFW_V4_TRACK_HIT_SOURCE_ID, {
          type: "geojson", data: EMPTY,
          attribution: '<a href="https://globalfishingwatch.org/" target="_blank" rel="noopener">Powered by Global Fishing Watch</a>',
        });
      }
      if (!map.getLayer(GFW_V4_TRACK_CUSTOM_LAYER_ID)) {
        map.addLayer(createGfwV4TrackCustomLayer({
          budget: GFW_V4_TRACK_BUDGET,
          getFrame: () => frameRef.current,
          getVisible: () => visibleRef.current,
          getOpacity: () => opacityRef.current,
          getTheme: () => themeRef.current,
          onRendered: (rendered) => {
            if (disposed || !loadedDate) return;
            try {
              const selectedEpoch = shadowState.selectedEpoch ?? Date.parse(`${loadedDate}T00:00:00Z`) / 1_000;
              setHitData(gfwV4HitCollection(rendered.heads, loadedDate, selectedEpoch, trailHours));
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              setHitData(EMPTY);
              publishShadowState({ status: "error", error: message });
              showTransientNotice(`GFW v4 popup contract 驗證失敗：${message}`);
            }
          },
        }));
        customLayerOwned = true;
      }
      if (!map.getLayer(GFW_V4_TRACK_HIT_LAYER_ID)) {
        map.addLayer({
          id: GFW_V4_TRACK_HIT_LAYER_ID,
          type: "circle",
          source: GFW_V4_TRACK_HIT_SOURCE_ID,
          paint: {
            "circle-radius": [
              "interpolate", ["linear"],
              ["sqrt", ["max", 1, ["to-number", ["get", "vessel_count"], 1]]],
              1, 2.4,
              2, 4,
              4, 6.5,
            ],
            "circle-color": [
              "match", ["get", "ship_type_bucket"],
              "cargo", "#39bff4",
              "tanker", "#ff8f43",
              "passenger", "#b3a0ff",
              "fishing", "#58d68d",
              "other", "#f0cc66",
              "#f5f1db",
            ],
            // 這份 source 本來就是完整 popup hit data；同時畫船頭不增加第二份 GeoJSON。
            "circle-opacity": Math.max(0, Math.min(1, opacityRef.current)),
            "circle-stroke-color": "#041316",
            "circle-stroke-width": 0.5,
            "circle-stroke-opacity": 0.7,
          },
          layout: { visibility: visibleRef.current ? "visible" : "none" },
        } as CircleLayer);
      }
    };

    const renderFrame = (rawEpoch: number) => {
      if (!loadedDate || disposed || !visibleRef.current) return;
      const selectedEpoch = gfwV4ShadowEpoch(rawEpoch, loadedDate);
      const frame = buildTrackFrame(packs, selectedEpoch, Math.max(0.5, trailHours) * 3_600, GFW_V4_TRACK_BUDGET);
      frameRef.current = frame;
      const overBudget = frame.overBudgetHeads > 0 || frame.overBudgetTrailVertices > 0;
      publishShadowState({
        status: overBudget ? "over-budget" : "ready", displayDate: loadedDate, selectedEpoch,
        visibleHeadGroups: frame.visibleHeadGroups, visibleMembers: frame.visibleMembers,
        visibleTrailVertices: frame.visibleTrailVertices, renderedHeadGroups: frame.renderedHeadGroups,
        renderedTrailVertices: frame.renderedTrailVertices, overBudgetHeads: frame.overBudgetHeads,
        overBudgetTrailVertices: frame.overBudgetTrailVertices,
      });
      if (overBudget) {
        const key = `${loadedDate}|${frame.overBudgetHeads}|${frame.overBudgetTrailVertices}`;
        if (key !== overBudgetNoticeKey) {
          overBudgetNoticeKey = key;
          showTransientNotice(`GFW v4 shadow 超出繪製預算：船位 +${frame.overBudgetHeads.toLocaleString()}、航跡頂點 +${frame.overBudgetTrailVertices.toLocaleString()}；已標記 FAIL，未靜默通過`);
        }
      }
      map.triggerRepaint();
    };

    const ensureDay = async (rawEpoch: number) => {
      try {
        const manifest = await loader.loadManifest();
        if (disposed) return;
        const requestedDate = gfwV4UtcDate(rawEpoch);
        const sortedDates = [...manifest.days.keys()].sort();
        const displayDate = manifest.days.has(requestedDate)
          ? requestedDate
          : sortedDates[sortedDates.length - 1] ?? null;
        if (!displayDate) throw new Error("GFW v4 shadow manifest has no day");
        const nextLoadKey = `${displayDate}|${bucketKey}`;
        if (nextLoadKey === loadKey) { renderFrame(rawEpoch); return; }
        loadKey = nextLoadKey;
        const id = ++requestId;
        publishShadowState({ status: "loading", displayDate, buckets: [...enabledBuckets], error: null });
        const result = await loader.loadDay(displayDate, enabledBuckets, "binary");
        if (disposed || id !== requestId) return;
        packs = result.packs;
        loadedDate = displayDate;
        publishShadowState({
          transferBytes: result.transferBytes, fetchMs: result.fetchMs, decodeMs: result.decodeMs,
          assembleMs: result.assembleMs, cacheDays: result.cacheDays, cachePacks: result.cachePacks,
        });
        renderFrame(rawEpoch);
      } catch (error) {
        if (disposed || (error instanceof DOMException && error.name === "AbortError")) return;
        const message = error instanceof Error ? error.message : String(error);
        frameRef.current = null;
        setHitData(EMPTY);
        publishShadowState({ status: "error", error: message });
        showTransientNotice(`GFW v4 shadow 載入失敗：${message}`);
      }
    };

    ensureMapLayers();
    const styleListener = () => { ensureMapLayers(); map.triggerRepaint(); };
    map.on("styledata", styleListener);
    const unsubscribe = timeStore.subscribeThrottled(100, (epoch) => void ensureDay(epoch));
    void ensureDay(timeStore.getTime());

    return () => {
      disposed = true;
      requestId += 1;
      unsubscribe();
      loader.abort();
      map.off("styledata", styleListener);
      frameRef.current = null;
      if (map.getLayer(GFW_V4_TRACK_HIT_LAYER_ID)) map.removeLayer(GFW_V4_TRACK_HIT_LAYER_ID);
      if (customLayerOwned && map.getLayer(GFW_V4_TRACK_CUSTOM_LAYER_ID)) map.removeLayer(GFW_V4_TRACK_CUSTOM_LAYER_ID);
      if (map.getSource(GFW_V4_TRACK_HIT_SOURCE_ID)) map.removeSource(GFW_V4_TRACK_HIT_SOURCE_ID);
    };
  }, [bucketKey, mapRef, mapTick, runtimeEnabled, trailHours, visible]);
}
