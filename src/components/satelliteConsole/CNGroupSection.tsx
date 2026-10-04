/**
 * §B 中國衛星 6 群 accordion
 *
 * Yaogan/Jilin/Gaofen (S) + TJS (A) + Beidou (B) + Shiyan/餘 (C)
 *
 * 每組標題：共用 ListRow —— icon + 中文主名／外文小字 + 變軌 N chip + N 顆 + chevron + 列開關
 * 展開：該組衛星列表，每列 name / alt / 變軌 chip if maneuver
 *
 * Toggle 與 LayerVisibility 雙向同步（左 sidebar 同步可見）
 */
import { useEffect, useMemo, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA, CN_GROUPS_META, INTL_GROUPS_META } from "./satelliteConsoleTokens";
import { FONT_SIZE } from "../../styles/designTokens";
import { chipOutline } from "../intel/intelTokens";
import { loadSatellitesResult } from "../../data/satelliteLoader";
import type { SatelliteRecord, SatelliteCategory } from "../../data/satelliteTypes";
import type { ManeuverRow } from "../../data/satelliteManeuversLoader";
import type { LayerVisibility } from "../../types";
import * as satellite from "satellite.js";
import { Satellite as SatelliteIcon } from "lucide-react";
import { ListRow, LayerNameLine } from "../sidebar/LayerRow";
import { SubGroupLabel } from "../sidebar/ThemeBanner";
import { DARK_PALETTE, RailThemeContext } from "../sidebar/railTheme";

interface Props {
  maneuvers: ManeuverRow[];
  layerVisibility: LayerVisibility;
  setLayerVisibility: (next: Partial<LayerVisibility>) => void;
  onSelectNorad: (n: number) => void;
}

interface SatRow {
  norad: number;
  name: string;
  alt: number | null;
}


// §5.21 狀態徽章：chipOutline，圓角 3、10px（同 SatelliteConsoleHeader）
const CHIP_BASE = {
  display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 5px",
  borderRadius: 3, fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, lineHeight: 1.2, whiteSpace: "nowrap",
} as const;

