import { useEffect, useRef } from "react";
import type {
  CircleLayer,
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapboxMap,
} from "mapbox-gl";
import {
  loadMarineObservationFeatures,
  type MarineObservationFeatureCollection,
  type MarineSourceNetwork,
} from "../data/marineObservationLoader";
import { keepLoadingUntilMapIdle } from "../lib/loadingRegistry";
import { useMapReadyTick } from "./useMapReadyTick";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

interface MarineObservationLayerConfig {
  sourceId: string;
  glowLayerId: string;
  circleLayerId: string;
  refreshMs: number;
  loadingLabel: string;
}

/** Legend + Mapbox paint shared status palette. Fresh colors remain source-specific. */
export const MARINE_OBSERVATION_STATUS_STYLES = {
  fresh: {
    label: "新鮮",
    colors: { cwa: "#22d3ee", isohe: "#a78bfa" },
  },
  delayed: {
    label: "延遲",
    colors: { cwa: "#f59e0b", isohe: "#f59e0b" },
  },
  stale: {
    label: "過期或無最新觀測",
    colors: { cwa: "#64748b", isohe: "#64748b" },
  },
  abnormal: {
    label: "來源狀態異常",
    colors: { cwa: "#ef4444", isohe: "#ef4444" },
  },
} as const;

const NETWORK_CONFIG: Record<MarineSourceNetwork, MarineObservationLayerConfig> = {
  cwa: {
    sourceId: "marine-observation-cwa",
    glowLayerId: "marine-observation-cwa-glow",
    circleLayerId: "marine-observation-cwa-circle",
    // CWA 約每小時更新；不要套用 ISOHE 的 10 分鐘 freshness 門檻。
    refreshMs: 60 * 60 * 1000,
    loadingLabel: "CWA 海洋觀測站渲染中",
  },
  isohe: {
    sourceId: "marine-observation-isohe",
    glowLayerId: "marine-observation-isohe-glow",
    circleLayerId: "marine-observation-isohe-circle",
    // ISOHE 約每 10 分鐘更新，延遲與過期門檻獨立於 CWA。
    refreshMs: 10 * 60 * 1000,
    loadingLabel: "ISOHE 港區海氣象站渲染中",
  },
};

export const MARINE_OBSERVATION_CLICK_LAYERS = [
  NETWORK_CONFIG.cwa.circleLayerId,
  NETWORK_CONFIG.isohe.circleLayerId,
] as const;

const HEALTHY_STATUSES = [
  // CWA station registry uses the upstream numeric flag as text: 1=現存、0=撤站/停用。
  "1",
  "active",
  "online",
  "operational",
  "ok",
  "normal",
  "available",
  "enabled",
  "現存測站",
  "現存",
  "正常",
  "運作中",
] as const;

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

/**
 * Keep `zoom` as the direct input of the top-level interpolate. Mapbox rejects
 * otherwise plausible expressions such as `["*", ["interpolate", ..., ["zoom"]], scale]`.
 */
export function marineObservationRadiusExpression(
  scale = 1,
): ExpressionSpecification {
  return [
    "interpolate", ["linear"], ["zoom"],
    5, 2.4 * scale,
    8, 3.6 * scale,
    12, 5.2 * scale,
    16, 7.2 * scale,
  ] as unknown as ExpressionSpecification;
}

function abnormalPropertyStatusExpression(property: "sourceStatus" | "latestSourceStatus"): ExpressionSpecification {
  return [
    "all",
    ["has", property],
    ["!=", ["to-string", ["get", property]], ""],
    [
      "!",
      [
        "in",
        ["downcase", ["to-string", ["get", property]]],
        ["literal", HEALTHY_STATUSES],
      ],
    ],
  ] as unknown as ExpressionSpecification;
}

