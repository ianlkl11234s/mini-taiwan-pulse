import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/tokens.css";
import "./card.css";
import { CardApp } from "./CardApp";
import { localeStore } from "../state/localeStore";

// 分析卡是公開頁，外框文字依看卡人語系：?lang= ＞ 上次選擇 ＞ zh-TW（本頁沒有語系切換器）。
localeStore.init();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

createRoot(rootEl).render(
  <StrictMode>
    <CardApp />
  </StrictMode>,
);
