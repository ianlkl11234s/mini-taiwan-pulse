/**
 * 監看卡標題（spec §5.35 C3）：中文標題＋英文小字附註。
 * v2 的標題列由 MonitorPanel 依這張表統一畫，各卡不再自己寫標題文字。
 */
import type { MonitorWidgetId } from "./monitorLayout";
import type { MonitorFreshnessSpec } from "./monitorFreshness";

export interface MonitorCardMeta {
  title: string;
  /** 英文小字附註；窄格放不下時先隱藏 */
  en: string;
  /**
   * 預期更新週期（spec §5.35 狀態字表；依 data-quality.md 的上游頻率）。
   * 不給＝沒有資料本身的時間可判斷（直播、災防觀測），不出新鮮度狀態。
   */
  fresh?: MonitorFreshnessSpec;
}

export const MONITOR_CARD_META: Record<MonitorWidgetId, MonitorCardMeta> = {
  newsFeed: { title: "新聞事件", en: "News feed", fresh: { cadence: "stream", periodMin: 30 } },
  timeline: { title: "新聞與警報時間軸", en: "Timeline", fresh: { cadence: "stream", periodMin: 30 } },
  alertBoard: { title: "警訊整合", en: "Alerts", fresh: { cadence: "stream", periodMin: 15 } },
  hotZones: { title: "熱區前五名", en: "Hotspots", fresh: { cadence: "stream", periodMin: 30 } },
  triage: { title: "信號分級", en: "Triage", fresh: { cadence: "stream", periodMin: 30 } },
  histogram: { title: "每小時新聞量", en: "Hourly", fresh: { cadence: "stream", periodMin: 30 } },
  liveWall: { title: "新聞直播", en: "Live news" },
  hazardStrip: { title: "災防觀測", en: "Hazard watch" },
  typhoon: { title: "颱風", en: "Typhoon", fresh: { cadence: "event" } },
  radiation: { title: "環境輻射", en: "Radiation", fresh: { cadence: "stream", periodMin: 15 } },
  lightning: { title: "落雷", en: "Lightning", fresh: { cadence: "event" } },
  earthquake: { title: "地震", en: "Earthquake", fresh: { cadence: "event" } },
  foodPriceBoard: { title: "食品價格", en: "Food prices", fresh: { cadence: "days", staleDays: 3 } },
  taiex: { title: "加權指數", en: "TAIEX", fresh: { cadence: "market", periodMin: 1 } },
  situationCards: { title: "公衛週報", en: "Public health", fresh: { cadence: "days", staleDays: 14, stoppedDays: 35 } },
  prison: { title: "在監人數", en: "Inmates", fresh: { cadence: "days" } },
  airportPax: { title: "機場入出境", en: "Border pax", fresh: { cadence: "stream", periodMin: 60 } },
  powerCard: { title: "供電", en: "Power grid", fresh: { cadence: "stream", periodMin: 10 } },
  erCongestion: { title: "急診壅塞", en: "ER congestion", fresh: { cadence: "stream", periodMin: 15 } },
  situationOverview: { title: "戰情概覽", en: "Pressure index", fresh: { cadence: "stream", periodMin: 60 } },
  plaBoard: { title: "共機擾台", en: "PLA activity", fresh: { cadence: "days" } },
  // 沒有船的日子 RPC 沒有列，最後一列日期不代表來源停更 → 不判過期
  vesselZone: { title: "特殊船舶接近", en: "Vessel zones", fresh: { cadence: "event" } },
  isrSatellitePasses: { title: "中國 ISR 衛星過境", en: "ISR passes", fresh: { cadence: "days" } },
  traDelay: { title: "台鐵誤點", en: "TRA delay", fresh: { cadence: "days", staleDays: 3 } },
  internetHealth: { title: "網路觀察", en: "RIPE NCC", fresh: { cadence: "stream", periodMin: 5 } },
};
