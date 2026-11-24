import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { FONT_CJK, FONT_DATA, FONT_SIZE, FONT_WEIGHT, RADIUS } from "../../styles/designTokens";
import type { LayerVisibility } from "../../types";
import { countryDef, type CountryCode } from "../../constants/countries";
import type { CountryFlyMode } from "../../state/countryStore";
import { useLocale } from "../../state/localeStore";
import { CountryChip } from "./CountryMenu";
import { LAYER_COLORS, layerDisplayName } from "./layerCatalog";
import { LAYER_ICONS } from "./layerIcons";
import { LayerRow } from "./LayerRow";
import type { PinnedOpenGroup } from "./pinnedOpenGroups";
import { useRailTheme } from "./railTheme";

export const PINNED_OPEN_EXPANDED_KEY = "pulse.pinnedOpenExpanded.v1";

function readExpanded(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(PINNED_OPEN_EXPANDED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * 「其他釘選國家已開的圖層」摺疊區（G1-b，spec §5.41）：圖層面板底部，依國家分組列出釘選、非目前國家、開著的圖層。
 * 可逐層關閉、一鍵關該國全部；點國名切到該國（飛記住的鏡頭）。沒有分組時整區不畫。
 */
export function PinnedOpenLayers({
  groups, visibility, lockedKeys, getCount, onToggleVisibility, onBulkSetVisibility, onCountrySelect,
}: {
  groups: readonly PinnedOpenGroup[];
  visibility: LayerVisibility;
  lockedKeys?: ReadonlySet<keyof LayerVisibility>;
  getCount: (key: keyof LayerVisibility) => number | undefined;
  onToggleVisibility: (layer: keyof LayerVisibility) => void;
  onBulkSetVisibility?: (keys: (keyof LayerVisibility)[], value: boolean) => void;
  onCountrySelect: (code: CountryCode, mode?: CountryFlyMode) => void;
}) {
  const { BORDER, DIM, TEXT_STRONG, BANNER_BG, ALLOFF_BORDER, INACTIVE_TEXT } = useRailTheme();
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(readExpanded);
  if (groups.length === 0) return null;
  const total = groups.reduce((sum, g) => sum + g.layers.length, 0);
  const toggle = () => {
    setExpanded((prev) => {
      try { localStorage.setItem(PINNED_OPEN_EXPANDED_KEY, prev ? "0" : "1"); } catch { /* 無痕模式：只當這次不記住 */ }
      return !prev;
    });
  };
  const closeAll = (group: PinnedOpenGroup) => {
    const keys = group.layers.map((l) => l.key);
    if (onBulkSetVisibility) onBulkSetVisibility(keys, false);
    else for (const key of keys) onToggleVisibility(key);
  };
  return (
    <section aria-label={t("layers.pinnedOpen.title")} style={{ flexShrink: 0, position: "sticky", bottom: 0, zIndex: 3, borderTop: `1px solid ${BORDER}`, background: BANNER_BG, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", fontFamily: FONT_CJK }}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={toggle}
        style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "8px 12px", border: 0, background: "transparent", cursor: "pointer", color: "inherit", textAlign: "left", fontFamily: FONT_CJK }}
      >
        <span style={{ color: DIM, display: "flex", flexShrink: 0 }}>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.semibold, color: TEXT_STRONG }}>{t("layers.pinnedOpen.title")}</span>
        <span style={{ fontFamily: FONT_DATA, fontSize: FONT_SIZE.sm, color: DIM }}>{total}</span>
      </button>
      {expanded && (
        <div className="layer-sidebar-scroll" style={{ maxHeight: "min(200px, 22vh)", overflowY: "auto" }}>
          {groups.map((group) => {
            const name = t(countryDef(group.country).labelKey);
            return (
              <div key={group.country}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 12px" }}>
                  <button
                    type="button"
                    onClick={() => onCountrySelect(group.country, "remembered")}
                    title={t("country.pinnedChipAria", { country: name })}
                    aria-label={t("country.pinnedChipAria", { country: name })}
                    style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, padding: "2px 0", border: 0, background: "transparent", cursor: "pointer", color: TEXT_STRONG, fontFamily: FONT_CJK, fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.semibold, textAlign: "left" }}
                  >
                    <CountryChip code={group.country} color={INACTIVE_TEXT} />
                    <span style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => closeAll(group)}
                    aria-label={t("layers.pinnedOpen.closeAllAria", { country: name })}
                    style={{ flexShrink: 0, padding: "2px 8px", background: "transparent", border: `1px solid ${ALLOFF_BORDER}`, borderRadius: RADIUS.lg, color: INACTIVE_TEXT, fontSize: FONT_SIZE.sm, fontFamily: FONT_CJK, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    {t("layers.pinnedOpen.closeAll")}
                  </button>
                </div>
                {group.layers.map(({ key, label }) => (
                  <LayerRow
                    key={key}
                    layerKey={key}
                    name={layerDisplayName(key, label)}
                    label={label}
                    expandable={false}
                    active={!!visibility[key]}
                    locked={!!lockedKeys?.has(key)}
                    color={LAYER_COLORS[key]}
                    count={getCount(key)}
                    isExpanded={false}
                    Icon={LAYER_ICONS[key]}
                    onLayerClick={onToggleVisibility}
                    onToggleVisibility={onToggleVisibility}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
