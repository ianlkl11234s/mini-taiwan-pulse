/**
 * `/card/<slug>` 卡片頁（viz-library 4b）。狀態機：
 *   slug 格式不符 → 「連結無效」（不打 RPC）
 *   RPC 0 列（不存在／已撤銷／已過期）或 payload 驗證不過 → 「這張卡片已失效」
 *   網路／HTTP 錯誤 → 「暫時無法載入」（不能說成失效）
 *   成功 → 4:5 卡片；地圖另外 lazy 載入（MapLibre 較大，先讓文字出來）
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { AnalysisCard, CardMapFallback, CardNotice } from "./AnalysisCard";
import { cardApiConfigFromEnv, fetchAnalysisCard, type CardApiConfig, type CardFetchResult } from "./cardApi";
import { parseCardSlug } from "./cardPayload";
import { useLocale } from "../state/localeStore";

const CardMap = lazy(() => import("./CardMap"));

export type CardPageState = { status: "invalid" } | { status: "loading" } | CardFetchResult;

export function CardPageView({ state }: { state: CardPageState }) {
  const { t } = useLocale();
  if (state.status === "invalid") return <CardNotice title={t("analysisCard.invalidTitle")} detail={t("analysisCard.invalidDetail")} />;
  if (state.status === "loading") return <CardNotice title={t("analysisCard.loadingTitle")} detail={t("analysisCard.loadingDetail")} />;
  if (state.status === "gone") return <CardNotice title={t("analysisCard.goneTitle")} detail={t("analysisCard.goneDetail")} />;
  if (state.status === "error") return <CardNotice title={t("analysisCard.errorTitle")} detail={t("analysisCard.errorDetail")} />;
  return <AnalysisCard payload={state.payload} expiresAt={state.expiresAt} mapSlot={<Suspense fallback={<CardMapFallback message={t("analysisCard.mapLoading")} />}><CardMap payload={state.payload} /></Suspense>} />;
}

export function CardApp({ pathname = window.location.pathname, config = cardApiConfigFromEnv() }: { pathname?: string; config?: CardApiConfig }) {
  const slug = parseCardSlug(pathname);
  const [state, setState] = useState<CardPageState>(slug ? { status: "loading" } : { status: "invalid" });
  useEffect(() => {
    if (!slug) return;
    const abort = new AbortController();
    void fetchAnalysisCard(slug, config, abort.signal).then(result => { if (!abort.signal.aborted) setState(result); });
    return () => abort.abort();
    // config 只在首次 render 讀一次 env；slug 由網址決定。
  }, [slug]);
  const { t, active } = useLocale();
  useEffect(() => {
    if (state.status === "ok") document.title = t("analysisCard.docTitle", { title: state.payload.title });
    // t 隨語系換新；active 變了才需重設標題
  }, [state, active]);
  return <main className="analysis-card-page"><CardPageView state={state} /></main>;
}
