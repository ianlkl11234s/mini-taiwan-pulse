/**
 * 地圖無法啟動時的說明（OPS-1）：沒有 WebGL2，或地圖初始化丟錯。
 * 取代整個 App 畫面，避免整頁空白；只連到不需要 3D 的頁面（/blog/）。
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useLocale } from "../../state/localeStore";
import "./mapUnavailable.css";

export type MapUnavailableReason = "webgl" | "crash";

/** Mapbox GL v3、MapLibre v6、three r17x 都需要 WebGL2。不帶 failIfMajorPerformanceCaveat：軟體繪圖仍可用。 */
export function hasWebGL2(doc: Document = document): boolean {
  try {
    return !!doc.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

export function MapUnavailableNotice({ reason }: { reason: MapUnavailableReason }) {
  const { t } = useLocale();
  return (
    <main className="map-unavailable" role="alert">
      <div className="map-unavailable__card">
        <p className="map-unavailable__eyebrow">Mini Taiwan Pulse</p>
        <h1 className="map-unavailable__title">{t(reason === "webgl" ? "mapUnavailable.webglTitle" : "mapUnavailable.crashTitle")}</h1>
        <p className="map-unavailable__body">{t(reason === "webgl" ? "mapUnavailable.webglBody" : "mapUnavailable.crashBody")}</p>
        <p className="map-unavailable__hint">{t("mapUnavailable.browserHint")}</p>
        <div className="map-unavailable__actions">
          {reason === "crash" && (
            <button type="button" className="map-unavailable__btn map-unavailable__btn--primary" onClick={() => window.location.reload()}>
              {t("mapUnavailable.reload")}
            </button>
          )}
          <a className={`map-unavailable__btn${reason === "webgl" ? " map-unavailable__btn--primary" : ""}`} href="/blog/">
            {t("mapUnavailable.blogLink")}
          </a>
        </div>
      </div>
    </main>
  );
}

/** 包住整個 App：初始化（含 Mapbox 建構）丟錯時顯示說明，不讓 React 卸載成空白頁。 */
export class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("[app] 畫面啟動失敗：", error, info.componentStack);
  }

  render(): ReactNode {
    return this.state.failed ? <MapUnavailableNotice reason="crash" /> : this.props.children;
  }
}
