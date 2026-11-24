/**
 * 點擊查詢 Mapbox GIS 層（接線表＝`GIS_LAYERS`，順序 load-bearing：first-hit-wins）。
 * 主地圖（`hooks/useMapInteraction.ts`）與兩國並排的右圖（`CountryCompareMapView.tsx`）共用同一套命中與欄位整理，
 * 右圖不另寫一份；主地圖獨有的後續（橋梁韌性起點、GFW 詳情 hydrate、raster／氣候場讀值）留在主地圖。
 */
import type { Map as MapboxMap, MapboxGeoJSONFeature, Point, PointLike } from "mapbox-gl";
import type { FeatureInfo } from "../types";
import { enrichJpHeightFeature } from "../data/jpHeightFeatureMetadata";
import { GIS_LAYERS, dropHiddenLandUseHex } from "./gisClickRegistry";
import { gisHitTarget, queryStatisticsHits } from "./statisticsClickHit";
import { pickElectionHits } from "./electionSpread";
import { isGfwHourlyGridDominantHitLayer } from "../hooks/useGfwHourlyGridLayer";
import { canonicalGfwGridCellId } from "../data/gfwHourlyDetailLoader";
import { encodeParamsToOverlay, layerParamsStore } from "../state/layerParamsStore";
import { jpWaterSelectionIdentity } from "../data/jpWaterTypes";
import { BRIDGE_RESILIENCE_LAYER_IDS } from "../data/bridgeResilienceTypes";
import { isDrawn as isBusCrowdingDrawn } from "../data/busCrowdingSimTypes";

type GisClickType = FeatureInfo["layerType"];

export interface GisHitCandidate {
  type: GisClickType;
  /** 已依該類型過濾、排序後的命中（至少一筆） */
  features: MapboxGeoJSONFeature[];
}

/** 依 `GIS_LAYERS` 順序逐類查詢，只產出有命中的類型（呼叫端取第一個就是 first-hit-wins；要跳過某類時 continue） */
export function* gisHitCandidates(map: MapboxMap, point: Point): Generator<GisHitCandidate> {
  const bbox: [PointLike, PointLike] = [
    [point.x - 5, point.y - 5],
    [point.x + 5, point.y + 5],
  ];
  for (const { layers: layerIds, type } of GIS_LAYERS) {
    const candidates = type === "jpBuildingHeight"
      ? [...layerIds, ...(map.getStyle?.()?.layers ?? []).map((layer) => layer.id)
        .filter((id) => /^jp-building-height(?:-grid)?--[a-z0-9-]+-(?:fill|extrusion)$/.test(id))]
      : layerIds;
    const existingIds = candidates.filter((id) => {
      if (!map.getLayer(id)) return false;
      // PMTiles roundZoom bridge 令 z10 兩尺度都存在；popup 必依真實 zoom 選尺度，
      // 不能讓 opacity=0 的舊格網先命中。
      if (type === "companyIndustryDistribution" || type === "companyAgeStructure" || type === "factoryDensityGrid" || type === "manufacturingCompanyDensityGrid" || type === "regulatedFacilityDensityGrid") {
        return map.getZoom() >= 10 ? id.includes("-450-") : id.includes("-1500-");
      }
      return true;
    });
    if (existingIds.length === 0) continue;
    // 小格網面只查點擊點，不讓 POI 容錯框內的鄰格搶走（清單見 EXACT_POINT_HIT_TYPES）
    const hitTarget = gisHitTarget<PointLike>(type, point, bbox);
    // 統計面以點擊點落在哪個多邊形為準（低縮放時容錯框會先命中鄰區）；比例圓保留容錯框
    const queried = type === "regionalStatistic"
      ? queryStatisticsHits(map, point, existingIds)
      : map.queryRenderedFeatures(hitTarget, { layers: existingIds });
    // GFW v4 網格：三個小時 slot 的 hit layer 都恆為 visible（翻 visibility 會 reload
    // 共用 source），所以「哪個小時能回答點擊」改在查詢後決定。必須在取 [0] 之前過濾：
    // v4 tile 沒有 observed_at，popup 一律以 dominant hour 去 hydrate，放非 dominant 的
    // feature 進來會 vessel_count 對不上而變成「驗證失敗」面板。dominant 為 null
    // （資料窗外已完全淡出）時視為沒命中，讓點擊落到下一個 GIS_LAYERS 條目。
    let features = type === "gfwHourlyGrid"
      ? queried.filter((feature) => isGfwHourlyGridDominantHitLayer(feature.layer?.id))
      : queried;
    if (type === "landUseChangeMonitoring") features = dropHiddenLandUseHex(queried);
    if (type === "electionEvents2026") {
      // 確切地點多場展開後點與點相切：取離游標最近的那一場，並丟掉目前縮放下看不到的數字圖示／展開點
      const scale = Number(encodeParamsToOverlay(layerParamsStore.getAll()).electionEvents2026Scale ?? 1) || 1;
      features = pickElectionHits(map, queried, point, scale);
    }
    if (type === "busCrowdingSim") {
      // 命中層與線同 filter（不畫的段點不到）；這裡再防一次。多條路線疊在同一條街時，
      // 優先回答超載比例最高的那條（與 line-sort-key 讓高值畫在上面一致）。
      features = queried.filter((feature) => isBusCrowdingDrawn(feature.properties?.ov, feature.properties?.t))
        .sort((a, b) => Number(b.properties?.ov ?? -1) - Number(a.properties?.ov ?? -1));
    }
    if (type === "busCrowdingSimVehicle") {
      // 車點疊在一起時回答負載分級最高的那台（與 circle／symbol-sort-key 讓高級畫在上面一致）。
      features = [...queried].sort((a, b) => Number(b.properties?.cls ?? -1) - Number(a.properties?.cls ?? -1));
    }
    if (type === "bridgeResilienceTwinCity") {
      // 橋線用容差框；村里面是相鄰多邊形，容差框會混入鄰村（Mapbox 依繪製順序而非距離排序）→ 改以 point 精確查詢
      const bridgeHits = queried.filter((feature) => feature.layer?.id !== BRIDGE_RESILIENCE_LAYER_IDS.villageFill);
      features = bridgeHits.length > 0 || !existingIds.includes(BRIDGE_RESILIENCE_LAYER_IDS.villageFill)
        ? bridgeHits
        : map.queryRenderedFeatures(point, { layers: [BRIDGE_RESILIENCE_LAYER_IDS.villageFill] });
    }
    if (features.length > 0) yield { type, features };
  }
}

