/**
 * PF-7：統計配方明細（完整交付 JSON，含 release_options／fragment_context）的非同步載入點。
 *
 * 首屏只帶 `*.catalog.json`；需要 exact release selector 的地方（統計 loader、期別選單、
 * 醫療口徑切換、研究 dataset adapter）先 `await ensureStatisticsRecipeDetails(family)`。
 * PF-10：依家族（agri／social）分開 dynamic import，各自一個 chunk、各自註冊 loadingRegistry；
 * 開社會類統計只下載社會明細，反之亦然。不帶參數＝全部（研究 adapter、測試）。
 * 未載入就讀取明細會丟 STATISTICS_RECIPE_DETAILS_NOT_LOADED，不回空陣列冒充「沒有期別」。
 */
import { withLoading } from "../lib/loadingRegistry";
import type { AgriRecipeDocument } from "./agriStatisticsRecipes";
import type { SocialRecipeDocument } from "./socialStatisticsRecipes";

export const STATISTICS_RECIPE_DETAILS_NOT_LOADED = "STATISTICS_RECIPE_DETAILS_NOT_LOADED";

export type StatisticsRecipeFamily = "agri" | "social";
export const STATISTICS_RECIPE_FAMILIES: readonly StatisticsRecipeFamily[] = ["agri", "social"];

interface StatisticsRecipeDetails {
  agri: AgriRecipeDocument;
  social: SocialRecipeDocument;
}

// Literal dynamic imports so Vite emits one chunk per family.
const IMPORTERS: { [F in StatisticsRecipeFamily]: () => Promise<{ default: unknown }> } = {
  agri: () => import("./agriStatisticsRecipes.json?raw"),
  social: () => import("./socialStatisticsRecipes.json?raw"),
};
const LABELS: Record<StatisticsRecipeFamily, string> = {
  agri: "載入農業統計配方明細",
  social: "載入社會統計配方明細",
};

const details: Partial<StatisticsRecipeDetails> = {};
const pending: Partial<Record<StatisticsRecipeFamily, Promise<void>>> = {};
const listeners = new Set<() => void>();

// Vite/Vitest load `?raw` as a string, while the Node/tsx runtime used by
// audit scripts can expose the already-parsed JSON object.  Accept both.
function parseRaw<T>(raw: unknown): T {
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as T;
}

function familyList(families: StatisticsRecipeFamily | readonly StatisticsRecipeFamily[]): readonly StatisticsRecipeFamily[] {
  return typeof families === "string" ? [families] : families;
}

function ensureFamily(family: StatisticsRecipeFamily): Promise<void> {
  if (details[family]) return Promise.resolve();
  let promise = pending[family];
  if (!promise) {
    promise = withLoading(`statistics-recipe-details:${family}`, LABELS[family], IMPORTERS[family]())
      .then((module) => {
        (details as Record<StatisticsRecipeFamily, unknown>)[family] = parseRaw(module.default);
        for (const listener of listeners) listener();
      })
      .finally(() => {
        delete pending[family];
      });
    pending[family] = promise;
  }
  return promise;
}

/** 下載並解析指定家族的明細（預設全部）；並發呼叫共用同一個 Promise，失敗後可重試。 */
export function ensureStatisticsRecipeDetails(
  families: StatisticsRecipeFamily | readonly StatisticsRecipeFamily[] = STATISTICS_RECIPE_FAMILIES,
): Promise<void> {
  return Promise.all(familyList(families).map(ensureFamily)).then(() => undefined);
}

export function statisticsRecipeDetailsLoaded(
  families: StatisticsRecipeFamily | readonly StatisticsRecipeFamily[] = STATISTICS_RECIPE_FAMILIES,
): boolean {
  return familyList(families).every((family) => details[family] !== undefined);
}

export function subscribeStatisticsRecipeDetails(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function agriRecipeDetailsDocument(): AgriRecipeDocument {
  if (!details.agri) throw new Error(STATISTICS_RECIPE_DETAILS_NOT_LOADED);
  return details.agri;
}

export function socialRecipeDetailsDocument(): SocialRecipeDocument {
  if (!details.social) throw new Error(STATISTICS_RECIPE_DETAILS_NOT_LOADED);
  return details.social;
}
