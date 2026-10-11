/**
 * 監看卡標準殼（spec §5.35 A1／C3，v2 樣式）。
 *
 * MonitorPanel 用它包住每一格：統一畫框（`.mtp-mcard`）與標題列（中文標題＋英文小字＋
 * 右側狀態 pill 與資料時間）。各卡只畫內容；要在標題列右側顯示資料時間或異常狀態時，
 * 在卡片元件裡呼叫 `useMonitorCardHeader({ time, state })`。
 *
 * 由 `HazardShell` 的「狀態點＋標題＋內容」結構升格而來；不是通用 Card（§11 KEEP OUT）。
 */
import {
  createContext, useContext, useLayoutEffect, useState, type ReactNode,
} from "react";
import "./monitorCard.css";

/** 標題列右側的異常狀態（§5.35 狀態字表）。正常（即時）時不傳。 */
export interface MonitorCardState {
  /** delay＝延遲（只把時間變色）；stale＝過期；stopped＝停更／下架；paused＝收盤等正常暫停 */
  kind: "delay" | "stale" | "stopped" | "paused";
  /** pill 文字，例「停更 138 天」「收盤」；kind=delay 時不顯示 pill */
  label?: string;
}

export interface MonitorCardHeaderSlot {
  /** 資料時間（epoch 毫秒）；當日顯示 HH:MM、跨日顯示 MM/DD */
  time?: number | null;
  /** 不是時刻的資料期別（例「W37」「09/29」）；有值時取代 time */
  timeText?: string | null;
  state?: MonitorCardState | null;
}

type SetSlot = (slot: MonitorCardHeaderSlot) => void;
const HeaderSlotContext = createContext<SetSlot | null>(null);

/**
 * 卡片元件把資料時間與狀態送到 MonitorPanel 畫的標題列。
 * 不在 v2 殼內（舊版、或殼外掛載）時什麼都不做。
 */
export function useMonitorCardHeader(slot: MonitorCardHeaderSlot): void {
  const set = useContext(HeaderSlotContext);
  const { time = null, timeText = null } = slot;
  const kind = slot.state?.kind ?? null;
  const label = slot.state?.label ?? null;
  useLayoutEffect(() => {
    if (!set) return;
    set({ time, timeText, state: kind ? { kind, label: label ?? undefined } : null });
  }, [set, time, timeText, kind, label]);
}

/** 給沒有自己元件可放 hook 的格子（由 MonitorPanel 組裝的新聞三格）送資料時間 */
export function MonitorCardTime(props: MonitorCardHeaderSlot): null {
  useMonitorCardHeader(props);
  return null;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 當日 HH:MM、跨日 MM/DD（台灣時間，與站上其他時間顯示一致用瀏覽器時區） */
export function formatMonitorTime(ms: number, nowMs: number = Date.now()): string {
  const d = new Date(ms);
  const n = new Date(nowMs);
  const sameDay = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  return sameDay ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}` : `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
}

export function MonitorCardFrame({
  title, en, widgetId, children, bare = false,
}: {
  title: string;
  en: string;
  widgetId: string;
  children: ReactNode;
  /** 舊版樣式：保留同一棵 React 樹（切換樣式不 remount 內容），只是不畫框與標題列（display: contents） */
  bare?: boolean;
}) {
  const [slot, setSlot] = useState<MonitorCardHeaderSlot>({});
  const timeLabel = slot.timeText ?? (slot.time != null ? formatMonitorTime(slot.time) : null);
  const kind = slot.state?.kind;
  const pillLabel = kind && kind !== "delay" ? slot.state?.label : undefined;
  return (
    <section className={bare ? "mtp-mcard mtp-mcard--bare" : "mtp-mcard"} data-widget={widgetId} aria-label={title}>
      {!bare && <header className="mtp-mcard__head">
        <span className="mtp-mcard__title">
          <span className="mtp-mcard__zh">{title}</span>
          <span className="mtp-mcard__en">{en}</span>
        </span>
        {(pillLabel || timeLabel) && (
          <span className="mtp-mcard__meta">
            {pillLabel && <span className={`mtp-mcard__pill mtp-mcard__pill--${kind}`}>{pillLabel}</span>}
            {timeLabel && (
              <span className={`mtp-mcard__time${kind === "delay" || kind === "stale" ? " is-warn" : ""}`}>{timeLabel}</span>
            )}
          </span>
        )}
      </header>}
      <div className="mtp-mcard__body">
        <HeaderSlotContext.Provider value={setSlot}>{children}</HeaderSlotContext.Provider>
      </div>
    </section>
  );
}
