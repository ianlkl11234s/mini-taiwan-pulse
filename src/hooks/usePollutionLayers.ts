import { useEffect } from "react";
import type { Map as MapboxMap, FilterSpecification } from "mapbox-gl";
import {
  FACILITY_MEDIA,
  PENALTY_MEDIA,
  PENALTY_CRITICAL_FILTER,
  PENALTY_GENERAL_FILTER,
  PENALTY_MOBILE_FILTER,
  type PollutionMedium,
} from "../data/pollutionTypes";

/**
 * 環境污染三層的 filter 套用（介質 / 嚴重度 / 年份 / 模式 / 列管中）。
 *
 * paint（opacity / scale / 色）走 overlayRegistry + overlayManager 的 params 路徑；
 * 這裡只負責「哪些 feature 要顯示」的 setFilter，比對 realEstate / 覆蓋分析 的分工。
 *
 * 設計要點：
 * - 三層都是 PMTiles，Mapbox 會 lazy load tile；setFilter 是純表現層過濾，零重抓。
 * - style.load 後 layer 會重建 → 監聽重新套用（比照 useRealEstateTimeline）。
 * - 圖層關閉時不需套 filter（overlayManager 已設 visibility none）。
 */

const FACILITY_LAYER = "pollution-facility-circle";
const PENALTY_CRITICAL_LAYER = "pollution-penalty-critical-circle";
const PENALTY_GENERAL_LAYER = "pollution-penalty-general-circle";
const PENALTY_MOBILE_LAYER = "pollution-penalty-mobile-circle";
const SITE_LAYER = "pollution-site-circle";
// R5（P-4／G-2）：拉遠的熱區子圖層（overlayRegistry）與點套同一個 filter，兩者顯示同一批資料。
const FACILITY_HEATMAP = "pollution-facility-heatmap";
const PENALTY_CRITICAL_HEATMAP = "pollution-penalty-critical-heatmap";
const PENALTY_GENERAL_HEATMAP = "pollution-penalty-general-heatmap";
const PENALTY_MOBILE_HEATMAP = "pollution-penalty-mobile-heatmap";

export interface PollutionFilterState {
  facilityMedia: Record<PollutionMedium, boolean>;
  facilityMinSev: number;
  penaltyMediumIdx: number; // 0 = 全部；1.. = PENALTY_MEDIA[idx-1]
  penaltyYear: number;      // 0 = 全部年份
  penaltyMode: number;      // 0 = 累積 ≤ 該年、1 = 僅該年
  siteActiveOnly: boolean;
}

function facilityFilter(media: Record<PollutionMedium, boolean>, minSev: number): unknown[] | null {
  const clauses: unknown[] = [];
  // 介質：勾選的介質中「至少登記一項」（sev_<m> 有值即代表登記該介質）
  const selected = FACILITY_MEDIA.filter((m) => media[m]);
  if (selected.length === 0) {
    // 全不選 → 不顯示任何點
    return ["==", ["literal", 1], ["literal", 0]];
  }
  if (selected.length < FACILITY_MEDIA.length) {
    const any: unknown[] = ["any", ...selected.map((m) => ["has", `sev_${m}`])];
    clauses.push(any);
  }
  if (minSev > 0) {
    clauses.push([">=", ["coalesce", ["to-number", ["get", "max_sev"]], 0], minSev]);
  }
  if (clauses.length === 0) return null;
  return ["all", ...clauses];
}

function penaltyFilter(mediumIdx: number, year: number, mode: number): unknown[] | null {
  const clauses: unknown[] = [];
  if (mediumIdx > 0) {
    const m = PENALTY_MEDIA[mediumIdx - 1];
    if (m) clauses.push(["==", ["get", "event_medium"], m]);
  }
  if (year > 0) {
    const yExpr = ["coalesce", ["to-number", ["get", "penalty_year"]], 0];
    // 模式 0 = 累積至該年（<=）；模式 1 = 僅該年（==）
    clauses.push(mode === 1 ? ["==", yExpr, year] : ["<=", yExpr, year]);
  }
  if (clauses.length === 0) return null;
  return ["all", ...clauses];
}

function combineFilters(base: unknown[], dynamic: unknown[] | null): unknown[] {
  return dynamic ? ["all", base, dynamic] : base;
}

function siteFilter(activeOnly: boolean): unknown[] | null {
  if (!activeOnly) return null;
  return ["==", ["coalesce", ["to-number", ["get", "is_active"]], 0], 1];
}

export function usePollutionLayers(
  mapRef: React.RefObject<MapboxMap | null>,
  visibility: {
    pollutionFacility: boolean;
    pollutionPenaltyCritical: boolean;
    pollutionPenaltyGeneral: boolean;
    pollutionPenaltyMobile: boolean;
    pollutionSite: boolean;
  },
  state: PollutionFilterState,
) {
  const {
    facilityMedia, facilityMinSev,
    penaltyMediumIdx, penaltyYear, penaltyMode,
    siteActiveOnly,
  } = state;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const setFilter = (ids: string[], filter: unknown[] | null) => {
        for (const id of ids) {
          if (map.getLayer(id)) map.setFilter(id, filter as unknown as FilterSpecification);
        }
      };
      setFilter([FACILITY_LAYER, FACILITY_HEATMAP], facilityFilter(facilityMedia, facilityMinSev));
      const penaltyDynamicFilter = penaltyFilter(penaltyMediumIdx, penaltyYear, penaltyMode);
      setFilter([PENALTY_CRITICAL_LAYER, PENALTY_CRITICAL_HEATMAP], combineFilters(PENALTY_CRITICAL_FILTER, penaltyDynamicFilter));
      setFilter([PENALTY_GENERAL_LAYER, PENALTY_GENERAL_HEATMAP], combineFilters(PENALTY_GENERAL_FILTER, penaltyDynamicFilter));
      setFilter([PENALTY_MOBILE_LAYER, PENALTY_MOBILE_HEATMAP], combineFilters(PENALTY_MOBILE_FILTER, penaltyDynamicFilter));
      setFilter([SITE_LAYER], siteFilter(siteActiveOnly));
    };

    apply();
    map.on("style.load", apply);
    return () => { map.off("style.load", apply); };
  }, [
    mapRef,
    // 圖層開關變動 → layer 會被建立/顯示，需重套 filter
    visibility.pollutionFacility,
    visibility.pollutionPenaltyCritical,
    visibility.pollutionPenaltyGeneral,
    visibility.pollutionPenaltyMobile,
    visibility.pollutionSite,
    facilityMedia, facilityMinSev,
    penaltyMediumIdx, penaltyYear, penaltyMode,
    siteActiveOnly,
  ]);
}
