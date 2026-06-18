import { useEffect, useRef, useState } from "react";
import { COLORS, FONT_DATA, RADIUS, FONT_SIZE, SURFACE } from "../styles/designTokens";

interface LoadingStep {
  label: string;
  done: boolean;
  count?: number;
}

interface LoadingScreenProps {
  steps: LoadingStep[];
}

/* ── category colors ── */
type Cat = "flight" | "ship" | "rail" | "weather" | "system";

const CAT_COLOR: Record<Cat, string> = {
  flight: "#64aaff",
  ship: "#4ecdc4",
  rail: "#f4a261",
  weather: "#7bc47f",
  system: "#b8a9c9",
};

/** Map step label to category */
function stepToCat(label: string): Cat {
  if (label.includes("Airspace") || label.includes("Flight")) return "flight";
  if (label.includes("Ship")) return "ship";
  if (label.includes("Rail")) return "rail";
  if (label.includes("Temperature")) return "weather";
  return "system";
}

const VISIBLE_LINES = 10;

export function LoadingScreen({ steps }: LoadingScreenProps) {
  const allDone = steps.every((s) => s.done);
  const [lines, setLines] = useState<{ id: number; cat: Cat; text: string }[]>([]);
  const lineIdRef = useRef(0);
  const [doneBounce, setDoneBounce] = useState<Set<string>>(new Set());
  const prevDoneRef = useRef<Set<string>>(new Set());
  const [fading, setFading] = useState(false);

  // 真實進度：完成的 step 比例
  const doneCount = steps.filter((s) => s.done).length;
  const progress = allDone ? 1 : doneCount / steps.length;

  // 攔截 console.log，擷取 loader 的實際訊息
  useEffect(() => {
    if (allDone) return;
    const original = console.log;
    const originalWarn = console.warn;
    const prefixPattern = /^\[(Ship|Airspace|Rail|Temperature|H3|YouBike|Loader)/;

    const intercept = (level: "log" | "warn") => (...args: unknown[]) => {
      (level === "log" ? original : originalWarn).apply(console, args);
      const msg = args.map((a) => (typeof a === "string" ? a : String(a))).join(" ");
      if (prefixPattern.test(msg)) {
        let cat: Cat = "system";
        if (msg.startsWith("[Ship")) cat = "ship";
        else if (msg.startsWith("[Airspace") || msg.startsWith("[Flight")) cat = "flight";
        else if (msg.startsWith("[Rail")) cat = "rail";
        else if (msg.startsWith("[Temperature")) cat = "weather";
        else if (msg.startsWith("[H3") || msg.startsWith("[YouBike")) cat = "system";

        const id = lineIdRef.current++;
        setLines((prev) => [...prev.slice(-(VISIBLE_LINES - 1)), { id, cat, text: msg }]);
      }
    };

    console.log = intercept("log") as typeof console.log;
    console.warn = intercept("warn") as typeof console.warn;
    return () => {
      console.log = original;
      console.warn = originalWarn;
    };
  }, [allDone]);

  // 偵測新完成的 step → bounce 動畫
  useEffect(() => {
    const nowDone = new Set(steps.filter((s) => s.done).map((s) => s.label));
    const newOnes = [...nowDone].filter((l) => !prevDoneRef.current.has(l));
    if (newOnes.length > 0) {
      setDoneBounce((prev) => {
        const next = new Set(prev);
        newOnes.forEach((l) => next.add(l));
        return next;
      });
      setTimeout(() => {
        setDoneBounce((prev) => {
          const next = new Set(prev);
          newOnes.forEach((l) => next.delete(l));
          return next;
        });
      }, 500);
    }
    prevDoneRef.current = nowDone;
  }, [steps]);

  // allDone → fade out
  useEffect(() => {
    if (allDone) {
      const t = setTimeout(() => setFading(true), 200);
      return () => clearTimeout(t);
    }
  }, [allDone]);

  const firstPending = steps.findIndex((s) => !s.done);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: SURFACE.app,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        fontFamily: FONT_DATA,
        color: "#fff",
        zIndex: 9999,
        opacity: fading ? 0 : 1,
        transition: "opacity 0.4s ease",
      }}
    >
      {/* title */}
      <div style={{ fontSize: FONT_SIZE.xxl, letterSpacing: 4, fontWeight: 700, marginBottom: 2 }}>
        Mini Taiwan Pulse
      </div>
      <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textDim, letterSpacing: 1, marginBottom: 4 }}>
        Supabase Realtime
      </div>

      {/* step indicators */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.map((step, i) => {
          const isDone = step.done;
          const isActive = i === firstPending;
          const bouncing = doneBounce.has(step.label);
          return (
            <div
              key={step.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: FONT_SIZE.lg,
                color: isDone
                  ? CAT_COLOR[stepToCat(step.label)]
                  : isActive
                    ? COLORS.textDefault
                    : COLORS.textFaint,
                transition: "color 0.3s",
              }}
            >
              <span
                style={{
                  width: 18,
                  textAlign: "center",
                  display: "inline-block",
                  transform: bouncing ? "scale(1.4)" : "scale(1)",
                  transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                }}
              >
                {isDone ? "✓" : isActive ? (
                  <span className="loading-spin">⟳</span>
                ) : "○"}
              </span>
              <span style={{ minWidth: 160 }}>{step.label}</span>
              <span style={{ fontSize: FONT_SIZE.base, opacity: 0.7 }}>
                {isDone && step.count != null
                  ? step.count.toLocaleString()
                  : isActive
                    ? "loading..."
                    : ""}
              </span>
            </div>
          );
        })}
      </div>

      {/* progress bar */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: 4 }}>
        <div style={{ fontSize: FONT_SIZE.base, color: COLORS.textDim, letterSpacing: 0.5 }}>
          {allDone ? "載入完成" : `載入中... ${doneCount}/${steps.length}`}
        </div>
        <div
          style={{
            width: 280,
            height: 4,
            background: "rgba(255,255,255,0.08)",
            borderRadius: RADIUS.sm,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background: "linear-gradient(90deg, #64aaff, #4ecdc4)",
              borderRadius: RADIUS.sm,
              transition: "width 0.5s ease",
              boxShadow: "0 0 12px rgba(100,170,255,0.5), 0 0 4px rgba(100,170,255,0.8)",
            }}
          />
        </div>
        <div style={{ fontSize: FONT_SIZE.sm, color: COLORS.textFaint }}>
          {Math.round(progress * 100)}%
        </div>
      </div>

      {/* real data stream terminal */}
      <div
        style={{
          width: 420,
          height: VISIBLE_LINES * 20 + 16,
          marginTop: 8,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: RADIUS.lg,
          padding: "8px 12px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        {lines.length === 0 && !allDone && (
          <div style={{ fontSize: FONT_SIZE.base, color: COLORS.textFaint, lineHeight: "20px" }}>
            Connecting to Supabase...
          </div>
        )}
        {lines.map((line, i) => {
          const isLast = i === lines.length - 1;
          return (
            <div
              key={line.id}
              style={{
                fontSize: FONT_SIZE.base,
                lineHeight: "20px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: CAT_COLOR[line.cat],
                opacity: isLast ? 1 : 0.3 + (i / lines.length) * 0.5,
                transition: "opacity 0.2s",
              }}
            >
              {line.text}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .loading-spin { display: inline-block; animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}
