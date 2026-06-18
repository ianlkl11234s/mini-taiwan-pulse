import { COLORS, RADIUS, FONT_SIZE } from "../../styles/designTokens";

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
  if (!value || value === "null" || value === "undefined") return null;
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 4, fontSize: FONT_SIZE.base, lineHeight: 1.5 }}>
      <span style={{ color: COLORS.textMuted, flexShrink: 0, minWidth: 56 }}>{label}</span>
      <span style={{ color: color ?? COLORS.textStrong, wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

export function Badge({ label, on, color }: { label: string; on: boolean; color: string }) {
  return (
    <span style={{
      fontSize: FONT_SIZE.sm,
      padding: "1px 5px",
      borderRadius: RADIUS.sm,
      background: on ? color : "rgba(255,255,255,0.08)",
      color: on ? "#fff" : COLORS.textDim,
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
