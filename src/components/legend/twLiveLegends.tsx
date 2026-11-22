// 台灣圖層延伸 B8：登革熱聚集區、航船布告、大潮與長浪警戒的圖例（色票 SSOT = src/data/twLiveTypes.ts）。
// 類型／期限／監測篩選在設定面板（多選），圖例上關掉的項目畫成淡色。
import { useSyncExternalStore } from "react";
import { LegendNote, LegendNum, LegendRow, LegendTitle, SwatchDot, SwatchLine, SwatchSquare, useLegendTheme } from "./legendKit";
import {
  DENGUE_COLOR, NAV_KINDS, NAV_KIND_COLOR, NAV_LIFETIME_DEFAULT_IDS, NAV_LIFETIME_IDS,
  TIDE_KINDS, TIDE_LEVEL_COLOR, TIDE_UNKNOWN_COLOR,
} from "../../data/twLiveTypes";
import { twLiveSummaryStore, type TwLiveKey } from "../../data/twLiveSnapshots";
import { useKeyOverlayParams } from "../../layers/layerParamsAccess";
import { FONT_SIZE } from "../../styles/designTokens";
import { useLocale } from "../../state/localeStore";
import { localizeLayerName } from "../../i18n/layerText";
import { LAYER_MANIFEST } from "../../data/layerManifest";

// i18n key 寫成字面值（localeParity 測試靠字面值判斷 key 有人用）
const NAV_KIND_KEY = [
  "legend.twLive.navKind.obstruction",
  "legend.twLive.navKind.firing",
  "legend.twLive.navKind.aton",
  "legend.twLive.navKind.windfarm",
] as const;
const NAV_LIFETIME_KEY = ["legend.twLive.navLifetime.temporary", "legend.twLive.navLifetime.permanent"] as const;
const TIDE_KIND_KEY = ["legend.twLive.tideKind.spring", "legend.twLive.tideKind.swell"] as const;
const TIDE_LEVEL_KEY = ["legend.twLive.tideLevel.0", "legend.twLive.tideLevel.1", "legend.twLive.tideLevel.2"] as const;

function on(mask: number | undefined, i: number, fallbackOn = true): boolean {
  return mask === undefined || !Number.isFinite(mask) ? fallbackOn : (Math.trunc(mask) & (1 << i)) !== 0;
}

function useSummary(key: TwLiveKey) {
  return useSyncExternalStore(twLiveSummaryStore.subscribe, () => twLiveSummaryStore.get(key), () => twLiveSummaryStore.get(key));
}

function title(key: TwLiveKey, i18n: ReturnType<typeof useLocale>): string {
  return localizeLayerName(key, LAYER_MANIFEST[key].name, i18n).primary;
}

