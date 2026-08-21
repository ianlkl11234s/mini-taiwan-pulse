import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";

export function formatTaiwanTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  const t = useFeatureTheme();
  if (!value || value === "null" || value === "undefined") return null;
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: FONT_SIZE.base, lineHeight: 1.5 }}>
      <span style={{ color: t.textMuted, flexShrink: 0, minWidth: 56 }}>{label}</span>
      <span style={{ color: color ?? t.textStrong, wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

/**
 * AI 助手 highlight_point tool 的通用標記 panel。
 * properties 期望帶：label（選填標籤）、lng / lat（座標）。
 */
export function ChatHighlightPanel({ props }: { props: Record<string, unknown> }) {
  const label = typeof props.label === "string" ? props.label : "";
  const lng = Number(props.lng);
  const lat = Number(props.lat);
  const hasCoords = Number.isFinite(lng) && Number.isFinite(lat);
  return (
    <div>
      {label && <Row label="標記" value={label} />}
      {hasCoords && <Row label="座標" value={`${lng.toFixed(4)}, ${lat.toFixed(4)}`} />}
      {!label && !hasCoords && <Row label="標記" value="地圖標記點" />}
    </div>
  );
}

export function Badge({ label, on, color }: { label: string; on: boolean; color: string }) {
  const t = useFeatureTheme();
  return (
    <span style={{
      fontSize: FONT_SIZE.sm,
      padding: "1px 5px",
      borderRadius: RADIUS.sm,
      background: on ? color : t.bgStrong,
      color: on ? "#fff" : t.textDim,
      fontWeight: on ? 700 : 400,
    }}>
      {label}
    </span>
  );
}

export function numOrNull(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function formatNum(v: number | null, unit: string, digits = 1): string {
  if (v == null) return "";
  return `${v.toFixed(digits)} ${unit}`;
}

/**
 * 溯源清單正規化：跑 map.queryRenderedFeatures() 拿到的 properties 是 vector tile
 * 編碼後的結果——mapbox-gl-js 的 vt-pbf writeProperties() 對非 string/boolean/number
 * 的值一律 `JSON.stringify()`，所以巢狀 array（如 `_provenance`）到面板手上時常是
 * JSON 字串而非真陣列（Supabase RPC 直出的 loader 如 fossilFuelLoader 才會是真陣列）。
 * 兩種來源都要接得住。
 */
function toProvenanceArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (typeof raw === "string" && raw.length > 0) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
    } catch {
      // 非合法 JSON，視為沒有溯源清單
    }
  }
  return [];
}

/**
 * 標準溯源 footer — 任何 panel 底部都應該掛這個。
 * props 期望帶：source / source_org / source_url / license / fetched_at / source_tier。
 * canonical SSOT layer 多帶 provenance jsonb（會展成 details 列出）；
 * 部分 pipeline（如宗教）欄位名是 `_provenance`（底線開頭），兩者都接。
 */
export function SourceFooter({ props }: { props: Record<string, unknown> }) {
  const t = useFeatureTheme();
  const org = String(props.source_org ?? "");
  const url = String(props.source_url ?? "");
  const license = String(props.license ?? "");
  const tier = props.source_tier;
  const fetched = String(props.fetched_at ?? "");
  const provenance = toProvenanceArray(props._provenance ?? props.provenance);

  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 8,
        borderTop: `1px solid ${t.border}`,
        fontSize: FONT_SIZE.xs,
        color: t.textDim,
      }}
    >
      <div style={{ marginBottom: 4, letterSpacing: 1.2 }}>
        資料來源 (Tier {String(tier ?? "?")})
      </div>
      {org && <div>{org}</div>}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-block",
            color: t.link,
            textDecoration: "none",
            marginTop: 2,
          }}
        >
          原始下載頁 ↗
        </a>
      )}
      {(license || fetched) && (
        <div style={{ marginTop: 2 }}>
          {license}
          {license && fetched ? " · " : ""}
          {fetched && `抓取於 ${fetched}`}
        </div>
      )}
      {provenance.length > 1 && (
        <details style={{ marginTop: 4 }}>
          <summary style={{ cursor: "pointer" }}>
            跨來源溯源（{provenance.length} 筆）
          </summary>
          <ul style={{ margin: "4px 0 0 12px", padding: 0 }}>
            {provenance.map((p, i) => {
              const pTier = String(p.tier ?? "?");
              const pOrg = String(p.source_org ?? p.source ?? "");
              const pName = String(p.name_raw ?? "");
              const pUrl = String(p.source_url ?? "");
              return (
                <li key={i} style={{ marginTop: 2 }}>
                  Tier {pTier} · {pOrg}
                  {pName && pName !== String(props.name ?? "") ? ` ("${pName}")` : ""}
                  {pUrl && (
                    <>
                      {" · "}
                      <a
                        href={pUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: t.link }}
                      >
                        原始頁
                      </a>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
