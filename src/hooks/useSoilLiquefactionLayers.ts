import { useEffect } from "react";
import type { Map as MapboxMap, RasterLayer } from "mapbox-gl";
import { useMapReadyTick } from "./useMapReadyTick";

export const SOIL_LIQUEFACTION_MAP_URL = "https://liquefaction.gsmma.gov.tw/cgs/Web/Map.aspx";
export const SOIL_LIQUEFACTION_POTENTIAL_WMTS = "https://gis.liquid.net.tw/arcgis/rest/services/P04032/Soil_cgs_2026/MapServer/WMTS/tile/1.0.0/P04032_Soil_cgs/default/GoogleMapsCompatible/{z}/{y}/{x}.png";
export const WEAK_SOIL_WMS = "https://gis.liquid.net.tw/arcgis/services/P04032/weaksoil/MapServer/WMSServer";
export const WEAK_SOIL_WMS_LAYERS = { weakSoilClay0To5: "5", weakSoilSand0To5: "4", weakSoilClay5To10: "3", weakSoilSand5To10: "2", weakSoilClay10To20: "1", weakSoilSand10To20: "0" } as const;
export type SoilLiquefactionLayerKey = "soilLiquefactionPotential" | keyof typeof WEAK_SOIL_WMS_LAYERS;
// Generated from official `_agMap_DEF.js?Ver=20260911`; these are site locations only, never live observations.
export const LIQUEFACTION_MONITORING_SITES = [["臺北市中山站", "TPSite", 121.5401, 25.0627], ["嘉義縣義竹站", "CYSite", 120.2376, 23.3426], ["新北市三重站", "NTSite", 121.5003, 25.0721], ["臺南市永康站", "TNSite", 120.2689, 23.0049], ["宜蘭縣壯圍站", "YLSite", 121.8167, 24.7208], ["高雄市楠梓站", "KCSite", 120.2867, 22.7133], ["臺中市霧峰站", "TCSite", 120.6981, 24.0537], ["花蓮縣花蓮站", "HLSite", 121.6072, 23.9905], ["雲林縣大埤站", "YULSite", 120.4002, 23.6343], ["花蓮縣花蓮港站", "HLPSite", 121.6258, 23.9749], ["彰化縣和美站", "CHSite", 120.4902, 24.1030]] as const;

export const SOIL_LIQUEFACTION_RASTER_SPECS: Readonly<Record<SoilLiquefactionLayerKey, { sourceId: string; layerId: string; url: string }>> = {
  soilLiquefactionPotential: { sourceId: "soil-liquefaction-potential-src", layerId: "soil-liquefaction-potential-raster", url: SOIL_LIQUEFACTION_POTENTIAL_WMTS },
  ...Object.fromEntries(Object.entries(WEAK_SOIL_WMS_LAYERS).map(([key, layer]) => [key, { sourceId: `soil-liquefaction-${key}-src`, layerId: `soil-liquefaction-${key}-raster`, url: `${WEAK_SOIL_WMS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=${layer}&STYLES=&FORMAT=image/png&TRANSPARENT=true&WIDTH=256&HEIGHT=256&SRS=EPSG:3857&BBOX={bbox-epsg-3857}` }])) as Record<keyof typeof WEAK_SOIL_WMS_LAYERS, { sourceId: string; layerId: string; url: string }>,
};
const ATTRIBUTION = "經濟部地質調查及礦業管理中心土壤液化潛勢查詢系統（公開瀏覽，重利用條款待確認）";

function ensureRaster(map: MapboxMap, spec: { sourceId: string; layerId: string; url: string }, opacity: number, visible: boolean) {
  if (!map.getSource(spec.sourceId)) map.addSource(spec.sourceId, { type: "raster", tiles: [spec.url], tileSize: 256, attribution: ATTRIBUTION });
  if (!map.getLayer(spec.layerId)) map.addLayer({ id: spec.layerId, type: "raster", source: spec.sourceId, paint: { "raster-opacity": opacity } } as RasterLayer);
  map.setLayoutProperty(spec.layerId, "visibility", visible ? "visible" : "none");
  map.setPaintProperty(spec.layerId, "raster-opacity", opacity);
}

export function useSoilLiquefactionLayers(mapRef: React.RefObject<MapboxMap | null>, visibility: Record<SoilLiquefactionLayerKey, boolean>, opacity: Record<SoilLiquefactionLayerKey, number>, monitoringVisible: boolean, monitoringOpacity: number) {
  const mapTick = useMapReadyTick(mapRef, Object.values(visibility).some(Boolean) || monitoringVisible);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let disposed = false;
    const apply = () => {
      if (disposed || !map.isStyleLoaded()) return;
      for (const key of Object.keys(SOIL_LIQUEFACTION_RASTER_SPECS) as SoilLiquefactionLayerKey[]) ensureRaster(map, SOIL_LIQUEFACTION_RASTER_SPECS[key], opacity[key], visibility[key]);
      const sourceId = "liquefaction-monitoring-sites-src"; const layerId = "liquefaction-monitoring-sites-circle";
      if (!map.getSource(sourceId)) map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features: LIQUEFACTION_MONITORING_SITES.map(([name, code, lng, lat]) => ({ type: "Feature" as const, properties: { name, code, officialDetailUrl: `https://www.sinotech.org.tw/GSMMA/pec/${code}` }, geometry: { type: "Point" as const, coordinates: [lng, lat] } })) } });
      if (!map.getLayer(layerId)) map.addLayer({ id: layerId, type: "circle", source: sourceId, paint: { "circle-radius": 5, "circle-color": "#2563eb", "circle-stroke-width": 1.5, "circle-stroke-color": "#ffffff", "circle-opacity": monitoringOpacity } });
      map.setLayoutProperty(layerId, "visibility", monitoringVisible ? "visible" : "none"); map.setPaintProperty(layerId, "circle-opacity", monitoringOpacity);
    };
    apply(); map.on("style.load", apply);
    return () => { disposed = true; map.off("style.load", apply); };
  }, [mapRef, mapTick, visibility, opacity, monitoringVisible, monitoringOpacity]);
}