/** 摘要列（精簡模式也顯示，空資料提示不能被收掉） */
function Status({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  const t = useLegendTheme();
  return <div role="status" style={{ marginTop: 4, fontSize: FONT_SIZE.xs, color: strong ? t.textDefault : t.textMuted, lineHeight: 1.4 }}>{children}</div>;
}

export function DengueClustersLegend() {
  const i18n = useLocale();
  const { t } = i18n;
  const s = useSummary("dengueClusters");
  return (
    <div>
      <LegendTitle zh={title("dengueClusters", i18n)} />
      <LegendRow swatch={<SwatchSquare color={DENGUE_COLOR} outline />}>{t("legend.twLive.dengue.area")}</LegendRow>
      <LegendRow swatch={<SwatchDot color={DENGUE_COLOR} opacity={0.25} stroke={DENGUE_COLOR} strokeWidth={2} />}>{t("legend.twLive.dengue.center")}</LegendRow>
      {s && s.shown === 0 && <Status strong>{t("legend.twLive.dengue.empty", { date: s.dataTime ?? "—" })}</Status>}
      {s && s.shown > 0 && <Status>{t("legend.twLive.dengue.count", { count: s.shown, date: s.dataTime ?? "—" })}</Status>}
      <LegendNote>{t("legend.twLive.dengue.note")}</LegendNote>
    </div>
  );
}

export function NavNoticesLegend() {
  const i18n = useLocale();
  const { t } = i18n;
  const p = useKeyOverlayParams("navNotices");
  const s = useSummary("navNotices");
  const muted = useLegendTheme().textMuted;
  const defaultOn = (i: number) => NAV_LIFETIME_DEFAULT_IDS.includes(NAV_LIFETIME_IDS[i]!);
  return (
    <div>
      <LegendTitle zh={title("navNotices", i18n)} />
      {NAV_KINDS.map((k, i) => (
        <div key={k} style={{ opacity: on(p.navNoticesKindMask, i) ? 1 : 0.35 }}>
          <LegendRow swatch={<SwatchDot color={NAV_KIND_COLOR[k]} />}>{t(NAV_KIND_KEY[i]!)}</LegendRow>
        </div>
      ))}
      <div style={{ height: 6 }} />
      <LegendRow swatch={<SwatchSquare color={NAV_KIND_COLOR.礙航公告} outline />}>{t("legend.twLive.nav.shapeArea")}</LegendRow>
      <LegendRow swatch={<SwatchLine color={NAV_KIND_COLOR.礙航公告} dash={[2, 2]} />}>{t("legend.twLive.nav.shapeLine")}</LegendRow>
      <div style={{ height: 6 }} />
      {NAV_LIFETIME_IDS.map((id, i) => (
        <div key={id} style={{ opacity: on(p.navNoticesLifetimeMask, i, defaultOn(i)) ? 1 : 0.35 }}>
          <LegendRow swatch={<SwatchDot color="transparent" opacity={1} stroke={muted} />}>{t(NAV_LIFETIME_KEY[i]!)}</LegendRow>
        </div>
      ))}
      <Status>{t("legend.twLive.nav.permanentNote")}</Status>
      {s && <Status>{t("legend.twLive.nav.count", { count: s.shown, unlocated: s.extra?.unlocated ?? 0 })}</Status>}
      <LegendNote>{t("legend.twLive.nav.note")}</LegendNote>
    </div>
  );
}

export function TideSwellAlertsLegend() {
  const i18n = useLocale();
  const { t } = i18n;
  const p = useKeyOverlayParams("tideSwellAlerts");
  const s = useSummary("tideSwellAlerts");
  const muted = useLegendTheme().textMuted;
  return (
    <div>
      <LegendTitle zh={title("tideSwellAlerts", i18n)} />
      {([0, 1, 2] as const).map((lv) => (
        <LegendRow key={lv} swatch={<SwatchDot color={TIDE_LEVEL_COLOR[lv]} glow={lv >= 1 ? TIDE_LEVEL_COLOR[lv] : undefined} />}>{t(TIDE_LEVEL_KEY[lv])}</LegendRow>
      ))}
      <LegendRow swatch={<SwatchDot color={TIDE_UNKNOWN_COLOR} />}>{t("legend.twLive.tideLevel.unknown")}</LegendRow>
      <div style={{ height: 6 }} />
      {TIDE_KINDS.map((k, i) => (
        <div key={k} style={{ opacity: on(p.tideSwellAlertsKindMask, i) ? 1 : 0.35 }}>
          <LegendRow swatch={<SwatchDot color="transparent" opacity={1} stroke={muted} />}>{t(TIDE_KIND_KEY[i]!)}</LegendRow>
        </div>
      ))}
      {s && (s.extra?.alerts ?? 0) > 0 && <Status strong>{t("legend.twLive.tide.alerts", { count: s.extra?.alerts ?? 0 })}</Status>}
      {s && (s.extra?.alerts ?? 0) === 0 && <Status>{t("legend.twLive.tide.noAlerts")}</Status>}
      {s?.dataTime && <Status>{t("legend.twLive.dataTime")} <LegendNum>{s.dataTime.slice(0, 16).replace("T", " ")}</LegendNum></Status>}
      <LegendNote>{t("legend.twLive.tide.note")}</LegendNote>
    </div>
  );
}