function unavailableStatusExpression(): ExpressionSpecification {
  // Empty/null status is common in ISOHE and stays neutral; an explicit non-healthy value wins
  // over freshness. Station metadata and the latest observation status are both respected.
  return [
    "any",
    abnormalPropertyStatusExpression("sourceStatus"),
    abnormalPropertyStatusExpression("latestSourceStatus"),
  ] as unknown as ExpressionSpecification;
}

/** Station health is derived from source status and station-level freshness, never a metric value. */
export function marineObservationColorExpression(
  sourceNetwork: MarineSourceNetwork,
): ExpressionSpecification {
  return [
    "case",
    unavailableStatusExpression(), MARINE_OBSERVATION_STATUS_STYLES.abnormal.colors[sourceNetwork],
    ["in", ["get", "freshnessStatus"], ["literal", ["missing", "stale"]]], MARINE_OBSERVATION_STATUS_STYLES.stale.colors[sourceNetwork],
    ["==", ["get", "freshnessStatus"], "delayed"], MARINE_OBSERVATION_STATUS_STYLES.delayed.colors[sourceNetwork],
    MARINE_OBSERVATION_STATUS_STYLES.fresh.colors[sourceNetwork],
  ] as unknown as ExpressionSpecification;
}

function marineObservationOpacityExpression(
  opacity: number,
): ExpressionSpecification {
  const base = clampOpacity(opacity);
  return [
    "case",
    unavailableStatusExpression(), base * 0.55,
    ["==", ["get", "freshnessStatus"], "missing"], base * 0.5,
    ["==", ["get", "freshnessStatus"], "stale"], base * 0.55,
    base,
  ] as unknown as ExpressionSpecification;
}

export function marineObservationCircleLayers(
  sourceNetwork: MarineSourceNetwork,
  opacity = 0.85,
): readonly CircleLayer[] {
  const config = NETWORK_CONFIG[sourceNetwork];
  const color = marineObservationColorExpression(sourceNetwork);
  const pointOpacity = marineObservationOpacityExpression(opacity);
  return [
    {
      id: config.glowLayerId,
      type: "circle",
      source: config.sourceId,
      layout: { visibility: "none" },
      paint: {
        "circle-radius": marineObservationRadiusExpression(1.85),
        "circle-color": color,
        "circle-opacity": marineObservationOpacityExpression(opacity * 0.24),
        "circle-blur": 0.75,
      },
    } as CircleLayer,
    {
      id: config.circleLayerId,
      type: "circle",
      source: config.sourceId,
      layout: { visibility: "none" },
      paint: {
        "circle-radius": marineObservationRadiusExpression(),
        "circle-color": color,
        "circle-opacity": pointOpacity,
        "circle-stroke-color": "rgba(255,255,255,0.9)",
        "circle-stroke-width": [
          "interpolate", ["linear"], ["zoom"],
          5, 0.35,
          10, 0.65,
          15, 1,
        ] as unknown as ExpressionSpecification,
        "circle-stroke-opacity": clampOpacity(opacity),
      },
    } as CircleLayer,
  ];
}

/** Mapbox queryRenderedFeatures only guarantees scalar properties. */
export function marineObservationMapboxData(
  data: MarineObservationFeatureCollection,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: data.features.map((feature) => ({
      ...feature,
      properties: Object.fromEntries(
        Object.entries(feature.properties ?? {}).map(([key, value]) => [
          key,
          value != null && typeof value === "object" ? JSON.stringify(value) : value,
        ]),
      ),
    })),
  };
}

function ensureLayers(
  map: MapboxMap,
  sourceNetwork: MarineSourceNetwork,
  opacity: number,
  data: GeoJSON.FeatureCollection,
): void {
  const config = NETWORK_CONFIG[sourceNetwork];
  if (!map.getSource(config.sourceId)) {
    map.addSource(config.sourceId, {
      type: "geojson",
      data,
      attribution: sourceNetwork === "cwa" ? "中央氣象署 CWA" : "ISOHE 港區海氣象開放資料",
    });
  }
  for (const layer of marineObservationCircleLayers(sourceNetwork, opacity)) {
    if (!map.getLayer(layer.id)) map.addLayer(layer);
  }
}

