/**
 * §5.5 共用圖層列與主題列（面板統一 A／B 段）、§5.37 連動選單（C 段）。
 * 列、主題列、標題、控制項都是真元件；名稱／色／icon 讀 manifest 真條目，計數與選項是小型假資料（不呼叫網路）。
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { FONT_CJK, FONT_SIZE } from "../../styles/designTokens";
import { LAYER_MANIFEST, type LayerName } from "../../data/layerManifest";
import { SEQUENTIAL_PALETTES } from "../../map/palettes";
import { LayerRow, ListRow } from "../../components/sidebar/LayerRow";
import { MacroGroupLabel, SubGroupLabel, ThemeBanner } from "../../components/sidebar/ThemeBanner";
import { LayerControlArea, ParamControlList } from "../../components/sidebar/LayerParamControls";
import { LayerInfoLine } from "../../components/sidebar/LayerInfoLine";
import { RailThemeContext, railPalette } from "../../components/sidebar/railTheme";
import type { LinkedSelectConfig, ParamControl } from "../../state/layerParamsControls";
import { Kv, Pair, Section, Spec, Sub, type SectionDef } from "../kit";

type DemoKey = "cctv" | "jpNaturalParksNational";
interface DemoEntry { name: LayerName; label: string; color: string; icon: LucideIcon }
const entry = (key: DemoKey) => LAYER_MANIFEST[key] as unknown as DemoEntry;

/** 圖層面板外殼（railTheme 的 BG_PANEL／PANEL_BORDER），寬度可調來示範空間不足 */
function RailPanel({ isDark, width = 300, children }: { isDark: boolean; width?: number; children: ReactNode }) {
  const p = railPalette(isDark);
  return (
    <RailThemeContext.Provider value={p}>
      <div style={{ width, maxWidth: "100%", background: p.BG_PANEL, border: `1px solid ${p.PANEL_BORDER}`, borderRadius: 8, overflow: "hidden", color: p.TEXT_STRONG, fontFamily: FONT_CJK }}>
        {children}
      </div>
    </RailThemeContext.Provider>
  );
}

