import { X } from "lucide-react";
import type { CSSProperties } from "react";

type Props = { title: string; onClose: () => void; borderColor: string; mutedColor: string; textColor: string; titleSize?: CSSProperties["fontSize"]; className?: string };

/** Shared title row for floating rail panels and the persistent collaboration panel. */
export function PanelHeader({ title, onClose, borderColor, mutedColor, textColor, titleSize = 13, className }: Props) {
  return <div className={className} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 12px 10px", borderBottom: `1px solid ${borderColor}`, flexShrink: 0 }}>
    <span style={{ color: textColor, fontSize: titleSize, fontWeight: 600, fontFamily: "Inter, system-ui, sans-serif" }}>{title}</span><div style={{ flex: 1 }} />
    <button type="button" onClick={onClose} aria-label={`關閉${title}`} style={{ width: 24, height: 24, borderRadius: 4, border: "none", background: "transparent", color: mutedColor, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}><X size={14} /></button>
  </div>;
}
