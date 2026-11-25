// 英國列車重播 popup（站主限定測試圖層）。feature 只帶 key（rid），班次狀態依目前時間即時從模組資料算（每秒更新）；
// popup 開著時高亮該班整條路徑（setGbRailReplaySelection），關閉時清除。來源與授權自掛 SourceFooter。
import { useEffect } from "react";
import { Row, SourceFooter, Title } from "../../components/featureInfo/shared";
import { useLocale } from "../../state/localeStore";
import { useTimeStoreTime } from "../../hooks/useTimeStoreTime";
import { setGbRailReplaySelection } from "./useGbRailReplayLayer";
import {
  GB_RAIL_COLOR, GB_RAIL_TOC_NAMES, formatLondonHHMM, gbRailCurrentDelay, gbRailDelayColor, gbRailNextStop, gbRailPlaceName,
  gbRailPointSource, gbRailReplayTime, gbRailTripProgress,
} from "./gbRailReplay";
import { getGbRailReplayData } from "./gbRailReplayLoader";
import type { MessageKey } from "../../i18n/keys";

const FOOTER_PROPS = {
  source_org: "National Rail Enquiries／Darwin（Rail Data Marketplace）· © OpenStreetMap contributors · NaPTAN（DfT）· YA_Tiploc_List",
  license: "Darwin 資料授權條款 · ODbL 1.0 · OGL v3.0 · CC BY-SA 4.0",
};

const SRC_KEYS: Record<"a" | "e" | "s", MessageKey> = {
  a: "popup.transport.gbRailSrcA", e: "popup.transport.gbRailSrcE", s: "popup.transport.gbRailSrcS",
};

export function GbRailReplayPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  const rid = typeof props.key === "string" ? props.key : "";
  useEffect(() => {
    setGbRailReplaySelection(rid || null);
    return () => setGbRailReplaySelection(null);
  }, [rid]);
  const now = useTimeStoreTime(1000);
  const data = getGbRailReplayData();
  const trip = data?.trips.find((x) => x.rid === rid);
  if (!data || !trip) return <Title color={GB_RAIL_COLOR}>{t("popup.transport.gbRailNotLoaded")}</Title>;

  const geom = data.geometry;
  const replayT = gbRailReplayTime(now, data.serviceDate);
  // 與地圖同一套 progress 狀態：首站前／終點後淡入淡出的 60 秒內也有狀態列
  const st = gbRailTripProgress(trip, geom, replayT);
  const delay = st ? gbRailCurrentDelay(trip, st.idx) : null;
  const color = data.hasDelay ? gbRailDelayColor(delay) : GB_RAIL_COLOR;
  const toc = GB_RAIL_TOC_NAMES[trip.toc] ?? trip.toc;
  const first = trip.pts[0]!, last = trip.pts[trip.pts.length - 1]!;
  const next = st ? gbRailNextStop(trip, geom, st.idx) : null;
  const nextPt = next !== null ? trip.pts[next] : undefined;
  const src = st ? gbRailPointSource(trip, st.idx, "dep") : null;
  const etaSrc = next !== null ? gbRailPointSource(trip, next, "arr") : null;
  const delayText = delay === null
    ? t("popup.transport.gbRailNoData")
    : delay < 0 ? t("popup.transport.gbRailEarlyMin", { min: Math.abs(delay).toFixed(1) }) : t("popup.transport.gbRailDelayMin", { min: delay.toFixed(1) });

  return <>
    <Title color={color}>{`${trip.hc} · ${toc}`}</Title>
    <Row label={t("popup.transport.gbRailOperator")} value={toc} />
    <Row label={t("popup.transport.gbRailFromTo")} value={`${gbRailPlaceName(geom, first[0])} → ${gbRailPlaceName(geom, last[0])}`} />
    {st ? <>
      <Row label={t("popup.transport.gbRailStatus")} value={t(st.dwelling ? "popup.transport.gbRailDwelling" : "popup.transport.gbRailRunning")} />
      {nextPt ? <Row label={t("popup.transport.gbRailNextStop")} value={gbRailPlaceName(geom, nextPt[0])} /> : null}
      {nextPt ? <Row label={t("popup.transport.gbRailEta")} value={`${formatLondonHHMM(nextPt[1])}${etaSrc ? `（${t(SRC_KEYS[etaSrc])}）` : ""}`} mono /> : null}
      <Row label={t("popup.transport.gbRailDelay")} value={delayText} color={delay === null ? undefined : color} />
      {src ? <Row label={t("popup.transport.gbRailTimeSource")} value={t(SRC_KEYS[src])} /> : null}
      {st.fallback ? <Row label="" value={t("popup.transport.gbRailFallback")} /> : null}
    </> : <Row label={t("popup.transport.gbRailStatus")} value={t("popup.transport.gbRailNotRunning")} />}
    <Row label={t("popup.transport.gbRailReplayTime")} value={`${data.serviceDate} ${formatLondonHHMM(replayT)}`} mono />
    <Row label={t("popup.transport.gbRailCodes")} value={`${trip.rid}${nextPt ? ` · ${nextPt[0]}` : ""}`} mono />
    <SourceFooter props={FOOTER_PROPS} />
  </>;
}
