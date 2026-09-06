// 地圖操作工具 — 執行體全部打 MapBridge（App.tsx 注入）。
// 只做「動作」，不回傳大資料，故不需 capToolResult。

import { tool } from "ai";
import { z } from "zod";
import type { MapBridge } from "../types";
import { LAYER_LABELS } from "../../components/sidebar/layerCatalog";
import { ALL_PRESETS, getPresetById } from "../../map/cameraPresets";
import { isStatisticsChoropleth } from "../../data/statisticsLayerRegistry";

// 台灣範圍（含外島：金門 118.36 / 馬祖 26.2 / 澎湖 / 綠島）
const LNG_MIN = 118;
const LNG_MAX = 123;
const LAT_MIN = 21.5;
const LAT_MAX = 26.5;

const PRESET_LIST = ALL_PRESETS.map((p) => `${p.id}（${p.name}）`).join("、");

export function mapTools(bridge: MapBridge) {
  return {
    set_layers: tool({
      description:
        "開啟或關閉指定圖層。keys 必須是圖層 key（非顯示名）；不確定 key 時先用 list_layers 或 search_layers 查。",
      inputSchema: z.object({
        keys: z.array(z.string()).describe("圖層 key 陣列，例如 ['countyBoundary']"),
        visible: z.boolean().describe("true = 開啟，false = 關閉"),
      }),
      execute: ({ keys, visible }) => {
        const valid = new Set(Object.keys(LAYER_LABELS));
        const applied = keys.filter((k) => valid.has(k));
        const invalid = keys.filter((k) => !valid.has(k));
        const visibleBefore = bridge.getVisibleLayerKeys();
        if (applied.length > 0) bridge.bulkSetVisibility(applied, visible);
        const visibleNow = bridge.getVisibleLayerKeys();
        const visibleStatistics = visibleNow.filter(isStatisticsChoropleth);
        const replacedStatistics = visibleBefore.filter(isStatisticsChoropleth).filter((key) => !visibleNow.includes(key));
        const action = visible ? "開啟" : "關閉";
        const summary =
          applied.length > 0
            ? `${action}後目前可見 ${visibleNow.length} 個圖層${visibleStatistics.length ? `；統計面：${visibleStatistics.join("、")}` : ""}${replacedStatistics.length ? `；已替換：${replacedStatistics.join("、")}` : ""}${invalid.length ? `（${invalid.length} 個無效 key 已略過）` : ""}`
            : `無有效 key 可${action}${invalid.length ? `（${invalid.join("、")} 皆無效）` : ""}`;
        return { summary, applied, invalid, visible, visibleNow, visibleStatistics, replacedStatistics };
      },
    }),

    all_layers_off: tool({
      description: "關閉目前所有已開啟的圖層，回到乾淨畫面。",
      inputSchema: z.object({}),
      execute: () => {
        bridge.allOff();
        return { summary: "已關閉所有圖層" };
      },
    }),

    fly_to: tool({
      description: "把地圖鏡頭飛到指定經緯度（僅限台灣範圍）；zoom 省略則用預設。",
      inputSchema: z.object({
        lng: z.number().describe("經度 118–123"),
        lat: z.number().describe("緯度 21.5–26.5"),
        zoom: z.number().optional().describe("縮放 6–16，省略用預設"),
      }),
      execute: ({ lng, lat, zoom }) => {
        if (lng < LNG_MIN || lng > LNG_MAX || lat < LAT_MIN || lat > LAT_MAX) {
          return { ok: false, summary: `座標 (${lng}, ${lat}) 超出台灣範圍，已拒絕` };
        }
        bridge.flyTo(lng, lat, zoom);
        return { ok: true, summary: `已飛往 (${lng.toFixed(3)}, ${lat.toFixed(3)})` };
      },
    }),

    jump_to_place: tool({
      description: `跳到具名地點（城市 / 機場 / 時空場景）。可用 presetId：${PRESET_LIST}`,
      inputSchema: z.object({
        presetId: z.string().describe("預設地點 id，例如 taipei、RCTP、scene-penghu-fishing"),
      }),
      execute: ({ presetId }) => {
        const ok = bridge.jumpToPlace(presetId);
        const preset = getPresetById(presetId);
        return ok
          ? { ok: true, summary: `已跳至 ${preset ? preset.name : presetId}` }
          : { ok: false, summary: `找不到地點 id：${presetId}` };
      },
    }),

    highlight_point: tool({
      description: "在地圖上標記一個點位（含選填文字標籤）。",
      inputSchema: z.object({
        lng: z.number().describe("經度"),
        lat: z.number().describe("緯度"),
        label: z.string().optional().describe("標籤文字"),
      }),
      execute: ({ lng, lat, label }) => {
        bridge.highlightPoint(
          lng,
          lat,
          label ? "chat-highlight" : undefined,
          label ? { label } : undefined,
        );
        return {
          summary: `已標記${label ? `「${label}」` : "座標"} (${lng.toFixed(3)}, ${lat.toFixed(3)})`,
        };
      },
    }),
  };
}
