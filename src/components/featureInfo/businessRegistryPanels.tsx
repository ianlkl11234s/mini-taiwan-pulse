import { Row } from "./shared";

function formatTwd(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value).toLocaleString("zh-TW")} 元`
    : "";
}

/**
 * 只陳述同一門牌的登記聚合事實；不推論借址、空殼、違法或異常。
 * 公開契約只有 address / n_companies / capital_median 三欄。
 */
export function CommonRegistrationAddressesPanel({ props }: { props: Record<string, unknown> }) {
  const nCompanies = typeof props.n_companies === "number" ? props.n_companies : null;
  return (
    <>
      <Row label="地址" value={String(props.address ?? "")} />
      <Row
        label="共同登記公司數"
        value={nCompanies == null ? "" : `${nCompanies.toLocaleString("zh-TW")} 家`}
      />
      <Row label="資本額中位數" value={formatTwd(props.capital_median)} />
    </>
  );
}
