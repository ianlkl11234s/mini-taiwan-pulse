import type { CSSProperties } from "react";
import type { NewsArticleListPocRow } from "../../data/newsArticleListPoc";
import { BORDER, COLORS, FONT_SIZE, RADIUS, SPACING } from "../../styles/designTokens";
import { FONT_CJK, FONT_DATA } from "./intelTokens";

interface Props {
  articles: readonly NewsArticleListPocRow[];
}

type ScopeSection = {
  key: "unlocated" | "national" | "foreign";
  title: string;
  description: string;
  rows: NewsArticleListPocRow[];
};

const rootStyle: CSSProperties = {
  fontFamily: FONT_CJK,
  color: COLORS.textDefault,
  display: "flex",
  flexDirection: "column",
  gap: SPACING.md,
};

function text(value: string | null): string {
  return value ?? "—";
}

function time(value: string | null): string {
  if (!value) return "—";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Taipei", hour12: false }).format(parsed)
    : value;
}

function precisionLabel(value: NewsArticleListPocRow["locationPrecision"]): string {
  const labels: Record<string, string> = {
    address: "地址層級",
    poi: "POI 層級",
    intersection: "路口層級",
    road_segment: "道路範圍",
    village: "里（非精確點）",
    township: "鄉鎮市區（非精確點）",
    county: "縣市（非精確點）",
    country: "國家範圍（非精確點）",
    none: "未提供",
  };
  return labels[value] ?? value;
}

function countLabel(count: number | null): string {
  return count === null ? "—" : count.toLocaleString("zh-TW");
}

function locationRoleLabel(value: NewsArticleListPocRow["locationRole"]): string {
  const labels: Record<NonNullable<NewsArticleListPocRow["locationRole"]>, string> = {
    event_site: "事件地點",
    affected_area: "受影響範圍",
    reporting_location: "報導地點",
    organization_location: "組織所在地",
    background: "背景提及",
  };
  return value === null ? "—" : labels[value];
}

function locationStatusLabel(value: NewsArticleListPocRow["locationStatus"]): string {
  return {
    accepted: "已接受",
    ambiguous: "多候選",
    unresolved: "待定位",
    rejected: "已排除",
  }[value];
}

function evidenceFieldLabel(value: string | null): string {
  if (value === "title") return "標題";
  if (value === "summary") return "摘要";
  if (value === "body") return "正文";
  if (value === "feed_hint") return "Feed 提示（僅候選）";
  return "—";
}

export function partitionNewsScopeListPoc(articles: readonly NewsArticleListPocRow[]): ScopeSection[] {
  const sections: ScopeSection[] = [
    { key: "unlocated", title: "未定位", description: "尚未接受的地點判讀；可能與其他分類重疊。", rows: [] },
    { key: "national", title: "全國／多地", description: "涵蓋範圍不是單一精確點；可能與未定位重疊。", rows: [] },
    { key: "foreign", title: "國外", description: "含已定位與待確認的國外範圍；可能與未定位重疊。", rows: [] },
  ];
  for (const article of articles) {
    if (article.acceptedLocationCount === 0) sections[0]!.rows.push(article);
    if (article.locationScope === "taiwan_national" || article.locationScope === "taiwan_multi") sections[1]!.rows.push(article);
    if (article.locationScope === "foreign") sections[2]!.rows.push(article);
  }
  return sections;
}

/** 純 props 呈現的證據清單；展開只顯示資料，不讀寫地圖狀態。 */
export function NewsScopeListPoc({ articles }: Props) {
  const sections = partitionNewsScopeListPoc(articles);
  return (
    <section aria-label="新聞地點證據清單" style={rootStyle}>
      <p style={{ margin: 0, fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>
        時空相近，不代表同一事件；定位精度與證據應分開判讀。
      </p>
      {sections.map((section) => (
        <div key={section.key}>
          <div style={{ display: "flex", alignItems: "baseline", gap: SPACING.sm, marginBottom: SPACING.xs }}>
            <h3 style={{ margin: 0, fontSize: FONT_SIZE.sm, color: COLORS.textStrong }}>{section.title}</h3>
            <span style={{ fontSize: FONT_SIZE.xs, color: COLORS.textMuted }}>
              <span style={{ fontFamily: FONT_DATA }}>{section.rows.length}</span> 則
            </span>
          </div>
          <p style={{ margin: `0 0 ${SPACING.sm}px`, fontSize: FONT_SIZE.xs, color: COLORS.textFaint }}>{section.description}</p>
          {section.rows.length === 0 ? (
            <p style={{ margin: 0, fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>—</p>
          ) : section.rows.map((article) => (
            <details key={article.articleId} style={{ borderTop: `1px solid ${BORDER.soft}`, padding: `${SPACING.sm}px 0` }}>
              <summary style={{ cursor: "pointer", color: COLORS.textStrong, fontSize: FONT_SIZE.sm }}>{article.title}</summary>
              <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: `${SPACING.xs}px ${SPACING.sm}px`, marginTop: SPACING.sm, fontSize: FONT_SIZE.xs }}>
                <span style={{ color: COLORS.textMuted }}>來源</span>
                <span>{article.url ? <a href={article.url} target="_blank" rel="noreferrer" style={{ color: COLORS.link }}>{text(article.sourceName)}</a> : text(article.sourceName)}</span>
                <span style={{ color: COLORS.textMuted }}>發布時間</span><time style={{ fontFamily: FONT_DATA }}>{time(article.publishedAt)}</time>
                <span style={{ color: COLORS.textMuted }}>事件時間</span><time style={{ fontFamily: FONT_DATA }}>{time(article.eventOccurredFrom)}</time>
                <span style={{ color: COLORS.textMuted }}>地點</span><span>{text(article.placeName)}</span>
                <span style={{ color: COLORS.textMuted }}>定位狀態</span><span>{locationStatusLabel(article.locationStatus)}</span>
                <span style={{ color: COLORS.textMuted }}>定位精度</span><span>{precisionLabel(article.locationPrecision)}</span>
                <span style={{ color: COLORS.textMuted }}>短證據</span><span>{article.evidenceText ?? "—"}</span>
                <span style={{ color: COLORS.textMuted }}>證據來源</span><span>{evidenceFieldLabel(article.evidenceField)}</span>
                <span style={{ color: COLORS.textMuted }}>同稿候選數</span><span style={{ fontFamily: FONT_DATA }}>{countLabel(article.articleRelationCount)}</span>
                <span style={{ color: COLORS.textMuted }}>同事件報導數</span><span style={{ fontFamily: FONT_DATA }}>{countLabel(article.eventReportCount)}</span>
                <span style={{ color: COLORS.textMuted }}>位置角色</span><span>{locationRoleLabel(article.locationRole)}</span>
                <span style={{ color: COLORS.textMuted }}>幾何類型</span><span>{text(article.geometryKind)}</span>
                <span style={{ color: COLORS.textMuted }}>解析方法</span><span>{text(article.locationResolver)}</span>
                <span style={{ color: COLORS.textMuted }}>方法版本</span><span>{text(article.locationMethodVersion)}</span>
              </div>
              <p style={{ margin: `${SPACING.sm}px 0 0`, fontSize: FONT_SIZE.xs, color: COLORS.textFaint, borderRadius: RADIUS.sm }}>
                展開僅查看證據，不移動地圖。
              </p>
            </details>
          ))}
        </div>
      ))}
    </section>
  );
}
