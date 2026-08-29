/**
 * DataSourceModal — 顯示單一 layer 的資料來源浮窗
 *
 * Step 4 UI for the SSOT bridge. Reads from Supabase RPC via useDataCatalogForLayer.
 * Graceful fallback to UPSTREAM_REGISTRY (Step 1 static bridge) when RPC unavailable.
 */
import { useMemo } from "react";
import { X, ExternalLink, Database, Clock, Building2, FileText, GitBranch } from "lucide-react";
import { useDataCatalogForLayer } from "../hooks/useDataCatalog";
import { UPSTREAM_REGISTRY, resolveUpstreamDatasets } from "../data/upstreamRegistry";
import { LAYER_COLORS } from "./sidebar/layerCatalog";
import type { LayerVisibility } from "../types";

interface Props {
  layerKey: keyof LayerVisibility | null;
  onClose: () => void;
}

const LIFECYCLE_LABEL: Record<string, string> = {
  realtime: "即時（分鐘級）",
  daily: "每日",
  weekly: "每週",
  monthly: "每月",
  quarterly: "每季",
  yearly: "每年",
  static: "一次性 / 靜態",
  semi_annual: "每半年",
  planned: "規劃中",
  deprecated: "已停用",
};

export function DataSourceModal({ layerKey, onClose }: Props) {
  const { data: entries, loading, error } = useDataCatalogForLayer(layerKey);
  const ref = layerKey ? UPSTREAM_REGISTRY[layerKey] : null;

  const upstreamDatasetIds = useMemo(() => {
    if (!layerKey) return [];
    return resolveUpstreamDatasets(layerKey);
  }, [layerKey]);

  if (!layerKey || !ref) return null;

  const color = LAYER_COLORS[layerKey] ?? "#666";
  const status = ref.status;

  return (
    <div
      className="ds-modal-backdrop"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#111827", color: "#E5E7EB", borderRadius: 12,
          padding: 24, maxWidth: 560, width: "90vw", maxHeight: "85vh",
          overflow: "auto", border: `2px solid ${color}`,
          boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 12, height: 12, background: color, borderRadius: "50%" }} />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>資料來源 — {layerKey}</h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "#9CA3AF", cursor: "pointer" }}
            aria-label="關閉"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status badge */}
        <StatusBadge status={status} />

        {/* Loading */}
        {loading && <div style={{ marginTop: 16, color: "#9CA3AF" }}>載入中…</div>}
        {error && (
          <div style={{ marginTop: 12, padding: 8, background: "#7f1d1d33", borderRadius: 6, fontSize: 12 }}>
            ⚠ Supabase RPC 未就緒（{error}）— 顯示 Step 1 static bridge 內容。
          </div>
        )}

        {/* pulse_only lineage */}
        {status === "pulse_only" && (ref.derivedFromLayers || ref.derivedFromDatasets) && (
          <div style={{ marginTop: 16, padding: 12, background: "#1F2937", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color: "#A78BFA", fontSize: 13 }}>
              <GitBranch size={14} /> 派生分析
            </div>
            <div style={{ fontSize: 13, color: "#D1D5DB", marginBottom: 6 }}>
              <strong>類型：</strong> {ref.derivationType ?? "custom"}
            </div>
            {ref.processing && (
              <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8, lineHeight: 1.5 }}>
                {ref.processing}
              </div>
            )}
            {ref.derivedFromLayers && (
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                派生自 layers: <code style={{ color: "#A78BFA" }}>{ref.derivedFromLayers.join(", ")}</code>
              </div>
            )}
            {upstreamDatasetIds.length > 0 && (
              <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
                最終上游 datasets: <code style={{ color: "#60A5FA" }}>{upstreamDatasetIds.join(", ")}</code>
              </div>
            )}
          </div>
        )}

        {/* Catalog entries */}
        {entries.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
              {entries.length} 個上游資料集
            </div>
            {entries.map((e) => <EntryCard key={e.datasetId} entry={e} />)}
          </div>
        )}

        {/* Fallback: no entries from RPC, show static registry info */}
        {entries.length === 0 && status === "verified" && !loading && (
          <div style={{ marginTop: 16 }}>
            {ref.datasets.map((d) => (
              <div key={d.datasetId} style={{ padding: 12, background: "#1F2937", borderRadius: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#60A5FA" }}>
                  <Database size={12} style={{ display: "inline", marginRight: 6 }} />
                  {d.datasetId}
                </div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>
                  Confidence: {d.confidence} · 詳細資訊需 Supabase migration 269 apply
                </div>
              </div>
            ))}
          </div>
        )}

        {status === "catalog_missing" && (
          <div style={{ marginTop: 16, padding: 12, background: "#78350f33", borderRadius: 8, fontSize: 13 }}>
            此 layer 尚無對應 catalog 條目。詳見 <code>docs/audit/data_sources_pending_catalog.md</code>。
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "verified" | "pulse_only" | "catalog_missing" }) {
  const cfg = {
    verified: { color: "#10B981", label: "已橋接" },
    pulse_only: { color: "#A78BFA", label: "派生分析" },
    catalog_missing: { color: "#F59E0B", label: "待補 catalog" },
  }[status];
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", background: cfg.color + "22",
      color: cfg.color, borderRadius: 4, fontSize: 11, fontWeight: 500,
    }}>{cfg.label}</span>
  );
}

function EntryCard({ entry }: { entry: import("../data/dataCatalogLoader").DataCatalogEntry }) {
  return (
    <div style={{ padding: 12, background: "#1F2937", borderRadius: 8, marginBottom: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: "#F3F4F6", marginBottom: 4 }}>
        <Database size={12} style={{ display: "inline", marginRight: 6, color: "#60A5FA" }} />
        {entry.title ?? entry.datasetId}
      </div>
      {entry.summary && (
        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8, lineHeight: 1.5 }}>{entry.summary}</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 12 }}>
        {entry.providerAgency && (
          <>
            <span style={{ color: "#6B7280" }}><Building2 size={11} style={{ display: "inline" }} /> 機關</span>
            <span style={{ color: "#D1D5DB" }}>{entry.providerAgency}</span>
          </>
        )}
        {entry.lifecycle && (
          <>
            <span style={{ color: "#6B7280" }}><Clock size={11} style={{ display: "inline" }} /> 頻率</span>
            <span style={{ color: "#D1D5DB" }}>{LIFECYCLE_LABEL[entry.lifecycle] ?? entry.lifecycle}
              {entry.updateFrequency && ` · ${entry.updateFrequency}`}
            </span>
          </>
        )}
        {entry.license && (
          <>
            <span style={{ color: "#6B7280" }}>授權</span>
            <span style={{ color: "#D1D5DB" }}>{entry.license}</span>
          </>
        )}
        {entry.lastUpdated && (
          <>
            <span style={{ color: "#6B7280" }}>更新</span>
            <span style={{ color: "#D1D5DB" }}>{entry.lastUpdated}</span>
          </>
        )}
        {entry.sourceUrl && (
          <>
            <span style={{ color: "#6B7280" }}><ExternalLink size={11} style={{ display: "inline" }} /> API</span>
            <a href={entry.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "#60A5FA", wordBreak: "break-all" }}>
              {entry.sourceUrl}
            </a>
          </>
        )}
        {entry.catalogMdPath && (
          <>
            <span style={{ color: "#6B7280" }}><FileText size={11} style={{ display: "inline" }} /> 文件</span>
            <span style={{ color: "#9CA3AF", fontSize: 11, fontFamily: "monospace" }}>{entry.catalogMdPath}</span>
          </>
        )}
      </div>
    </div>
  );
}
