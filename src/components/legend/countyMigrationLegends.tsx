// 縣市間遷徙流向（台灣圖層延伸 B5）圖例：線寬 4 級、方向色、目前畫面（年份、選取縣市合計、未畫條數）、口徑與端點說明。
import { useSyncExternalStore } from "react";
import { COUNTY_MIGRATION_COLORS, COUNTY_MIGRATION_FOCUS_N, COUNTY_MIGRATION_MIN_PERSONS, COUNTY_MIGRATION_TOP_K, COUNTY_MIGRATION_WIDTH_TIERS, COUNTY_SEATS, countyMigrationViewStore } from "../../data/countyMigrationFlows";
import { enumLabel } from "../../i18n/dataText";
import { useLocale } from "../../state/localeStore";
import { LegendNote, LegendRow, LegendTitle, SwatchDot, SwatchLine } from "./legendKit";

const signed = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toLocaleString()}`;

export function CountyMigrationFlowsLegend() {
  const i18n = useLocale();
  const { t } = i18n;
  const view = useSyncExternalStore(countyMigrationViewStore.subscribe, countyMigrationViewStore.get, countyMigrationViewStore.get);
  const focusName = view.focus ? enumLabel("place", COUNTY_SEATS[view.focus]?.name ?? view.focus, COUNTY_SEATS[view.focus]?.name ?? view.focus, i18n) : null;
  const tiers = COUNTY_MIGRATION_WIDTH_TIERS.map((tier, index) => {
    const next = COUNTY_MIGRATION_WIDTH_TIERS[index + 1];
    const label = next ? t("legend.migration.widthRange", { from: tier.min.toLocaleString(), to: (next.min - 1).toLocaleString() }) : t("legend.migration.widthAbove", { from: tier.min.toLocaleString() });
    return { width: tier.width, label };
  });
  return <div>
    <LegendTitle zh={t("legend.migration.title", { year: view.year })} />
    {focusName ? <>
      <LegendRow swatch={<SwatchLine color={COUNTY_MIGRATION_COLORS.in} width={3} />}>{t("legend.migration.focusIn", { name: focusName, n: COUNTY_MIGRATION_FOCUS_N })}</LegendRow>
      <LegendRow swatch={<SwatchLine color={COUNTY_MIGRATION_COLORS.out} width={3} />}>{t("legend.migration.focusOut", { name: focusName, n: COUNTY_MIGRATION_FOCUS_N })}</LegendRow>
      {view.totals ? <LegendNote>{t("legend.migration.focusTotals", { inflow: view.totals.inflow.toLocaleString(), outflow: view.totals.outflow.toLocaleString(), net: signed(view.totals.net) })}</LegendNote> : null}
      <LegendNote>{t("legend.migration.focusClear")}</LegendNote>
    </> : <>
      <LegendRow swatch={<SwatchLine color={COUNTY_MIGRATION_COLORS.flow} width={3} />}>{t("legend.migration.defaultRow", { k: COUNTY_MIGRATION_TOP_K })}</LegendRow>
      <LegendNote>{t("legend.migration.clickHint", { n: COUNTY_MIGRATION_FOCUS_N })}</LegendNote>
    </>}
    {tiers.map((tier) => <LegendRow key={tier.width} swatch={<SwatchLine color={COUNTY_MIGRATION_COLORS.flow} width={tier.width} />}>{tier.label}</LegendRow>)}
    <LegendRow swatch={<SwatchDot color={COUNTY_MIGRATION_COLORS.seat} stroke="#0a0a14" />}>{t("legend.migration.seat")}</LegendRow>
    {view.loaded ? <LegendNote>{t("legend.migration.hidden", { shown: view.shown, hidden: view.hidden, min: COUNTY_MIGRATION_MIN_PERSONS })}</LegendNote> : null}
    <LegendNote>{t("legend.migration.direction")}</LegendNote>
    <LegendNote>{t("legend.migration.scope")}</LegendNote>
    <LegendNote>{t("legend.migration.base")}</LegendNote>
    <LegendNote>{t("legend.migration.source")}</LegendNote>
  </div>;
}
