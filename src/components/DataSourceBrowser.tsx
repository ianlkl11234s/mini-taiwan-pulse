/**
 * DataSourceBrowser — 自包裝浮動按鈕 + 全站資料來源總覽面板
 *
 * 用法（在 App.tsx 或任一頂層 layout 加一行）：
 *   <DataSourceBrowser />
 *
 * 功能：
 *   - 右下角 ℹ️ 按鈕
 *   - 點開顯示全部 layer 的主題列表與各筆上游 dataset
 *   - 點單筆 layer → 開 DataSourceModal 看完整 catalog
 */
import { useMemo, useState } from "react";
import { Info, X, Layers } from "lucide-react";
import { DataSourceModal } from "./DataSourceModal";
import { UPSTREAM_REGISTRY } from "../data/upstreamRegistry";
import { THEMES, LAYER_COLORS } from "./sidebar/layerCatalog";
import type { LayerVisibility } from "../types";

interface Props {
  /** 覆寫按鈕位置。預設 bottom-right。 */
  position?: { top?: number; right?: number; bottom?: number; left?: number };
  /** 淺色底圖時切換浮動鈕主題色 */
  isDarkTheme?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  verified: "✓",
  pulse_only: "⚙",
  catalog_missing: "?",
};

export function DataSourceBrowser({ position, isDarkTheme = true }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<keyof LayerVisibility | null>(null);
  const [filter, setFilter] = useState("");

  // Build flat theme→layers list
  const themedLayers = useMemo(() => {
    const out: { theme: string; groups: { title: string; layers: { key: keyof LayerVisibility; label: string }[] }[] }[] = [];
    for (const theme of THEMES) {
      const groups: { title: string; layers: { key: keyof LayerVisibility; label: string }[] }[] = [];
      for (const g of theme.groups) {
        const layers = g.layers
          .filter((l) => !filter || l.label.toLowerCase().includes(filter.toLowerCase()) || l.key.toLowerCase().includes(filter.toLowerCase()))
          .map((l) => ({ key: l.key, label: l.label }));
        if (layers.length > 0) groups.push({ title: g.title, layers });
      }
      if (groups.length > 0) out.push({ theme: theme.title, groups });
    }
    return out;
  }, [filter]);

  const totals = useMemo(() => {
    let v = 0, po = 0, cm = 0;
    for (const ref of Object.values(UPSTREAM_REGISTRY)) {
      if (ref.status === "verified") v++;
      else if (ref.status === "pulse_only") po++;
      else if (ref.status === "catalog_missing") cm++;
    }
    return { v, po, cm, total: v + po + cm };
  }, []);

  const pos = position ?? { bottom: 24, right: 24 };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        title="資料來源總覽"
        aria-label="資料來源總覽"
        style={{
          position: "fixed", ...pos, zIndex: 9990,
          width: 44, height: 44, borderRadius: "50%",
          background: isDarkTheme ? "#111827" : "#FFFFFF",
          border: `1px solid ${isDarkTheme ? "#374151" : "rgba(0,0,0,0.12)"}`,
          color: isDarkTheme ? "#60A5FA" : "#2563EB", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: isDarkTheme ? "0 4px 12px rgba(0,0,0,0.4)" : "0 4px 12px rgba(0,0,0,0.15)",
        }}
      >
        <Info size={20} />
      </button>

      {/* Browser panel */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            zIndex: 9995, display: "flex", justifyContent: "flex-end",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 420, maxWidth: "95vw", height: "100vh",
              background: "#0D0E10", color: "#E5E7EB", overflowY: "auto",
              borderLeft: "1px solid #374151",
            }}
          >
            {/* Header */}
            <div style={{ position: "sticky", top: 0, background: "#0D0E10", zIndex: 1, padding: 16, borderBottom: "1px solid #374151" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Layers size={18} color="#60A5FA" />
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>資料來源總覽</h2>
                </div>
                <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", color: "#9CA3AF", cursor: "pointer" }}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, fontSize: 11, marginBottom: 10, color: "#9CA3AF" }}>
                <span>共 {totals.total} 層</span>
                <span style={{ color: "#10B981" }}>✓ {totals.v} 已橋接</span>
                <span style={{ color: "#A78BFA" }}>⚙ {totals.po} 派生</span>
                {totals.cm > 0 && <span style={{ color: "#F59E0B" }}>? {totals.cm} 待補</span>}
              </div>
              <input
                placeholder="搜尋 layer 名稱…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{
                  width: "100%", padding: "6px 10px", background: "#1F2937",
                  border: "1px solid #374151", borderRadius: 6, color: "#E5E7EB",
                  fontSize: 13, outline: "none",
                }}
              />
            </div>

            {/* Themed list */}
            <div style={{ padding: 8 }}>
              {themedLayers.map((t) => (
                <div key={t.theme} style={{ marginBottom: 12 }}>
                  <div style={{ padding: "6px 8px", fontSize: 11, color: "#6B7280", textTransform: "uppercase", letterSpacing: 1 }}>
                    {t.theme}
                  </div>
                  {t.groups.map((g) => (
                    <div key={g.title}>
                      <div style={{ padding: "4px 8px", fontSize: 11, color: "#9CA3AF" }}>{g.title}</div>
                      {g.layers.map((l) => {
                        const ref = UPSTREAM_REGISTRY[l.key];
                        const status = ref?.status ?? "catalog_missing";
                        const color = LAYER_COLORS[l.key] ?? "#666";
                        return (
                          <button
                            key={l.key}
                            onClick={() => setSelectedLayer(l.key)}
                            style={{
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                              width: "100%", padding: "6px 10px", background: "transparent",
                              border: "none", color: "#E5E7EB", cursor: "pointer",
                              fontSize: 13, textAlign: "left", borderRadius: 4,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#1F2937")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.label}</span>
                            </div>
                            <span style={{
                              fontSize: 11, color: status === "verified" ? "#10B981" : status === "pulse_only" ? "#A78BFA" : "#F59E0B",
                            }}>{STATUS_LABEL[status]}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      <DataSourceModal layerKey={selectedLayer} onClose={() => setSelectedLayer(null)} />
    </>
  );
}
