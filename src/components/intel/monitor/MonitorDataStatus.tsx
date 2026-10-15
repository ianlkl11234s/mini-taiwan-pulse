import type { IntelQueryState } from "../../../hooks/useIntelPollingQuery";
import { fs } from "./monitorFont";
import { useMonitorV2 } from "./monitorStyle";
import { FONT_CJK } from "../intelTokens";
import { useIntelTheme } from "../intelTheme";
import { useLocale } from "../../../state/localeStore";

/** Transport health only; source freshness/coverage remains with each dataset. */
export function MonitorDataStatus({ label, query }: {
  label: string;
  query: Pick<IntelQueryState<unknown>, "status" | "lastSuccessAt">;
}) {
  const v2 = useMonitorV2();
  const palette = useIntelTheme();
  const i18n = useLocale();
  if (query.status === "ready") return null;
  const message = query.status === "denied" ? i18n.t("monitor.status.denied")
    : query.status === "error" ? i18n.t("monitor.status.error") : i18n.t("monitor.status.loading");
  return <div role="status" style={{ fontFamily: FONT_CJK, fontSize: fs(v2, 10), color: palette.textMuted, padding: "4px 0" }}>
    {label} · {message}
    {query.status === "error" && query.lastSuccessAt !== null &&
      i18n.t("monitor.status.keptOld", { time: i18n.formatDateTime(query.lastSuccessAt, { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }) })}
  </div>;
}
