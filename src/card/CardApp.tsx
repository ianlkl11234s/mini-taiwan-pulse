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

const CardMap = lazy(() => import("./CardMap"));

export type CardPageState = { status: "invalid" } | { status: "loading" } | CardFetchResult;

export function CardPageView({ state }: { state: CardPageState }) {
  if (state.status === "invalid") return <CardNotice title="連結無效" detail="這個卡片連結的格式不正確，請向分享者確認完整網址。" />;
  if (state.status === "loading") return <CardNotice title="卡片載入中" detail="正在讀取這張分析卡。" />;
  if (state.status === "gone") return <CardNotice title="這張卡片已失效" detail="卡片可能已到期、被分享者撤銷，或連結不存在。" />;
  if (state.status === "error") return <CardNotice title="卡片暫時無法載入" detail="讀取服務暫時沒有回應，請稍後重新整理。" />;
  return <AnalysisCard payload={state.payload} expiresAt={state.expiresAt} mapSlot={<Suspense fallback={<CardMapFallback message="地圖載入中" />}><CardMap payload={state.payload} /></Suspense>} />;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
  useEffect(() => {
    if (state.status === "ok") document.title = `${state.payload.title} — Mini Taiwan Pulse 分析卡`;
  }, [state]);
  return <main className="analysis-card-page"><CardPageView state={state} /></main>;
}
