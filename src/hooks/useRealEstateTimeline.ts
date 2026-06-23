import { useEffect } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { AppMode } from "../types";

/**
 * 房地產 period 時間軸（取代 Fire 的 RPC+setData，改用 setFilter）
 *
 * - 6 layer（3 類 × {grid fill+line, point circle}）共 9 個 mapbox layer id。
 * - realtime 模式：grid 顯示 period="ALL" 全期彙總、point 顯示全部交易（僅 type filter）。
 *   此即 overlayRegistry 的初始 config.filter，故 realtime 不需本 hook 也正確。
 * - historical + 季粒度：filter 切成當季 period（grid/point 皆 type + period==當季）。
 * - 純 map.setFilter 換 filter expression，零 RPC、零 setData。
 * - style 切換後 overlay 重建會回到 config.filter，監聽 style.load 重新套用。
 */

type Kind = "grid" | "point";
const RE_LAYERS: { id: string; type: string; kind: Kind }[] = [
  { id: "re-grid-rental-fill", type: "rental", kind: "grid" },
  { id: "re-grid-rental-line", type: "rental", kind: "grid" },
  { id: "re-grid-sale-fill", type: "sale", kind: "grid" },
  { id: "re-grid-sale-line", type: "sale", kind: "grid" },
  { id: "re-grid-presale-fill", type: "presale", kind: "grid" },
  { id: "re-grid-presale-line", type: "presale", kind: "grid" },
  { id: "re-points-rental-circle", type: "rental", kind: "point" },
  { id: "re-points-sale-circle", type: "sale", kind: "point" },
  { id: "re-points-presale-circle", type: "presale", kind: "point" },
];

const TAIPEI_CITIES = ["taipei", "newtaipei"];
// 排除雙北：city 不在 [taipei, newtaipei]（grid 與 point 都有 city 欄位）
const EXCLUDE_TAIPEI_F: unknown[] = ["!", ["in", ["get", "city"], ["literal", TAIPEI_CITIES]]];

// period === null → realtime 全期視圖；否則 historical 當季
function buildFilter(type: string, kind: Kind, period: string | null, excludeTaipei: boolean): unknown[] {
  const clauses: unknown[] = [["==", ["get", "type"], type]];
  if (kind === "grid") {
    clauses.push(["==", ["get", "period"], period ?? "ALL"]);
  } else if (period !== null) {
    clauses.push(["==", ["get", "period"], period]);
  }
  if (excludeTaipei) clauses.push(EXCLUDE_TAIPEI_F);
  return ["all", ...clauses];
}

export function useRealEstateTimeline(
  mapRef: React.RefObject<MapboxMap | null>,
  appMode: AppMode,
  isQuarterMode: boolean,
  periodIndex: number,
  periods: string[],
  excludeTaipei: boolean,
) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const period =
      appMode === "historical" && isQuarterMode ? (periods[periodIndex] ?? null) : null;

    const apply = () => {
      for (const l of RE_LAYERS) {
        if (map.getLayer(l.id)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          map.setFilter(l.id, buildFilter(l.type, l.kind, period, excludeTaipei) as any);
        }
      }
    };

    apply();
    map.on("style.load", apply);
    return () => {
      map.off("style.load", apply);
    };
  }, [mapRef, appMode, isQuarterMode, periodIndex, periods, excludeTaipei]);
}
