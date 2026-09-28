import { Check } from "lucide-react";
import { BOOT_CITIES, BOOT_LAYOUT, bootGeometry, type BootPhase } from "./boot/bootSequence";
import { TAIWAN_OUTLINE } from "./boot/taiwanOutline";
import "./boot/bootScreen.css";

interface LoadingScreenProps {
  phase: Exclude<BootPhase, "gone">;
  isDarkTheme: boolean;
}

const GEOMETRY = bootGeometry();

/**
 * 開站畫面 W2「城市脈動」（design-system §5.33）：台灣本島＋離島輪廓，城市由北往南依序亮起。
 * 只負責畫面；時間（完成停留、淡出、元件彈入）由 App 依 BOOT_TIMING 推進 phase。
 */
export function LoadingScreen({ phase, isDarkTheme }: LoadingScreenProps) {
  const done = phase !== "loading";
  const className = [
    "boot-screen",
    isDarkTheme ? "" : "boot-screen--light",
    phase === "leaving" ? "boot-screen--leaving" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={className} style={{ zIndex: 9999 }} role="status" aria-live="polite">
      <div className="boot-screen__stage">
        <svg
          className="boot-screen__map"
          viewBox={GEOMETRY.viewBox}
          style={GEOMETRY.svg}
          aria-hidden="true"
        >
          <path className="boot-screen__land" d={TAIWAN_OUTLINE.path} />
          {BOOT_CITIES.map((city, i) => {
            const style = {
              "--delay": `${(i / BOOT_CITIES.length) * BOOT_LAYOUT.cycleS}s`,
              "--cycle": `${BOOT_LAYOUT.cycleS}s`,
              "--ripple": BOOT_LAYOUT.rippleScale,
            } as React.CSSProperties;
            return (
              <g key={city.name} style={style}>
                <circle className="boot-screen__ripple" cx={city.x} cy={city.y} r={GEOMETRY.cityRadius} />
                <circle className="boot-screen__city" cx={city.x} cy={city.y} r={GEOMETRY.cityRadius} />
              </g>
            );
          })}
        </svg>
        <div className="boot-screen__foot" style={{ top: GEOMETRY.footTop, left: GEOMETRY.footLeft }}>
          <div className="boot-screen__wordmark">
            MINI TAIWAN <span>PULSE</span>
          </div>
          <div className="boot-screen__status">
            <span className="boot-screen__icon">
              {done ? <Check size={10} strokeWidth={2.5} /> : <span className="boot-screen__ring" />}
            </span>
            <span>{done ? "完成" : "載入地圖"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
