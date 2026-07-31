/**
 * EarthquakeReplayPanel — 地震回放事件清單 + 播放控制
 *
 * 左 docked 面板，幾何 / token 沿用 PropertyValuePanel（left:64 top:98 bottom:130）；
 * 播放控制列的排版沿用 intel/IntelReplay（play/pause + scrub + 時間標籤）。
 *
 * 分層回放（見 earthquakeReplayTypes.eventTier）：
 * - Tier A（有鄉鎮震度 + 等震度網格）→ 五步完整回放，badge「完整」
 * - Tier B（只有測站）→ 三步簡化回放，badge「測站」
 *
 * 進度條走 `earthquakeReplayClock` external store（通知節流 10Hz），
 * 只有本面板重繪；回放引擎的 RAF 不會讓 App.tsx re-render。
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { Rewind, Play, Pause, RotateCcw, X } from "lucide-react";
import { COLORS, FONT_CJK, FONT_DATA, RADIUS, FONT_SIZE } from "../styles/designTokens";
import { fetchReplayEvents } from "../data/earthquakeReplayLoader";
import { eventTier, type EarthquakeReplayEvent } from "../data/earthquakeReplayTypes";
import { earthquakeReplayClock } from "../state/earthquakeReplayClock";

const PANEL_WIDTH = 322;

interface Props {
  open: boolean;
  onClose: () => void;
  selectedId: string | null;
  onSelect: (ev: EarthquakeReplayEvent) => void;
  playing: boolean;
  onTogglePlay: () => void;
  onReplay: () => void;
}

function magColor(m: number): string {
  if (m >= 6) return "#dc2626";
  if (m >= 5) return "#f97316";
  if (m >= 4) return "#facc15";
  return "#94a3b8";
}

function fmtTaipei(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

/** 「臺南市政府東北東方 36.7 公里 (位於臺南市楠西區)」→「臺南市楠西區」 */
function shortLocation(loc: string): string {
  const m = /位於(.+?)\)/.exec(loc);
  return (m?.[1] ?? loc).trim();
}

