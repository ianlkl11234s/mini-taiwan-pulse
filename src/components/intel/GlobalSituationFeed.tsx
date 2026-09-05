import { IntelCard, intelCardId, type IntelCardEvent } from "./IntelCard";
import { IntelIcon, ICON } from "./IntelIcon";
import { COLORS, FONT_CJK, clockTime } from "./intelTokens";
import { FONT_SIZE } from "../../styles/designTokens";
import type { GlobalSituationEntry } from "../../data/globalEventsLoader";
import type { GlobalSituationFeedSnapshot } from "../../state/globalSituationFeedStore";

/** 沒有座標的事件在卡片上的地點文字 */
export const UNLOCATED_LABEL = "待定位";

/**
 * 已研究（正式事件）判定。
 * 正式事件由 `parseGlobalEventRecord` 產生，沒有 candidateId；候選由
 * `parseGlobalEventCandidate` 產生，researchStatus 預設 `ai_assessed`。
 */
export function isGlobalSituationPublished(entry: GlobalSituationEntry): boolean {
  return entry.candidateId === undefined || entry.researchStatus === "published";
}

/**
 * INTEL 的預設過濾：只顯示已研究與 `keep_core`；toggle 開啟後加入
 * `keep_watch` 與尚未判斷（`decision = null`，約佔候選 15%）。`drop_noise`
 * 在 INTEL 永不顯示 —— 面板要在短時間內把「世界上正在發生的重要事情」講完。
 * 地圖圖層與 sidebar 的行為不受影響。
 */
export function isGlobalSituationVisible(entry: GlobalSituationEntry, includeWatch: boolean): boolean {
  if (isGlobalSituationPublished(entry)) return true;
  if (entry.decision === "keep_core") return true;
  return includeWatch && (entry.decision === "keep_watch" || entry.decision === null || entry.decision === undefined);
}

function firstSentence(text: string | null): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const cut = trimmed.search(/[。！？!?\n]/);
  return cut > 0 ? trimmed.slice(0, cut + 1) : trimmed;
}

function eventSeconds(entry: GlobalSituationEntry): number | null {
  // 事件時間一律走 valid_from（= 候選的 observed_at），不用 available_at
  // ——後者是「我們何時看到」，不是「事情何時發生」。
  for (const value of [entry.validFrom, entry.publishedAt]) {
    const parsed = Date.parse(value ?? "");
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
  }
  return null;
}

function hostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * `GlobalSituationEntry` → 新聞卡片契約。回傳 null = 沒有可用的事件時間，
 * 放進 feed 只會被 RANGE 永久濾掉，直接丟棄。
 */
export function toIntelCardEvent(entry: GlobalSituationEntry): IntelCardEvent | null {
  const publishedTs = eventSeconds(entry);
  if (publishedTs === null) return null;
  const published = isGlobalSituationPublished(entry);
  const url = entry.sourceUrls?.[0] ?? null;
  const place = [entry.countryCode, entry.placeName].filter((value): value is string => !!value).join(" · ");
  const title = entry.titleZhTw && entry.titleZhTw !== "未命名事件"
    ? entry.titleZhTw
    : entry.sourceHeadline ?? firstSentence(entry.summaryZhTw) ?? "未命名事件";
  return {
    id: 0,
    card_key: entry.eventId,
    scope: "global",
    origin_label: published ? "已研究" : "AI 初判",
    title,
    summary: entry.summaryZhTw,
    category: entry.category,
    source: url ? hostname(url) : null,
    url,
    published_ts: publishedTs,
    confidence: entry.confidence,
    // 借新聞卡片的分級欄位表達「這則有多值得看」：已研究／keep_core → 重大
    gis_relevance: published || entry.decision === "keep_core" ? 3 : entry.decision === "keep_watch" ? 2 : 1,
    severity: entry.severity,
    is_event: true,
    location_name: entry.coordinates === null ? UNLOCATED_LABEL : place || "未標示地點",
  };
}

function latestSeconds(entries: readonly GlobalSituationEntry[], pick: (entry: GlobalSituationEntry) => (string | null | undefined)[]): number | null {
  let latest: number | null = null;
  for (const entry of entries) {
    for (const value of pick(entry)) {
      const parsed = Date.parse(value ?? "");
      if (!Number.isFinite(parsed)) continue;
      if (latest === null || parsed > latest) latest = parsed;
      break;
    }
  }
  return latest === null ? null : Math.floor(latest / 1000);
}

