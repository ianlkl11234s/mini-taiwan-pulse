import { ChevronDown, ChevronRight } from "lucide-react";
import { FONT_CJK, FONT_DATA, FONT_SIZE, FONT_WEIGHT } from "../../styles/designTokens";
import { themeName } from "./layerCatalog";
import { RailToggle } from "./LayerRow";
import { useRailTheme } from "./railTheme";

/**
 * 主題列（spec §5.5 LT1）：chevron・中文・英文小字・開啟數/總數・總開關；sticky 置頂。
 * 空間不夠時只省略副標（同 `LayerNameLine`）；中文主名與計數不縮、不折行。
 */
export function ThemeBanner({
  title, isCollapsed, onCount, totalCount, onToggleCollapse, onBulkToggle,
}: {
  title: string;
  isCollapsed: boolean;
  onCount: number;
  totalCount: number;
  onToggleCollapse: () => void;
  onBulkToggle: () => void;
}) {
  const { DIM, BORDER, TEXT_STRONG, BANNER_BG } = useRailTheme();
  const someOn = onCount > 0;
  // LT1（design-system §5.5）：title 是識別字串，顯示名稱查 THEME_NAMES（副標：英文，日本主題用日文）。
  const { zh, sub } = themeName(title);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        // sticky：滾到該 theme 內容時 banner 黏在頂部，直到下一個 theme banner 把它推出
        position: "sticky",
        top: 0,
        zIndex: 2,
        background: BANNER_BG,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderTop: `1px solid ${BORDER}`,
        borderBottom: `1px solid ${BORDER}`,
        userSelect: "none",
      }}
    >
      <button
        type="button"
        aria-expanded={!isCollapsed}
        onClick={onToggleCollapse}
        style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, padding: "8px 4px 8px 12px", border: 0, background: "transparent", cursor: "pointer", color: "inherit", textAlign: "left" }}
      >
        <span style={{ color: DIM, flexShrink: 0, display: "flex" }}>
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </span>
        <span style={{ flex: 1, display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
          <span style={{ flex: "0 0 auto", whiteSpace: "nowrap", fontFamily: FONT_CJK, fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semibold, color: TEXT_STRONG }}>{zh}</span>
          {sub && (
            <span style={{ flex: "0 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: DIM, letterSpacing: 0.3 }}>{sub}</span>
          )}
        </span>
        <span style={{ flexShrink: 0, whiteSpace: "nowrap", fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, color: DIM, marginRight: 4 }}>
          {onCount}/{totalCount}
        </span>
      </button>
      <span style={{ paddingRight: 12, display: "flex" }}><RailToggle on={someOn} onChange={onBulkToggle} label={`${zh} 全部開關`} /></span>
    </div>
  );
}

/** L2 群組標題：CJK 標題＋右側 1px 細線拉到底（淘汰「└」字元縮排）。 */
export function SubGroupLabel({ children }: { children: string }) {
  const { COLOR_SCHEME } = useRailTheme();
  const dark = COLOR_SCHEME === "dark";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: dark ? "#9CA3AF" : "#4B5563",
        fontFamily: FONT_CJK,
        fontSize: FONT_SIZE.sm,
        fontWeight: 600,
        letterSpacing: 0.6,
        padding: "10px 12px 3px 12px",
      }}
    >
      <span>{children}</span>
      <span aria-hidden="true" style={{ flex: 1, height: 1, background: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)" }} />
    </div>
  );
}

/** 大分類標題：只顯示中文（LT1），右側細線同 L2 群組線色（design-system §5.5）。 */
export function MacroGroupLabel({ zh }: { zh: string }) {
  const { DIM, COLOR_SCHEME } = useRailTheme();
  const dark = COLOR_SCHEME === "dark";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px 4px",
        color: DIM,
        fontFamily: FONT_CJK,
        fontSize: 9.5,
        letterSpacing: 1.2,
      }}
    >
      <span>{zh}</span>
      <span aria-hidden="true" style={{ flex: 1, height: 1, background: dark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)" }} />
    </div>
  );
}