function setLayerVisibility(
  map: MapboxMap,
  sourceNetwork: MarineSourceNetwork,
  visible: boolean,
): void {
  const config = NETWORK_CONFIG[sourceNetwork];
  for (const id of [config.glowLayerId, config.circleLayerId]) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  }
}

function updatePaint(
  map: MapboxMap,
  sourceNetwork: MarineSourceNetwork,
  opacity: number,
): void {
  const config = NETWORK_CONFIG[sourceNetwork];
  if (map.getLayer(config.glowLayerId)) {
    map.setPaintProperty(
      config.glowLayerId,
      "circle-opacity",
      marineObservationOpacityExpression(opacity * 0.24),
    );
  }
  if (map.getLayer(config.circleLayerId)) {
    map.setPaintProperty(
      config.circleLayerId,
      "circle-opacity",
      marineObservationOpacityExpression(opacity),
    );
    map.setPaintProperty(config.circleLayerId, "circle-stroke-opacity", clampOpacity(opacity));
  }
}

/** Shared source-specific factory hook. CWA and ISOHE retain independent sources and refresh clocks. */
export function useMarineObservationLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  sourceNetwork: MarineSourceNetwork,
  visible: boolean,
  opacity = 0.85,
): void {
  const config = NETWORK_CONFIG[sourceNetwork];
  const mapTick = useMapReadyTick(mapRef, visible);
  const dataRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const refresh = async () => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const loaded = await loadMarineObservationFeatures(sourceNetwork);
        if (cancelled) return;
        const data = marineObservationMapboxData(loaded);
        dataRef.current = data;
        const map = mapRef.current;
        const source = map?.getSource(config.sourceId) as GeoJSONSource | undefined;
        if (map && source) {
          source.setData(data);
          keepLoadingUntilMapIdle(
            map,
            `marine-observation-${sourceNetwork}-render`,
            config.loadingLabel,
            config.sourceId,
          );
        }
      } catch (error) {
        console.warn(`[MarineObservation:${sourceNetwork}] load failed`, error);
      } finally {
        loadingRef.current = false;
      }
    };

    void refresh();
    const timer = window.setInterval(refresh, config.refreshMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [config.loadingLabel, config.refreshMs, config.sourceId, mapRef, mapTick, sourceNetwork, visible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // 關閉必須立即 soft-hide；style busy 時 isStyleLoaded() 也可能是 false。
    if (!visible) {
      try { setLayerVisibility(map, sourceNetwork, false); } catch { /* map style 正在切換 */ }
      return;
    }

    const mount = () => {
      if (!map.isStyleLoaded()) return;
      ensureLayers(map, sourceNetwork, opacity, dataRef.current ?? EMPTY);
      const source = map.getSource(config.sourceId) as GeoJSONSource | undefined;
      if (source && dataRef.current) source.setData(dataRef.current);
      updatePaint(map, sourceNetwork, opacity);
      setLayerVisibility(map, sourceNetwork, true);
    };

    mount();
    map.on("style.load", mount);
    return () => { map.off("style.load", mount); };
  }, [config.sourceId, mapRef, mapTick, opacity, sourceNetwork, visible]);
}

/** One stable host-facing hook for the two independently toggleable source networks. */
export function useMarineObservationLayers(
  mapRef: React.RefObject<MapboxMap | null>,
  cwaVisible: boolean,
  isoheVisible: boolean,
  cwaOpacity = 0.85,
  isoheOpacity = 0.85,
): void {
  useMarineObservationLayer(mapRef, "cwa", cwaVisible, cwaOpacity);
  useMarineObservationLayer(mapRef, "isohe", isoheVisible, isoheOpacity);
}
