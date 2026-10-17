/**
 * 統計圖層的顯示層翻譯。配方（`*StatisticsRecipes.ts` 與打包 JSON）的中文是正本：
 * 單位要跟 R2 指標比對（loader 的契約檢查）、配色依中文 label 判斷、Agent 與分析倉庫也讀中文，
 * 所以只在畫面上換語系，不改配方。
 *
 * - 標題：借圖層名 `layer.<renderKey>`（layers.json 已有），沒有再回退配方中文。
 * - 單位、更新頻率：用中文原文當 key（`enum.statUnit.人／每萬人口`），翻一次所有配方通用。
 */
import type { I18nContext } from "./layerText";
import { demographicsYtdText } from "../data/demographicsStatisticsRecipes";

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

const VARIANT_PREFIX = /^(縣市|鄉鎮市區|鄉鎮|村里（僅 115 年 8 月）)[：・](.+)$/u;
const VARIANT_RATE = /^(.+?)(?:－|（)(每萬名居民|每萬人口|每平方公里)）?$/u;
const VARIANT_COMPARE = /^(.+)（人口比較）$/u;
const VARIANT_DETAIL = /^(.+?)－(.+)$/u;
const VARIANT_YTD = /^(.+)（(\d+) 年 (\d+)–(\d+) 月累計）$/u;

/**
 * 統計群組「指標／口徑」選項的短句翻譯。拆「地理層級：」前綴與「（115 年 1–8 月累計）」尾註，
 * 其餘片段查 `enum.statVariant.<中文>`；任何一段查不到回 null，由呼叫端退回圖層譯名（不顯示中文）。
 * 中文介面原樣回傳。
 */
export function statisticsVariantLabel(zh: string, i18n: I18nContext): string | null {
  if (i18n.active === "zh-TW") return zh;
  const sep = i18n.lookup("statisticsSelect.colon") ?? ": ";
  const prefix = VARIANT_PREFIX.exec(zh);
  if (prefix) {
    const level = i18n.lookup(`enum.statVariant.${prefix[1]}`);
    const rest = statisticsVariantLabel(prefix[2]!, i18n);
    return level && rest ? `${level}${sep}${rest}` : null;
  }
  const ytd = VARIANT_YTD.exec(zh);
  if (ytd) {
    const base = statisticsVariantLabel(ytd[1]!, i18n);
    const template = i18n.lookup("statisticsSelect.variantWithPeriod");
    if (!base || !template) return null;
    const period = demographicsYtdText({ roc_year: ytd[2]!, start_month: Number(ytd[3]), end_month: Number(ytd[4]) }, i18n);
    return template.replace("{label}", base).replace("{period}", period);
  }
  const rate = VARIANT_RATE.exec(zh);
  if (rate) {
    const base = statisticsVariantLabel(rate[1]!, i18n);
    const template = i18n.lookup(rate[2] === "每平方公里" ? "statisticsSelect.metricPerKm2" : "statisticsSelect.metricPerResidents");
    return base && template ? template.replace("{base}", base) : null;
  }
  const compare = VARIANT_COMPARE.exec(zh);
  if (compare) {
    const base = statisticsVariantLabel(compare[1]!, i18n);
    const template = i18n.lookup("statisticsSelect.variantPopCompare");
    return base && template ? template.replace("{label}", base) : null;
  }
  const detail = VARIANT_DETAIL.exec(zh);
  if (detail) {
    const base = statisticsVariantLabel(detail[1]!, i18n);
    const part = statisticsVariantLabel(detail[2]!, i18n);
    const template = i18n.lookup("statisticsSelect.variantDetail");
    return base && part && template ? template.replace("{label}", base).replace("{detail}", part) : null;
  }
  return i18n.lookup(`enum.statVariant.${zh}`);
}

const CJK = /[㐀-鿿]/u;

function textEnum(domain: string, zh: string, { active, lookup }: I18nContext): string {
  if (active === "zh-TW" || !CJK.test(zh)) return zh;
  return lookup(`enum.${domain}.${zh}`) ?? zh;
}
