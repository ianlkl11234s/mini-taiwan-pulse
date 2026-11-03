/**
 * 雙北大眾運輸可及性 popup（模擬面板，公開、情境推演）：只顯示結果與口徑，控制項只在面板（spec §5.40）。
 * 到不了寫明（120／240 分內到不了），不當 0。
 */
import { FONT_SIZE } from "../../styles/designTokens";
import { chipOutline } from "../intel/intelTokens";
import { transitAccessGridState } from "../../data/transitAccessStore";
import {
  TRANSIT_ACCESS_COLOR, TRANSIT_ACCESS_GRID_KEY, TRANSIT_ACCESS_GROUP_LABELS, TRANSIT_ACCESS_GROUPS, TRANSIT_ACCESS_NA,
  TRANSIT_ACCESS_NETWORK_LABELS, TRANSIT_ACCESS_NETWORKS, TRANSIT_ACCESS_ORIGINS, TRANSIT_ACCESS_ORIGIN_LABELS, TRANSIT_ACCESS_SLOT_LABELS,
  TRANSIT_ACCESS_SLOTS, carMinutes, oneOfOrNull, tierOf, type TransitAccessGroup,
} from "../../data/transitAccessTypes";
import { transitAccessGridControls, useTransitAccessClassification } from "../../layers/hosts/transitAccessHosts";
import { useLayerParams } from "../../layers/layerParamsAccess";
import { paramText } from "../../i18n/paramText";
import { placeName } from "../../i18n/placeText";
import type { I18nContext } from "../../i18n/layerText";
import { useLocale } from "../../state/localeStore";
import { Row, SourceFooter, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import { formatMinutes, formatPopulation } from "./transitReachPanels";

type Tr = ReturnType<typeof useLocale>["t"];
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function Badge({ text }: { text: string }) {
  const t = useFeatureTheme();
  return <div style={{ margin: "2px 0 4px" }}>
    <span className="fi-badge" style={{ ...chipOutline(t.textMuted), display: "inline-block", padding: "2px 5px", borderRadius: 3, fontSize: FONT_SIZE.sm, lineHeight: 1.2 }}>{text}</span>
  </div>;
}

function SectionLabel({ children }: { children: string }) {
  const t = useFeatureTheme();
  return <div style={{ marginTop: 6, color: t.textDim, fontSize: FONT_SIZE.sm, fontWeight: 600 }}>{children}</div>;
}

function Note({ children }: { children: string }) {
  const t = useFeatureTheme();
  return <div style={{ marginTop: 4, color: t.textDim, fontSize: FONT_SIZE.sm, lineHeight: 1.4 }}>{children}</div>;
}

/** 分鐘（uint8；NA＝到不了） */
function minutesText(v: number | undefined, tr: Tr, unreachKey: "popup.transitAccess.unreached120" | "popup.transitAccess.unreached240"): string {
  return v === undefined || v === TRANSIT_ACCESS_NA ? tr(unreachKey) : formatMinutes(v, tr);
}

/** 網格 popup：目前類別的分位數、開車、三級、據點數、最近據點；其他類別只列 P50 */
export function TransitAccessGridPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const cls = useTransitAccessClassification();
  const c = transitAccessGridControls(useLayerParams(TRANSIT_ACCESS_GRID_KEY), cls);
  const state = transitAccessGridState();
  const i = num(props.i);
  if (!state || i === null || i < 0 || i >= state.base.cells.h3.length) {
    return <><Title color={TRANSIT_ACCESS_COLOR}>{tr("popup.transitAccess.gridTitle")}</Title><Note>{tr("popup.transitAccess.loading")}</Note></>;
  }
  const { cells, meta, car, facilities } = state.base;
  const n = cells.h3.length, P = meta.percentiles.length, T = meta.thresholds.length;
  const townIdx = cells.town[i] ?? -1;
  const town = townIdx >= 0 ? placeName(cells.towns[townIdx] ?? "", i18n as I18nContext) : tr("popup.transitAccess.noTown");
  const near = (data: { near: Uint8Array }, g: number, q: number) => data.near[(g * P + meta.percentiles.indexOf(q)) * n + i];
  const g = meta.groups.indexOf(c.group);
  const groupLabel = (k: TransitAccessGroup) => paramText(TRANSIT_ACCESS_GROUP_LABELS[k], i18n);
  const tierText = (data: { near: Uint8Array }, gi: number, key: string) => {
    const tier = tierOf(near(data, gi, c.pct) ?? TRANSIT_ACCESS_NA, car[gi * n + i]!, key === c.group ? c.tier : { ...c.tier, ...defaultTier(cls.defaultThresholds[key]) }, cls);
    return { tier, label: tr(`legend.transitAccess.tier.${tier}`) };
  };
  const main = state.main, sched = state.sched;
  const cmp = !!sched;
  const three = (data: { near: Uint8Array }) => [5, 50, 95].map((q) => minutesText(near(data, g, q), tr, "popup.transitAccess.unreached120")).join("／");
  const carM = g >= 0 ? carMinutes(car[g * n + i]!, c.tier, cls) : null;
  const argIdx = g >= 0 ? main.arg[g * n + i]! : 0xffff;
  const nearestNames = argIdx !== 0xffff ? facilities.names?.[c.group]?.[argIdx] ?? [] : [];
  const tierMain = g >= 0 ? tierText(main, g, c.group) : null;
  return <>
    <Title color={TRANSIT_ACCESS_COLOR}>{town}</Title>
    <Badge text={tr("popup.transitAccess.badge")} />
    <Row label={tr("popup.transitAccess.cellPop")} value={formatPopulation(cells.pop[i] ?? 0, i18n)} />
    <Row label={tr("popup.transitAccess.slot")} value={`${paramText(TRANSIT_ACCESS_SLOT_LABELS[c.slot], i18n)}・${paramText(TRANSIT_ACCESS_NETWORK_LABELS[c.network], i18n)}`} />
    {g >= 0 && <>
      <SectionLabel>{groupLabel(c.group)}</SectionLabel>
      <Row label={tr(cmp ? "popup.transitAccess.p5p50p95Gps" : "popup.transitAccess.p5p50p95")} value={three(main)} />
      {sched && <Row label={tr("popup.transitAccess.p5p50p95Sched")} value={three(sched)} />}
      <Row label={tr("popup.transitAccess.car")} value={carM === null ? tr("popup.transitAccess.carUnreached") : formatMinutes(carM, tr)} />
      {tierMain && <Row label={tr("popup.transitAccess.tier")} value={tierMain.label} />}
      <Row label={tr("popup.transitAccess.counts")} value={meta.thresholds.map((th, k) => `${th}${tr("legend.transitAccess.min")}：${main.count[(g * T + k) * n + i]}`).join("　")} />
      {nearestNames.length > 0 && <Row label={tr("popup.transitAccess.nearest")} value={nearestNames.slice(0, 3).join("、") + (nearestNames.length > 3 ? tr("popup.transitAccess.andMore", { n: nearestNames.length - 3 }) : "")} />}
    </>}
    <SectionLabel>{tr("popup.transitAccess.otherGroups")}</SectionLabel>
    {TRANSIT_ACCESS_GROUPS.filter((k) => k !== c.group).map((k) => {
      const gi = meta.groups.indexOf(k);
      if (gi < 0) return null;
      return <Row key={k} label={groupLabel(k)} value={`${minutesText(near(main, gi, 50), tr, "popup.transitAccess.unreached120")}（${tierText(main, gi, k).label}）`} />;
    })}
    <Note>{tr("popup.transitAccess.gridNote")}</Note>
    <SourceFooter props={{ source: tr("popup.transitAccess.source") }} />
  </>;
}

