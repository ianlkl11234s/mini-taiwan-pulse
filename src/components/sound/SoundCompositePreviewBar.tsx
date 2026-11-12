/**
 * PREVIEW（W6-4/5）：綜合聲景甲／乙版本切換列，綜合圖層開著時掛在地圖底部中央。
 * 使用者選定一版後：刪掉本檔、App.tsx 的掛載、compositePreview.ts（固定版本）——移除清單見
 * docs/features/city-sound-atlas/GRID_ARCHITECTURE.md §6。
 */
import { useSyncExternalStore } from "react";
import { useLocale } from "../../state/localeStore";
import { compositePreviewStore, NO_SOURCE_NOTES } from "../../sound/grid/compositePreview";
import { selectSoundScene } from "../../sound/soundAtlasActions";
import { BORDER, COLORS, CONTROL, ELEVATION, FONT_CJK, FONT_DATA, FONT_SIZE, LAYOUT, LIGHT, RADIUS, SURFACE, Z_INDEX } from "../../styles/designTokens";

export function SoundCompositePreviewBar({ isDark }: { isDark: boolean }) {
  const { t } = useLocale();
  const st = useSyncExternalStore(compositePreviewStore.subscribe, compositePreviewStore.get);
  const c = isDark
    ? { bg: SURFACE.strong, border: BORDER.panel, text: COLORS.textStrong, muted: COLORS.textMuted, ctrlBorder: CONTROL.border, shadow: ELEVATION.lg }
    : { bg: LIGHT.surfaceStrong, border: LIGHT.border, text: LIGHT.textStrong, muted: LIGHT.textMuted, ctrlBorder: LIGHT.controlBorder, shadow: LIGHT.elevationLg };
  const noSource = !!st.notes && Object.values(st.notes).some((n) => n != null && NO_SOURCE_NOTES.has(n));
  return (
    <div
      role="group"
      aria-label={t("soundAtlas.composite.preview")}
      style={{
        pointerEvents: "auto", position: "fixed", left: "50%", bottom: LAYOUT.mapBottomInset + 8, transform: "translateX(-50%)", zIndex: Z_INDEX.floatingPanel,
        maxWidth: "min(560px, calc(100vw - 32px))", display: "flex", flexDirection: "column", gap: 4, alignItems: "center",
        padding: "6px 10px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: RADIUS.xl, boxShadow: c.shadow,
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", fontFamily: FONT_CJK, fontSize: FONT_SIZE.sm, color: c.text,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: c.muted }}>{t("soundAtlas.composite.preview")}</span>
        {(["a", "b"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={st.variant === v}
            onClick={() => compositePreviewStore.setVariant(v)}
            style={{
              fontSize: FONT_SIZE.sm, fontFamily: FONT_CJK, cursor: "pointer", padding: "3px 10px", borderRadius: RADIUS.md,
              background: "transparent", color: st.variant === v ? c.text : c.muted, fontWeight: st.variant === v ? 600 : 400,
              border: `1px solid ${st.variant === v ? c.text : c.ctrlBorder}`,
            }}
          >
            {t(v === "a" ? "soundAtlas.composite.previewA" : "soundAtlas.composite.previewB")}
          </button>
        ))}
        {st.unknownShare != null && (
          <span style={{ color: c.muted, fontFamily: FONT_DATA, fontSize: FONT_SIZE.xs }}>
            {t("soundAtlas.composite.unknownShare", { pct: Math.round(st.unknownShare * 100) })}
          </span>
        )}
      </div>
      {/* 沒有全範圍來源檔的日子：一句話＋直接跳到有資料的 11/09 場景（綜合圖層照開） */}
      {noSource && (
        <div role="note" style={{ display: "flex", alignItems: "center", gap: 6, color: c.muted, fontSize: FONT_SIZE.xs }}>
          <span>{t("soundAtlas.composite.noSourceShort")}</span>
          <button
            type="button"
            onClick={() => selectSoundScene("taipei-1109")}
            style={{ fontSize: FONT_SIZE.xs, fontFamily: FONT_CJK, cursor: "pointer", padding: "2px 8px", borderRadius: RADIUS.md, background: "transparent", color: c.text, border: `1px solid ${c.ctrlBorder}` }}
          >
            {t("soundAtlas.composite.sampleDay")}
          </button>
        </div>
      )}
    </div>
  );
}