export function EarthquakeReplayPanel({
  open, onClose, selectedId, onSelect, playing, onTogglePlay, onReplay,
}: Props) {
  const [events, setEvents] = useState<EarthquakeReplayEvent[] | null>(null);
  const [failed, setFailed] = useState(false);

  const clock = useSyncExternalStore(
    earthquakeReplayClock.subscribe,
    earthquakeReplayClock.getSnapshot,
    earthquakeReplayClock.getSnapshot,
  );

  useEffect(() => {
    if (!open || events) return;
    let alive = true;
    fetchReplayEvents()
      .then((d) => { if (alive) setEvents(d); })
      .catch((e) => {
        console.warn("[EarthquakeReplay] 事件清單載入失敗:", e);
        if (alive) setFailed(true);
      });
    return () => { alive = false; };
  }, [open, events]);

  if (!open) return null;

  const hasTimeline = clock.duration > 0;

  return (
    <div
      style={{
        position: "fixed",
        left: 64,
        top: 98,
        bottom: 130,
        width: PANEL_WIDTH,
        background: COLORS.panelBg,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${COLORS.panelBorder}`,
        boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
        borderRadius: RADIUS.xl,
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        pointerEvents: "auto",
        color: COLORS.textDefault,
        fontFamily: FONT_CJK,
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 9,
          padding: "13px 14px 11px",
          borderBottom: `1px solid ${COLORS.panelBorder}`,
          flexShrink: 0,
        }}
      >
        <Rewind size={17} color={COLORS.accent} strokeWidth={1.6} style={{ flexShrink: 0 }} />
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.textStrong }}>地震回放</span>
          <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "2.5px", color: COLORS.textDim }}>
            EARTHQUAKE REPLAY
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          aria-label="close"
          style={{
            width: 24, height: 24, borderRadius: RADIUS.md, border: "none",
            background: "transparent", color: COLORS.textDim,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* ── 事件清單 ── */}
      <div className="layer-sidebar-scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 8px 10px" }}>
        {failed && (
          <div style={{ fontSize: FONT_SIZE.base, color: COLORS.textFaint, padding: "10px 6px" }}>
            ⚠ 事件清單載入失敗（earthquake_replay_events）
          </div>
        )}
        {!failed && !events && (
          <div style={{ fontSize: FONT_SIZE.base, color: COLORS.textFaint, padding: "10px 6px" }}>載入中…</div>
        )}
        {events?.length === 0 && (
          <div style={{ fontSize: FONT_SIZE.base, color: COLORS.textFaint, padding: "10px 6px" }}>目前沒有可回放的地震</div>
        )}

        {events?.map((ev) => {
          const tier = eventTier(ev);
          const active = ev.event_id === selectedId;
          return (
            <button
              key={ev.event_id}
              onClick={() => onSelect(ev)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 8px",
                marginBottom: 3,
                textAlign: "left",
                cursor: "pointer",
                borderRadius: RADIUS.lg,
                border: `1px solid ${active ? COLORS.borderAccent : "transparent"}`,
                background: active ? COLORS.accentFaint : "rgba(255,255,255,0.03)",
                color: COLORS.textDefault,
                fontFamily: FONT_CJK,
              }}
            >
              <span
                style={{
                  fontFamily: FONT_DATA,
                  fontSize: FONT_SIZE.md,
                  fontWeight: 700,
                  color: magColor(ev.magnitude),
                  width: 34,
                  flexShrink: 0,
                }}
              >
                M{ev.magnitude.toFixed(1)}
              </span>
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                <span
                  style={{
                    fontSize: FONT_SIZE.base,
                    color: active ? COLORS.textStrong : COLORS.textDefault,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {shortLocation(ev.location)}
                </span>
                <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>
                  {fmtTaipei(ev.occurred_at)} · {ev.station_count} 站 · {ev.depth_km.toFixed(0)}km
                </span>
              </span>
              <span
                title={tier === "A" ? "鄉鎮震度 + 等震度網格 + 測站（五步回放）" : "僅測站（三步回放）"}
                style={{
                  flexShrink: 0,
                  fontSize: FONT_SIZE.xs,
                  fontWeight: 700,
                  padding: "2px 5px",
                  borderRadius: RADIUS.sm,
                  color: tier === "A" ? "#0f172a" : COLORS.textMuted,
                  background: tier === "A" ? "#fbbf24" : "rgba(255,255,255,0.08)",
                }}
              >
                {tier === "A" ? "完整" : "測站"}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 播放控制（仿 intel/IntelReplay）── */}
      <div
        style={{
          flexShrink: 0,
          padding: "9px 12px 11px",
          borderTop: `1px solid ${COLORS.panelBorder}`,
          background: "rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, letterSpacing: "1.5px", color: COLORS.textFaint }}>
            震後 T+
          </span>
          <span style={{ fontFamily: FONT_DATA, fontSize: 11.5, fontWeight: 700, color: hasTimeline ? COLORS.statusWarn : COLORS.textFaint }}>
            {hasTimeline ? `${clock.clock.toFixed(1)}s` : "—"}
          </span>
          <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs, color: COLORS.textDim }}>
            {hasTimeline ? `/ ${clock.duration.toFixed(0)}s · ×${clock.rate.toFixed(1)}` : "選一起地震"}
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onTogglePlay}
            disabled={!hasTimeline}
            title="play / pause"
            style={{
              width: 24, height: 24, borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.borderMid}`,
              background: "rgba(255,255,255,0.05)",
              color: hasTimeline ? COLORS.textDefault : COLORS.textFaint,
              cursor: hasTimeline ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {playing ? <Pause size={11} /> : <Play size={11} />}
          </button>
          <button
            onClick={onReplay}
            disabled={!hasTimeline}
            title="重播"
            style={{
              width: 24, height: 24, borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.borderMid}`,
              background: "rgba(255,255,255,0.05)",
              color: hasTimeline ? COLORS.textDefault : COLORS.textFaint,
              cursor: hasTimeline ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <RotateCcw size={11} />
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(1, clock.duration)}
          step={0.1}
          value={clock.clock}
          disabled={!hasTimeline}
          onChange={(ev) => earthquakeReplayClock.set(Number(ev.target.value), true)}
          style={{ width: "100%", height: 3, accentColor: COLORS.accent, cursor: hasTimeline ? "pointer" : "default" }}
        />
      </div>
    </div>
  );
}
