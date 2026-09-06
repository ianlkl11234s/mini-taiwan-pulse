import { useState, useCallback } from "react";
import { RADIUS } from "../styles/designTokens";

type SheetLevel = "collapsed" | "half" | "full";

const LEVELS: SheetLevel[] = ["collapsed", "half", "full"];

interface Props {
  isLandscape: boolean;
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

export function MobileBottomSheet({ isLandscape, children }: Props) {
  const [level, setLevel] = useState<SheetLevel>("collapsed");

  const cycleLevel = useCallback(() => {
    setLevel((prev) => {
      const idx = LEVELS.indexOf(prev);
      return LEVELS[(idx + 1) % LEVELS.length]!;
    });
  }, []);

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
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: "1px solid rgba(255,255,255,0.12)",
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
          color: "#cbd5e1",
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
            background: "rgba(255,255,255,0.3)",
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
