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
import { FAMILY_KEYS, formatDistanceM, rainClassKey, ROAD_EVIDENCE_KEYS, roadLevelKey } from "./soundAtlasText";
import { activeFamilies, compositeReason, reasonFamilyName } from "./compositeReason";
import type { MessageKey } from "../../i18n/keys";

const LEVEL_KEYS = ["soundAtlas.level.0", "soundAtlas.level.1", "soundAtlas.level.2", "soundAtlas.level.3", "soundAtlas.level.4"] as const;
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

type T = ReturnType<typeof useLocale>["t"];
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

/** 一族在此格的具體依據（只讀點選查詢已算好的明細欄位，不新增計算） */
function cellBasis(t: T, f: CompositeFamily, info: Record<string, unknown> | null): string {
  if (!info) return t("soundAtlas.reason.basis.none");
  if (f === "rain") {
    const mm = num(info.gaugeMm), station = str(info.stationName);
    return mm != null && station ? t("soundAtlas.reason.basis.rainGauge", { station, mm: mm.toFixed(1) }) : t("soundAtlas.reason.basis.rainRadar");
  }
  if (f === "road_traffic") {
    const ev = str(info.evidence) as keyof typeof ROAD_EVIDENCE_KEYS | null;
    const evidence = ev && ROAD_EVIDENCE_KEYS[ev] ? t(ROAD_EVIDENCE_KEYS[ev]) : t("soundAtlas.reason.basis.none");
    const road = str(info.roadName) ?? t(FAMILY_KEYS.road_traffic);
    const veh = num(info.vehPerHour);
    return veh != null ? t("soundAtlas.reason.basis.roadFlow", { road, veh: Math.round(veh), evidence }) : t("soundAtlas.reason.basis.roadClass", { road, evidence });
  }
  const label = str(info.topLabel), dist = num(info.topDistanceM);
  if (!label && dist == null) return t("soundAtlas.reason.basis.none");
  const base = t("soundAtlas.reason.basis.near", { label: label ?? t(FAMILY_KEYS[f]), dist: formatDistanceM(dist) });
  return f === "rail" && info.status === "active" ? base + t("soundAtlas.reason.basis.railNow") : base;
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
  const levels = comp ? comp.terms.map((x) => x?.level ?? null) : null;
  const reason = comp && levels ? compositeReason(t, levels, variant, { a: comp.codeA, b: comp.codeB, c: comp.codeC }) : null;
  const basis = levels ? activeFamilies(levels).slice(0, 3).map(({ family }) => ({ family, text: cellBasis(t, family, q.infos[family] ?? null) })) : [];
  const unknownFams = levels ? COMPOSITE_FAMILIES.filter((_, i) => levels[i] == null) : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: FONT_SIZE.xs, color: theme.textMuted, fontWeight: 600 }}>{t("soundAtlas.cell.title")}</div>
      {/* 綜合：白話原因一句（和滑過提示同一支 compositeReason）＋偏活躍族各一小段依據（數字取自下方各族明細，最多 3 個） */}
      {comp && reason && (
        <div style={{ borderLeft: `3px solid ${SOUND_COMPOSITE_A_COLORS[2]}`, paddingLeft: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.6, color: theme.textDefault }}>
          <div><strong>{reason.head}</strong>{t("soundAtlas.reason.colon")}{reason.detail}</div>
          {basis.map(({ family, text }) => (
            <div key={family} style={{ color: theme.textMuted }}>{reasonFamilyName(t, family)}{t("soundAtlas.reason.colon")}{text}</div>
          ))}
          {unknownFams.length > 0 && <div style={{ color: theme.textMuted }}>{t("soundAtlas.reason.basisUnknown", { list: unknownFams.map((f) => reasonFamilyName(t, f)).join(t("soundAtlas.reason.sep")) })}</div>}
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
