// 圖層目錄查詢工具 — 讓模型按需查 key/label，避免把 231 個圖層塞進 system prompt。
// 清單類回傳一律過 capToolResult。

import { tool } from "ai";
import { z } from "zod";
import type { MapBridge } from "../types";
import { THEMES, LAYER_LABELS } from "../../components/sidebar/layerCatalog";
import { capToolResult } from "./truncate";
import { callWhitelistedRpc } from "./rpcTools";

interface LayerRef {
  key: string;
  label: string;
}

function themeLayers(theme: (typeof THEMES)[number]): LayerRef[] {
  return theme.groups.flatMap((g) => g.layers.map((l) => ({ key: l.key, label: l.label })));
}

// ── get_layer_details 用：從 THEMES 反查圖層所屬主題 / 子群 ──
interface LayerDetail {
  key: string;
  found: boolean;
  label?: string;
  theme?: string;
  group?: string;
  visibleNow?: boolean;
  /** 上游資料來源（get_data_catalog_for_layer 的結果；查不到時回說明字串）*/
  source?: unknown;
  note?: string;
}

function locateLayer(key: string): { label: string; theme: string; group: string } | null {
  for (const t of THEMES) {
    for (const g of t.groups) {
      const l = g.layers.find((layer) => layer.key === key);
      if (l) return { label: l.label, theme: t.title, group: g.title };
    }
  }
  return null;
}

const MAX_DETAIL_KEYS = 5;

/**
 * 彙整一組圖層的細節（label + 主題/子群 + 上游資料來源）。
 * 上游來源透過白名單 RPC get_data_catalog_for_layer 取得，失敗時 graceful 降級只回 catalog 資訊。
 * keys 超過 MAX_DETAIL_KEYS 個自動截斷。抽成 export 供測試。
 */
export async function collectLayerDetails(keys: string[], bridge: MapBridge) {
  const use = keys.slice(0, MAX_DETAIL_KEYS);
  const truncatedKeys = keys.length > MAX_DETAIL_KEYS;
  const visible = new Set(bridge.getVisibleLayerKeys());
  const details = await Promise.all(
    use.map(async (key): Promise<LayerDetail> => {
      const loc = locateLayer(key);
      if (!loc) {
        return { key, found: false, note: `找不到圖層 key「${key}」，請先用 search_layers 確認` };
      }
      const r = await callWhitelistedRpc("get_data_catalog_for_layer", { p_layer_key: key });
      return {
        key,
        found: true,
        label: loc.label,
        theme: loc.theme,
        group: loc.group,
        visibleNow: visible.has(key),
        source: r.ok ? r.result : `（查無上游來源：${r.error}）`,
      };
    }),
  );
  const foundCount = details.filter((d) => d.found).length;
  return {
    summary: `已彙整 ${foundCount}/${use.length} 個圖層細節${
      truncatedKeys ? `（keys 超過 ${MAX_DETAIL_KEYS} 個，僅取前 ${MAX_DETAIL_KEYS}）` : ""
    }`,
    truncatedKeys,
    requested: keys.length,
    details: capToolResult(details, { maxItems: MAX_DETAIL_KEYS }),
  };
}

export function catalogTools(bridge: MapBridge) {
  return {
    list_layers: tool({
      description:
        "列出某個主題底下的所有圖層（回 {key,label}）。theme 用主題名，可只給中文或英文片段，例如「交通」「Water」。",
      inputSchema: z.object({
        theme: z.string().describe("主題名片段，例如「水資源」「Hazard」"),
      }),
      execute: ({ theme }) => {
        const q = theme.trim().toLowerCase();
        const matched = THEMES.find((t) => t.title.toLowerCase().includes(q));
        if (!matched) {
          return {
            summary: `找不到主題「${theme}」`,
            themes: THEMES.map((t) => t.title),
            note: "theme 不符，請從 themes 清單挑一個重試",
          };
        }
        const layers = themeLayers(matched);
        const visible = new Set(bridge.getVisibleLayerKeys());
        const visibleNow = layers.filter((l) => visible.has(l.key)).map((l) => l.key);
        return {
          summary: `主題「${matched.title}」共 ${layers.length} 個圖層，目前開啟 ${visibleNow.length} 個`,
          theme: matched.title,
          total: layers.length,
          layers: capToolResult(layers),
          visibleNow,
        };
      },
    }),

    search_layers: tool({
      description: "以中英文關鍵字模糊搜尋圖層名稱，回前 10 筆 {key,label}。",
      inputSchema: z.object({
        query: z.string().describe("關鍵字，例如「消防」「flood」「bus」"),
      }),
      execute: ({ query }) => {
        const q = query.trim().toLowerCase();
        const hits: LayerRef[] = [];
        for (const [key, label] of Object.entries(LAYER_LABELS)) {
          if (!label) continue;
          if (key.toLowerCase().includes(q) || label.toLowerCase().includes(q)) {
            hits.push({ key, label });
          }
        }
        const results = hits.slice(0, 10);
        const visible = new Set(bridge.getVisibleLayerKeys());
        const visibleNow = results.filter((l) => visible.has(l.key)).map((l) => l.key);
        return {
          summary: `搜尋「${query}」找到 ${hits.length} 筆${hits.length > 10 ? "（顯示前 10）" : ""}`,
          query,
          total: hits.length,
          results: capToolResult(results, { maxItems: 10 }),
          visibleNow,
        };
      },
    }),

    get_layer_details: tool({
      description:
        "彙整一組圖層的細節：中文名、所屬主題 / 子群、上游資料來源、是否已開啟。回答『圖層之間的關係』『資料哪來的』『建議怎麼用 / 怎麼疊圖』之前，先用這支拿脈絡。keys 上限 5 個（超過自動截斷）。",
      inputSchema: z.object({
        keys: z
          .array(z.string())
          .describe("圖層 key 陣列（先用 list_layers / search_layers 找），上限 5 個"),
      }),
      execute: ({ keys }) => collectLayerDetails(keys, bridge),
    }),
  };
}
