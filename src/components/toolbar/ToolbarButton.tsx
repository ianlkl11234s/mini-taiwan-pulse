import { useState, type CSSProperties, type ReactNode } from "react";
import { FONT_CJK, RADIUS } from "../../styles/designTokens";
import type { ToolbarPalette } from "./toolbarTheme";

interface Props {
  palette: ToolbarPalette;
  /** 純圖示按鈕（正方形、寬 = 高 26） */
  icon?: boolean;
  /** 主要按鈕（C2）：淡 accent 底 + accent 框 + accent 字，semibold */
  primary?: boolean;
  title?: string;
  ariaLabel?: string;
  onClick?: () => void;
  children?: ReactNode;
  style?: CSSProperties;
}

/** 右上角工具列共用按鈕（T2 規格）：高 26、圓角 4、中文字型；hover 淡入底色。 */
export function ToolbarButton({ palette, icon = false, primary = false, title, ariaLabel, onClick, children, style }: Props) {
  const [hover, setHover] = useState(false);

  const background = primary
    ? palette.accentFaint
    : hover
    ? palette.controlBgHover
    : "transparent";

  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel ?? title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: icon ? "center" : "flex-start",
        gap: 5,
        height: 26,
        width: icon ? 26 : undefined,
        padding: icon ? 0 : "0 10px",
        borderRadius: RADIUS.md,
        border: `1px solid ${primary ? palette.accent : "transparent"}`,
        background,
        color: primary ? palette.accent : palette.textStrong,
        fontFamily: FONT_CJK,
        fontSize: 11,
        fontWeight: primary ? 600 : 500,
        whiteSpace: "nowrap",
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
