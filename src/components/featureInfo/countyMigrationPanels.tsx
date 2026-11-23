// 縣市間遷徙流向（台灣圖層延伸 B5）popup：弧線＝一組遷出→遷入；端點＝該縣市當年合計。來源 panel 自掛（FOOTER_SELF_MANAGED）。
import { Row, SourceFooter, Title } from "./shared";
import { useLocale } from "../../state/localeStore";
import { COUNTY_MIGRATION_COLORS, COUNTY_MIGRATION_LICENSE, COUNTY_MIGRATION_PUBLISHER, COUNTY_MIGRATION_SOURCE_URL } from "../../data/countyMigrationFlows";
import { enumLabel } from "../../i18n/dataText";

const num = (value: unknown) => Number(value ?? 0).toLocaleString();
const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toLocaleString()}`;

export function CountyMigrationFlowsPanel({ props }: { props: Record<string, unknown> }) {
  const i18n = useLocale();
  const { t } = i18n;
  const place = (name: unknown) => enumLabel("place", String(name ?? ""), String(name ?? ""), i18n);
  const year = String(props.year ?? "");
  const footer = <SourceFooter props={{ source_org: COUNTY_MIGRATION_PUBLISHER, source_url: COUNTY_MIGRATION_SOURCE_URL, license: COUNTY_MIGRATION_LICENSE }} />;
  if (props.kind === "seat") {
    const name = place(props.name);
    return <>
      <Title color={COUNTY_MIGRATION_COLORS.seatFocus}>{t("popup.migration.seatTitle", { name, year })}</Title>
      <Row label={t("popup.migration.inflow")} value={t("popup.migration.persons", { value: num(props.inflow) })} />
      <Row label={t("popup.migration.outflow")} value={t("popup.migration.persons", { value: num(props.outflow) })} />
      <Row label={t("popup.migration.net")} value={t("popup.migration.persons", { value: signed(Number(props.net ?? 0)) })} />
      <Row label={t("popup.migration.notes")} value={t("popup.migration.seatHint")} />
      {footer}
    </>;
  }
  const origin = place(props.o_name);
  const dest = place(props.d_name);
  const role = String(props.role ?? "flow") as keyof typeof COUNTY_MIGRATION_COLORS;
  const net = Number(props.net ?? 0);
  return <>
    <Title color={COUNTY_MIGRATION_COLORS[role] ?? COUNTY_MIGRATION_COLORS.flow}>{t("popup.migration.flowTitle", { origin, dest })}</Title>
    <Row label={t("popup.migration.year")} value={t("popup.migration.yearValue", { year })} />
    <Row label={t("popup.migration.movers")} value={t("popup.migration.persons", { value: num(props.persons) })} />
    <Row label={t("popup.migration.bySex")} value={t("popup.migration.bySexValue", { male: num(props.male), female: num(props.female) })} />
    <Row label={t("popup.migration.reverse", { origin: dest, dest: origin })} value={t("popup.migration.persons", { value: num(props.reverse) })} />
    <Row label={t("popup.migration.pairNet")} value={net === 0 ? t("popup.migration.pairNetZero") : net > 0 ? t("popup.migration.pairNetTo", { place: dest, value: num(net) }) : t("popup.migration.pairNetTo", { place: origin, value: num(-net) })} />
    {footer}
  </>;
}
