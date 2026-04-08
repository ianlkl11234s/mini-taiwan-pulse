import { useLoadingTasks } from "../hooks/useLoadingTasks";

/**
 * 全域 loading 指示器
 * 任何 loader 透過 withLoading() 包裝的 Supabase 呼叫，都會在這裡顯示。
 * 沒有任務時不渲染。
 */
export function LoadingIndicator() {
  const tasks = useLoadingTasks();
  if (tasks.length === 0) return null;

  const visible = tasks.slice(0, 3);
  const extra = tasks.length - visible.length;

  return (
    <>
      <style>{`
        @keyframes lr-spin { to { transform: rotate(360deg); } }
        @keyframes lr-fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        .lr-pill {
          position: absolute;
          top: 110px;
          right: 16px;
          z-index: 1000;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 8px 12px;
          color: #fff;
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
          color: #93c5fd;
          margin-bottom: 4px;
        }
        .lr-spinner {
          width: 12px; height: 12px;
          border: 2px solid rgba(147, 197, 253, 0.25);
          border-top-color: #93c5fd;
          border-radius: 50%;
          animation: lr-spin 0.8s linear infinite;
        }
        .lr-task {
          color: #e2e8f0;
          font-size: 10px;
          padding: 1px 0 1px 18px;
          line-height: 1.4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .lr-extra {
          color: #94a3b8;
          font-size: 10px;
          padding: 1px 0 1px 18px;
          font-style: italic;
        }
      `}</style>
      <div className="lr-pill">
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
