import { useEffect, type ReactNode } from "react";
import { LAYOUT, Z_INDEX } from "../../styles/designTokens";
import { useTimelineExpand } from "./timelineExpand";
import "./timeline.css";

/** 卡片右側預留給右下停靠 popup（280px）＋間距，避免互相遮住 */
const RIGHT_RESERVE = 312;
/** TC3 收合膠囊寬、展開（TC1 單列）寬 */
export const TC3_COLLAPSED_WIDTH = 270;
export const TC3_EXPANDED_WIDTH = 590;

export interface TimelineShellContext {
  expanded: boolean;
  popupOpen: boolean;
  setPopupOpen: (open: boolean) => void;
  onDragChange: (dragging: boolean) => void;
}

interface Props {
  isDarkTheme: boolean;
  isMobile: boolean;
  leftOffset: number;
  /** 根節點額外屬性（viewportFit 用 data-viewport-occluder／data-testid 判斷遮擋區） */
  rootAttrs: Record<string, string>;
  children: (ctx: TimelineShellContext) => ReactNode;
}

/**
 * TC3 時間軸外殼（docs/design-system.md §5.24）：收合膠囊 ↔ 展開單列卡片。
 * 底邊固定在 LAYOUT.mapBottomInset（與右下停靠區同一常數），展開時往上／往右長。
 * 手機固定展開（沒有 hover；外層 App 的時間軸條負責底色）。
 */
export function TimelineShell({ isDarkTheme, isMobile, leftOffset, rootAttrs, children }: Props) {
  const { expanded, state, dispatch, rootRef, rootHandlers, onDragChange, setPopupOpen, activate } = useTimelineExpand(isMobile);
  const popupOpen = state.popupOpen;

  // 面板開著時：點卡片外或按 Esc 關閉
  useEffect(() => {
    if (!popupOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (root && e.target instanceof Node && !root.contains(e.target)) dispatch({ type: "popup", open: false });
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") dispatch({ type: "popup", open: false }); };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
    // 不放 currentTime（CLAUDE.md §6）
  }, [popupOpen, dispatch, rootRef]);

  const rootClass = [
    "tl3",
    expanded ? "tl3--expanded" : "tl3--collapsed",
    isDarkTheme ? "" : "tl3--light",
    isMobile ? "tl3--mobile" : "",
  ].filter(Boolean).join(" ");

  const rootStyle: React.CSSProperties = isMobile
    ? {}
    : {
        position: "absolute",
        // 與右下停靠區共用底邊偏移：兩者底邊對齊（收合、展開皆同）
        bottom: LAYOUT.mapBottomInset,
        left: leftOffset,
        // 時間軸屬地圖控制列，刻意維持 mapOverlay（10），在浮動面板（20）之下
        zIndex: Z_INDEX.mapOverlay,
        width: expanded ? TC3_EXPANDED_WIDTH : TC3_COLLAPSED_WIDTH,
        maxWidth: `calc(100vw - ${leftOffset + RIGHT_RESERVE}px)`,
      };

  return (
    <div
      {...rootAttrs}
      {...rootHandlers}
      className={rootClass}
      style={rootStyle}
      data-boot-part="timeline"
      role="group"
      aria-label={expanded ? "時間軸" : "時間軸（按 Enter 展開）"}
      tabIndex={expanded ? -1 : 0}
      onClick={() => { if (!expanded) activate(); }}
      onKeyDown={(e) => {
        if (!expanded && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          activate();
        }
      }}
    >
      {children({ expanded, popupOpen, setPopupOpen, onDragChange })}
    </div>
  );
}
