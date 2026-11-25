// 日本國家包：overlays.ts（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。
// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。
import type { OverlayConfig } from "../../types";
import { ENV_WBGT_ATTRIBUTION, envWbgtColorExpr, JMA_POINT_HOLLOW_COLOR, JMA_SNOWCAP_OBSERVED_COLOR, JMA_SNOWCAP_OBSERVED_STROKE } from "../../data/jmaPointTypes";
import { JMA_ATTRIBUTION, JMA_INTENSITY_CLASSES, JMA_MISSING_COLOR, JMA_QUAKE_RADIUS_STOPS, JMA_VOLCANO_LEVELS, jmaAmedasColorExpr, jmaAmedasFilter, jmaAmedasMode, jmaIsNullExpr } from "../../data/jmaTypes";
import { gradedSeamPaint, mapSeamColor } from "../../map/mapStyleScale";
import { jmaSeasonalLabelLayer } from "../../map/overlayRegistry";
import { JP_DID_DEFAULT_YEAR, JP_DID_YEARS, JP_NATIONAL_PARK_ZONES, JP_NATIONAL_PARKS_MOE_ATTRIBUTION, JP_NATIONAL_PARKS_MOE_URL, JP_NATURAL_PARK_AREAS_ATTRIBUTION, JP_NATURAL_PARK_AREAS_COLOR, JP_NATURAL_PARK_AREAS_URL, JP_NATURAL_PARK_LEVELS, JP_WILDLIFE_CATEGORIES, JP_WILDLIFE_MOE_ATTRIBUTION, JP_WILDLIFE_MOE_COLOR, JP_WILDLIFE_MOE_URL, jpDidAttribution, jpDidDensityColorExpr, jpDidUrl } from "./jpNatureR2Types";

// ── 日本第二輪（2026-11-06，C057／C105／X009）：自然公園地域 A10-2015、環境省国立公園／国指定鳥獣保護区（令和7年4月）、
// 人口集中地区 DID 五期（年份 select 換檔，同淹水情境 sourceUrlByParam）。色與類別讀 data/jpNatureR2Types.ts；
// 類別多選走 categoryFilters/groupD（withCategoryFilter 自動接線）；點／面切換走 repPointLayers（DID 為統計區劃面，不做點切換）。
function jpMatchColor(property: string, rows: readonly { value: string; color: string }[], fallback: string): unknown[] {
  return ["match", ["to-string", ["get", property]], ...rows.flatMap((r) => [r.value, r.color]), fallback];
}

const JP_NATURAL_PARK_LEVEL_COLOR = jpMatchColor("level", JP_NATURAL_PARK_LEVELS, JP_NATURAL_PARK_AREAS_COLOR);

const JP_NATIONAL_PARK_ZONE_COLOR = jpMatchColor("zone", JP_NATIONAL_PARK_ZONES, "#9ca3af");

const JP_WILDLIFE_CATEGORY_COLOR = jpMatchColor("category", JP_WILDLIFE_CATEGORIES, JP_WILDLIFE_MOE_COLOR);


