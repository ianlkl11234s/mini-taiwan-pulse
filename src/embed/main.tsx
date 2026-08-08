// ⚠️ 必須是第一行：注入 maplibregl.MercatorCoordinate 給 utils/coordinates
// （EM-16 回放圖層用；embed 不得 static import mapbox-gl）
import "./mercatorEngineMaplibre";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EmbedApp } from "./EmbedApp";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <EmbedApp />
  </StrictMode>,
);
