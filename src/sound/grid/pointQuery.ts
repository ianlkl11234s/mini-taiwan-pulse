/**
 * W6-5 點選查詢：接收點所在格、某個 10 分格的七族網格資訊（原本各族格子 popup 的欄位，併進聲景面板）。
 * 每族都對格心呼叫和網格同一套的單點估計（rainEstimateAt／roadTrafficEstimateAt／queryFamilyInterval），所以等級＝地圖顏色。
 */
import type { SetOrigin } from "../soundAtlasData";
import type { SoundSourceFamily, SoundSourceSet } from "../types";
import { COMPOSITE_FAMILIES, type CompositeFamily } from "./compositeGrid";
import { potentialCellInfo, type PotentialGridFamily } from "./potentialGridState";
import { rainCellInfo } from "./rainGridState";
import { roadCellInfo } from "./roadGridState";

const NEEDS_GRID_ORIGIN = new Set<CompositeFamily>(["aviation", "wind_vegetation", "coastal_wave", "river_water"]);

export function pointCellInfos(
  sets: Partial<Record<SoundSourceFamily, SoundSourceSet>>,
  origins: Partial<Record<SoundSourceFamily, SetOrigin>>,
  bin: number,
  gate: number,
  notes: Partial<Record<string, string | null>> | null,
  lon: number,
  lat: number,
): Partial<Record<CompositeFamily, Record<string, unknown> | null>> {
  const out: Partial<Record<CompositeFamily, Record<string, unknown> | null>> = {};
  for (const f of COMPOSITE_FAMILIES) {
    const set = sets[f] ?? null;
    if (!set) continue;
    const origin = origins[f] ?? null;
    if (f === "rain") out[f] = rainCellInfo(set, origin, bin, lon, lat);
    else if (f === "road_traffic") out[f] = roadCellInfo(set, origin, bin, lon, lat);
    else {
      // 整幀說明：Worker 有回就用；否則依 origin 判斷「這天沒有全範圍來源檔」（同網格的整幀斜線）
      const note = notes?.[f] ?? (NEEDS_GRID_ORIGIN.has(f) && origin !== "grid" ? "no_full_area_source" : null);
      out[f] = potentialCellInfo(f as PotentialGridFamily, set, origin, bin, f === "aviation" ? gate : 0, note, lon, lat);
    }
  }
  return out;
}
