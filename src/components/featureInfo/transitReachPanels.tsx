/**
 * 交通可及性 popup（模擬面板，公開、情境推演）：只顯示結果與口徑，控制項只在面板（spec §5.40）。
 * 未到／未涵蓋寫明原因，不當 0。
 */
import { FONT_SIZE } from "../../styles/designTokens";
import { chipOutline } from "../intel/intelTokens";
import {
  TRANSIT_REACH_COLOR, TRANSIT_REACH_GRID_KEY, TRANSIT_REACH_MODE_LABELS, TRANSIT_REACH_MODES, TRANSIT_REACH_SPEED_LABELS, TRANSIT_REACH_SPEEDS,
  TRANSIT_REACH_GRID_METRICS, TRANSIT_REACH_GRID_VIEWS, TRANSIT_REACH_GAIN_MIN, gridValue, isCompareMode,
} from "../../data/transitReachTypes";
import { transitReachGridData } from "../../data/transitReachStore";
import { oneOfParam, paramStr, useLayerParams } from "../../layers/layerParamsAccess";
import { paramText } from "../../i18n/paramText";
import { placeName } from "../../i18n/placeText";
import type { I18nContext } from "../../i18n/layerText";
import { useLocale } from "../../state/localeStore";
import { Row, SourceFooter, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";

type Tr = ReturnType<typeof useLocale>["t"];
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** 分鐘 → 「2 小時 5 分」／「45 分」 */
export function formatMinutes(minutes: number, tr: Tr): string {
  const m = Math.round(minutes);
  if (m < 60) return tr("popup.transitReach.minutes", { m });
  return m % 60 === 0 ? tr("popup.transitReach.hours", { h: m / 60 }) : tr("popup.transitReach.hoursMinutes", { h: Math.floor(m / 60), m: m % 60 });
}

/** 人口：中文／日文用「萬人」，英文用 k／M */
export function formatPopulation(n: number, i18n: { active: string; t: Tr }): string {
  if (i18n.active === "en") {
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)} M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)} k`;
    return String(Math.round(n));
  }
  return n >= 1e4 ? i18n.t("popup.transitReach.popWan", { n: (n / 1e4).toFixed(1) }) : i18n.t("popup.transitReach.popPeople", { n: Math.round(n) });
}

function Badge({ text }: { text: string }) {
  const t = useFeatureTheme();
  return <div style={{ margin: "2px 0 4px" }}>
    <span className="fi-badge" style={{ ...chipOutline(t.textMuted), display: "inline-block", padding: "2px 5px", borderRadius: 3, fontSize: FONT_SIZE.sm, lineHeight: 1.2 }}>{text}</span>
  </div>;
}

/** 六個大站的英文名（grid hubs 是中文站名；日文沿用漢字） */
const HUB_EN: Record<string, string> = { 臺北: "Taipei", 板橋: "Banqiao", 桃園: "Taoyuan", 臺中: "Taichung", 臺南: "Tainan", 高雄: "Kaohsiung" };

function SectionLabel({ children }: { children: string }) {
  const t = useFeatureTheme();
  return <div style={{ marginTop: 6, color: t.textDim, fontSize: FONT_SIZE.sm, fontWeight: 600 }}>{children}</div>;
}

function Note({ children }: { children: string }) {
  const t = useFeatureTheme();
  return <div style={{ marginTop: 4, color: t.textDim, fontSize: FONT_SIZE.sm, lineHeight: 1.4 }}>{children}</div>;
}

/** 網格 popup：所屬鄉鎮、格內人口、全運具三指標（目前車速）＋純開車對照 */
export function TransitReachGridPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const params = useLayerParams(TRANSIT_REACH_GRID_KEY);
  const speed = oneOfParam(paramStr(params, TRANSIT_REACH_GRID_KEY, "transitReachGridSpeed"), TRANSIT_REACH_SPEEDS, "free");
  const loaded = transitReachGridData();
  const i = num(props.i);
  const grid = loaded?.grid;
  if (!grid || i === null || i < 0 || i >= grid.ids.length) {
    return <><Title color={TRANSIT_REACH_COLOR}>{tr("popup.transitReach.gridTitle")}</Title><Note>{tr("popup.transitReach.loading")}</Note></>;
  }
  const townIdx = grid.town[i] ?? -1;
  const town = townIdx >= 0 ? placeName(grid.townNames[townIdx] ?? "", i18n as I18nContext) : tr("popup.transitReach.noTown");
  const v = (metric: (typeof TRANSIT_REACH_GRID_METRICS)[number], view: (typeof TRANSIT_REACH_GRID_VIEWS)[number]) => gridValue(grid, i, metric, view, speed);
  const pop = (x: number | null) => (x === null ? tr("popup.transitReach.uncovered") : formatPopulation(x, i18n));
  const time = (x: number | null) => (x === null ? tr("popup.transitReach.uncovered") : formatMinutes(x, tr));
  const hubIdx = grid.v[`all_${speed}`]?.hub?.[i];
  const hubZh = typeof hubIdx === "number" && hubIdx >= 0 ? grid.hubs[Math.round(hubIdx)] : undefined;
  const hub = hubZh && i18n.active === "en" ? (HUB_EN[hubZh] ?? hubZh) : hubZh;
  return <>
    <Title color={TRANSIT_REACH_COLOR}>{town}</Title>
    <Badge text={tr("popup.transitReach.badge")} />
    <Row label={tr("popup.transitReach.cellPop")} value={formatPopulation(grid.pop[i] ?? 0, i18n)} />
    <Row label={tr("popup.transitReach.speed")} value={paramText(TRANSIT_REACH_SPEED_LABELS[speed], i18n)} />
    <SectionLabel>{tr("popup.transitReach.allModes")}</SectionLabel>
    <Row label={tr("popup.transitReach.reach1h")} value={pop(v("pop1h", "abs"))} />
    <Row label={tr("popup.transitReach.reach2h")} value={pop(v("pop2h", "abs"))} />
    <Row label={tr("popup.transitReach.reach3h")} value={pop(v("pop3h", "abs"))} />
    <Row label={hub ? tr("popup.transitReach.toHubNamed", { hub }) : tr("popup.transitReach.toHub")} value={time(v("thub", "abs"))} />
    <Row label={tr("popup.transitReach.avgTime")} value={time(v("avg", "abs"))} />
    <SectionLabel>{tr("popup.transitReach.driveOnlyHeader")}</SectionLabel>
    <Row label={tr("popup.transitReach.reach3h")} value={pop(v("pop3h", "drv"))} />
    <Row label={tr("popup.transitReach.toHub")} value={time(v("thub", "drv"))} />
    <Row label={tr("popup.transitReach.avgTime")} value={time(v("avg", "drv"))} />
    <Note>{tr("popup.transitReach.gridNote")}</Note>
    <SourceFooter props={{ source: tr("popup.transitReach.source") }} />
  </>;
}

function originText(props: Record<string, unknown>, i18n: { active: string; t: Tr }): string {
  const name = i18n.active === "en" && typeof props.originNameEn === "string" ? props.originNameEn : String(props.originName ?? "—");
  return props.originMode === "thsr" ? i18n.t("popup.transitReach.thsrStation", { name }) : name;
}

/** 播放 popup：點擊當下的到達時間快照（起點、運具、車速一起記下） */
export function TransitReachPlaybackPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const mode = oneOfParam(String(props.mode ?? ""), TRANSIT_REACH_MODES, "all");
  const speed = oneOfParam(String(props.speed ?? ""), TRANSIT_REACH_SPEEDS, "free");
  const t = num(props.t);
  const base = num(props.base);
  const u = num(props.u) ?? 0;
  const arrival = t !== null ? formatMinutes(t, tr)
    : u === 1 ? tr("popup.transitReach.noRoad")
      : u === 2 ? tr("popup.transitReach.islandUncovered")
        : tr("popup.transitReach.notReached");
  return <>
    <Title color={TRANSIT_REACH_COLOR}>{tr("popup.transitReach.playbackTitle")}</Title>
    <Badge text={tr("popup.transitReach.badge")} />
    <Row label={tr("popup.transitReach.origin")} value={originText(props, i18n)} />
    <Row label={tr("popup.transitReach.mode")} value={paramText(TRANSIT_REACH_MODE_LABELS[mode], i18n)} />
    <Row label={tr("popup.transitReach.speed")} value={paramText(TRANSIT_REACH_SPEED_LABELS[speed], i18n)} />
    <Row label={tr("popup.transitReach.arrival")} value={arrival} />
    {isCompareMode(mode) && <Row
      label={tr(mode === "cmp_air" ? "popup.transitReach.compareBaseAir" : "popup.transitReach.compareBaseThsr")}
      value={base === null ? tr("popup.transitReach.notReached") : t !== null && base - t >= TRANSIT_REACH_GAIN_MIN
        ? tr("popup.transitReach.saved", { time: formatMinutes(base, tr), saved: formatMinutes(base - t, tr) })
        : formatMinutes(base, tr)}
    />}
    <Note>{tr("popup.transitReach.playbackNote")}</Note>
    <SourceFooter props={{ source: tr("popup.transitReach.source") }} />
  </>;
}
