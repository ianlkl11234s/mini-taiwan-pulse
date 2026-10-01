import type { IntelQueryState } from "../../../hooks/useIntelPollingQuery";
import { fs } from "./monitorFont";
import { useMonitorV2 } from "./monitorStyle";
import { FONT_CJK } from "../intelTokens";
import { useIntelTheme } from "../intelTheme";

/** Transport health only; source freshness/coverage remains with each dataset. */
export function MonitorDataStatus({ label, query }: {
  label: string;
  query: Pick<IntelQueryState<unknown>, "status" | "lastSuccessAt">;
}) {
  const v2 = useMonitorV2();
  const palette = useIntelTheme();
  if (query.status === "ready") return null;
  const message = query.status === "denied" ? "無權限讀取"
    : query.status === "error" ? "更新中斷" : "讀取中";
  return <div role="status" style={{ fontFamily: FONT_CJK, fontSize: fs(v2, 10), color: palette.textMuted, padding: "4px 0" }}>
    {label} · {message}
    {query.status === "error" && query.lastSuccessAt !== null &&
      ` · 保留舊資料，最後成功讀取 ${new Date(query.lastSuccessAt).toLocaleString("zh-TW")}`}
  </div>;
}
