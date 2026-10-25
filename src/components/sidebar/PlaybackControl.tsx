/**
 * 模擬面板 S-1 播放列（spec §5.40 S-1）：控制區內一列——標籤「模擬時間」＋數值欄目前時刻（HH:MM），
 * 控件列由左到右：圓形播放鍵 22px（C2 主要色，lucide Play／Pause 12px）→ `TimeAxis compact` →
 * 倍速原生 select → 重來圖示鈕（RotateCcw，aria-label「從頭播放」）。
 * 時鐘是 scoped store（`state/simPlaybackClock.ts`），只有本元件訂閱（10Hz 通知），不接 timeStore。
 */
import { useSyncExternalStore } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { PlaybackConfig } from "../../state/layerParamsControls";
import { formatSimClock, getSimPlaybackClock, type SimPlaybackClock } from "../../state/simPlaybackClock";
import { useLocale } from "../../state/localeStore";
import { TimeAxis } from "../timeline/TimeAxis";
import { ControlRow } from "./LayerParamControls";
import "./playbackControl.css";

const NOOP_SUBSCRIBE = () => () => undefined;
const EMPTY = { t: 0, playing: false, speed: 1 };

/** 鍵盤：←→ 1 分鐘、Shift 5 分鐘、Home／End（S-1）。 */
export function playbackKeyTarget(key: string, shift: boolean, t: number, t0: number, t1: number): number | null {
  const step = shift ? 300 : 60;
  if (key === "ArrowLeft") return t - step;
  if (key === "ArrowRight") return t + step;
  if (key === "Home") return t0;
  if (key === "End") return t1;
  return null;
}

/** 倍速顯示：模擬秒／牆鐘秒 → 「1 分鐘／秒」。 */
export const speedMinutes = (speed: number) => String(Number((speed / 60).toFixed(2)));

function PlaybackRow({ ctrl, clock }: { ctrl: PlaybackConfig; clock: SimPlaybackClock }) {
  const { t: tr } = useLocale();
  const snap = useSyncExternalStore(clock.subscribe, clock.getSnapshot);
  const { t0, t1, speeds } = clock.config;
  const span = t1 - t0 || 1;
  const now = formatSimClock(snap.t);
  return (
    <ControlRow label={ctrl.label} value={now}>
      <div className="lpc-playback">
        <button
          type="button"
          className="lpc-play"
          aria-label={snap.playing ? tr("paramsPanel.pause") : tr("paramsPanel.play")}
          aria-pressed={snap.playing}
          onClick={() => (snap.playing ? clock.pause() : clock.play())}
        >
          {snap.playing ? <Pause size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
        </button>
        <TimeAxis
          compact
          ratio={(snap.t - t0) / span}
          ticks={[]}
          ariaLabel={ctrl.label}
          ariaValueMin={t0}
          ariaValueMax={t1}
          ariaValueNow={Math.round(snap.t)}
          ariaValueText={now}
          onSeekRatio={(r) => clock.seek(t0 + r * span)}
          onKey={(key, shift) => {
            const next = playbackKeyTarget(key, shift, clock.get(), t0, t1);
            if (next === null) return false;
            clock.seek(next);
            return true;
          }}
        />
        <select
          className="lpc-select lpc-playback__speed"
          aria-label={tr("paramsPanel.playbackSpeed")}
          value={snap.speed}
          onChange={(e) => clock.setSpeed(Number(e.target.value))}
        >
          {speeds.map((s) => <option key={s} value={s}>{tr("paramsPanel.playbackSpeedOption", { n: speedMinutes(s) })}</option>)}
        </select>
        <button type="button" className="lpc-btn lpc-playback__restart" aria-label={tr("paramsPanel.playbackRestart")} title={tr("paramsPanel.playbackRestart")} onClick={() => clock.restart()}>
          <RotateCcw size={12} aria-hidden="true" />
        </button>
      </div>
    </ControlRow>
  );
}

export function PlaybackControl({ ctrl }: { ctrl: PlaybackConfig }) {
  const clock = getSimPlaybackClock(ctrl.clock);
  // 時鐘尚未登記（理論上不會：時鐘模組由圖層 hook import）→ 不渲染控件，不造假值
  useSyncExternalStore(clock ? clock.subscribe : NOOP_SUBSCRIBE, () => (clock ? clock.getSnapshot() : EMPTY));
  if (!clock) return null;
  return <PlaybackRow ctrl={ctrl} clock={clock} />;
}