/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("JP", n)。 */
export const JP_PACK_OVERLAY_SLOTS: Readonly<Record<number, readonly OverlayConfig[]>> = {
  1: [
    // ── 日本氣象廳即時 3 點層（dynamicData，資料由 useJmaLiveLayer setData；警報 choropleth 由 useJmaWarningsLayer 自建）──
    // AMeDAS：NULL＝中空點（不經 to-number，避免 null 變 0）；雨量／積雪 0 與 >0 分色；積雪模式只畫有積雪計的站（filter → 重建）。
    {
      id: "jmaAmedas",
      sourceUrl: "./geo/_empty.geojson",
      sourceId: "jma-amedas",
      dynamicData: true,
      attribution: JMA_ATTRIBUTION,
      rebuildOnParamChange: ["circle"],
      rebuildOnParamKeys: ["jmaAmedasModeIdx"],
      layers: [{
        suffix: "circle", type: "circle", minzoom: 4, maxzoom: 22,
        filter: (p) => jmaAmedasFilter(jmaAmedasMode(p?.jmaAmedasModeIdx)) ?? ["all"],
        paint: (isDark, p) => {
          const mode = jmaAmedasMode(p?.jmaAmedasModeIdx);
          const hollow = jmaIsNullExpr(mode.field);
          const op = p?.jmaAmedasOpacity ?? 0.9;
          return {
            "circle-color": jmaAmedasColorExpr(mode) as unknown as string,
            "circle-opacity": ["case", hollow, 0, op] as unknown as number,
            "circle-stroke-color": ["case", hollow, JMA_MISSING_COLOR, mapSeamColor(isDark)] as unknown as string,
            "circle-stroke-width": ["case", hollow, 1.6, 0.8] as unknown as number,
            "circle-stroke-opacity": op,
          };
        },
      }],
    } satisfies OverlayConfig,
    // 地震：半徑＝規模（泡泡 B）、顏色＝最大震度；規模或震度 NULL → 中空。
    {
      id: "jmaQuakes",
      sourceUrl: "./geo/_empty.geojson",
      sourceId: "jma-quakes",
      dynamicData: true,
      attribution: JMA_ATTRIBUTION,
      layers: [{
        suffix: "circle", type: "circle", minzoom: 3, maxzoom: 22,
        paint: (isDark, p) => {
          const op = p?.jmaQuakesOpacity ?? 0.85;
          const s = p?.jmaQuakesScale ?? 1;
          const hollow: unknown[] = ["any", ["==", ["get", "max_intensity"], null], ["==", ["get", "magnitude"], null]];
          return {
            "circle-radius": ["case", ["==", ["get", "magnitude"], null], 4 * s,
              ["interpolate", ["linear"], ["get", "magnitude"], ...JMA_QUAKE_RADIUS_STOPS.flatMap(([m, px]) => [m, px * s])]] as unknown as number,
            "circle-color": ["match", ["get", "max_intensity"], ...JMA_INTENSITY_CLASSES.flatMap((c) => [c.value, c.color]), JMA_MISSING_COLOR] as unknown as string,
            "circle-opacity": ["case", hollow, 0, op * 0.75] as unknown as number,
            "circle-stroke-color": ["case", hollow, JMA_MISSING_COLOR, mapSeamColor(isDark)] as unknown as string,
            "circle-stroke-width": ["case", hollow, 1.6, 1] as unknown as number,
            "circle-stroke-opacity": op,
          };
        },
      }],
    } satisfies OverlayConfig,
    // 火山：噴火警戒レベル 1–5＋未導入レベル。
    {
      id: "jmaVolcanoes",
      sourceUrl: "./geo/_empty.geojson",
      sourceId: "jma-volcanoes",
      dynamicData: true,
      attribution: JMA_ATTRIBUTION,
      layers: [{
        suffix: "circle", type: "circle", minzoom: 3, maxzoom: 22,
        paint: (isDark, p) => {
          const op = p?.jmaVolcanoesOpacity ?? 0.9;
          return {
            "circle-color": ["match", ["get", "level"], ...JMA_VOLCANO_LEVELS.flatMap((l) => [l.value, l.color]), JMA_MISSING_COLOR] as unknown as string,
            "circle-opacity": op,
            "circle-stroke-color": mapSeamColor(isDark),
            "circle-stroke-width": 1,
            "circle-stroke-opacity": op,
          };
        },
      }],
    } satisfies OverlayConfig,
    // 日本落雷（LIDEN）：沿用台灣氣象署源樣式（無電流強度 → 半徑只看 zoom），對地／雲放電分色。
    {
      id: "jmaLightning",
      sourceUrl: "./geo/_empty.geojson",
      sourceId: "jma-lightning",
      dynamicData: true,
      attribution: JMA_ATTRIBUTION,
      rebuildOnParamChange: ["jmaLightningOpacity"],
      layers: [
        {
          suffix: "halo", type: "circle",
          paint: (_isDark, params) => {
            const o = params?.jmaLightningOpacity ?? 0.85;
            const scale = params?.jmaLightningScale ?? 1;
            return {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4 * scale, 9, 7 * scale, 12, 12 * scale],
              "circle-color": ["match", ["get", "strike_type"], 0, "#a78bfa", 1, "#4ade80", "#9ca3af"],
              "circle-blur": 0.85,
              "circle-opacity": ["*", o * 0.45, ["coalesce", ["get", "alpha"], 1]],
            };
          },
        },
        {
          suffix: "core", type: "circle",
          paint: (_isDark, params) => {
            const o = params?.jmaLightningOpacity ?? 0.85;
            const scale = params?.jmaLightningScale ?? 1;
            return {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 1.2 * scale, 10, 2.2 * scale, 14, 3.5 * scale],
              "circle-color": ["match", ["get", "strike_type"], 0, "#a78bfa", 1, "#4ade80", "#9ca3af"],
              "circle-opacity": ["*", o, ["coalesce", ["get", "alpha"], 1]],
            };
          },
        },
      ],
    } satisfies OverlayConfig,
    // 暑さ指数 WBGT（環境省）：4 段步階色；值 NULL → 中空。出典環境省（非 PDL1.0）。
    {
      id: "jmaWbgt",
      sourceUrl: "./geo/_empty.geojson",
      sourceId: "jma-wbgt",
      dynamicData: true,
      attribution: ENV_WBGT_ATTRIBUTION,
      layers: [{
        suffix: "circle", type: "circle", minzoom: 4, maxzoom: 22,
        paint: (isDark, p) => {
          const op = p?.jmaWbgtOpacity ?? 0.9;
          const s = p?.jmaWbgtScale ?? 1;
          const hollow = jmaIsNullExpr("wbgt");
          return {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 2.5 * s, 8, 4.5 * s, 12, 7 * s] as unknown as number,
            "circle-color": envWbgtColorExpr() as unknown as string,
            "circle-opacity": ["case", hollow, 0, op] as unknown as number,
            "circle-stroke-color": ["case", hollow, JMA_MISSING_COLOR, mapSeamColor(isDark)] as unknown as string,
            "circle-stroke-width": ["case", hollow, 1.6, 0.6] as unknown as number,
            "circle-stroke-opacity": op,
          };
        },
      }],
    } satisfies OverlayConfig,
    // 山頂初冠雪：已觀測＝白點深描邊；未觀測＝灰中空（as-of 已過平年日 → 描邊加粗）。
    {
      id: "jmaSnowcap",
      sourceUrl: "./geo/_empty.geojson",
      sourceId: "jma-snowcap",
      dynamicData: true,
      attribution: JMA_ATTRIBUTION,
      layers: [{
        suffix: "circle", type: "circle", minzoom: 3, maxzoom: 22,
        paint: (_isDark, p) => {
          const op = p?.jmaSnowcapOpacity ?? 0.95;
          const s = p?.jmaSnowcapScale ?? 1;
          const observed: unknown[] = ["==", ["get", "state"], "observed"];
          const notObserved: unknown[] = ["!=", ["get", "state"], "observed"];
          const pastNormal: unknown[] = ["!=", ["get", "days_past_normal"], null];
          return {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 4 * s, 8, 6.5 * s, 12, 9 * s] as unknown as number,
            "circle-color": JMA_SNOWCAP_OBSERVED_COLOR,
            "circle-opacity": ["case", observed, op, 0] as unknown as number,
            // 條件分支才是資料編碼（withPointSpec 只換 fallback）：已觀測深描邊、未觀測灰圈、已過平年粗圈
            "circle-stroke-color": ["case", observed, JMA_SNOWCAP_OBSERVED_STROKE, notObserved, JMA_POINT_HOLLOW_COLOR, JMA_POINT_HOLLOW_COLOR] as unknown as string,
            "circle-stroke-width": ["case", observed, 1.6, ["all", notObserved, pastNormal], 2.4, notObserved, 1.4, 1.4] as unknown as number,
            "circle-stroke-opacity": op,
          };
        },
      }, jmaSeasonalLabelLayer("jmaSnowcapOpacity", 0.95)],
    } satisfies OverlayConfig,
  ],
  2: [
  {
    id: "jpNaturalParkAreas2015", sourceUrl: JP_NATURAL_PARK_AREAS_URL, sourceId: "jp-natural-park-areas-2015",
    pmtiles: { sourceLayer: "jp_natural_park_areas_ksj_2015", minzoom: 4, maxzoom: 13 },
    attribution: JP_NATURAL_PARK_AREAS_ATTRIBUTION,
    rebuildOnParamChange: ["fill", "outline"],
    layers: [
      { suffix: "fill", type: "fill", layout: { "fill-sort-key": ["to-number", ["get", "level"], 1] }, paint: (_d, p) => ({ "fill-color": JP_NATURAL_PARK_LEVEL_COLOR, "fill-opacity": p?.jpNaturalParkAreas2015Opacity ?? 0.35 }) },
      { suffix: "outline", type: "line", paint: (_d, p) => ({ "line-color": JP_NATURAL_PARK_LEVEL_COLOR, "line-width": 1, "line-opacity": (p?.jpNaturalParkAreas2015Opacity ?? 0.35) > 0 ? 0.8 : 0 }) },
    ],
  },
  {
    id: "jpNationalParksMoe", sourceUrl: JP_NATIONAL_PARKS_MOE_URL, sourceId: "jp-national-parks-moe",
    pmtiles: { sourceLayer: "jp_national_parks_moe_r7", minzoom: 4, maxzoom: 13 },
    attribution: JP_NATIONAL_PARKS_MOE_ATTRIBUTION,
    rebuildOnParamChange: ["fill", "outline"],
    layers: [
      // zone_rank 小＝規制嚴，排在上層（sort-key 大者後畫）
      { suffix: "fill", type: "fill", layout: { "fill-sort-key": ["-", 10, ["to-number", ["get", "zone_rank"], 7]] }, paint: (_d, p) => ({ "fill-color": JP_NATIONAL_PARK_ZONE_COLOR, "fill-opacity": p?.jpNationalParksMoeOpacity ?? 0.35 }) },
      { suffix: "outline", type: "line", paint: (_d, p) => ({ "line-color": JP_NATIONAL_PARK_ZONE_COLOR, "line-width": 1, "line-opacity": (p?.jpNationalParksMoeOpacity ?? 0.35) > 0 ? 0.8 : 0 }) },
    ],
  },
  {
    id: "jpWildlifeProtectionMoe", sourceUrl: JP_WILDLIFE_MOE_URL, sourceId: "jp-wildlife-protection-moe",
    pmtiles: { sourceLayer: "jp_wildlife_protection_areas_moe_r7", minzoom: 4, maxzoom: 13 },
    attribution: JP_WILDLIFE_MOE_ATTRIBUTION,
    rebuildOnParamChange: ["fill", "outline"],
    layers: [
      { suffix: "fill", type: "fill", layout: { "fill-sort-key": ["to-number", ["get", "class_rank"], 1] }, paint: (_d, p) => ({ "fill-color": JP_WILDLIFE_CATEGORY_COLOR, "fill-opacity": p?.jpWildlifeProtectionMoeOpacity ?? 0.35 }) },
      { suffix: "outline", type: "line", paint: (_d, p) => ({ "line-color": JP_WILDLIFE_CATEGORY_COLOR, "line-width": 1, "line-opacity": (p?.jpWildlifeProtectionMoeOpacity ?? 0.35) > 0 ? 0.8 : 0 }) },
    ],
  },
  {
    id: "jpDid", sourceUrl: jpDidUrl(JP_DID_DEFAULT_YEAR), sourceId: "jp-did",
    sourceUrlByParam: { param: "jpDidYearIdx", urls: JP_DID_YEARS.map((y) => jpDidUrl(y)) },
    pmtiles: { sourceLayer: "jp_did", minzoom: 4, maxzoom: 12 },
    attribution: jpDidAttribution(JP_DID_DEFAULT_YEAR),
    rebuildOnParamChange: ["fill", "outline"],
    layers: [
      // V-1（map-layers §3.8）：z5 全國視角 DID 多半只剩 2–3 px，1px 底圖色細縫會把小面吃掉、0.55 透明度又太淡，
      // 所以低縮放提高不透明度（z5 ×1.6、z8 起回到滑桿值），細縫 z8 起才畫。
      { suffix: "fill", type: "fill", paint: (isDark, p) => {
        const op = p?.jpDidOpacity ?? 0.55;
        return { "fill-color": jpDidDensityColorExpr(isDark), "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, Math.min(1, op * 1.6), 8, op] };
      } },
      { suffix: "outline", type: "line", minzoom: 8, paint: (isDark) => gradedSeamPaint(isDark, true) },
    ],
  },
  ],
  // <codemod:append JP_PACK_OVERLAY_SLOTS>
};
