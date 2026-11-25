// ⚠️ 必須是第一行：注入 mapboxgl.MercatorCoordinate 給 utils/coordinates
// （EM-16 引擎注入改造；早於 MapView 建 map 與任何 Three 場景求值）
import "./utils/mercatorEngineMapbox";
import "./styles/tokens.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { setBootAttr } from "./components/boot/bootSequence";
import { localeStore } from "./state/localeStore";
import { setPackLocaleLoader } from "./countries/packs";
import { countryLayerFile } from "./i18n/localeFiles";
import { loadLayerAssetIndex } from "./data/layerAssetIndex";
import { MapErrorBoundary, MapUnavailableNotice, hasWebGL2 } from "./components/boot/MapUnavailableNotice";

// i18n：國家包的英日文圖層名（layers.<cc>）跟著國家包載入；要在 init 前接上，開站國家包的檔才會算進開站檔
setPackLocaleLoader((cc) => localeStore.need([countryLayerFile(cc)]));
// i18n：讀 URL ?lang／偏好／瀏覽器語言，並寫入 <html lang>（驅動 CSS :lang() 字型堆疊）
localeStore.init();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

// 沒有 WebGL2 時不建地圖，直接顯示說明（OPS-1：原本整頁空白）；也不設開站等待狀態
if (!hasWebGL2()) {
  createRoot(rootEl).render(
    <StrictMode>
      <MapUnavailableNotice reason="webgl" />
    </StrictMode>,
  );
} else {
  // 靜態圖層資產索引（ADR-0024 §4）：開站載入一次，之後 resolver 同步查表。失敗時遷移清單內的圖層退回部署時版本。
  void loadLayerAssetIndex();

  // 開站畫面期間主畫面元件先藏在邊界外，地圖好了再彈入（design-system §5.33）
  setBootAttr("wait");

  createRoot(rootEl).render(
    <StrictMode>
      <MapErrorBoundary>
        <App />
      </MapErrorBoundary>
    </StrictMode>,
  );
}
