/**
 * 活的設計系統參考頁（design-system.html）。
 * 規則：元件從實作檔 import、數值從 token／規格常數 import，不手抄；每區附「規格 §x.y ／ 實作 path」。
 * 全部渲染完成後在 <html> 標 data-ds-ready="1"（給靜態快照腳本用）。
 */
import { useEffect } from "react";
import { BOOT_TIMING } from "../components/boot/bootSequence";
import { SPEC_MAP, SPEC_UI, type SectionDef } from "./kit";
import { LAYOUT_SECTION, LeftDockSection, TOKENS_SECTION, TYPE_SECTION, TokensSection, TypographySection } from "./sections/TokenSections";
import {
  CONTROLS_SECTION, ControlsSection, GLOW_SECTION, GlowSection, LEGEND_SECTION, LOADING_SECTION, LegendSection, LoadingStatusSection,
  PANEL_SECTION, POPUP_SECTION, PanelSection, PopupSection,
} from "./sections/ComponentSections";
import { TIMELINE_SECTION, TimelineSection } from "./sections/TimelineSection";
import { MAP_SECTION, MapLayerSection } from "./sections/MapLayerSection";
import { BOOT_SECTION, BootSection } from "./sections/BootSection";
import { MONITOR_SECTION, MonitorSection } from "./sections/MonitorSection";
import { LAYER_PANEL_SECTION, LINKED_SELECT_SECTION, LayerPanelSection, LinkedSelectSection } from "./sections/LayerPanelSection";

const SECTIONS: readonly [SectionDef, () => React.JSX.Element][] = [
  [TOKENS_SECTION, TokensSection],
  [TYPE_SECTION, TypographySection],
  [PANEL_SECTION, PanelSection],
  [POPUP_SECTION, PopupSection],
  [CONTROLS_SECTION, ControlsSection],
  [TIMELINE_SECTION, TimelineSection],
  [LOADING_SECTION, LoadingStatusSection],
  [GLOW_SECTION, GlowSection],
  [LEGEND_SECTION, LegendSection],
  [MAP_SECTION, MapLayerSection],
  [BOOT_SECTION, BootSection],
  [LAYOUT_SECTION, LeftDockSection],
  [MONITOR_SECTION, MonitorSection],
  [LAYER_PANEL_SECTION, LayerPanelSection],
  [LINKED_SELECT_SECTION, LinkedSelectSection],
];

/** 開站畫面淡入（台灣 0.7s、品牌字 0.3s 後 0.5s）結束後才標 ready，快照不會停在淡入中 */
const READY_DELAY_MS = BOOT_TIMING.introMs + 900;

function useReadySignal() {
  useEffect(() => {
    let cancelled = false;
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    void (async () => {
      await document.fonts.ready;
      await new Promise((r) => window.setTimeout(r, READY_DELAY_MS));
      await frame();
      await frame();
      if (!cancelled) document.documentElement.dataset.dsReady = "1";
    })();
    return () => { cancelled = true; };
  }, []);
}

export function DesignSystemPage() {
  useReadySignal();
  return (
    <div className="ds">
      <nav className="ds-toc" aria-label="目錄">
        <h1>Pulse 設計系統</h1>
        <p>活的參考頁：真元件＋真 token。</p>
        <ol>
          {SECTIONS.map(([def]) => (
            <li key={def.id}><a href={`#${def.id}`}><span className="ds-mono">{def.no}</span>{def.title}</a></li>
          ))}
        </ol>
      </nav>
      <main className="ds-main">
        <div className="ds-intro">
          <h2>元件與樣式參考</h2>
          <p>每個區塊都 import 實際元件與 token（<code>src/design-system/</code>），暗／淡並排；旁邊印出的數值是執行期讀到的真值。改了 token 或元件，這頁跟著變。</p>
          <p>規格文件：UI <code>{SPEC_UI}</code>、地圖 <code>{SPEC_MAP}</code>。標籤：<span className="ds-tag ds-tag--real">真元件</span> 直接渲染；<span className="ds-tag ds-tag--replica">結構仿製，樣式為真</span> 元件本身會拉進資料載入鏈或只吃全域狀態，改用它的真 class／真 token 組出；<span className="ds-tag ds-tag--doc">文件值</span> 程式沒有匯出常數，照規格印出。</p>
        </div>
        {SECTIONS.map(([def, Comp]) => <Comp key={def.id} />)}
      </main>
    </div>
  );
}