export function CNGroupSection({ maneuvers, layerVisibility, setLayerVisibility, onSelectNorad }: Props) {
  const [records, setRecords] = useState<SatelliteRecord[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">("loading");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    loadSatellitesResult().then((res) => {
      if (!alive) return;
      if (res.ok) { setRecords(res.records); setLoadState("ok"); } else setLoadState("error");
    });
    return () => { alive = false; };
  }, []);

  // 按 category 分流 sat list + 算 alt
  const byCat = useMemo(() => {
    const map = new Map<SatelliteCategory, SatRow[]>();
    for (const r of records) {
      const list = map.get(r.category) ?? [];
      let alt: number | null = null;
      try {
        const satrec = satellite.twoline2satrec(r.tleLine1, r.tleLine2);
        const noRadMin = satrec.no;
        if (noRadMin > 0) {
          // n (rad/min) → n (rad/s) → semi-major axis a = (μ/n²)^(1/3)
          const nRadSec = noRadMin / 60;
          const a = Math.pow(398600.4418 / (nRadSec ** 2), 1 / 3); // km
          alt = a - 6371;
        }
      } catch { /* skip */ }
      list.push({ norad: r.noradId, name: r.name, alt });
      map.set(r.category, list);
    }
    // 各組依名稱排序
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [records]);

  // 變軌計數 by group
  const maneuverCountByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const mn of maneuvers) {
      const cat = mapManeuverGroupToCategory(mn.cn_group);
      if (!cat) continue;
      m.set(cat, (m.get(cat) ?? 0) + 1);
    }
    return m;
  }, [maneuvers]);

  // 變軌的 NORAD set（給展開列表標 ⚡）
  const maneuverNoradSet = useMemo(() => {
    const s = new Set<number>();
    for (const m of maneuvers) s.add(m.norad_id);
    return s;
  }, [maneuvers]);

  const toggle = (k: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const renderGroup = (g: (typeof CN_GROUPS_META)[number] | (typeof INTL_GROUPS_META)[number]) => {
    const isOpen = expanded.has(g.key);
    const list = byCat.get(g.key as SatelliteCategory) ?? [];
    const manCount = maneuverCountByCat.get(g.key) ?? 0;
    const layerKey = g.layerKey as keyof LayerVisibility;
    const layerOn = !!layerVisibility[layerKey];
    return (
      <div key={g.key} style={{ borderTop: `1px solid ${COLORS.borderSoft}` }}>
        {/* 共用圖層列（layer-panel-unify P8）：icon・名稱＋等級徽章・顆數・chevron・黑白列開關（開關移到 chevron 後） */}
        <ListRow
          ariaLabel={g.zh}
          label={<LayerNameLine name={{ zh: g.zh, alt: g.alt }} />}
          icon={<SatelliteIcon size={14} color={layerOn ? g.color : COLORS.textDim} style={{ flexShrink: 0 }} />}
          meta={<>
            {manCount > 0 && (
              <span title="近 24 小時變軌" style={{ marginLeft: 6, alignSelf: "center", ...CHIP_BASE, ...chipOutline(COLORS.statusErr) }}>
                變軌 <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>{manCount}</span>
              </span>
            )}
          </>}
          count={list.length}
          countUnit="顆"
          accent={g.color}
          active={layerOn}
          expandable
          expanded={isOpen}
          onClick={() => toggle(g.key)}
          toggle={{ on: layerOn, onChange: () => setLayerVisibility({ [layerKey]: !layerOn } as Partial<LayerVisibility>), label: `${g.zh} 顯示` }}
        />
        {isOpen && (
          <div style={{ padding: "0 14px 8px" }}>
            {list.length === 0 ? (
              <div style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textFaint, padding: "4px 0" }}>
                {loadState === "loading" ? "讀取中…" : loadState === "error" ? "資料讀取失敗" : layerOn ? "尚無資料" : "尚未開啟此圖層"}
              </div>
            ) : (
              <div style={{ maxHeight: 200, overflowY: "auto" }} className="mtp-scroll">
                {list.slice(0, 80).map((sat) => {
                  const isManeuver = maneuverNoradSet.has(sat.norad);
                  return (
                    <div key={sat.norad}
                      onClick={() => onSelectNorad(sat.norad)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "3px 0", cursor: "pointer",
                        fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, color: COLORS.textDefault,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {sat.name}
                      </span>
                      {sat.alt != null && (
                        <span style={{ fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: COLORS.textDim, whiteSpace: "nowrap" }}>
                          <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>{Math.round(sat.alt)}</span> km
                        </span>
                      )}
                      {isManeuver && (
                        <span title="近 24 小時變軌" style={{ ...CHIP_BASE, ...chipOutline(COLORS.statusErr) }}>變軌</span>
                      )}
                    </div>
                  );
                })}
                {list.length > 80 && (
                  <div style={{ padding: "4px 0", fontFamily: FONT_CJK, fontSize: FONT_SIZE.xs, color: COLORS.textFaint, textAlign: "center" }}>
                    共 <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>{list.length}</span> 顆，只列前 <span style={{ fontFamily: FONT_DATA, fontVariantNumeric: "tabular-nums" }}>80</span> 顆
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    // 衛星情報 Console 只有暗色
    <RailThemeContext.Provider value={DARK_PALETTE}>
    <div style={{ borderBottom: `1px solid ${COLORS.borderSoft}` }}>
      <SubGroupLabel>中國</SubGroupLabel>
      {CN_GROUPS_META.map(renderGroup)}

      {/* 國際偵察區 */}
      <div style={{ marginTop: 4, borderTop: `1px solid ${COLORS.borderSoft}` }}>
        <SubGroupLabel>國際偵察</SubGroupLabel>
      </div>
      {INTL_GROUPS_META.map(renderGroup)}
    </div>
    </RailThemeContext.Provider>
  );
}

function mapManeuverGroupToCategory(g: string): SatelliteCategory | null {
  switch (g) {
    case "YAOGAN": return "china_yaogan";
    case "JILIN": return "china_jilin";
    case "GAOFEN": return "china_gaofen";
    case "TJS": return "china_tjs";
    case "BEIDOU": return "china_beidou";
    case "SHIYAN":
    case "OTHER": return "china_shiyan";
    case "TAIWAN": return "taiwan";
    case "USA": return "usa";
    case "JAPAN": return "japan";
    case "RUSSIA": return "russia";
    case "INDIA": return "india";
    case "KOREA": return "korea";
    case "FRANCE": return "france";
    case "GERMANY": return "germany";
    case "ITALY": return "italy";
    case "ISRAEL": return "israel";
    default: return null;
  }
}
