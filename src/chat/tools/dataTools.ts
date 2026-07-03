// 資料查詢工具 — 組裝 query_dataset / rank_by_population / call_rpc 給 agent。
// 照 mapTools.ts 的 tool() 寫法；每個回傳都含繁中 summary（UI chip 用）。
// 安全邊界：資料集 / RPC 皆白名單，LLM 不產 SQL；清單類輸出全過 capToolResult。

import { tool } from "ai";
import { z } from "zod";
import type { MapBridge } from "../types";
import { DATASET_WHITELIST } from "./datasets";
import {
  fetchDataset,
  countDataset,
  groupByField,
  filterEqField,
  filterContainsField,
  nearestPoints,
  pointOf,
  nameOf,
} from "./geojsonQuery";
import { rankPointsByPopulation } from "./h3Population";
import { RPC_WHITELIST, callWhitelistedRpc } from "./rpcTools";

const DATASET_LIST = Object.entries(DATASET_WHITELIST)
  .map(([id, m]) => `  - ${id}：${m.description}`)
  .join("\n");

const RPC_LIST = Object.entries(RPC_WHITELIST)
  .map(([name, s]) => `  - ${name}：${s.description}`)
  .join("\n");

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function dataTools(_bridge: MapBridge) {
  return {
    query_dataset: tool({
      description:
        "查詢靜態點位資料集的統計（數量 / 分類佔比 / 篩選 / 最近點）。回答「全台幾個 X」「X 分哪幾類、各多少」「離某地最近的 X」等。\n" +
        "op：count（總數 + 可用欄位）、groupBy（依 field 分類計數，需 field）、filterEq（field==value 精確比對的筆數，需 field+value）、filterContains（field 文字包含 value，不分大小寫，需 field+value）、nearest（離 lng,lat 最近 k 個，需 lng+lat）。\n" +
        "地址/名稱類篩選用 filterContains（例：address 含 臺北市）；精確分類值用 filterEq；不確定值域先 groupBy。\n" +
        "查 0 筆或欄位不存在時，回傳會附 availableFields / fieldSamples / hint，請依此換欄位或換 op 再查一次，不要放棄。\n" +
        `可用 datasetId：\n${DATASET_LIST}`,
      inputSchema: z.object({
        datasetId: z.string().describe("白名單資料集 id，例如 policeStations"),
        op: z.enum(["count", "groupBy", "filterEq", "filterContains", "nearest"]),
        field: z.string().optional().describe("groupBy / filterEq / filterContains 用的欄位名"),
        value: z.string().optional().describe("filterEq / filterContains 的比對值"),
        lng: z.number().optional().describe("nearest 的原點經度"),
        lat: z.number().optional().describe("nearest 的原點緯度"),
        k: z.number().optional().describe("nearest 取幾個，預設 5"),
      }),
      execute: async ({ datasetId, op, field, value, lng, lat, k }) => {
        const meta = DATASET_WHITELIST[datasetId];
        if (!meta) {
          return {
            summary: `未授權資料集：${datasetId}`,
            error: `datasetId「${datasetId}」不在白名單`,
            available: Object.keys(DATASET_WHITELIST),
          };
        }
        let features;
        try {
          features = await fetchDataset(datasetId);
        } catch (e) {
          return { summary: `載入 ${meta.label} 失敗`, error: (e as Error).message };
        }

        switch (op) {
          case "count": {
            const r = countDataset(features);
            return { summary: `${meta.label} 共 ${r.total} 筆`, datasetId, ...r };
          }
          case "groupBy": {
            if (!field) return { summary: "groupBy 需要 field 參數" };
            const r = groupByField(features, field);
            const distinct = "distinct" in r ? r.distinct : 0;
            return {
              summary:
                "error" in r
                  ? `${meta.label}：${r.error}`
                  : `${meta.label} 依 ${field} 分 ${distinct} 類（共 ${features.length} 筆）`,
              datasetId,
              ...r,
            };
          }
          case "filterEq": {
            if (!field || value === undefined)
              return { summary: "filterEq 需要 field 與 value 參數" };
            const r = filterEqField(features, field, value);
            return {
              summary:
                "error" in r
                  ? `${meta.label}：${r.error}`
                  : `${meta.label} 中 ${field}=${value} 共 ${r.matched} 筆`,
              datasetId,
              ...r,
            };
          }
          case "filterContains": {
            if (!field || value === undefined)
              return { summary: "filterContains 需要 field 與 value 參數" };
            const r = filterContainsField(features, field, value);
            return {
              summary:
                "error" in r
                  ? `${meta.label}：${r.error}`
                  : `${meta.label} 中 ${field} 含「${value}」共 ${r.matched} 筆`,
              datasetId,
              ...r,
            };
          }
          case "nearest": {
            if (lng === undefined || lat === undefined)
              return { summary: "nearest 需要 lng 與 lat 參數" };
            const r = nearestPoints(features, lng, lat, k ?? 5);
            return { summary: `${meta.label}：已找出最近 ${k ?? 5} 個點`, datasetId, ...r };
          }
        }
      },
    }),

    rank_by_population: tool({
      description:
        "把某資料集的點位對到 H3 人口網格，依「附近人口密度」排名。回答「哪些消防分隊 / 醫院附近人口最多」這類問題。metric：day 日間人口 / night 夜間人口（預設 night）。",
      inputSchema: z.object({
        datasetId: z.string().describe("白名單資料集 id，例如 fireStations"),
        topN: z.number().optional().describe("回前幾名，預設 10"),
        metric: z.enum(["day", "night"]).optional().describe("day 日間 / night 夜間人口"),
      }),
      execute: async ({ datasetId, topN, metric }) => {
        const meta = DATASET_WHITELIST[datasetId];
        if (!meta) {
          return {
            summary: `未授權資料集：${datasetId}`,
            error: `datasetId「${datasetId}」不在白名單`,
            available: Object.keys(DATASET_WHITELIST),
          };
        }
        let features;
        try {
          features = await fetchDataset(datasetId);
        } catch (e) {
          return { summary: `載入 ${meta.label} 失敗`, error: (e as Error).message };
        }
        const points = features
          .map((f) => {
            const pt = pointOf(f);
            return pt ? { lng: pt[0], lat: pt[1], name: nameOf(f.properties ?? {}) } : null;
          })
          .filter((p): p is { lng: number; lat: number; name: string } => p !== null);

        const n = topN ?? 10;
        const m = metric ?? "night";
        const r = await rankPointsByPopulation(points, n, m);
        return {
          summary: `${meta.label} 依${m === "day" ? "日" : "夜"}間人口密度排名（top ${n}）`,
          datasetId,
          ...r,
        };
      },
    }),

    call_rpc: tool({
      description:
        "呼叫白名單內的 Supabase 唯讀 RPC，回答時序 / 事件 / 資料目錄類問題。name 必須在白名單內，params 依該 RPC 需求給。\n" +
        `可用 RPC：\n${RPC_LIST}`,
      inputSchema: z.object({
        name: z.string().describe("白名單 RPC 名稱，例如 get_data_catalog_by_theme"),
        params: z.record(z.string(), z.unknown()).optional().describe("該 RPC 的參數物件"),
      }),
      execute: async ({ name, params }) => {
        const r = await callWhitelistedRpc(name, params ?? {});
        return {
          summary: r.ok ? `已呼叫 RPC ${name}` : `RPC ${name} 失敗：${r.error}`,
          name,
          ...r,
        };
      },
    }),
  };
}
