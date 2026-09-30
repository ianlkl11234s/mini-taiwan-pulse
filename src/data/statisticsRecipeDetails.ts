/**
 * PF-7：統計配方明細（完整交付 JSON，含 release_options／fragment_context）的非同步載入點。
 *
 * 首屏只帶 `*.catalog.json`；需要 exact release selector 的地方（統計 loader、期別選單、
 * 醫療口徑切換、研究 dataset adapter）先 `await ensureStatisticsRecipeDetails()`。
 * 明細以 dynamic import 拆成獨立 chunk，並註冊 loadingRegistry（右上角顯示載入中）。
 * 未載入就讀取明細會丟 STATISTICS_RECIPE_DETAILS_NOT_LOADED，不回空陣列冒充「沒有期別」。
 */
import { withLoading } from "../lib/loadingRegistry";
import type { AgriRecipeDocument } from "./agriStatisticsRecipes";
import type { SocialRecipeDocument } from "./socialStatisticsRecipes";

export const STATISTICS_RECIPE_DETAILS_NOT_LOADED = "STATISTICS_RECIPE_DETAILS_NOT_LOADED";

interface StatisticsRecipeDetails {
  agri: AgriRecipeDocument;
  social: SocialRecipeDocument;
}

let details: StatisticsRecipeDetails | null = null;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

// Vite/Vitest load `?raw` as a string, while the Node/tsx runtime used by
// audit scripts can expose the already-parsed JSON object.  Accept both.
function parseRaw<T>(raw: unknown): T {
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as T;
}

/** 下載並解析明細；並發呼叫共用同一個 Promise，失敗後可重試。 */
export function ensureStatisticsRecipeDetails(): Promise<void> {
  if (details) return Promise.resolve();
  if (!pending) {
    pending = withLoading(
      "statistics-recipe-details",
      "載入統計配方明細",
      Promise.all([
        import("./agriStatisticsRecipes.json?raw"),
        import("./socialStatisticsRecipes.json?raw"),
      ]),
    ).then(([agri, social]) => {
      details = {
        agri: parseRaw<AgriRecipeDocument>(agri.default),
        social: parseRaw<SocialRecipeDocument>(social.default),
      };
      for (const listener of listeners) listener();
    }).finally(() => {
      pending = null;
    });
  }
  return pending;
}

export function statisticsRecipeDetailsLoaded(): boolean {
  return details !== null;
}

export function subscribeStatisticsRecipeDetails(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function loadedDetails(): StatisticsRecipeDetails {
  if (!details) throw new Error(STATISTICS_RECIPE_DETAILS_NOT_LOADED);
  return details;
}

export function agriRecipeDetailsDocument(): AgriRecipeDocument {
  return loadedDetails().agri;
}

export function socialRecipeDetailsDocument(): SocialRecipeDocument {
  return loadedDetails().social;
}
