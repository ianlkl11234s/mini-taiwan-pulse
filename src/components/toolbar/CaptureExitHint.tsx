import { useEffect, useRef, useState } from "react";
import { FONT_CJK, FONT_DATA, RADIUS, Z_INDEX } from "../../styles/designTokens";

interface Props {
  onExit: () => void;
}

/**
 * 拍攝模式 P2：平常隱藏的離開提示膠囊。
 * 滑鼠移動時淡入，靜止 2 秒後淡出；`prefers-reduced-motion` 時無 transition，直接切換顯示／隱藏。
 * 點擊本身也能離開拍攝模式（等同按 Esc）。
 */
export function CaptureExitHint({ onExit }: Props) {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const reducedMotionRef = useRef(
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    const reveal = () => {
      setVisible(true);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setVisible(false), 2000);
    };
    window.addEventListener("mousemove", reveal);
    return () => {
      window.removeEventListener("mousemove", reveal);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={onExit}
      style={{
        position: "absolute",
        left: "50%",
        bottom: 32,
        transform: "translateX(-50%)",
        zIndex: Z_INDEX.toolbar,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: RADIUS.pill,
        background: "rgba(0,0,0,0.35)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "rgba(255,255,255,0.75)",
        fontSize: 10,
        fontFamily: FONT_CJK,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        whiteSpace: "nowrap",
        cursor: "pointer",
        opacity: visible ? 1 : 0,
        transition: reducedMotionRef.current ? "none" : "opacity 0.3s ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      離開拍攝模式
      <span
        style={{
          fontFamily: FONT_DATA,
          fontWeight: 600,
          fontSize: 9,
          border: "1px solid rgba(255,255,255,0.3)",
          borderRadius: RADIUS.sm,
          padding: "1px 4px",
        }}
      >
        Esc
      </span>
    </button>
  );
}
