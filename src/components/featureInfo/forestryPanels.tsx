import { Row } from "./shared";
import { COLORS } from "../../styles/designTokens";

const HIKING_TRAIL_SOURCE_INFO: Record<string, { color: string; label: string }> = {
  A_forest: { color: "#d62728", label: "A 林業署國家步道（KML）" },
  B_osm: { color: "#1f77b4", label: "B OpenStreetMap" },
  C_np_sheipa: { color: "#2ca02c", label: "C 雪霸國家公園 SHP" },
  C_np_kinmen: { color: "#9467bd", label: "C 金門國家公園 KML" },
  D_taipei_grand: { color: "#ff7f0e", label: "D 臺北大縱走（GPX）" },
  D_newtaipei: { color: "#e377c2", label: "D 新北市觀光局（GPX）" },
};

export function HikingTrailsPanel({ props }: { props: Record<string, unknown> }) {
  const src = String(props.source ?? "");
  const info = HIKING_TRAIL_SOURCE_INFO[src] ?? { color: "#888", label: src || "未知來源" };
  const name = String(props.name ?? "(無名步道)");
  const region = String(props.region ?? "");
  const np = String(props.in_national_park ?? "");
  const url = String(props.url ?? "");
  const dup = props.is_dup_of_A === true || props.is_dup_of_A === "true";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 14, height: 2, background: info.color, flexShrink: 0 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>{name}</div>
      </div>
      <Row label="來源" value={info.label} color={info.color} />
      {region ? <Row label="管理單位" value={region} /> : null}
      {np ? <Row label="國家公園" value={np} /> : null}
      {dup ? <Row label="備註" value="與 A 林業署路線重疊" /> : null}
      {url ? (
        <div style={{ marginTop: 4 }}>
          <a href={url} target="_blank" rel="noreferrer" style={{ color: "#7ec4ff", textDecoration: "underline", fontSize: 11 }}>
            原始連結 ↗
          </a>
        </div>
      ) : null}
    </>
  );
}

// ── FORESTRY panels ────────────────────────────────────────────

const FORESTRY_PROP_LABELS: Record<string, string> = {
  Name: "名稱", name: "名稱", NAME: "名稱",
  County: "縣市", county: "縣市", COUNTY: "縣市", city: "縣市",
  Town: "鄉鎮", town: "鄉鎮",
  Area: "面積", AREA: "面積", area: "面積", Area_ha: "面積 (ha)",
  Length: "長度", LENGTH: "長度", Lenth: "長度", length_m: "長度 (m)",
  Type: "類型", type: "類型", TYPE: "類型",
  species: "物種", Species: "物種",
  count: "個體數", Count: "個體數",
};

export function ForestryGenericPanel({ props }: { props: Record<string, unknown> }) {
  const entries = Object.entries(props).slice(0, 8);
  return (
    <>
      {entries.length === 0 && (
        <div style={{ fontSize: 10, color: COLORS.textDim }}>無屬性資料</div>
      )}
      {entries.map(([k, v]) => {
        const label = FORESTRY_PROP_LABELS[k] ?? k;
        const val = v == null ? "" : typeof v === "number" ? String(v) : String(v);
        if (!val) return null;
        return <Row key={k} label={label} value={val.length > 40 ? `${val.slice(0, 40)}…` : val} />;
      })}
    </>
  );
}