/** 其他類別用各自預設門檻（目前類別才吃滑桿） */
function defaultTier(th: [number, number] | undefined): { a: number; b: number } {
  return th ? { a: th[0], b: th[1] } : { a: 30, b: 60 };
}

/** 單起點 popup：點擊當下的旅行時間快照 */
export function TransitAccessPlaybackPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t: tr } = i18n;
  const origin = oneOfOrNull(String(props.origin ?? ""), TRANSIT_ACCESS_ORIGINS);
  const slot = oneOfOrNull(String(props.slot ?? ""), TRANSIT_ACCESS_SLOTS);
  const network = oneOfOrNull(String(props.network ?? ""), TRANSIT_ACCESS_NETWORKS);
  const arr = (v: unknown) => (Array.isArray(v) ? v as number[] : null);
  const main = arr(props.main), sched = arr(props.sched);
  const fmt3 = (a: number[]) => a.map((v) => minutesText(v, tr, "popup.transitAccess.unreached240")).join("／");
  const town = typeof props.town === "string" ? placeName(props.town, i18n as I18nContext) : tr("popup.transitAccess.noTown");
  return <>
    <Title color={TRANSIT_ACCESS_COLOR}>{town}</Title>
    <Badge text={tr("popup.transitAccess.badge")} />
    <Row label={tr("popup.transitAccess.origin")} value={origin ? paramText(TRANSIT_ACCESS_ORIGIN_LABELS[origin], i18n) : "—"} />
    <Row label={tr("popup.transitAccess.slot")} value={`${slot ? paramText(TRANSIT_ACCESS_SLOT_LABELS[slot], i18n) : "—"}・${network ? paramText(TRANSIT_ACCESS_NETWORK_LABELS[network], i18n) : "—"}`} />
    <Row label={tr("popup.transitAccess.cellPop")} value={formatPopulation(num(props.pop) ?? 0, i18n)} />
    {main && <Row label={tr(sched ? "popup.transitAccess.p5p50p95Gps" : "popup.transitAccess.p5p50p95")} value={fmt3(main)} />}
    {sched && <Row label={tr("popup.transitAccess.p5p50p95Sched")} value={fmt3(sched)} />}
    <Note>{tr("popup.transitAccess.playbackNote")}</Note>
    <SourceFooter props={{ source: tr("popup.transitAccess.source") }} />
  </>;
}
