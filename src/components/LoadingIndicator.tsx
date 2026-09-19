import { useLoadingTasks } from "../hooks/useLoadingTasks";
import { BORDER, COLORS, SURFACE, WHITE_ALPHA } from "../styles/designTokens";

/**
 * 全域 loading 指示器
 * 任何 loader 透過 withLoading() 包裝的 Supabase 呼叫，都會在這裡顯示。
 * 沒有任務時不渲染。
 */
/**
 * @param rightOffset CSS `right` 值。split 模式要讓到 Monitor dock 左邊，
 *   否則這顆 pill（z-index 1000）會直接壓在面板上閃。
 */
export function LoadingIndicator({
  rightOffset = "16px",
  isDarkTheme = true,
}: {
  rightOffset?: string;
  isDarkTheme?: boolean;
}) {
  const tasks = useLoadingTasks();
  if (tasks.length === 0) return null;

  const visible = tasks.slice(0, 3);
  const extra = tasks.length - visible.length;
  const background = isDarkTheme ? SURFACE.panel : "rgba(255, 255, 255, 0.96)";
  const border = isDarkTheme ? BORDER.panel : "rgba(15, 23, 42, 0.18)";
  const text = isDarkTheme ? COLORS.textDefault : "#1f2937";
  const textStrong = isDarkTheme ? COLORS.textStrong : "#111827";
  const textMuted = isDarkTheme ? COLORS.textMuted : "#4b5563";
  const spinnerTrack = isDarkTheme ? WHITE_ALPHA[20] : "rgba(15, 23, 42, 0.2)";

  return (
    <>
      <style>{`
        @keyframes lr-spin { to { transform: rotate(360deg); } }
        @keyframes lr-fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .lr-pill {
          position: absolute;
          top: 110px;
          z-index: 1000;
          background: ${background};
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid ${border};
          border-radius: 8px;
          padding: 8px 12px;
          color: ${text};
          font-size: 11px;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
          animation: lr-fade-in 180ms ease-out;
          pointer-events: none;
          max-width: 260px;
        }
        .lr-header {
          display: flex; align-items: center; gap: 6px;
          font-weight: 600; letter-spacing: 0.5px;
          color: ${textStrong};
          margin-bottom: 4px;
        }
        .lr-spinner {
          width: 12px; height: 12px;
          border: 2px solid ${spinnerTrack};
          border-top-color: ${text};
          border-radius: 50%;
          animation: lr-spin 0.8s linear infinite;
        }
        .lr-task {
          color: ${text};
          font-size: 10px;
          padding: 1px 0 1px 18px;
          line-height: 1.4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .lr-extra {
          color: ${textMuted};
          font-size: 10px;
          padding: 1px 0 1px 18px;
          font-style: italic;
        }
      `}</style>
      <div className="lr-pill" style={{ right: rightOffset }}>
        <div className="lr-header">
          <div className="lr-spinner" />
          LOADING
        </div>
        {visible.map((t) => (
          <div className="lr-task" key={t.id} title={t.label}>
            • {t.label}
          </div>
        ))}
        {extra > 0 && <div className="lr-extra">+{extra} more</div>}
      </div>
    </>
  );
}
