/**
 * 會員專區「卡片」分頁（只給 owner）：列出自己發布的分析卡、複製連結、撤銷。
 *
 * 放在會員專區而不是 Agent 面板：Agent 面板只在本機開發環境掛載（App.tsx 以
 * import.meta.env.DEV 包住 MainMapConnection），撤銷卻是「分享錯了要馬上收回」的動作，
 * 必須在正式站也找得到；會員專區是正式站上唯一以帳號為範圍的地方。
 */
import { useCallback, useEffect, useState } from "react";
import { taipeiDate } from "../../card/cardStyle";
import { analysisCardUrl, listMyAnalysisCards, revokeAnalysisCard, type CardRpcClient, type CardSummary } from "../../lib/analysisCardApi";

type Phase = { kind: "loading" } | { kind: "ready"; cards: CardSummary[] } | { kind: "error"; message: string };

export function cardStatusText(card: CardSummary, now: number = Date.now()): string {
  if (card.revokedAt) return `已撤銷（${taipeiDate(card.revokedAt) ?? ""}）`;
  if (Date.parse(card.expiresAt) <= now) return `已到期（${taipeiDate(card.expiresAt) ?? ""}）`;
  return `連結到期：${taipeiDate(card.expiresAt) ?? ""}`;
}

export function MyAnalysisCardsList({ cards, busySlug, onCopy, onRevoke, now }: { cards: readonly CardSummary[]; busySlug: string | null; onCopy: (slug: string) => void; onRevoke: (slug: string) => void; now?: number }) {
  if (!cards.length) return <div className="member-empty"><p>還沒有發布過分析卡。在「與 Agent 協作」面板按「發布連結」後會列在這裡。</p></div>;
  return <>{cards.map(card => {
    const active = !card.revokedAt && Date.parse(card.expiresAt) > (now ?? Date.now());
    return <article className="member-item" key={card.slug}>
      <strong>{card.title}</strong>
      <small>{cardStatusText(card, now)} · 發布於 {taipeiDate(card.createdAt) ?? ""}</small>
      <div className="member-actions">
        <button disabled={!active} onClick={() => onCopy(card.slug)}>複製連結</button>
        <button disabled={!active || busySlug === card.slug} onClick={() => onRevoke(card.slug)}>{busySlug === card.slug ? "撤銷中" : "撤銷"}</button>
      </div>
    </article>;
  })}</>;
}

export function MyAnalysisCards({ client }: { client?: CardRpcClient }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setPhase({ kind: "loading" });
    const result = await listMyAnalysisCards(client);
    setPhase(result.ok ? { kind: "ready", cards: result.value } : { kind: "error", message: result.message });
  }, [client]);
  useEffect(() => { void load(); }, [load]);
  const revoke = async (slug: string) => {
    if (!window.confirm("撤銷後這個連結立刻失效，收到連結的人會看到「這張卡片已失效」。確定撤銷？")) return;
    setBusySlug(slug);
    const result = await revokeAnalysisCard(slug, client);
    setBusySlug(null);
    setNotice(result.ok ? "已撤銷。" : result.message);
    if (result.ok) await load();
  };
  const copy = async (slug: string) => {
    try { await navigator.clipboard.writeText(analysisCardUrl(slug)); setNotice("已複製連結。"); } catch { setNotice(analysisCardUrl(slug)); }
  };
  return <>
    <p className="member-hint">你發布的分析卡（固定 30 天到期）。撤銷會立刻讓連結失效。</p>
    {notice && <div role="status" aria-live="polite" className="member-notice">{notice}</div>}
    {phase.kind === "loading" && <p className="member-hint">正在讀取卡片。</p>}
    {phase.kind === "error" && <p className="member-hint">{phase.message}</p>}
    {phase.kind === "ready" && <MyAnalysisCardsList cards={phase.cards} busySlug={busySlug} onCopy={slug => void copy(slug)} onRevoke={slug => void revoke(slug)} />}
  </>;
}