// ── §5.5 共用圖層列與主題列 ────────────────────────────────
function LayerPanelDemo({ isDark }: { isDark: boolean }) {
  const cctv = entry("cctv");
  const park = entry("jpNaturalParksNational");
  const [collapsed, setCollapsed] = useState(false);
  const [on, setOn] = useState<Record<DemoKey, boolean>>({ cctv: true, jpNaturalParksNational: false });
  const [expanded, setExpanded] = useState<DemoKey | null>("cctv");
  const [filter, setFilter] = useState("all");
  const [pal, setPal] = useState("viridis");
  const [opacity, setOpacity] = useState(0.8);
  const [size, setSize] = useState(1);
  const toggle = (k: string) => setOn((s) => ({ ...s, [k]: !s[k as DemoKey] }));
  const click = (k: string) => setExpanded((cur) => (cur === k ? null : (k as DemoKey)));

  // 展開區控件順序：資料篩選 → 顏色 → 透明度 → 大小（說明・來源固定最後一行）
  const controls: ParamControl[] = [
    { type: "select", label: "資料篩選", value: filter, options: [{ label: "全部", value: "all" }, { label: "國道", value: "fw" }, { label: "省道", value: "pw" }, { label: "市區", value: "city" }], onChange: setFilter },
    { type: "palette", label: "顏色", value: pal, defaultValue: "viridis", role: "heatmap", options: SEQUENTIAL_PALETTES.map((x) => ({ label: x.zh, value: x.id })), onChange: setPal },
    { label: `透明度 ${opacity.toFixed(2)}`, name: "透明度", valueText: opacity.toFixed(2), value: opacity, min: 0, max: 1, step: 0.05, onChange: setOpacity },
    { label: `大小 ×${size.toFixed(1)}`, name: "大小", valueText: `×${size.toFixed(1)}`, value: size, min: 0.5, max: 3, step: 0.1, onChange: setSize },
  ];
  const p = railPalette(isDark);

  return <>
    <Sub title="主題列 ThemeBanner、大分類 MacroGroupLabel、L2 群組 SubGroupLabel、圖層列 LayerRow" kind="real">
      <RailPanel isDark={isDark}>
        <MacroGroupLabel zh="移動與城市" />
        <ThemeBanner title="交通 Move" isCollapsed={collapsed} onCount={Object.values(on).filter(Boolean).length} totalCount={24} onToggleCollapse={() => setCollapsed((c) => !c)} onBulkToggle={() => setOn((s) => ({ cctv: !s.cctv, jpNaturalParksNational: s.jpNaturalParksNational }))} />
        {!collapsed && <>
          <SubGroupLabel>路網</SubGroupLabel>
          <LayerRow layerKey="cctv" name={cctv.name} label={cctv.label} expandable active={on.cctv} locked={false} color={cctv.color} count={2386} isExpanded={expanded === "cctv"} Icon={cctv.icon} onLayerClick={click} onToggleVisibility={toggle} />
          {expanded === "cctv" && (
            <LayerControlArea isDarkTheme={isDark} style={{ margin: "2px 12px 8px 22px" }}>
              <ParamControlList controls={controls} />
              <LayerInfoLine layerKey="cctv">
                <p style={{ margin: "2px 0 4px", color: p.DIM, fontSize: FONT_SIZE.sm, lineHeight: 1.5 }}>（參考頁假資料）上游資料卡在此處；實際畫面是資料來源面板同一張卡。</p>
              </LayerInfoLine>
            </LayerControlArea>
          )}
          <ListRow label="空氣品質測站" ariaLabel="空氣品質測站（載入中示範）" icon={<cctv.icon size={14} color="#22c55e" style={{ flexShrink: 0 }} />} loading accent="#22c55e" active expandable toggle={{ on: true, onChange: () => undefined, label: "空氣品質測站 顯示" }} />
          <ListRow label="私人圖層" ariaLabel="私人圖層（鎖定示範）" icon={<cctv.icon size={14} color={p.DIM} style={{ flexShrink: 0 }} />} locked expandable toggle={{ on: false, onChange: () => undefined }} />
        </>}
        <MacroGroupLabel zh="自然與環境" />
        <ThemeBanner title="自然保護" isCollapsed={false} onCount={on.jpNaturalParksNational ? 1 : 0} totalCount={6} onToggleCollapse={() => undefined} onBulkToggle={() => toggle("jpNaturalParksNational")} />
        <SubGroupLabel>自然公園（歷史資料）</SubGroupLabel>
        <LayerRow layerKey="jpNaturalParksNational" name={park.name} label={park.label} expandable active={on.jpNaturalParksNational} locked={false} color={park.color} count={34} isExpanded={false} Icon={park.icon} onLayerClick={() => toggle("jpNaturalParksNational")} onToggleVisibility={toggle} />
        <MacroGroupLabel zh="醫療與照護" />
        <ThemeBanner title="長照服務" isCollapsed onCount={0} totalCount={3} onToggleCollapse={() => undefined} onBulkToggle={() => undefined} />
      </RailPanel>
      <p className="ds-note" style={{ marginTop: 4 }}>名稱、色、icon 讀 <code>LAYER_MANIFEST</code> 真條目（<code>cctv</code>、<code>jpNaturalParksNational</code> 有外文與來源標籤）；計數為假資料。轉圈與鎖定列是 <code>ListRow</code>（<code>LayerRow</code> 底下的同一個元件）直接帶 <code>loading</code>／<code>locked</code>，不往全域 loadingRegistry 塞假任務。</p>
    </Sub>
    <Sub title="空間不足：主題列只截副標、中文與計數不折行；圖層列只截外文" kind="real">
      <RailPanel isDark={isDark} width={210}>
        <ThemeBanner title="農林漁牧 Agriculture, Forestry & Fisheries" isCollapsed={false} onCount={2} totalCount={11} onToggleCollapse={() => undefined} onBulkToggle={() => undefined} />
        <LayerRow layerKey="jpNaturalParksNational" name={park.name} label={park.label} expandable active locked={false} color={park.color} count={34} isExpanded={false} Icon={park.icon} onLayerClick={() => undefined} onToggleVisibility={() => undefined} />
      </RailPanel>
    </Sub>
    <Sub title="展開區（ExpandedControls 的組成）" kind="replica" tagText="真子元件組出">
      <p className="ds-note"><code>ExpandedControls</code> 本體會 per-key 訂閱參數 store 並觸發連動選單載入，本頁改用它的真子元件照同一順序組出：<code>LayerControlArea</code>（同一 margin）→ <code>ParamControlList</code>（資料篩選 → 顏色 → 透明度 → 大小）→ <code>LayerInfoLine</code>「說明・來源」。點上方「道路攝影機」可收合／展開。</p>
    </Sub>
    <Kv rows={[
      ["BG_PANEL", p.BG_PANEL], ["PANEL_BORDER", p.PANEL_BORDER], ["BANNER_BG", p.BANNER_BG], ["DIM", p.DIM], ["TEXT_STRONG", p.TEXT_STRONG], ["ROW_HOVER", p.ROW_HOVER],
      ["主題列中文", `FONT_SIZE.lg = ${FONT_SIZE.lg}px semibold`], ["副標", `FONT_SIZE.sm = ${FONT_SIZE.sm}px`], ["圖層列中文", `FONT_SIZE.md = ${FONT_SIZE.md}px`], ["大分類", "9.5px（文件值）"],
    ]} />
  </>;
}

