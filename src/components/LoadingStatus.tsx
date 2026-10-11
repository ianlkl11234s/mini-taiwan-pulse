import { useEffect, useRef, useState } from "react";
import { loadingRegistry } from "../lib/loadingRegistry";
import {
  createLoadingStatusController,
  HIDDEN_LOADING_STATUS,
  type LoadingStatusView,
} from "../lib/loadingStatusController";
import "./loadingStatus.css";

/**
 * 右上載入狀態條（design-system §5.30）：工具列正下方單行，
 * 「載入中 · 名稱 +N」→「已載入」停 2 秒淡出；失敗停 4 秒。
 * 節奏規則在 loadingStatusController。
 *
 * @param rightOffset CSS `right`。split 模式要讓到 Monitor dock 左邊。
 * @param playing 時間軸（含地震回放、歷史軌跡）播放中：只顯示「載入中」，停下才顯示「已載入」。
 */
export function LoadingStatus({
  rightOffset = "16px",
  top = 60,
  isDarkTheme = true,
  playing = false,
  hidden = false,
}: {
  rightOffset?: string;
  top?: number;
  isDarkTheme?: boolean;
  playing?: boolean;
  /** 拍攝模式：保持掛載（才不會丟掉進行中任務的 start 事件），只是不顯示 */
  hidden?: boolean;
}) {
  const [view, setView] = useState<LoadingStatusView>(HIDDEN_LOADING_STATUS);
  const controllerRef = useRef<ReturnType<typeof createLoadingStatusController> | null>(null);

  useEffect(() => {
    const controller = createLoadingStatusController({ onChange: setView });
    controllerRef.current = controller;
    const unsubscribe = loadingRegistry.subscribeEvents(controller.handle);
    return () => {
      unsubscribe();
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setPlaying(playing);
  }, [playing]);

  const text = statusText(view);
  const className = [
    "loading-status",
    `loading-status--${view.phase}`,
    view.visible ? "loading-status--on" : "",
    isDarkTheme ? "" : "loading-status--light",
  ].filter(Boolean).join(" ");

  return (
    <div className={className} style={{ top, right: rightOffset, ...(hidden ? { display: "none" } : null) }} role="status" aria-live="polite" aria-hidden={hidden || !view.visible}>
      <span className="loading-status__icon" aria-hidden="true">
        {view.phase === "loading" && <span className="loading-status__ring" />}
        {view.phase === "done" && (
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 5.2 4 7.6 8.6 2.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        )}
        {view.phase === "error" && (
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 1.2 9.2 8.6H.8Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M5 4v2.2M5 7.3v.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
        )}
      </span>
      <span className="loading-status__text" key={text.main}>
        <span className="loading-status__label">{text.main}</span>
        {text.extra && <span className="loading-status__extra">{text.extra}</span>}
      </span>
    </div>
  );
}

export function statusText(view: LoadingStatusView): { main: string; extra: string } {
  if (view.phase === "done") {
    return { main: view.count > 1 ? `已載入 ${view.count} 項` : `已載入 · ${view.label}`, extra: "" };
  }
  if (view.phase === "error") return { main: `載入失敗 · ${view.label}`, extra: "" };
  return { main: `載入中 · ${view.label}`, extra: view.extra > 0 ? `+${view.extra}` : "" };
}