/**
 * 空清單時的第二行說明。上游收集→研判有延遲，事件時間（observed_at）會落在
 * 資料源最後一次更新（available_at）之前；把實際數字算出來講，不寫死。
 */
export function describeFeedLag(entries: readonly GlobalSituationEntry[]): string {
  const updated = latestSeconds(entries, (entry) => [entry.availableAt, entry.displayFrom, entry.publishedAt]);
  if (updated === null) return "近 24 小時尚無已研究或核心事件";
  const event = latestSeconds(entries, (entry) => [entry.validFrom, entry.publishedAt]);
  const lagHours = event === null ? null : Math.round((updated - event) / 3600);
  return `資料源最新更新：${clockTime(updated)}`
    + (lagHours !== null && lagHours >= 1 ? `，事件時間落後約 ${lagHours} 小時` : "");
}

export interface GlobalFeedWindow {
  includeWatch: boolean;
  /** 與新聞同一組 RANGE 邊界（前端過濾，不送 RPC） */
  windowStartTs: number;
  endTs: number;
}

/** decision 過濾 → 卡片轉換 → RANGE 前端過濾 → 依事件時間降冪 */
export function selectGlobalFeedCards(
  entries: readonly GlobalSituationEntry[],
  { includeWatch, windowStartTs, endTs }: GlobalFeedWindow,
): IntelCardEvent[] {
  const cards: IntelCardEvent[] = [];
  for (const entry of entries) {
    if (!isGlobalSituationVisible(entry, includeWatch)) continue;
    const card = toIntelCardEvent(entry);
    if (!card) continue;
    if (card.published_ts < windowStartTs || card.published_ts > endTs) continue;
    cards.push(card);
  }
  cards.sort((a, b) => b.published_ts - a.published_ts);
  return cards;
}

interface Props {
  cards: IntelCardEvent[];
  snapshot: GlobalSituationFeedSnapshot;
  selectedId: number | string | null;
  expandedId: number | string | null;
  onSelect: (id: number | string) => void;
  onToggle: (id: number | string) => void;
  nowTs: number;
}

export function GlobalSituationFeed({
  cards, snapshot, selectedId, expandedId, onSelect, onToggle, nowTs,
}: Props) {
  const unlocated = cards.filter((card) => card.location_name === UNLOCATED_LABEL).length;

  if (cards.length === 0) {
    return (
      <div
        style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          height: "100%", gap: 8, textAlign: "center", padding: 24,
        }}
      >
        <IntelIcon d={ICON.radio} size={28} color={COLORS.textGhost} />
        <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.md, color: COLORS.textMuted }}>
          {snapshot.status === "loading" ? "正在載入全球情勢…"
            : snapshot.status === "error" ? "全球情勢載入失敗"
              : "目前無符合條件的國際事件"}
        </div>
        <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint }}>
          {snapshot.status === "error" ? snapshot.message ?? "稍後重試" : describeFeedLag(snapshot.entries)}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          marginBottom: 10,
          fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm,
          color: COLORS.textMuted, lineHeight: 1.5,
        }}
      >
        共 {cards.length} 件{unlocated > 0 ? ` · ${unlocated} 件${UNLOCATED_LABEL}` : ""}
        {snapshot.status === "loading" && <span style={{ color: COLORS.textFaint }}>　更新中…</span>}
        {snapshot.status === "error" && <span style={{ color: COLORS.statusWarn }}>　{snapshot.message ?? "更新失敗"}</span>}
      </div>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10 }}>
        <span
          style={{
            position: "absolute", left: 12, top: 6, bottom: 6,
            width: 1.5,
            background: `linear-gradient(${COLORS.borderMid}, ${COLORS.borderSoft} 90%, transparent)`,
          }}
        />
        {cards.map((card) => (
          <IntelCard
            key={intelCardId(card)}
            e={card}
            selected={intelCardId(card) === selectedId}
            expanded={intelCardId(card) === expandedId}
            trending={false}
            onSelect={onSelect}
            onToggle={onToggle}
            nowTs={nowTs}
          />
        ))}
      </div>
      <div
        style={{
          marginTop: 12,
          fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm,
          color: COLORS.textFaint, lineHeight: 1.5,
        }}
      >
        「AI 初判」尚未經研究確認；已被判為低價值（drop_noise）的條目不在此列表。
      </div>
    </>
  );
}
