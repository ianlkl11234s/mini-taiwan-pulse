import { FARM_COLOR, slaughterKind, SLAUGHTER_COLOR, FEED_COLOR, MARKET_COLOR } from "../../data/livestockTypes";
import { Row, Title } from "./shared";
import { useLocale } from "../../state/localeStore";
import { enumLabel } from "../../i18n/dataText";
import { placeName } from "../../i18n/placeText";

export function LivestockFarmPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t, formatNumber } = i18n;
  const species = String(props["主畜種"] ?? "");
  const accent = FARM_COLOR[species] ?? "#9e9e9e";
  const lowPrecision = String(props["精度"] ?? "") === "低";
  const total = Number(props["總隻數"] ?? 0);
  return (
    <>
      <Title color={accent}>{String(props["場名"] ?? t("popup.livestock.farmFallback"))}</Title>
      <Row label={t("popup.livestock.mainSpecies")} value={species} color={accent} />
      <Row label={t("popup.livestock.totalHeads")} value={formatNumber(total)} />
      <Row label={t("popup.livestock.speciesDetail")} value={String(props["種類明細"] ?? "")} />
      <Row field="county" value={placeName(String(props["縣市"] ?? ""), i18n)} />
      {lowPrecision && <Row field="positionAccuracy" value={t("popup.livestock.lowPrecision")} color="#ffb300" />}
    </>
  );
}

export function LivestockSlaughterPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const kind = slaughterKind(props["種類"]);
  const accent = kind === "家禽" ? SLAUGHTER_COLOR.poultry : SLAUGHTER_COLOR.livestock;
  return (
    <>
      <Title color={accent}>{String(props["場名"] ?? t("popup.livestock.slaughterFallback"))}</Title>
      <Row field="category" value={enumLabel("livestockKind", kind, kind, i18n)} color={accent} />
      <Row label={t("popup.livestock.kind")} value={String(props["種類"] ?? "")} />
      <Row field="address" value={String(props["地址"] ?? "")} />
    </>
  );
}

export function LivestockFeedPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <>
      <Title color={FEED_COLOR}>{String(props["廠名"] ?? t("popup.livestock.feedFallback"))}</Title>
      <Row label={t("popup.livestock.ban")} value={String(props["BAN"] ?? "")} />
      <Row field="address" value={String(props["地址"] ?? "")} />
    </>
  );
}

export function LivestockMarketPanel({ props }: { props: Record<string, unknown> }) {
  const { t } = useLocale();
  return (
    <>
      <Title color={MARKET_COLOR}>{String(props["場名"] ?? t("popup.livestock.marketFallback"))}</Title>
      <Row label={t("popup.livestock.kind")} value={String(props["種類"] ?? "")} />
      <Row field="address" value={String(props["地址"] ?? "")} />
    </>
  );
}
