// 英國國家包：overlays.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { OverlayConfig } from "../../types";
import { densePointOpacity, pointStrokePaint } from "../../map/mapStyleScale";
import { GB_EA_POLLUTION_ATTRIBUTION, GB_EA_POLLUTION_COUNTS, GB_EA_POLLUTION_SOURCE_ID, GB_ENV_HOLLOW_STROKE, GB_POLLUTION_COLOR } from "./gbEnvPlanningTypes";

/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("GB", n)。 */
export const GB_PACK_OVERLAY_SLOTS: Readonly<Record<number, readonly OverlayConfig[]>> = {
  1: [
  // ── 🇬🇧 英格蘭污染排放申報（EA，站主限定）──
  // dynamicData：useGbEaPollutionInventoryLayer 從 owner-only RPC get_gb_ea_pollution_inventory（gis-platform mig 499）拉一次後 setData。
  // EA Conditional Licence 限 internal or personal purposes → 不走任何公開檔。配色、實心／空心語意比照蘇格蘭層 gbPollutionInventory：
  // released（routes 非空＝有申報排放量）實心；無申報＝同色空心。2,536 點 z5 起直接畫（§3.8：英國全覽 z5.5 畫得出點）。
  {
    id: "gbPollutionInventoryEngland",
    sourceUrl: "./geo/_empty.geojson",
    sourceId: GB_EA_POLLUTION_SOURCE_ID,
    dynamicData: true,
    attribution: GB_EA_POLLUTION_ATTRIBUTION,
    layers: [
      {
        suffix: "circle",
        type: "circle",
        minzoom: 5,
        paint: (isDark, p) => {
          const def = densePointOpacity(GB_EA_POLLUTION_COUNTS.total);
          const op = p?.gbPollutionInventoryEnglandOpacity ?? def;
          const scale = p?.gbPollutionInventoryEnglandScale ?? 1;
          const released = ["==", ["get", "released"], true];
          // 空環要寫成明確的條件分支：withPointSpec 的 normalizeMixedBranches 會把 case 最後的 fallback 換成標準值，
          // 空環（同色描邊）若放在 fallback 會被換成底圖色細縫 → 846 個未申報場址變成底色空環
          const unreleased = ["!=", ["get", "released"], true];
          const seam = pointStrokePaint(isDark, op / def);
          return {
            "circle-radius": 5 * scale,
            "circle-color": GB_POLLUTION_COLOR,
            "circle-opacity": ["case", released, op, 0] as unknown as number,
            "circle-stroke-color": ["case", released, seam["circle-stroke-color"], unreleased, GB_POLLUTION_COLOR, GB_POLLUTION_COLOR] as unknown as string,
            "circle-stroke-width": ["case", released, seam["circle-stroke-width"], unreleased, GB_ENV_HOLLOW_STROKE, GB_ENV_HOLLOW_STROKE] as unknown as number,
            "circle-stroke-opacity": ["case", released, seam["circle-stroke-opacity"], unreleased, op, op] as unknown as number,
          };
        },
      },
    ],
  },
  ],
  // <codemod:append GB_PACK_OVERLAY_SLOTS>
};
