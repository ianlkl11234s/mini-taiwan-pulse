import { FONT_DATA, RADIUS, FONT_SIZE } from "../styles/designTokens";

/**
 * AqiLegend — AQI 6 級色階圖例（橫條）
 *
 * 任一 aqi 相關圖層開啟時顯示。
 * 上方 header 內嵌 loading 狀態（訂閱 loadingRegistry 中以 "aqi-" 開頭的任務）。
 */

import { AQI_LEVELS } from "../map/aqiColorScale";
import { useLoadingTasks } from "../hooks/useLoadingTasks";

interface Props {
  isDark: boolean;
  /** 小字註腳（例：當前產品 / 「LASS: PM2.5 濃度」） */
  caption?: string;
}

export function AqiLegend({ isDark, caption }: Props) {
  const allTasks = useLoadingTasks();
  const aqiTasks = allTasks.filter(
    (t) =>
      t.id.startsWith("aqi-") ||
      t.id.startsWith("micro-sensors") ||
      t.id.startsWith("aqi-imagery-batch"),
  );
  const loadingLabel = aqiTasks[0]?.label ?? null;
  const boundaries = AQI_LEVELS.map((lv) =>
    Number.isFinite(lv.max) ? lv.max.toString() : "301+",
  );
  // 6 級 → 顯示 5 個邊界（0 / 50 / 100 / 150 / 200 / 300 / 301+）
  const ticks = ["0", ...boundaries];

  return (
    <div
      style={{
        padding: "6px 8px",
        background: isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.7)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: RADIUS.xl,
        fontFamily: FONT_DATA,
        color: isDark ? "#ddd" : "#222",
      }}
    >
      <style>{`
        @keyframes aqi-spin { to { transform: rotate(360deg); } }
        .aqi-spin {
          display: inline-block;
          width: 10px;
          height: 10px;
          border: 2px solid rgba(147, 197, 253, 0.25);
          border-top-color: #93c5fd;
          border-radius: 50%;
          animation: aqi-spin 0.8s linear infinite;
          vertical-align: -1px;
        }
      `}</style>
      <div
        style={{
          fontSize: FONT_SIZE.sm,
          marginBottom: 4,
          opacity: 0.75,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span>AQI 空氣品質指標</span>
        {loadingLabel && (
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, color: "#93c5fd" }}>
            <span className="aqi-spin" />
            <span style={{ fontSize: FONT_SIZE.xs }}>載入中…</span>
          </span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          height: 12,
          width: 220,
          borderRadius: RADIUS.sm,
          overflow: "hidden",
        }}
      >
        {AQI_LEVELS.map((lv) => (
          <div
            key={lv.label}
            title={`${lv.label} — ${lv.description}`}
            style={{ flex: 1, background: lv.color }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: FONT_SIZE.xs,
          marginTop: 2,
          opacity: 0.75,
          width: 220,
        }}
      >
        {ticks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      {caption && (
        <div style={{ fontSize: FONT_SIZE.xs, marginTop: 3, opacity: 0.6 }}>{caption}</div>
      )}
    </div>
  );
}
