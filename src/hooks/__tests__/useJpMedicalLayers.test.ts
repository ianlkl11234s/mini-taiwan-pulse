import { describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { RefObject } from "react";

const harness = vi.hoisted(() => {
  let cursor = 0;
  const states: unknown[] = [];
  const cleanups: Array<() => void> = [];
  return {
    begin: () => { cursor = 0; },
    cleanup: () => { cleanups.splice(0).reverse().forEach((fn) => fn()); },
    useState: <T,>(initial: T | (() => T)) => {
      const index = cursor++;
      states[index] ??= typeof initial === "function" ? (initial as () => T)() : initial;
      return [states[index] as T, (value: T) => { states[index] = value; }] as const;
    },
    useRef: <T,>(value: T) => { cursor++; return { current: value }; },
    useEffect: (effect: () => void | (() => void)) => { cursor++; const cleanup = effect(); if (cleanup) cleanups.push(cleanup); },
    useSyncExternalStore: () => { cursor++; return runtime; },
  };
});
let runtime = { status: "ready", revision: 1, displayMode: "adaptive" as "adaptive" | "points" };
const aggregate = { type: "FeatureCollection", features: [
  { type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 0]]] }, properties: { grid_id: "6/0/0", record_kind: "hospital", mapped_point_count: 2 } },
  { type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 0]]] }, properties: { grid_id: "6/0/0", record_kind: "clinic", mapped_point_count: 3 } },
] } as unknown as GeoJSON.FeatureCollection;
vi.mock("react", () => harness);
vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../map/pmtilesSourceType", () => ({ registerPmtilesSourceTypeOnce: vi.fn() }));
vi.mock("../../lib/loadingRegistry", () => ({ keepLoadingUntilMapIdle: vi.fn() }));
vi.mock("../../data/jpMedicalLoader", () => ({
  getJpMedicalRuntime: () => runtime, subscribeJpMedicalRuntime: () => () => {}, reportJpMedicalError: vi.fn(),
  jpMedicalLayerAsset: vi.fn(async () => ({ url: "http://assets/points.pmtiles", asset: { source_layer: "points", minimum_point_zoom: 0 } })),
  fetchJpMedicalAggregate: vi.fn(async () => aggregate),
}));
import { useJpMedicalLayers } from "../useJpMedicalLayers";

function mapAt(zoom: number) {
  const sources = new Map<string, { data?: unknown; setData: ReturnType<typeof vi.fn> }>();
  const layers = new Map<string, { id: string; minzoom?: number }>();
  const addSource = vi.fn((id: string, config: { data?: unknown }) => sources.set(id, { data: config.data, setData: vi.fn() }));
  const map = {
    getZoom: () => zoom, getSource: (id: string) => sources.get(id), addSource, removeSource: (id: string) => sources.delete(id),
    getLayer: (id: string) => layers.get(id), addLayer: (layer: { id: string; minzoom?: number }) => layers.set(layer.id, layer), removeLayer: (id: string) => layers.delete(id),
    setLayerZoomRange: vi.fn(), setLayoutProperty: vi.fn(), setPaintProperty: vi.fn(), on: vi.fn(), off: vi.fn(),
  } as unknown as MapboxMap;
  return { map, sources, layers, addSource };
}
const off = { jpMedicalHospitals: false, jpMedicalClinics: false, jpMedicalDental: false, jpMedicalMaternity: false, jpMedicalPharmacies: false, jpCarePlanning: false, jpCareHomeVisit: false, jpCareDayServices: false, jpCareResidential: false, jpCareCombined: false, jpCareEquipment: false, jpMedicalAreasPrimary: false, jpMedicalAreasSecondary: false, jpMedicalAreasTertiary: false };
const params: Record<string, number> = {};

describe("useJpMedicalLayers lifecycle", () => {
  it("uses source-specific zoom modes and removes owned sources on All Off/unmount", async () => {
    const view = mapAt(4); const ref = { current: view.map } as RefObject<MapboxMap | null>;
    runtime = { ...runtime, displayMode: "points", revision: 1 };
    harness.begin(); useJpMedicalLayers(ref, { ...off, jpMedicalHospitals: true, jpMedicalClinics: true }, params);
    await Promise.resolve(); harness.begin(); useJpMedicalLayers(ref, { ...off, jpMedicalHospitals: true }, params);
    expect(view.layers.get("jp-medical-facilities-hospital")?.minzoom).toBe(0);
    expect((view.map.setLayerZoomRange as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("jp-medical-facilities-hospital", 0, 24);
    expect(view.sources.has("jp-medical-facilities-aggregate")).toBe(false);

    runtime = { ...runtime, displayMode: "adaptive", revision: 2 };
    harness.begin(); useJpMedicalLayers(ref, { ...off, jpMedicalHospitals: true, jpMedicalClinics: true }, params);
    await Promise.resolve(); harness.begin(); useJpMedicalLayers(ref, { ...off, jpMedicalHospitals: true, jpMedicalClinics: true }, params);
    expect(view.sources.has("jp-medical-facilities")).toBe(false);
    expect(view.sources.has("jp-medical-facilities-aggregate")).toBe(true);
    expect((view.sources.get("jp-medical-facilities-aggregate")?.data as GeoJSON.FeatureCollection).features[0]?.properties?.aggregate_count).toBe(5);
    const addCount = view.addSource.mock.calls.length;
    harness.begin(); useJpMedicalLayers(ref, { ...off, jpMedicalHospitals: true }, params);
    expect(view.addSource).toHaveBeenCalledTimes(addCount);

    runtime = { ...runtime, revision: 3 };
    harness.begin(); useJpMedicalLayers(ref, { ...off, jpMedicalHospitals: true }, params);
    await Promise.resolve(); harness.begin(); useJpMedicalLayers(ref, { ...off, jpMedicalHospitals: true }, params);
    expect(view.sources.has("jp-medical-facilities-aggregate")).toBe(true);

    // Both families share grid centers: their family labels must not cover each other.
    const both = { ...off, jpMedicalHospitals: true, jpCarePlanning: true };
    harness.begin(); useJpMedicalLayers(ref, both, params);
    await Promise.resolve(); harness.begin(); useJpMedicalLayers(ref, both, params);
    expect(view.map.setLayoutProperty).toHaveBeenCalledWith("jp-medical-facilities-aggregate-count", "text-offset", [-28 / 12, 0]);
    expect(view.map.setLayoutProperty).toHaveBeenCalledWith("jp-medical-care-aggregate-count", "text-offset", [28 / 12, 0]);
    harness.begin(); useJpMedicalLayers(ref, { ...off, jpMedicalHospitals: true }, params);
    expect(view.map.setLayoutProperty).toHaveBeenLastCalledWith("jp-medical-facilities-aggregate-count", "text-offset", [0, 0]);
    expect(view.map.setPaintProperty).toHaveBeenLastCalledWith("jp-medical-facilities-aggregate-count", "text-opacity", 0.78);

    harness.begin(); useJpMedicalLayers(ref, off, params);
    expect(view.sources.has("jp-medical-facilities-aggregate")).toBe(false);
    harness.cleanup();
    expect(view.sources.size).toBe(0);
  });
});
