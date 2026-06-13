import { useEffect, useRef, useState } from "react";
import { COLORS } from "./intelTokens";
import { IntelHeader } from "./IntelHeader";
import { IntelReplay } from "./IntelReplay";
import {
  fetchSourceHealth,
  type SourceHealthSummary,
} from "../../data/intelLoaders";

const EMPTY_HEALTH: SourceHealthSummary = {
  total: 0, ok: 0, lagging: 0, degraded: 0, unknown: 0, rows: [],
};

/** Cron 排程：每 10 分鐘整 1,11,21,...，倒數到下次刷新 */
function secsToNextCron(nowSec: number): number {
  const minuteOfHour = Math.floor((nowSec / 60) % 60);
  const secondOfMinute = Math.floor(nowSec % 60);
  // cron 跑在 1,11,21,31,41,51
  const slots = [1, 11, 21, 31, 41, 51];
  const found = slots.find((m) => m > minuteOfHour);
  const next = found ?? 61; // 下一小時的 1 分
  return (next - minuteOfHour) * 60 - secondOfMinute;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** events 數（從 feed body 算後傳進來；C1 先給 0） */
  totalCount?: number;
}

const RANGE_SEC = { "1h": 3600, "6h": 21600, "24h": 86400 } as const;
export type TimeRange = keyof typeof RANGE_SEC;

export function IntelPanel({ open, onClose, totalCount = 0 }: Props) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [isLive, setIsLive] = useState(true);
  const [playbackTs, setPlaybackTs] = useState(now);
  const [playing, setPlaying] = useState(false);
  const [timeRange] = useState<TimeRange>("24h");
  const [sourceHealth, setSourceHealth] = useState<SourceHealthSummary>(EMPTY_HEALTH);

  // 每秒推 now（純 UI 顯示 / 倒數，不進 react state cascade 即可）
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  // 30s polling source health（panel 開啟時）
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const tick = () => {
      fetchSourceHealth().then((s) => {
        if (alive) setSourceHealth(s);
      });
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [open]);

  // replay playback：90 step 從 windowStart 到 now
  const spanRef = useRef(RANGE_SEC[timeRange]);
  spanRef.current = RANGE_SEC[timeRange];
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setPlaybackTs((p) => {
        const next = p + spanRef.current / 90;
        const nowNow = Math.floor(Date.now() / 1000);
        if (next >= nowNow) {
          setPlaying(false);
          setIsLive(true);
          return nowNow;
        }
        return next;
      });
    }, 70);
    return () => window.clearInterval(id);
  }, [playing]);

  if (!open) return null;

  const windowStartTs = now - RANGE_SEC[timeRange];
  const effectivePlayback = isLive ? now : playbackTs;
  const countdownSec = secsToNextCron(now);

  const onScrub = (ts: number) => {
    setPlaybackTs(ts);
    setIsLive(ts >= now);
    setPlaying(false);
  };
  const goLive = () => {
    setIsLive(true);
    setPlaying(false);
    setPlaybackTs(now);
  };
  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (isLive || playbackTs >= now) setPlaybackTs(windowStartTs);
    setIsLive(false);
    setPlaying(true);
  };

  return (
    <div
      style={{
        position: "fixed",
        left: 64,
        top: 98,
        bottom: 14,
        width: 412,
        background: COLORS.panelBg,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${COLORS.panelBorder}`,
        borderRadius: 10,
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        pointerEvents: "auto",
        boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
        animation: "intelPanelFadeIn .25s ease-out",
        color: COLORS.textDefault,
      }}
    >
      <IntelHeader
        totalCount={totalCount}
        lastUpdateTs={now}
        countdownSec={countdownSec}
        sourceHealth={sourceHealth}
        onClose={onClose}
      />

      {/* C2 / C3 / C4 之後填這塊 */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 14,
          color: COLORS.textMuted,
          fontSize: 11,
        }}
      >
        <div style={{ opacity: 0.7 }}>
          [WIP] filters / 現況 / card list 將於 C2-C4 接上。
          目前 playback = {new Date(effectivePlayback * 1000).toLocaleString("zh-TW")}
        </div>
      </div>

      <IntelReplay
        playbackTs={effectivePlayback}
        windowStartTs={windowStartTs}
        nowTs={now}
        isLive={isLive}
        playing={playing}
        onScrub={onScrub}
        onLive={goLive}
        onTogglePlay={togglePlay}
      />

      <style>{`
        @keyframes intelPanelFadeIn {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes intelRing {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.78); }
        }
      `}</style>
    </div>
  );
}
