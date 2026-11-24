// 日本住宿密度格網 popup：圖層的 overlay、圖例都在中央（jpTourismTypes／cultureLegends），日本國家包搬家時留在靜態（B1 P5b），
// 嵌入頁（不載國家包）也看得到。
import { Row, Title } from "./shared";
import { useLocale } from "../../state/localeStore";

export function JpAccommodationDensityPanel({ props }: { props: Record<string, unknown> }) {
  const { t, formatNumber } = useLocale();
  const count = Number(props.n_records);
  const gridSize = Number(props.grid_size_m);
  const density = Number(props.density_per_km2);
  return (
    <>
      <Title color="#ea580c">{t("popup.japan.densityTitle")}</Title>
      <Row field="gridScale" value={Number.isFinite(gridSize) ? `${formatNumber(gridSize)} m` : ""} />
      <Row label={t("popup.japan.lodgingInCell")} value={Number.isFinite(count) ? t("popup.japan.lodgingCount", { count: formatNumber(count) }) : ""} />
      <Row label={t("popup.japan.perKm2")} value={Number.isFinite(density) ? formatNumber(density, { maximumFractionDigits: 1 }) : ""} />
      <Row label={t("popup.japan.countContract")} value={t("popup.japan.countContractValue")} />
    </>
  );
}