export const LAYER_PANEL_SECTION: SectionDef = { id: "layer-panel", no: "14", title: "圖層列與主題列" };
export function LayerPanelSection() {
  return (
    <Section def={LAYER_PANEL_SECTION}>
      <Spec section="§5.5" impl={["src/components/sidebar/LayerRow.tsx", "src/components/sidebar/layerRow.css", "src/components/sidebar/ThemeBanner.tsx", "src/components/sidebar/ExpandedControls.tsx", "src/components/sidebar/LayerInfoLine.tsx", "src/components/sidebar/railTheme.ts"]} />
      <Pair lightRemap render={(isDark) => <LayerPanelDemo isDark={isDark} />} />
    </Section>
  );
}

// ── §5.37 連動選單 ─────────────────────────────────────────
const PERIODS = [{ label: "113 年", value: "113" }, { label: "112 年", value: "112" }, { label: "111 年", value: "111" }];
/** 「切換中」要等 onChange 回的 Promise；這裡給一個永不完成的，讓狀態停住 */
const never = () => new Promise<void>(() => undefined);

function LinkedSelectDemo({ isDark }: { isDark: boolean }) {
  const [period, setPeriod] = useState("113");
  const [retried, setRetried] = useState(0);
  const switchingRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // 切換中是 LinkedSelectControl 的內部狀態，沒有 prop 可設：掛載後程式觸發一次改值（React 走原生 change 事件）
    const select = switchingRef.current?.querySelector("select");
    if (!select) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    setter?.call(select, "112");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, []);

  const states: readonly [string, LinkedSelectConfig][] = [
    ["一般", { type: "linkedSelect", label: "資料期別", value: period, options: PERIODS, status: "ready", onChange: setPeriod }],
    ["載入中", { type: "linkedSelect", label: "資料期別", value: "", options: [], status: "loading", statusText: "載入中…", onChange: () => undefined }],
    ["載入失敗＋重試", { type: "linkedSelect", label: "資料期別", value: "", options: [], status: "error", statusText: `載入失敗：連線逾時${retried ? `（已重試 ${retried} 次）` : ""}`, onChange: () => undefined, onRetry: () => setRetried((n) => n + 1) }],
    ["切換中", { type: "linkedSelect", label: "資料期別", value: "113", options: PERIODS, status: "ready", onChange: never }],
  ];
  return <>
    <div className="ds-row">
      {states.map(([name, ctrl]) => (
        <Sub key={name} title={name} kind="real">
          <div ref={name === "切換中" ? switchingRef : undefined} style={{ width: 220, maxWidth: "100%", fontFamily: FONT_CJK }}>
            <LayerControlArea isDarkTheme={isDark}>
              <ParamControlList controls={[ctrl]} />
            </LayerControlArea>
          </div>
        </Sub>
      ))}
    </div>
    <p className="ds-note">選項為假資料（不接 provider）。「切換中」：掛載後程式改一次值、<code>onChange</code> 回不會完成的 Promise，所以停在「切換中…」且選單暫停操作；實際畫面在資料載入完就恢復。「重試」在活頁可點。</p>
  </>;
}

export const LINKED_SELECT_SECTION: SectionDef = { id: "linked-select", no: "15", title: "連動選單" };
export function LinkedSelectSection() {
  return (
    <Section def={LINKED_SELECT_SECTION}>
      <Spec section="§5.37" impl={["src/components/sidebar/LayerParamControls.tsx（LinkedSelectControl）", "src/state/layerParamsControls.ts（LinkedSelectConfig）", "src/state/linkedSelect.ts"]} />
      <Pair lightRemap render={(isDark) => <LinkedSelectDemo isDark={isDark} />} />
    </Section>
  );
}
