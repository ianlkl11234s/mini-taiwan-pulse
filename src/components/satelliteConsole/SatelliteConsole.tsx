/**
 * SatelliteConsole — 衛星情報儀表板主 panel
 *
 * 左 docked（與 IntelPanel 同位置 left:64, top:98），用 IntelPanel 同樣的 token / 動畫，
 * 確保視覺一致。P5-P10 接入 §A-§F 子區塊。
 */
import { useEffect, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA, PANEL_WIDTH } from "./satelliteConsoleTokens";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { SatelliteConsoleHeader } from "./SatelliteConsoleHeader";
import { ManeuverAlertSection } from "./ManeuverAlertSection";
import { CNGroupSection } from "./CNGroupSection";
import { TWFleetSection } from "./TWFleetSection";
import { CoverageStatsSection } from "./CoverageStatsSection";
import { SatelliteDetailCard } from "./SatelliteDetailCard";
import { ManeuverCompareModal } from "./ManeuverCompareModal";
import { fetchRecentManeuvers, type ManeuverRow } from "../../data/satelliteManeuversLoader";
import { satelliteConsoleStore, useSatelliteConsole } from "../../state/satelliteConsoleStore";
import { useTimeStoreTime, isHistoryMode } from "../../hooks/useTimeStoreTime";
import type { LayerVisibility } from "../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  layerVisibility: LayerVisibility;
  setLayerVisibility: (next: Partial<LayerVisibility>) => void;
  /** 點台灣 hero / CN group row → 飛去衛星目前位置 */
  onFlyTo?: (lon: number, lat: number) => void;
}

export function SatelliteConsole({ open, onClose, layerVisibility, setLayerVisibility, onFlyTo }: Props) {
  const [maneuvers, setManeuvers] = useState<ManeuverRow[]>([]);
  const consoleState = useSatelliteConsole();
  // 訂閱時間軸 — 顯示時間徽章 + 歷史模式邊框
  const timelineSec = useTimeStoreTime(500);
  const isHistory = isHistoryMode(timelineSec);

  // 載入近 24h 變軌，30s polling
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const tick = () => {
      fetchRecentManeuvers(24).then((rows) => {
        if (alive) setManeuvers(rows);
      });
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [open]);

  // 全部變軌（含 INTL）— Header 警示用，總數就好；細節由 §A 拆給看
  const totalManeuverCount = maneuvers.length;

  if (!open) return null;

  return (
    <>
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
            maneuvers={maneuvers}
          />

          <CNGroupSection
            maneuvers={maneuvers}
            layerVisibility={layerVisibility}
            setLayerVisibility={setLayerVisibility}
            onSelectNorad={(n) => satelliteConsoleStore.selectNorad(n)}
          />

          <TWFleetSection
            maneuvers={maneuvers}
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
          gap: 10,
        }}>
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
