// ⚠️ 必須是第一行：注入 maplibregl.MercatorCoordinate 給 utils/coordinates
// （EM-16 回放圖層用；embed 不得 static import mapbox-gl）
import "./mercatorEngineMaplibre";
import "./maplibreWorker";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EmbedApp } from "./EmbedApp";
import { localeStore } from "../state/localeStore";

// 嵌入頁依看的人的語系：?lang= ＞ 上次選擇 ＞ zh-TW（本頁沒有語系切換器；目前只影響底圖地名與已翻譯的外框文字）。
localeStore.init();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <EmbedApp />
  </StrictMode>,
);
