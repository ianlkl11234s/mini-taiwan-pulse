/**
 * 右上載入狀態條的任務名稱在地化。
 *
 * loadingRegistry 註冊時傳入的顯示名稱是各 loader 寫死的中文（約 400 個呼叫點，
 * 許多是動態組字）。不逐一改呼叫點，而是在「畫到畫面上」這一刻翻譯：
 *   1. 中文介面、或名稱本身沒有中日文字 → 原樣顯示。
 *   2. 任務 id 對得到圖層 → 用 `layer.<key>` 的翻譯名稱（同圖層列）。
 *   3. 對不到 → 取名稱裡的拉丁字（例「LASS 渲染中」→「LASS」）。
 *   4. 都沒有 → 依 id 形狀取 `loading.*` 通用名稱（預設「資料」）。
 * 名稱裡的年份、日期、時間（動態部分）一律保留。
 */
import { LAYER_MANIFEST, type ManifestKey } from "../data/layerManifest";
import { isLoadingTaskForLayer } from "./layerLoading";
import { localizeLayerName, type I18nContext } from "../i18n/layerText";
import type { MessageKey } from "../i18n/keys";
import type { Locale } from "../i18n/locales";

const HAS_CJK = /[぀-ヿ㐀-鿿]/;
const CJK_RUN = /[぀-ヿ㐀-鿿＀-￯、。・·]+/g;
/** 動態片段：年份、日期（2026-04-08）、時間（12:30）、其他數字 */
const DYNAMIC_TOKEN = /\d{4}(?:[-/.]\d{1,2}){1,2}|\d{1,2}:\d{2}|\d+(?:\.\d+)?/g;

export interface LoadingLabelContext extends I18nContext {
  t: (key: MessageKey) => string;
}

/** 對不到圖層、又沒有拉丁字可用的任務：依 id 形狀給較具體的通用名稱。 */
function genericKeyForTask(id: string): MessageKey {
  if (id.startsWith("research:")) return "loading.research";
  if (id.includes("private-access")) return "loading.privateAccess";
  if (id.startsWith("analysis-card")) return "loading.analysisCard";
  if (id.startsWith("member-write")) return "loading.saveContent";
  return "loading.generic";
}

const layerKeyCache = new Map<string, string | null>();

/** 任務 id → 圖層 key（盡力比對；多個命中時取最長 key，較具體）。 */
export function layerKeyForLoadingTask(taskId: string): string | null {
  const cached = layerKeyCache.get(taskId);
  if (cached !== undefined) return cached;
  let best: string | null = null;
  for (const key of Object.keys(LAYER_MANIFEST)) {
    if (best != null && key.length <= best.length) continue;
    if (isLoadingTaskForLayer(taskId, key)) best = key;
  }
  layerKeyCache.set(taskId, best);
  return best;
}

export function localizeLoadingLabel(id: string, label: string, ctx: LoadingLabelContext): string {
  if (ctx.active === ("zh-TW" satisfies Locale) || !HAS_CJK.test(label)) return label;

  const tokens = label.match(DYNAMIC_TOKEN) ?? [];
  const withTokens = (base: string) => {
    const extra = tokens.filter((token) => !base.includes(token));
    return extra.length ? `${base} ${extra.join(" ")}` : base;
  };

  const layerKey = layerKeyForLoadingTask(id);
  if (layerKey) {
    const entry = LAYER_MANIFEST[layerKey as ManifestKey] as { name?: Parameters<typeof localizeLayerName>[1] } | undefined;
    if (entry?.name) {
      const { primary } = localizeLayerName(layerKey, entry.name, ctx);
      // 日文名稱本身含漢字／假名，所以只要不是中文原名就算翻譯過
      if (primary !== entry.name.zh && (ctx.active === "ja" || !HAS_CJK.test(primary))) return withTokens(primary);
    }
  }

  const latin = label.replace(CJK_RUN, " ").replace(DYNAMIC_TOKEN, " ").replace(/[^\p{L}\s\-_/]/gu, " ").replace(/\s+/g, " ").trim();
  if (/[A-Za-z]{2,}/.test(latin)) return withTokens(latin);
  return withTokens(ctx.t(genericKeyForTask(id)));
}
