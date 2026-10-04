/**
 * SatelliteConsole — 衛星情報儀表板主 panel
 *
 * 左 docked（與 IntelPanel 同位置 left:64, top:LAYOUT.leftDockTop），用 IntelPanel 同樣的 token / 動畫，
 * 確保視覺一致。P5-P10 接入 §A-§F 子區塊。
 */
import { useEffect, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA, PANEL_WIDTH } from "./satelliteConsoleTokens";
import { RADIUS, FONT_SIZE, LAYOUT, SURFACE } from "../../styles/designTokens";
import { SatelliteConsoleHeader } from "./SatelliteConsoleHeader";
import { ManeuverAlertSection } from "./ManeuverAlertSection";
import { CNGroupSection } from "./CNGroupSection";
import { TWFleetSection } from "./TWFleetSection";
import { CoverageStatsSection } from "./CoverageStatsSection";
import { SatelliteDetailCard } from "./SatelliteDetailCard";
import { ManeuverCompareModal } from "./ManeuverCompareModal";
import { describeFreshness, type ManeuversState } from "../../data/satelliteDataState";
import { useSatelliteRecords } from "../../hooks/useSatelliteRecords";
import { satelliteConsoleStore, useSatelliteConsole } from "../../state/satelliteConsoleStore";
import { useTimeStoreTime, isHistoryMode } from "../../hooks/useTimeStoreTime";
import type { LayerVisibility } from "../../types";

interface Props {
  /** 變軌資料（App 持有的單一來源，面板不自己輪詢） */
  maneuvers: ManeuversState;
  open: boolean;
  onClose: () => void;
  layerVisibility: LayerVisibility;
  setLayerVisibility: (next: Partial<LayerVisibility>) => void;
  /** 點台灣 hero / CN group row → 飛去衛星目前位置 */
  onFlyTo?: (lon: number, lat: number) => void;
}

export function SatelliteConsole({ maneuvers, open, onClose, layerVisibility, setLayerVisibility, onFlyTo }: Props) {
  const consoleState = useSatelliteConsole();
  // 訂閱時間軸 — 顯示時間徽章 + 歷史模式邊框
  const timelineSec = useTimeStoreTime(500);
  const isHistory = isHistoryMode(timelineSec);
  // 資料新鮮度：TLE 抓取時間 + 變軌最後成功讀取時間；每分鐘重算「是否過期」
  const tle = useSatelliteRecords(open);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [open]);
  const freshness = [
    // TLE 由 gis-platform 每 2h 從 Space-Track 同步
    describeFreshness({ label: "TLE", status: tle.status, fetchedAt: tle.fetchedAt, nowMs, periodMin: 120 }),
    describeFreshness({ label: "變軌", status: maneuvers.status, fetchedAt: maneuvers.fetchedAt, stale: maneuvers.stale, nowMs }),
  ];

  // 全部變軌（含 INTL）— Header 警示用，總數就好；細節由 §A 拆給看。讀取失敗時不亮 ALERT
  const totalManeuverCount = maneuvers.status === "ok" ? maneuvers.rows.length : 0;

  if (!open) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          left: 64,
          top: LAYOUT.leftDockTop,
          bottom: 130,
          width: PANEL_WIDTH,
          background: SURFACE.strong,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: `1px solid ${isHistory ? "rgba(255,152,0,0.45)" : COLORS.panelBorder}`,
          boxShadow: isHistory
            ? "0 0 0 1px rgba(255,152,0,0.18), 0 12px 40px rgba(0,0,0,0.45)"
            : "0 12px 40px rgba(0,0,0,0.45)",
          borderRadius: RADIUS.xl,
          zIndex: 30,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          pointerEvents: "auto",
          animation: "satConsoleFadeIn .25s ease-out",
          color: COLORS.textDefault,
          fontFamily: FONT_CJK,
        }}
      >
        <SatelliteConsoleHeader
          totalManeuvers={totalManeuverCount}
          timelineSec={timelineSec}
          onClose={onClose}
        />

        <div className="mtp-scroll" style={{ flex: 1, overflowY: "auto" }}>
          <ManeuverAlertSection
            maneuvers={maneuvers}
            onSelectNorad={(n) => satelliteConsoleStore.selectNorad(n)}
            onOpenCompare={(m) => satelliteConsoleStore.openCompare(m)}
            onFlyTo={onFlyTo}
          />

          <CoverageStatsSection
            maneuvers={maneuvers.rows}
          />

          <CNGroupSection
            maneuvers={maneuvers.rows}
            layerVisibility={layerVisibility}
            setLayerVisibility={setLayerVisibility}
            onSelectNorad={(n) => satelliteConsoleStore.selectNorad(n)}
          />

          <TWFleetSection
            maneuvers={maneuvers.rows}
            onSelectNorad={(n) => satelliteConsoleStore.selectNorad(n)}
            onFlyTo={onFlyTo}
          />
        </div>

        <div style={{
          flexShrink: 0,
          padding: "8px 14px",
          borderTop: `1px solid ${COLORS.borderSoft}`,
          fontFamily: FONT_DATA,
          fontSize: FONT_SIZE.xs,
          color: COLORS.textFaint,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "4px 10px",
        }}>
          <div role="status" style={{ flexBasis: "100%", display: "flex", flexWrap: "wrap", gap: "2px 10px" }}>
            {freshness.map((f) => (
              <span key={f.text} style={{ color: f.tone === "warn" ? COLORS.statusWarn : COLORS.textFaint }}>{f.text}</span>
            ))}
          </div>
          <span>UCS Database · Space-Track</span>
          <span style={{ marginLeft: "auto" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", color: COLORS.textMuted }}>
              <input
                type="checkbox"
                checked={consoleState.showAllOrbits}
                onChange={(e) => satelliteConsoleStore.setShowAllOrbits(e.target.checked)}
                style={{ accentColor: COLORS.accent }}
              />
              顯示全部軌道
            </label>
          </span>
        </div>
      </div>

      {/* §E 百科卡 — overlay on top of panel */}
      {consoleState.selectedNorad != null && (
        <SatelliteDetailCard
          norad={consoleState.selectedNorad}
          onClose={() => satelliteConsoleStore.selectNorad(null)}
          onOpenCompare={(m) => satelliteConsoleStore.openCompare(m)}
        />
      )}

      {/* §F 變軌前後對比 modal */}
      {consoleState.compareManeuver && (
        <ManeuverCompareModal
          maneuver={consoleState.compareManeuver}
          onClose={() => satelliteConsoleStore.closeCompare()}
        />
      )}

      <style>{`
        @keyframes satConsoleFadeIn {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes satManeuverPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.92); }
        }
      `}</style>
    </>
  );
}
