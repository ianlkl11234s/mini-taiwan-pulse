/**
 * 統計圖層的顯示層翻譯。配方（`*StatisticsRecipes.ts` 與打包 JSON）的中文是正本：
 * 單位要跟 R2 指標比對（loader 的契約檢查）、配色依中文 label 判斷、Agent 與分析倉庫也讀中文，
 * 所以只在畫面上換語系，不改配方。
 *
 * - 標題：借圖層名 `layer.<renderKey>`（layers.json 已有），沒有再回退配方中文。
 * - 單位、更新頻率：用中文原文當 key（`enum.statUnit.人／每萬人口`），翻一次所有配方通用。
 */
import type { I18nContext } from "./layerText";

/** 統計圖層標題：優先圖層譯名，沒有回退配方中文 */
export function statisticsTitle(layerKey: string, zh: string, { active, lookup }: I18nContext): string {
  if (active === "zh-TW") return zh;
  return lookup(`layer.${layerKey}`) ?? zh;
}

/** 單位（`%`、`TWD` 這類不含中文的原樣回傳） */
export function statisticsUnit(zh: string, i18n: I18nContext): string {
  return textEnum("statUnit", zh, i18n);
}

/** 配方的更新頻率說明（「年度」「每月」「9 個已交付期別」） */
export function statisticsFrequency(zh: string, i18n: I18nContext): string {
  return textEnum("statFrequency", zh, i18n);
}

const CJK = /[㐀-鿿]/u;

function textEnum(domain: string, zh: string, { active, lookup }: I18nContext): string {
  if (active === "zh-TW" || !CJK.test(zh)) return zh;
  return lookup(`enum.${domain}.${zh}`) ?? zh;
}
