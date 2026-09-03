import { useSyncExternalStore } from "react";
import { globalEventsViewStore } from "../../state/globalEventsViewStore";
import { FONT_SIZE, RADIUS } from "../../styles/designTokens";
import { DARK_FEATURE, type FeaturePalette } from "../featureInfo/featureTheme";

type ListPalette = Pick<FeaturePalette, "textStrong" | "textMuted" | "border" | "link" | "bgSubtle">;
export function GlobalEventsList({ palette = DARK_FEATURE, fillPanel = false }: { palette?: ListPalette; fillPanel?: boolean }) {
  const snapshot = useSyncExternalStore(globalEventsViewStore.subscribe, globalEventsViewStore.getSnapshot, globalEventsViewStore.getSnapshot);
  const events = [...new Map(snapshot.entries.map((row) => [row.eventId, row])).values()];
  const located = new Set(snapshot.entries.filter((row) => row.coordinates !== null && !row.mapSuppressed).map((row) => row.eventId));
  return <section aria-label="全球情勢事件列表" style={{ fontSize: FONT_SIZE.base, color: palette.textStrong, lineHeight: 1.5 }}>
    <div style={{ color: palette.textMuted }}>{snapshot.windowLabel}{(snapshot.status === "ready" || snapshot.status === "partial") && <> · 已載入 {events.length} 件 · {events.filter((row) => !located.has(row.eventId) && !row.mapSuppressed).length} 件待定位</>}</div>
    {snapshot.status === "loading" && <div role="status">正在載入全球情勢…</div>}
    {snapshot.status === "idle" && <div role="status">等待全球情勢圖層載入…</div>}
    {snapshot.message && <div role="status" style={{ color: "#d97706" }}>{snapshot.message}</div>}
    <div style={{ maxHeight: fillPanel ? undefined : 240, overflowY: fillPanel ? "visible" : "auto", marginTop: 5 }}>
      {events.map((event) => <details key={event.eventId} style={{ borderTop: `1px solid ${palette.border}`, padding: "5px 0" }}>
        <summary style={{ cursor: "pointer", lineHeight: 1.5 }}>
          <span style={{ color: palette.textMuted }}>{event.candidateId ? (event.assessmentStatus === "pending" ? "待判斷" : "AI 初判") : "已研究"} · {event.mapSuppressed ? "正式事件已撤回／取代，不上圖" : located.has(event.eventId) ? "可定位" : "待定位"}</span><br />
          {event.titleZhTw}
        </summary>
        <div style={{ paddingTop: 5 }}>{event.summaryZhTw ?? event.sourceHeadline ?? "尚無摘要"}</div>
        {event.decision && <div>Qwen 分類：{event.decision}</div>}
        {event.taiwanRelationship && <div>臺灣關聯：{event.taiwanRelationship}</div>}
        {event.taiwanImpactZhTw && <div>{event.taiwanImpactZhTw}</div>}
        {event.reasonZhTw && <div>{event.reasonZhTw}</div>}
        {(event.candidateAssessments?.length ?? 0) > 1 && <details style={{ marginTop: 5 }}>
          <summary>同組 {event.candidateAssessments!.length} 筆候選判斷</summary>
          {event.candidateAssessments!.map((assessment) => <div key={assessment.candidateId} style={{ marginTop: 5 }}>
            {assessment.title}<br />{assessment.decision ?? "待判斷"} · {assessment.taiwanRelationship ?? "臺灣關聯未知"}<br />
            {assessment.taiwanImpact}<br />{assessment.reason}
          </div>)}
        </details>}
        {located.has(event.eventId) && <button onClick={() => globalEventsViewStore.select(event)} style={{ color: palette.textStrong, background: palette.bgSubtle, border: `1px solid ${palette.border}`, borderRadius: RADIUS.sm, cursor: "pointer", fontSize: FONT_SIZE.base, marginTop: 5 }}>定位並展開</button>}
        {(event.sourceUrls ?? []).map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer" style={{ display: "block", color: palette.link, overflowWrap: "anywhere", marginTop: 5 }}>來源 {index + 1} · {new URL(url).hostname} ↗</a>)}
      </details>)}
    </div>
    {snapshot.status === "ready" && events.length === 0 && <div>此時間範圍尚無可用資料。</div>}
    <div style={{ color: palette.textMuted, marginTop: 5 }}>AI 初判尚未研究確認；重要性與臺灣關聯不作上圖門檻。</div>
  </section>;
}
