import type { IntelQueryState } from "../../../hooks/useIntelPollingQuery";
import { COLORS, FONT_CJK } from "../intelTokens";

/** Transport health only; source freshness/coverage remains with each dataset. */
export function MonitorDataStatus({ label, query }: {
  label: string;
  query: Pick<IntelQueryState<unknown>, "status" | "lastSuccessAt">;
}) {
  if (query.status === "ready") return null;
  const message = query.status === "denied" ? "無權限讀取"
    : query.status === "error" ? "更新中斷" : "讀取中";
  return <div role="status" style={{ fontFamily: FONT_CJK, fontSize: 10, color: COLORS.textMuted, padding: "4px 0" }}>
    {label} · {message}
    {query.status === "error" && query.lastSuccessAt !== null &&
      ` · 保留舊資料，最後成功讀取 ${new Date(query.lastSuccessAt).toLocaleString("zh-TW")}`}
  </div>;
}
