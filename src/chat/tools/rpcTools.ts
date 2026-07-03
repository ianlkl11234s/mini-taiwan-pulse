// Supabase RPC 白名單 — call_rpc 只能呼叫這裡列的薄 RPC，白名單外一律拒絕。
// 全部走 public schema 既有 anon RPC，零新增 DB 暴露面；回傳過 capToolResult。
// 參數 schema 用 zod；param 名稱對齊 migration 的 function 參數名（前端 supabase.rpc 具名傳參）。

import { z } from "zod";
import { supabase } from "../../lib/supabase";
import { withLoading } from "../../lib/loadingRegistry";
import { capToolResult } from "./truncate";

export interface RpcSpec {
  params: z.ZodType<Record<string, unknown>>;
  label: string;
  /** 給 LLM：這支 RPC 何時用 */
  description: string;
}

export const RPC_WHITELIST: Record<string, RpcSpec> = {
  // ── 資料目錄（migration 269）──
  get_data_catalog_by_theme: {
    params: z.object({ p_theme: z.string().nullish() }),
    label: "資料目錄（主題）",
    description:
      "查某主題底下有哪些上游資料集（來源機關 / 授權 / 更新頻率）。p_theme 省略則回全部。回答「有哪些 X 相關的資料 / 來源」。",
  },
  get_data_catalog_for_layer: {
    params: z.object({ p_layer_key: z.string() }),
    label: "資料目錄（圖層）",
    description:
      "查某個圖層 key 對應的上游資料來源。p_layer_key 為圖層 key（先用 search_layers 找）。回答「這個圖層的資料哪來的」。",
  },

  // ── 火災事件（migration 064）──
  get_fire_event_years: {
    params: z.object({}),
    label: "火災年份",
    description:
      "回可用的火災事件年份與每年筆數（極輕量）。回答火災「哪幾年有資料 / 每年幾件」優先用這支，不要拉全部事件。",
  },
  get_fire_events_by_year: {
    params: z.object({ target_year: z.number().int() }),
    label: "火災事件",
    description:
      "取某民國年的火災事件（一年約 1.6 萬筆，回傳會被截斷成樣本 + 總數）。需要縣市 / 成因 / 時段細節時才用；純數量請改用 get_fire_event_years。",
  },

  // ── H3 年度人口指標（migration 020）──
  get_h3_demographics_yearly: {
    params: z.object({
      target_year: z.number().int(),
      target_resolution: z.number().int().optional(),
    }),
    label: "H3 年度人口",
    description:
      "取某年 H3 六角格人口統計（人口 / 戶數 / 性別比 / 扶養比 / 老化指數等，res 預設 7）。資料量大會被截斷；適合抓某年概況。",
  },
  get_h3_demographics_years: {
    params: z.object({}),
    label: "H3 人口年份",
    description: "回 H3 年度人口有哪些年份 / 解析度（極輕量）。挑年份前先問這支。",
  },

  // ── 廢棄物設施數量（薄計數，全國）──
  get_waste_facility_counts: {
    params: z.object({}),
    label: "廢棄物處理設施數量",
    description:
      "回各類廢棄物『處理設施』的數量（facility_type × n）：incinerator 焚化爐 / landfill 衛生掩埋場 / landfill_coastal 濱海掩埋場 / transfer 轉運站 / medical 醫療廢棄物 / monitoring 地下水監測井 / recycling 資源回收廠 / scrap 廢車廢金屬 / other 其他事廢。回答「全台幾個掩埋場 / 焚化爐」用這支（極輕量，不要拉全部點位）。",
  },
  get_waste_disposal_point_counts: {
    params: z.object({}),
    label: "廢棄物投放點數量",
    description:
      "回各類回收 / 垃圾『投放點』數量（point_type × source × n）：衣物回收箱 / 混合投放點 / 街頭資收桶 / 電池回收 等。回答「全台幾個衣物回收箱 / 投放點」用這支（極輕量）。",
  },

  // ── 資料源健康 ──
  get_source_health: {
    params: z.object({}),
    label: "資料源健康",
    description: "各動態資料源的最新更新時間 / 健康狀態。回答「資料新不新 / 哪些源掛了」。",
  },

  // ── 熱門新聞事件 ──
  get_news_trending: {
    params: z.object({
      p_window_hours: z.number().int().positive(),
      p_limit: z.number().int().positive(),
    }),
    label: "熱門新聞",
    description:
      "取近 p_window_hours 小時內的熱門新聞事件（p_limit 筆）。回答「最近在關注什麼 / 熱門事件」。",
  },
};

export async function callWhitelistedRpc(
  name: string,
  params: unknown,
): Promise<
  | { ok: true; result: unknown }
  | { ok: false; error: string }
> {
  const spec = RPC_WHITELIST[name];
  if (!spec) {
    return { ok: false, error: `未授權的 RPC：${name}（僅允許白名單內的查詢）` };
  }
  const parsed = spec.params.safeParse(params ?? {});
  if (!parsed.success) {
    return { ok: false, error: `參數不符：${parsed.error.issues.map((i) => i.message).join("; ")}` };
  }
  const { data, error } = await withLoading(
    `chat-rpc:${name}`,
    spec.label,
    supabase.rpc(name, parsed.data as Record<string, unknown>),
  );
  if (error) return { ok: false, error: error.message };
  const rows = Array.isArray(data) ? data : data == null ? [] : [data];
  return { ok: true, result: capToolResult(rows as unknown[]) };
}
