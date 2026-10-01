/**
 * 監看卡標題（spec §5.35 C3）：中文標題＋英文小字附註。
 * v2 的標題列由 MonitorPanel 依這張表統一畫，各卡不再自己寫標題文字。
 */
import type { MonitorWidgetId } from "./monitorLayout";

export interface MonitorCardMeta {
  title: string;
  /** 英文小字附註；窄格放不下時先隱藏 */
  en: string;
}

export const MONITOR_CARD_META: Record<MonitorWidgetId, MonitorCardMeta> = {
  newsFeed: { title: "新聞事件", en: "News feed" },
  timeline: { title: "新聞與警報時間軸", en: "Timeline" },
  alertBoard: { title: "警訊整合", en: "Alerts" },
  hotZones: { title: "熱區前五名", en: "Hotspots" },
  triage: { title: "信號分級", en: "Triage" },
  histogram: { title: "每小時新聞量", en: "Hourly" },
  liveWall: { title: "新聞直播", en: "Live news" },
  hazardStrip: { title: "災防觀測", en: "Hazard watch" },
  typhoon: { title: "颱風", en: "Typhoon" },
  radiation: { title: "環境輻射", en: "Radiation" },
  lightning: { title: "落雷", en: "Lightning" },
  earthquake: { title: "地震", en: "Earthquake" },
  foodPriceBoard: { title: "食品價格", en: "Food prices" },
  taiex: { title: "加權指數", en: "TAIEX" },
  situationCards: { title: "公衛週報", en: "Public health" },
  prison: { title: "在監人數", en: "Inmates" },
  airportPax: { title: "機場入出境", en: "Border pax" },
  powerCard: { title: "供電", en: "Power grid" },
  erCongestion: { title: "急診壅塞", en: "ER congestion" },
  situationOverview: { title: "戰情概覽", en: "Pressure index" },
  plaBoard: { title: "共機擾台", en: "PLA activity" },
  vesselZone: { title: "特殊船舶接近", en: "Vessel zones" },
  isrSatellitePasses: { title: "中國 ISR 衛星過境", en: "ISR passes" },
  traDelay: { title: "台鐵誤點", en: "TRA delay" },
  internetHealth: { title: "網路觀察", en: "RIPE NCC" },
};
