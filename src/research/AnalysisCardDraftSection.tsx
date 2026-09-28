/**
 * Agent 面板「卡片草稿」（viz-library 4b）：縮小預覽（與 /card 頁同一個 AnalysisCard）、
 * 授權閘門訊息、「發布連結」「捨棄」。發布用主站已登入的 supabase client（owner JWT）；
 * Agent 永遠不能自行發布（使用者拍板 8），只有這個按鈕會呼叫 publish_analysis_card。
 */
import { lazy, Suspense, useState } from "react";
import { AnalysisCard, CardMapFallback } from "../card/AnalysisCard";
import { taipeiDate } from "../card/cardStyle";
import { publishAnalysisCard, type CardActionResult } from "../lib/analysisCardApi";
import type { AnalysisCardDraft } from "./analysisCardDraft";
import "../card/card.css";

const CardMap = lazy(() => import("../card/CardMap"));

export type Publish = (payload: unknown) => Promise<CardActionResult<{ slug: string; expiresAt: string; url: string }>>;
export type PublishState = { phase: "idle" } | { phase: "publishing" } | { phase: "published"; url: string; expiresAt: string } | { phase: "error"; message: string };

/** 「發布連結」的狀態轉移（抽出來讓測試不需 DOM）。閘門不通過時不呼叫 RPC。 */
export async function publishDraft(draft: AnalysisCardDraft, publish: Publish): Promise<PublishState> {
  if (!draft.gate.publishable) return { phase: "error", message: draft.gate.message || "這份結果的資料還不能公開分享。" };
  const result = await publish(draft.payload);
  return result.ok ? { phase: "published", url: result.value.url, expiresAt: result.value.expiresAt } : { phase: "error", message: result.message };
}

export function AnalysisCardDraftSection({ draft, onDiscard, publish = publishAnalysisCard, showMap = true, initialState = { phase: "idle" } }: {
  draft: AnalysisCardDraft;
  onDiscard: () => void;
  publish?: Publish;
  /** 測試（node 環境）關掉 MapLibre。 */
  showMap?: boolean;
  initialState?: PublishState;
}) {
  const [state, setState] = useState<PublishState>(initialState);
  const [copied, setCopied] = useState(false);
  const run = async () => {
    setState({ phase: "publishing" });
    setState(await publishDraft(draft, publish));
  };
  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); }
  };
  const mapSlot = showMap ? <Suspense fallback={<CardMapFallback message="地圖載入中" />}><CardMap payload={draft.payload} /></Suspense> : <CardMapFallback message="地圖預覽" />;
  return <section className="agent-analysis-results agent-card-draft" aria-label="卡片草稿">
    <h3>卡片草稿</h3>
    <p>{draft.gate.message || "這份結果的來源都可以公開分享。"}</p>
    <AnalysisCard payload={draft.payload} mapSlot={mapSlot} expiresAt={null} expiryNote="發布後 30 天到期" variant="preview" />
    {state.phase === "published" ? <div className="agent-card-draft__link" role="status">
      <label>分享連結<input readOnly value={state.url} onFocus={event => event.currentTarget.select()} /></label>
      <small>連結到期：{taipeiDate(state.expiresAt) ?? "30 天後"}；可在「會員專區 › 卡片」撤銷。</small>
      <div className="agent-card-draft__actions">
        <button type="button" onClick={() => void copy(state.url)}>{copied ? "已複製" : "複製連結"}</button>
        <button type="button" onClick={onDiscard}>關閉草稿</button>
      </div>
    </div> : <div className="agent-card-draft__actions">
      <button type="button" className="agent-card-draft__primary" disabled={!draft.gate.publishable || state.phase === "publishing"} onClick={() => void run()}>{state.phase === "publishing" ? "發布中" : "發布連結"}</button>
      <button type="button" disabled={state.phase === "publishing"} onClick={onDiscard}>捨棄</button>
    </div>}
    {state.phase === "error" && <p className="agent-card-draft__error" role="alert">{state.message}</p>}
    <small className="agent-card-draft__note">發布後任何拿到連結的人都能看這張卡片（不能點開完整地圖）；Agent 無法代為發布。</small>
  </section>;
}
