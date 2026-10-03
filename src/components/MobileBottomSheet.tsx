import { useState, useCallback, useEffect } from "react";
import { LIGHT, RADIUS } from "../styles/designTokens";

type SheetLevel = "collapsed" | "half" | "full";

const LEVELS: SheetLevel[] = ["collapsed", "half", "full"];

interface Props {
  isLandscape: boolean;
  /** 跟隨底圖主題（spec §5.5：手機底部面板與桌機面板同一套色票）；暗色維持原樣。 */
  isDarkTheme?: boolean;
  /** Another mobile surface opened; keep the map controls mutually exclusive. */
  forceCollapsed?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  children: (level: SheetLevel) => React.ReactNode;
}

function getHeight(level: SheetLevel, isLandscape: boolean): number {
  if (isLandscape) {
    switch (level) {
      case "collapsed": return 36;
      case "half": return Math.min(180, window.innerHeight * 0.45);
      case "full": return Math.min(340, window.innerHeight * 0.5);
    }
  }
  switch (level) {
    case "collapsed": return 36;
    case "half": return 200;
    case "full": return 420;
  }
}

export function MobileBottomSheet({ isLandscape, isDarkTheme = true, forceCollapsed = false, onExpandedChange, children }: Props) {
  const [level, setLevel] = useState<SheetLevel>("collapsed");

  useEffect(() => {
    if (forceCollapsed) setLevel("collapsed");
  }, [forceCollapsed]);

  const cycleLevel = useCallback(() => {
    const idx = LEVELS.indexOf(level);
    const next = LEVELS[(idx + 1) % LEVELS.length]!;
    setLevel(next);
    onExpandedChange?.(next !== "collapsed");
  }, [level, onExpandedChange]);

  const height = getHeight(level, isLandscape);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height,
        // 統計圖例與地圖控制也在右下角；sheet 必須在其上方，否則會攔截圖層詳情按鈕。
        zIndex: 40,
        background: isDarkTheme ? "rgba(0,0,0,0.7)" : LIGHT.surfaceStrong,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: `1px solid ${isDarkTheme ? "rgba(255,255,255,0.12)" : LIGHT.border}`,
        borderRadius: "16px 16px 0 0",
        transition: "height 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        flexDirection: "column",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        overflow: "hidden",
      }}
    >
      {/* Drag handle */}
      <button
        type="button"
        aria-label={level === "full" ? "收起圖層與搜尋" : "展開圖層與搜尋"}
        aria-expanded={level !== "collapsed"}
        onClick={cycleLevel}
        style={{
          display: "flex",
          border: 0,
          background: "transparent",
          color: isDarkTheme ? "#cbd5e1" : LIGHT.textMuted,
          fontSize: 12,
          gap: 8,
          justifyContent: "center",
          alignItems: "center",
          padding: "10px 0 6px",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <span>圖層與搜尋</span>
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: RADIUS.sm,
            background: isDarkTheme ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)",
          }}
        />
      </button>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: level === "full" ? "auto" : "hidden",
          overflowX: "hidden",
          padding: "0 16px",
        }}
      >
        {children(level)}
      </div>
    </div>
  );
}
