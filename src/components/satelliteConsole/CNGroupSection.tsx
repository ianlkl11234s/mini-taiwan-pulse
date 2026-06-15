/**
 * §B 中國衛星 6 群 accordion
 *
 * Yaogan/Jilin/Gaofen (S) + TJS (A) + Beidou (B) + Shiyan/餘 (C)
 *
 * 每組標題：群色點 + label + tier chip + N 顆 + ⚡近 24h 變軌 X 顆 + toggle + chevron
 * 展開：該組衛星列表，每列 name / alt / ⚡ if maneuver
 *
 * Toggle 與 LayerVisibility 雙向同步（左 sidebar 同步可見）
 */
import { useEffect, useMemo, useState } from "react";
import { COLORS, FONT_CJK, FONT_DATA, CN_GROUPS_META, INTL_GROUPS_META } from "./satelliteConsoleTokens";
import { loadSatellites } from "../../data/satelliteLoader";
import type { SatelliteRecord, SatelliteCategory } from "../../data/satelliteTypes";
import type { ManeuverRow } from "../../data/satelliteManeuversLoader";
import type { LayerVisibility } from "../../types";
import * as satellite from "satellite.js";

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


export function CNGroupSection({ maneuvers, layerVisibility, setLayerVisibility, onSelectNorad }: Props) {
  const [records, setRecords] = useState<SatelliteRecord[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    loadSatellites().then((recs) => { if (alive) setRecords(recs); });
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
        <div
          onClick={() => toggle(g.key)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 14px", cursor: "pointer", userSelect: "none",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: g.color, flexShrink: 0 }} />
          <span style={{ fontFamily: FONT_CJK, fontSize: 12, fontWeight: 600, color: COLORS.textStrong }}>
            {g.label}
          </span>
          <span style={{
            padding: "0 5px", borderRadius: 3,
            border: `1px solid ${COLORS.borderMid}`,
            fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textMuted, lineHeight: "14px",
          }}>{g.tier}</span>
          <span style={{ marginLeft: 4, fontFamily: FONT_DATA, fontSize: 10, color: COLORS.textMuted }}>
            {list.length} 顆
          </span>
          {manCount > 0 && (
            <span style={{
              marginLeft: 4, padding: "1px 6px", borderRadius: 3,
              background: "rgba(239,68,68,0.16)", border: "1px solid rgba(239,68,68,0.45)",
              fontFamily: FONT_DATA, fontSize: 9, fontWeight: 700, color: COLORS.statusErr,
              animation: "satManeuverPulse 1.1s ease-in-out infinite",
            }}>⚡{manCount}</span>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLayerVisibility({ [layerKey]: !layerOn } as Partial<LayerVisibility>);
            }}
            aria-label="toggle layer"
            style={{
              width: 28, height: 16, borderRadius: 8,
              border: `1px solid ${layerOn ? COLORS.borderAccent : COLORS.borderMid}`,
              background: layerOn ? COLORS.accentFaint : "transparent",
              cursor: "pointer", position: "relative", padding: 0,
            }}
          >
            <span style={{
              position: "absolute", top: 1, left: layerOn ? 13 : 1,
              width: 12, height: 12, borderRadius: "50%",
              background: layerOn ? COLORS.accent : COLORS.textDim,
              transition: "left 0.15s ease",
            }} />
          </button>
          <span style={{ color: COLORS.textDim, fontSize: 10, marginLeft: 4 }}>
            {isOpen ? "▾" : "▸"}
          </span>
        </div>
        {isOpen && (
          <div style={{ padding: "0 14px 8px" }}>
            {list.length === 0 ? (
              <div style={{ fontFamily: FONT_CJK, fontSize: 10, color: COLORS.textFaint, padding: "4px 0" }}>
                {layerOn ? "無資料（loader 仍在抓 TLE）" : "尚未開啟此圖層"}
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
                        fontFamily: FONT_CJK, fontSize: 11, color: COLORS.textDefault,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {sat.name}
                      </span>
                      {sat.alt != null && (
                        <span style={{ fontFamily: FONT_DATA, fontSize: 9.5, color: COLORS.textDim }}>
                          {Math.round(sat.alt)} km
                        </span>
                      )}
                      {isManeuver && (
                        <span style={{ color: COLORS.statusErr, fontSize: 11 }} title="近 24h 變軌">⚡</span>
                      )}
                    </div>
                  );
                })}
                {list.length > 80 && (
                  <div style={{ padding: "4px 0", fontFamily: FONT_DATA, fontSize: 9, color: COLORS.textFaint, textAlign: "center" }}>
                    … 共 {list.length}，顯示前 80
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
    <div style={{ borderBottom: `1px solid ${COLORS.borderSoft}` }}>
      <div style={{
        padding: "9px 14px 6px",
        fontFamily: FONT_DATA,
        fontSize: 9,
        letterSpacing: "2px",
        color: COLORS.textFaint,
      }}>
        CHINA · 6 GROUPS
      </div>
      {CN_GROUPS_META.map(renderGroup)}

      {/* 國際偵察區 */}
      <div style={{
        padding: "9px 14px 6px",
        marginTop: 4,
        borderTop: `1px solid ${COLORS.borderSoft}`,
        fontFamily: FONT_DATA, fontSize: 9, letterSpacing: "2px", color: COLORS.textFaint,
      }}>
        INTL RECON · 9 COUNTRIES
      </div>
      {INTL_GROUPS_META.map(renderGroup)}
    </div>
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
