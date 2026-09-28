import { X } from "lucide-react";
import type { CSSProperties } from "react";

type Props = { title: string; onClose: () => void; borderColor: string; mutedColor: string; textColor: string; titleSize?: CSSProperties["fontSize"]; className?: string; eyebrow?: string };

/**
 * Shared title row for floating rail panels and the persistent collaboration panel.
 * `eyebrow` opts into the H2 header (ui-consistency-audit handoff §4a):
 * 9px dim eyebrow + 13px bold title, padding 10×14, CJK system font.
 */
export function PanelHeader({ title, onClose, borderColor, mutedColor, textColor, titleSize = 13, className, eyebrow }: Props) {
  const closeButton = <button type="button" onClick={onClose} aria-label={`關閉${title}`} style={{ width: 24, height: 24, borderRadius: 4, border: "none", background: "transparent", color: mutedColor, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}><X size={14} /></button>;
  if (eyebrow !== undefined) {
    return <div className={className} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${borderColor}`, flexShrink: 0, fontFamily: "var(--font-cjk)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "var(--text-dim)", fontSize: 9, letterSpacing: "1.4px", lineHeight: 1.3 }}>{eyebrow}</div>
        <h2 style={{ margin: "1px 0 0", color: textColor, fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>{title}</h2>
      </div>
      {closeButton}
    </div>;
  }
  return <div className={className} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 12px 10px", borderBottom: `1px solid ${borderColor}`, flexShrink: 0 }}>
    <span style={{ color: textColor, fontSize: titleSize, fontWeight: 600, fontFamily: "Inter, system-ui, sans-serif" }}>{title}</span><div style={{ flex: 1 }} />
    {closeButton}
  </div>;
}
