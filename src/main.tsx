// ⚠️ 必須是第一行：注入 mapboxgl.MercatorCoordinate 給 utils/coordinates
// （EM-16 引擎注入改造；早於 MapView 建 map 與任何 Three 場景求值）
import "./utils/mercatorEngineMapbox";
import "./styles/tokens.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { setBootAttr } from "./components/boot/bootSequence";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

// 開站畫面期間主畫面元件先藏在邊界外，地圖好了再彈入（design-system §5.33）
setBootAttr("wait");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
