/**
 * Agent 面板「卡片草稿」（viz-library 4b）：縮小預覽（與 /card 頁同一個 AnalysisCard）、
 * 授權閘門訊息、「發布連結」「捨棄」。發布用主站已登入的 supabase client（owner JWT）；
 * Agent 永遠不能自行發布（使用者拍板 8），只有這個按鈕會呼叫 publish_analysis_card。
 */
import { lazy, Suspense, useState } from "react";
import { AnalysisCard, CardMapFallback } from "../card/AnalysisCard";
import { taipeiDate } from "../card/cardStyle";
import { localeStore, useLocale, type LocaleSnapshot } from "../state/localeStore";
import { publishAnalysisCard, type CardActionResult } from "../lib/analysisCardApi";
import type { AnalysisCardDraft } from "./analysisCardDraft";
import "../card/card.css";

const CardMap = lazy(() => import("../card/CardMap"));

export type Publish = (payload: unknown) => Promise<CardActionResult<{ slug: string; expiresAt: string; url: string }>>;
export type PublishState = { phase: "idle" } | { phase: "publishing" } | { phase: "published"; url: string; expiresAt: string } | { phase: "error"; message: string };

/** 「發布連結」的狀態轉移（抽出來讓測試不需 DOM）。閘門不通過時不呼叫 RPC。 */
export async function publishDraft(draft: AnalysisCardDraft, publish: Publish, i18n: LocaleSnapshot = localeStore.getSnapshot()): Promise<PublishState> {
  if (!draft.gate.publishable) return { phase: "error", message: draft.gate.message || i18n.t("analysisCard.draft.gateBlocked") };
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
  const i18n = useLocale();
  const { t } = i18n;
  const [state, setState] = useState<PublishState>(initialState);
  const [copied, setCopied] = useState(false);
  const run = async () => {
    setState({ phase: "publishing" });
    setState(await publishDraft(draft, publish, i18n));
  };
  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); }
  };
  const mapSlot = showMap ? <Suspense fallback={<CardMapFallback message={t("analysisCard.mapLoading")} />}><CardMap payload={draft.payload} /></Suspense> : <CardMapFallback message={t("analysisCard.mapPreview")} />;
  return <section className="agent-analysis-results agent-card-draft" aria-label={t("analysisCard.draft.title")}>
    <h3>{t("analysisCard.draft.title")}</h3>
    <p>{draft.gate.message || t("analysisCard.draft.gateDefault")}</p>
    <AnalysisCard payload={draft.payload} mapSlot={mapSlot} expiresAt={null} expiryNote={t("analysisCard.draft.expiryNote")} variant="preview" />
    {state.phase === "published" ? <div className="agent-card-draft__link" role="status">
      <label>{t("analysisCard.draft.shareLink")}<input readOnly value={state.url} onFocus={event => event.currentTarget.select()} /></label>
      <small>{t("analysisCard.draft.linkExpiry", { date: taipeiDate(state.expiresAt) ?? t("analysisCard.draft.daysLater") })}</small>
      <div className="agent-card-draft__actions">
        <button type="button" onClick={() => void copy(state.url)}>{copied ? t("analysisCard.draft.copied") : t("analysisCard.draft.copy")}</button>
        <button type="button" onClick={onDiscard}>{t("analysisCard.draft.closeDraft")}</button>
      </div>
    </div> : <div className="agent-card-draft__actions">
      <button type="button" className="agent-card-draft__primary" disabled={!draft.gate.publishable || state.phase === "publishing"} onClick={() => void run()}>{state.phase === "publishing" ? t("analysisCard.draft.publishing") : t("analysisCard.draft.publish")}</button>
      <button type="button" disabled={state.phase === "publishing"} onClick={onDiscard}>{t("analysisCard.draft.discard")}</button>
    </div>}
    {state.phase === "error" && <p className="agent-card-draft__error" role="alert">{state.message}</p>}
    <small className="agent-card-draft__note">{t("analysisCard.draft.note")}</small>
  </section>;
}
