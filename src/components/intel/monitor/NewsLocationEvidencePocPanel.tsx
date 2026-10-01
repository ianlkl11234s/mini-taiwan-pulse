import { useCallback } from "react";
import { fetchNewsArticleListPoc, type NewsArticleListPocRow } from "../../../data/newsArticleListPoc";
import { useIntelPollingQuery } from "../../../hooks/useIntelPollingQuery";
import { BORDER, COLORS, FONT_SIZE, RADIUS, SPACING } from "../../../styles/designTokens";
import { FONT_CJK } from "../intelTokens";
import { NewsScopeListPoc } from "../NewsScopeListPoc";

const EMPTY_ARTICLES: NewsArticleListPocRow[] = [];

interface Props {
  day: string;
  open: boolean;
}

/**
 * Shadow-only reader.  It owns a separate polling query, so its loading/error state
 * cannot alter the legacy clustered-news feed or any map interaction.
 */
export function NewsLocationEvidencePocPanel({ day, open }: Props) {
  const load = useCallback(async () => ({
    status: "ready" as const,
    data: await fetchNewsArticleListPoc({ day, bucket: "all", limit: 50 }),
    lastSuccessAt: Date.now(),
  }), [day]);
  const query = useIntelPollingQuery({
    enabled: open,
    queryKey: day,
    intervalMs: 60_000,
    emptyData: EMPTY_ARTICLES,
    load,
  });

  return (
    <section
      aria-label="新聞地點證據 POC"
      style={{
        border: `1px solid ${BORDER.panel}`, borderRadius: RADIUS.xl,
        padding: SPACING.md, fontFamily: FONT_CJK, background: COLORS.panelBg,
      }}
    >
      <h2 style={{ margin: `0 0 ${SPACING.xs}px`, fontSize: FONT_SIZE.md, color: COLORS.textStrong }}>新聞地點證據 POC</h2>
      <p style={{ margin: `0 0 ${SPACING.sm}px`, fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>
        Shadow 資料；不影響既有新聞清單、地圖或事件點。
      </p>
      {query.status === "unknown" && <p style={{ margin: 0, fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>載入中…</p>}
      {query.status === "error" && <p style={{ margin: 0, fontSize: FONT_SIZE.xs, color: COLORS.statusErr }}>POC 載入失敗：{query.message ?? "請檢查 shadow RPC"}</p>}
      {query.status === "denied" && <p style={{ margin: 0, fontSize: FONT_SIZE.xs, color: COLORS.statusWarn }}>POC 資料無權限讀取。</p>}
      {query.status === "ready" && <NewsScopeListPoc articles={query.data} />}
    </section>
  );
}
