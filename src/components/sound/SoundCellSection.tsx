/**
 * W6-5 點選查詢：接收點所在格、此 10 分格的網格值（原本各族格子 popup 的內容併到這裡）。
 * - 綜合列：用 Worker 回的七族網格碼（和地圖顏色同一份），經 compositeCell 算甲（偏活躍種數＋最明顯的族）與乙（指數、依 N／7 種）；只列目前預覽版本一行（W6-7）。
 * - 各族列：一行摘要（族名＋分級），展開是原本的格子 popup 內容（雨／道路／連續潛勢三種）。
 * - 網格範圍外 → 「網格範圍外」，上方來源照常列。
 * 主題色讀 FeatureThemeProvider（接收點面板與 featureInfo 共用）。
 */
import { useSyncExternalStore } from "react";
import { useLocale } from "../../state/localeStore";
import { soundAtlasStore } from "../../sound/soundAtlasStore";
import { COMPOSITE_FAMILIES, COMPOSITE_FAMILY_COUNT, compositeCell, type CompositeFamily } from "../../sound/grid/compositeGrid";
import { compositePreviewStore } from "../../sound/grid/compositePreview";
import { SOUND_COMPOSITE_A_COLORS, SOUND_FAMILY_COLORS } from "../../sound/soundAtlasColors";
import { FONT_SIZE } from "../../styles/designTokens";
import { COMPOSITE } from "../../sound/model/soundProfiles";
import { useFeatureTheme } from "../featureInfo/featureTheme";
import { SoundPotentialCellPanel, SoundRainCellPanel, SoundRoadCellPanel } from "../featureInfo/soundAtlasPanels";
import { FAMILY_KEYS, rainClassKey, roadLevelKey } from "./soundAtlasText";
import type { MessageKey } from "../../i18n/keys";

const LEVEL_KEYS = ["soundAtlas.level.0", "soundAtlas.level.1", "soundAtlas.level.2", "soundAtlas.level.3", "soundAtlas.level.4"] as const;
const A_LEVEL_KEYS = ["soundAtlas.composite.level.0", "soundAtlas.composite.level.1", "soundAtlas.composite.level.2"] as const;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function familyLevelKey(f: CompositeFamily, info: Record<string, unknown>): MessageKey {
  if (f === "rain") return rainClassKey(num(info.rainClass));
  if (f === "road_traffic") {
    const known = info.status === "active" || info.status === "inactive";
    return roadLevelKey(known ? num(info.level) : null);
  }
  const lv = num(info.level);
  return lv != null && lv >= 0 && lv <= 4 ? LEVEL_KEYS[lv as 0 | 1 | 2 | 3 | 4] : "soundAtlas.level.unknown";
}

export function SoundCellSection() {
  const theme = useFeatureTheme();
  const { t } = useLocale();
  const q = useSyncExternalStore(soundAtlasStore.subscribe, () => soundAtlasStore.get().cell);
  const variant = useSyncExternalStore(compositePreviewStore.subscribe, () => compositePreviewStore.get().variant);
  const note = { fontSize: FONT_SIZE.xs, color: theme.textDim, lineHeight: 1.5 };
  if (!q) return null;
  if (q.cell < 0) return <div style={note}>{t("soundAtlas.cell.outside")}</div>;

  const comp = q.codes && q.codes.length === COMPOSITE_FAMILY_COUNT ? compositeCell(q.codes, q.gate) : null;
  const unknownA = comp && comp.codeA === 255;
  const unknownB = comp && comp.index == null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: FONT_SIZE.xs, color: theme.textMuted, fontWeight: 600 }}>{t("soundAtlas.cell.title")}</div>
      {/* 綜合：只列目前預覽版本那一行（另一版在預覽列切換）；乙才附「權重是假設」 */}
      {comp && (
        <div style={{ borderLeft: `3px solid ${SOUND_COMPOSITE_A_COLORS[2]}`, paddingLeft: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.6, color: theme.textDefault }}>
          <div>
            <strong>{t("soundAtlas.composite.title")}</strong>{" "}
            {variant === "a"
              ? (unknownA
                ? t("soundAtlas.composite.unknown", { v: t("soundAtlas.composite.previewA"), known: comp.known })
                : t("soundAtlas.composite.a", {
                  level: t(A_LEVEL_KEYS[comp.codeA as 0 | 1 | 2]),
                  n: comp.activeCount,
                  dominant: comp.dominant ? t("soundAtlas.composite.aDominant", { family: t(FAMILY_KEYS[comp.dominant]) }) : "",
                }))
              : (unknownB
                ? t("soundAtlas.composite.unknown", { v: t("soundAtlas.composite.previewB"), known: comp.known })
                : t("soundAtlas.composite.b", { index: (comp.index ?? 0).toFixed(2), known: comp.known }))}
          </div>
          {variant === "b" && <div style={{ color: theme.textDim }}>{t("soundAtlas.composite.note")}</div>}
        </div>
      )}
      {COMPOSITE_FAMILIES.map((f, i) => {
        const info = q.infos[f] ?? null;
        const term = comp?.terms[i];
        const levelText = info ? t(familyLevelKey(f, info)) : term ? t(LEVEL_KEYS[term.level as 0 | 1 | 2 | 3 | 4] ?? "soundAtlas.level.unknown") : t("soundAtlas.cell.notLoaded");
        return (
          <details key={f} style={{ fontSize: FONT_SIZE.xs, borderLeft: `3px solid ${SOUND_FAMILY_COLORS[f]}`, paddingLeft: 6 }}>
            <summary style={{ cursor: info ? "pointer" : "default", color: theme.textDefault, listStyle: info ? undefined : "none" }}>
              <strong>{t(FAMILY_KEYS[f])}</strong>
              <span style={{ marginLeft: 6, color: theme.textMuted }}>{levelText}</span>
              {comp && term && term.level >= COMPOSITE.activeMinLevel.value[f]! && <span style={{ marginLeft: 6, color: theme.textDim }}>{t("soundAtlas.composite.activeMark")}</span>}
            </summary>
            {info && (
              <div style={{ paddingTop: 4 }}>
                {f === "rain" ? <SoundRainCellPanel props={info} /> : f === "road_traffic" ? <SoundRoadCellPanel props={info} /> : <SoundPotentialCellPanel props={info} />}
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}

/** featureInfo 註冊用（layerType "soundPointQuery"）：點選查詢不再開 popup，這裡只在被呼叫時列同一份內容 */
export function SoundPointQueryPanel() {
  return <SoundCellSection />;
}
