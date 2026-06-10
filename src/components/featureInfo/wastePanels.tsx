import {
  WASTE_FACILITY_COLORS, WASTE_FACILITY_LABELS,
  WASTE_DISPOSAL_COLORS, WASTE_DISPOSAL_LABELS,
  WASTE_SOURCE_LABELS, WASTE_SOURCE_BADGE_COLORS,
} from "../../data/wasteLoader";
import { Row } from "./shared";

// ─── 垃圾處理設施 ─────────────────────────────────────────────
export function WasteFacilityPanel({ props }: { props: Record<string, unknown> }) {
  const type = String(props.facility_type ?? "");
  const color = WASTE_FACILITY_COLORS[type] ?? "#9ca3af";
  const label = WASTE_FACILITY_LABELS[type] ?? type;
  const sourceUrl = props.source_url ? String(props.source_url) : "";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.facility_name ?? "(未命名設施)")}
        </div>
      </div>
      <Row label="類型" value={label} color={color} />
      <Row label="縣市" value={String(props.city ?? "")} />
      <Row label="營運單位" value={String(props.operator ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="處理量" value={props.capacity_tpd != null ? `${props.capacity_tpd} 噸/日` : ""} />
      <Row label="狀態" value={String(props.status ?? "")} />
      <Row label="啟用年" value={props.start_year != null ? String(props.start_year) : ""} />
      {sourceUrl && (
        <div style={{ marginTop: 6 }}>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 10,
              color: "#60a5fa",
              textDecoration: "underline",
              wordBreak: "break-all",
            }}
          >
            原始資料 ↗
          </a>
        </div>
      )}
    </>
  );
}

// ─── 垃圾投放點 ─────────────────────────────────────────────
export function WasteDisposalPointPanel({ props }: { props: Record<string, unknown> }) {
  const type = String(props.point_type ?? "");
  const color = WASTE_DISPOSAL_COLORS[type] ?? "#9ca3af";
  const label = WASTE_DISPOSAL_LABELS[type] ?? type;
  const source = String(props.source ?? "");
  const sourceLabel = WASTE_SOURCE_LABELS[source] ?? source;
  const badge = WASTE_SOURCE_BADGE_COLORS[source] ?? { bg: "rgba(148,163,184,0.18)", fg: "#94a3b8" };
  const sourceUrl = props.source_url ? String(props.source_url) : "";
  let categories: string[] = [];
  const rawCats = props.accepts_categories;
  if (Array.isArray(rawCats)) categories = rawCats.map(String);
  else if (typeof rawCats === "string") {
    try { const j = JSON.parse(rawCats); if (Array.isArray(j)) categories = j.map(String); } catch { /* */ }
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {String(props.point_name ?? label)}
        </div>
      </div>
      <Row label="類型" value={label} color={color} />
      <Row label="縣市" value={String(props.city ?? "")} />
      <Row label="行政區" value={String(props.district ?? "")} />
      <Row label="地址" value={String(props.address ?? "")} />
      <Row label="管理者" value={String(props.operator ?? "")} />

      {/* 來源權威度 badge */}
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, minWidth: 56 }}>來源</span>
        <span
          style={{
            fontSize: 10,
            padding: "2px 8px",
            borderRadius: 10,
            background: badge.bg,
            color: badge.fg,
            border: `1px solid ${badge.fg}55`,
            fontWeight: 600,
          }}
        >
          {sourceLabel}
        </span>
      </div>

      {/* 可投放類別 chips */}
      {categories.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, marginBottom: 4 }}>
            可投放
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {categories.map((c) => (
              <span
                key={c}
                style={{
                  fontSize: 10,
                  padding: "1px 7px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.75)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {sourceUrl && (
        <div style={{ marginTop: 8 }}>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 10,
              color: "#60a5fa",
              textDecoration: "underline",
              wordBreak: "break-all",
            }}
          >
            原始資料 ↗
          </a>
        </div>
      )}
    </>
  );
}
