import { describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { RefObject } from "react";

const harness = vi.hoisted(() => {
  let cursor = 0;
  const states: unknown[] = [];
  const cleanups: Array<() => void> = [];
  return {
    begin: () => { cursor = 0; },
    cleanup: () => { cleanups.splice(0).reverse().forEach((fn) => fn()); states.length = 0; cursor = 0; },
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
let runtime = { status: "ready", revision: 1 };
const aggregate = { type: "FeatureCollection", features: [
  { type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 0]]] }, properties: {
    grid_id: "J10000_0_0", grid_size_m: 10_000, grid_crs: "EPSG:6933", aggregate_schema: "category_columns_v1",
    mapped_point_count: 5, hospital_count: 2, clinic_count: 3, dental_count: 0, maternity_count: 0, pharmacy_count: 0,
  } },
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
  const layers = new Map<string, { id: string; type?: string; minzoom?: number }>();
  const addSource = vi.fn((id: string, config: { data?: unknown }) => sources.set(id, { data: config.data, setData: vi.fn() }));
  const map = {
    getZoom: () => zoom, getSource: (id: string) => sources.get(id), addSource, removeSource: (id: string) => sources.delete(id),
    getLayer: (id: string) => layers.get(id), addLayer: (layer: { id: string; type?: string; minzoom?: number }) => layers.set(layer.id, layer), removeLayer: (id: string) => layers.delete(id),
    setLayerZoomRange: vi.fn(), setLayoutProperty: vi.fn(), setPaintProperty: vi.fn(), on: vi.fn(), off: vi.fn(),
  } as unknown as MapboxMap;
  return { map, sources, layers, addSource };
}
const off = { jpMedicalHospitals: false, jpMedicalClinics: false, jpMedicalDental: false, jpMedicalMaternity: false, jpMedicalPharmacies: false, jpCarePlanning: false, jpCareHomeVisit: false, jpCareDayServices: false, jpCareResidential: false, jpCareCombined: false, jpCareEquipment: false, jpMedicalAreasPrimary: false, jpMedicalAreasSecondary: false, jpMedicalAreasTertiary: false };
const params: Record<string, number> = {};

describe("useJpMedicalLayers lifecycle", () => {
  it("renders density polygons below zoom 8 and removes owned sources on All Off/unmount", async () => {
    const view = mapAt(4); const ref = { current: view.map } as RefObject<MapboxMap | null>;
    runtime = { ...runtime, revision: 2 };
    harness.begin(); useJpMedicalLayers(ref, { ...off, jpMedicalHospitals: true, jpMedicalClinics: true }, params);
    await Promise.resolve(); harness.begin(); useJpMedicalLayers(ref, { ...off, jpMedicalHospitals: true, jpMedicalClinics: true }, params);
    expect(view.sources.has("jp-medical-facilities")).toBe(false);
    expect(view.sources.has("jp-medical-facilities-aggregate")).toBe(true);
    const grid = view.sources.get("jp-medical-facilities-aggregate")?.data as GeoJSON.FeatureCollection;
    expect(grid.features[0]?.geometry.type).toBe("Polygon");
    expect(grid.features[0]?.properties).toMatchObject({ aggregate_count: 5, geometry_role: "EQUAL_AREA_GRID_CELL" });
    expect(view.layers.get("jp-medical-facilities-aggregate-fill")?.type).toBe("fill");
    expect(view.layers.get("jp-medical-facilities-aggregate-outline")?.type).toBe("line");
    const addCount = view.addSource.mock.calls.length;
    harness.begin(); useJpMedicalLayers(ref, { ...off, jpMedicalHospitals: true }, params);
    expect(view.addSource).toHaveBeenCalledTimes(addCount);

    runtime = { ...runtime, revision: 3 };
    harness.begin(); useJpMedicalLayers(ref, { ...off, jpMedicalHospitals: true }, params);
    await Promise.resolve(); harness.begin(); useJpMedicalLayers(ref, { ...off, jpMedicalHospitals: true }, params);
    expect(view.sources.has("jp-medical-facilities-aggregate")).toBe(true);

    harness.begin(); useJpMedicalLayers(ref, off, params);
    expect(view.sources.has("jp-medical-facilities-aggregate")).toBe(false);
    harness.cleanup();
    expect(view.sources.size).toBe(0);
  });

  it("switches to complete categorized points at zoom 8 and above", async () => {
    const view = mapAt(9); const ref = { current: view.map } as RefObject<MapboxMap | null>;
    runtime = { ...runtime, revision: 4 };
    harness.begin(); useJpMedicalLayers(ref, { ...off, jpMedicalHospitals: true }, params);
    await Promise.resolve(); harness.begin(); useJpMedicalLayers(ref, { ...off, jpMedicalHospitals: true }, params);
    expect(view.sources.has("jp-medical-facilities-aggregate")).toBe(false);
    expect(view.sources.has("jp-medical-facilities")).toBe(true);
    expect(view.layers.get("jp-medical-facilities-hospital")?.minzoom).toBe(8);
    expect((view.map.setLayerZoomRange as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("jp-medical-facilities-hospital", 8, 24);
    harness.cleanup();
  });
});