/** 命中的 feature → popup 欄位與座標（點取幾何、其他取點擊處；feature-state、分片 source、同點多筆服務併入） */
export function gisHitProperties(
  type: GisClickType,
  f: MapboxGeoJSONFeature,
  features: readonly MapboxGeoJSONFeature[],
  lngLat: { lng: number; lat: number },
): { properties: Record<string, unknown>; coords: [number, number]; cellId: string | null } {
  let coords: [number, number] | undefined;
  const g = f.geometry as GeoJSON.Geometry | undefined;
  if (g && g.type === "Point") {
    const c = (g as GeoJSON.Point).coordinates;
    if (typeof c[0] === "number" && typeof c[1] === "number") {
      coords = [c[0], c[1]];
    }
  }
  if (!coords) coords = [lngLat.lng, lngLat.lat];
  // roadCongestion 的 level / temperatureGrid 的 temp / earthquakeReplayTown 的 eqi
  // / funeralOperatorDensity 的 operatorCount 在 feature-state（非 baked properties）→ 併入
  const queriedProperties =
    type === "roadCongestion" ||
    type === "temperatureGrid" ||
    type === "earthquakeReplayTown" ||
    type === "funeralOperatorDensity" ||
    type === "animalShelterPressure" ||
    type === "propertyValueAdmin"
      ? { ...(f.properties ?? {}), ...(f.state ?? {}) }
      : type === "jpBuildingHeight"
        ? enrichJpHeightFeature(f.source ?? "", f.properties ?? {})
        // 南韓生態自然圖：命中的 시·도 分片 source id（popup 依此查該檔고시번호）
        : type === "krEcologyNaturalness"
          ? { ...(f.properties ?? {}), _eco_source: f.source ?? "" }
          : (f.properties ?? {});
  const cellId = type === "gfwHourlyGrid" ? canonicalGfwGridCellId(queriedProperties, f.id) : null;
  // PMTiles may expose the immutable key as `grid_id` or feature.id.  Normalise it
  // before both popup rendering and detail-bucket SHA selection.
  let properties = cellId ? { ...queriedProperties, cell_id: cellId } : queriedProperties;
  if (type === "companyIndustryDistribution" || type === "companyAgeStructure") {
    properties = { ...properties, __demographics_params: encodeParamsToOverlay(layerParamsStore.getAll()) };
  }
  // 加拿大：同一 key 有多個 tile layer（機場／港口、軌道／車站、油氣 6 類…），popup 依命中的 source-layer 選欄位規格。
  if (f.layer?.id?.startsWith("ca-") && f.sourceLayer) properties = { ...properties, _ca_source_layer: f.sourceLayer };
  const waterIdentity = jpWaterSelectionIdentity(type, properties.source_id);
  if (waterIdentity) {
    properties = {
      ...properties,
      source_layer: waterIdentity.sourceLayer,
      asset_sha256: waterIdentity.assetSha256,
      selection_identity: waterIdentity.selectionId,
    };
  }
  // H17 同位置可能有多筆服務；保留目前篩選可見的登記，避免 first-hit 隱藏其他服務。
  if ((type === "jpCarePlanning" || type === "jpCareHomeVisit" || type === "jpCareDayServices"
    || type === "jpCareResidential" || type === "jpCareCombined" || type === "jpCareEquipment")
    && g?.type === "Point") {
    const origin = g.coordinates;
    const coLocated = features.filter(item => item.geometry.type === "Point"
      && Math.abs(item.geometry.coordinates[0]! - origin[0]!) < 1e-7
      && Math.abs(item.geometry.coordinates[1]! - origin[1]!) < 1e-7
      && typeof item.properties?.service_type === "string");
    const unique = new Map(coLocated.map(item => {
      const p = item.properties ?? {};
      return [JSON.stringify([p.source_id, p.establishment_id, p.service_type, p.name]), p];
    }));
    if (unique.size) properties = { ...properties, coLocatedServices: [...unique.values()] };
  }
  return { properties, coords, cellId };
}
