import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Map as MapboxMap } from "mapbox-gl";
import type { RefObject } from "react";

const reactHarness = vi.hoisted(() => {
  const refs: { current: unknown }[] = [];
  const states: unknown[] = [];
  let cursor = 0;

  return {
    resetRender: () => { cursor = 0; },
    useEffect: (effect: () => void | (() => void)) => { effect(); },
    useRef: <T,>(initial: T) => {
      const index = cursor++;
      return (refs[index] ??= { current: initial }) as { current: T };
    },
    useState: <T,>(initial: T) => {
      const index = cursor++;
      states[index] ??= initial;
      return [states[index] as T, (value: T | ((current: T) => T)) => {
        states[index] = typeof value === "function"
          ? (value as (current: T) => T)(states[index] as T)
          : value;
      }] as const;
    },
  };
});

vi.mock("react", () => ({
  useEffect: reactHarness.useEffect,
  useRef: reactHarness.useRef,
  useState: reactHarness.useState,
}));

vi.mock("../useMapReadyTick", () => ({ useMapReadyTick: () => 0 }));
vi.mock("../../data/jpReligionLoader", () => ({
  fetchJpReligionWikidata: () => Promise.resolve({ type: "FeatureCollection", features: [] }),
}));

import { useJpReligionLayers } from "../useJpReligionLayers";

type CircleLayer = { id: string; type?: string; minzoom?: number; maxzoom?: number; paint: Record<string, unknown> };

function createMap() {
  const sources = new Set<string>();
  const layers = new Map<string, CircleLayer>();
  const setPaintProperty = vi.fn();

  const map = {
    getSource: (id: string) => sources.has(id) ? {} : undefined,
    addSource: (id: string) => { sources.add(id); },
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: CircleLayer) => { layers.set(layer.id, layer); },
    setLayoutProperty: vi.fn(),
    setPaintProperty,
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as MapboxMap;

  return { map, layers, setPaintProperty };
}

const visibility = {
  jpReligionGsi: true,
  jpReligionOsm: true,
  jpReligionWikidata: true,
};

const opacity = {
  jpReligionGsi: 0.6,
  jpReligionOsm: 0.75,
  jpReligionWikidata: 0.75,
};

describe("useJpReligionLayers scale", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { location: { href: "http://localhost/" } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("三層 radius 使用固定 M tier，且 scale 變更會更新 paint", async () => {
    const { map, layers, setPaintProperty } = createMap();
    const mapRef = { current: map } as RefObject<MapboxMap | null>;

    const render = (scale: {
      jpReligionGsi: number;
      jpReligionOsm: number;
      jpReligionWikidata: number;
    }) => {
      reactHarness.resetRender();
      useJpReligionLayers(mapRef, visibility, opacity, scale);
    };

    render({
      jpReligionGsi: 1,
      jpReligionOsm: 1.5,
      jpReligionWikidata: 2,
    });
    await Promise.resolve();
    await Promise.resolve();
    render({
      jpReligionGsi: 1,
      jpReligionOsm: 1.5,
      jpReligionWikidata: 2,
    });

    expect(layers.get("jp-religion-gsi-circle")?.paint["circle-radius"]).toBe(4.5);
    expect(layers.get("jp-religion-osm-circle")?.paint["circle-radius"]).toBe(6.75);
    expect(layers.get("jp-religion-wikidata-circle")?.paint["circle-radius"]).toBe(9);
    setPaintProperty.mockClear();
    render({
      jpReligionGsi: 2,
      jpReligionOsm: 0.5,
      jpReligionWikidata: 1.2,
    });

    expect(setPaintProperty).toHaveBeenCalledWith(
      "jp-religion-gsi-circle",
      "circle-radius",
      9,
    );
    expect(setPaintProperty).toHaveBeenCalledWith(
      "jp-religion-osm-circle",
      "circle-radius",
      2.25,
    );
    const wikidataRadiusCall = setPaintProperty.mock.calls.find(
      ([layerId, property]) => layerId === "jp-religion-wikidata-circle" && property === "circle-radius",
    );
    expect(wikidataRadiusCall?.[2]).toBeCloseTo(5.4);
  });

  it("GSI 拉遠改畫熱區（z<12）、點 z≥12；透明度滑桿同時改熱區，OSM 不受影響", () => {
    const { map, layers, setPaintProperty } = createMap();
    const mapRef = { current: map } as RefObject<MapboxMap | null>;
    const scale = { jpReligionGsi: 1, jpReligionOsm: 1, jpReligionWikidata: 1 };
    reactHarness.resetRender();
    useJpReligionLayers(mapRef, visibility, opacity, scale);

    const heat = layers.get("jp-religion-gsi-heatmap");
    expect(heat?.type).toBe("heatmap");
    expect(heat?.maxzoom).toBeCloseTo(12.01);
    expect(heat?.paint["heatmap-opacity"]).toBeCloseTo(0.8);
    expect(layers.get("jp-religion-gsi-circle")?.minzoom).toBe(12);
    expect(layers.get("jp-religion-osm-circle")?.minzoom).toBeUndefined();
    expect(layers.has("jp-religion-osm-heatmap")).toBe(false);

    setPaintProperty.mockClear();
    reactHarness.resetRender();
    useJpReligionLayers(mapRef, visibility, { ...opacity, jpReligionGsi: 0.3 }, scale);
    const heatCall = setPaintProperty.mock.calls.find(([id, prop]) => id === "jp-religion-gsi-heatmap" && prop === "heatmap-opacity");
    expect(heatCall?.[2]).toBeCloseTo(0.4);
  });
});
