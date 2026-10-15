import { FONT_CJK, FONT_DATA, clockTime } from "./satelliteConsoleTokens";
import { chipOutline, withAlpha } from "../intel/intelTokens";
import { useIntelTheme } from "../intel/intelTheme";
import { PanelHeader } from "../sidebar/PanelHeader";
import { FONT_SIZE } from "../../styles/designTokens";
import { isHistoryMode, formatTimelineOffset } from "../../hooks/useTimeStoreTime";
import { useLocale } from "../../state/localeStore";

interface Props {
  totalManeuvers: number;
  /** 時間軸當下（秒）— panel 顯示用的「顯示時間」基準 */
  timelineSec: number;
  onClose: () => void;
}

// §5.21 狀態徽章：chipOutline（透明底＋框），圓角 3、10px
const chipBase = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "2px 5px",
  borderRadius: 3,
  fontSize: FONT_SIZE.sm,
  lineHeight: 1.2,
  whiteSpace: "nowrap",
} as const;

export function SatelliteConsoleHeader({ totalManeuvers, timelineSec, onClose }: Props) {
  const p = useIntelTheme();
  const { t } = useLocale();
  const hot = totalManeuvers > 0;
  const isHistory = isHistoryMode(timelineSec);
  const offsetRaw = isHistory ? formatTimelineOffset(timelineSec) : null;
  // 「+3 分」的單位字尾依語系換（其餘為「+1:30」數字格式）
  const offsetLabel = offsetRaw != null && offsetRaw.endsWith(" 分") ? offsetRaw.slice(0, -2) + t("satelliteConsole.header.offsetMinSuffix") : offsetRaw;
  const badgeColor = isHistory ? p.statusWarn : p.statusLive;

  return (
    <>
      {/* 標頭：共用 PanelHeader（H2 eyebrow 分支）；色跟底圖主題 */}
      <PanelHeader
        eyebrow={t("satelliteConsole.header.eyebrow")}
        title={t("satelliteConsole.header.title")}
        onClose={onClose}
        borderColor={p.panelBorder}
        mutedColor={p.textDim}
        textColor={p.textStrong}
      />

      {/* 狀態列（H1）：即時／歷史徽章、顯示時間、變軌警報 */}
      <div
        style={{
          flexShrink: 0,
          padding: "6px 14px 7px",
          borderBottom: `1px solid ${p.borderSoft}`,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: FONT_CJK,
          fontSize: FONT_SIZE.sm,
          // HT1：歷史模式狀態列 6% 橘底（淡色同 alpha 換 LIGHT.statusWarn）
          background: isHistory ? withAlpha(p.statusWarn, 0.06) : "transparent",
        }}
      >
        <span style={{ ...chipBase, ...chipOutline(badgeColor) }}>{isHistory ? t("satelliteConsole.header.history") : t("satelliteConsole.header.live")}</span>
        <span style={{ color: p.textDim, whiteSpace: "nowrap" }}>{t("satelliteConsole.header.displayTime")}</span>
        <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums", fontWeight: 600, color: p.textDefault }}>
          {clockTime(timelineSec)}
        </span>
        {offsetLabel && (
          <span style={{ color: p.statusWarn, whiteSpace: "nowrap" }}>
            （{offsetLabel.split(/([+\-\d:]+)/).filter(Boolean).map((part, i) =>
              /^[+\-\d:]+$/.test(part) ? <span key={i} style={{ fontFamily: FONT_DATA }}>{part}</span> : part)}）
          </span>
        )}
        {/* 變軌警報是「DB 24h 內」的客觀事實，不受歷史模式影響 → 歷史模式只提示固定看近 24 小時 */}
        {isHistory ? (
          <span style={{ marginLeft: "auto", color: p.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {t("satelliteConsole.header.alertFixed24h")}
          </span>
        ) : (
          hot && (
            <span style={{ marginLeft: "auto", ...chipBase, ...chipOutline(p.statusErr) }}>
              {t("satelliteConsole.maneuver")} <span style={{ fontFamily: FONT_DATA }}>{totalManeuvers}</span>
            </span>
          )
        )}
      </div>
    </>
  );
}
