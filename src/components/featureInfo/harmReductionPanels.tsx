import { Row, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import {
  HARM_REDUCTION_COLORS, HIV_TESTING_CATEGORY_OPTIONS, NEEDLE_SERVICE_OPTIONS, SELFTEST_CHANNEL_OPTIONS,
  SELFTEST_OUTLET_TYPE_LABELS, TREATMENT_CATEGORY_OPTIONS,
  harmReductionPrecisionLabel, isEstimatedPrecision, labelOf,
} from "../../data/harmReductionTypes";

/**
 * 減害服務 5 層 popup。來源 footer 由 FeatureInfoPanel 統一掛（public 檔已帶
 * source_org / source_url / license / fetched_at / source_tier），這裡只補「資料日期」。
 */
type Props = { props: Record<string, unknown> };

const str = (v: unknown): string => (v == null || v === "" ? "" : String(v));
const CJK = /[一-鿿]/;

function colorOf(options: readonly { value: string; color: string }[], value: unknown, fallback: string): string {
  return options.find((option) => option.value === value)?.color ?? fallback;
}

/** 5 層共通尾段：地址／電話／服務時間／座標精度／資料日期 */
function CommonRows({ props }: Props) {
  const t = useFeatureTheme();
  const precision = props.geocode_precision;
  return <>
    <Row label="地址" value={str(props.address)} />
    <Row label="電話" value={str(props.phone).replace(/\|/g, "、")} />
    <Row label="服務時間" value={str(props.service_hours).replace(/\s*\n+\s*/g, "；")} />
    <Row
      label="座標精度"
      value={harmReductionPrecisionLabel(precision)}
      color={isEstimatedPrecision(precision) ? t.warn : undefined}
    />
    <Row label="資料日期" value={str(props.vintage)} mono />
  </>;
}

export function HarmReductionNeedlePanel({ props }: Props) {
  const services = NEEDLE_SERVICE_OPTIONS
    .filter((option) => props[option.flag] === true)
    .map((option) => `${option.label}${props[option.is24h] === true ? "（24 小時）" : ""}`);
  return <>
    <Title color={HARM_REDUCTION_COLORS.harmReductionNeedle}>{str(props.name) || "清潔針具據點"}</Title>
    <Row label="提供服務" value={services.join("、")} color={HARM_REDUCTION_COLORS.harmReductionNeedle} />
    <Row label="據點類型" value={str(props.site_type).replace(/\|/g, "、")} />
    {props.in_cdc_list === false && <Row label="名冊" value="見於縣市衛生局名單，未列於疾管署名冊" />}
    <CommonRows props={props} />
  </>;
}

const FACILITY_TYPE_LABELS: Record<string, string> = { hospital: "醫院", clinic: "診所", health_center: "衛生所" };

export function HarmReductionTreatmentPanel({ props }: Props) {
  const color = colorOf(TREATMENT_CATEGORY_OPTIONS, props.category, HARM_REDUCTION_COLORS.harmReductionTreatment);
  const drugs = [props.has_methadone === true && "美沙冬", props.has_buprenorphine === true && "丁基原啡因"].filter(Boolean);
  return <>
    <Title color={color}>{str(props.name) || "藥癮治療機構"}</Title>
    <Row label="類別" value={labelOf(TREATMENT_CATEGORY_OPTIONS, props.category)} color={color} />
    <Row label="院所類型" value={FACILITY_TYPE_LABELS[str(props.facility_type)] ?? str(props.facility_type)} />
    <Row label="替代治療藥物" value={drugs.join("、")} />
    <Row label="指定效期至" value={str(props.designation_valid_to)} mono />
    <CommonRows props={props} />
  </>;
}

const MACHINE_TYPE_LABELS: Record<string, string> = { electronic_banknote: "電子式（可收紙鈔）", mechanical_coin: "機械式（投幣）" };

export function HarmReductionHivSelftestPanel({ props }: Props) {
  const color = colorOf(SELFTEST_CHANNEL_OPTIONS, props.channel, HARM_REDUCTION_COLORS.harmReductionHivSelftest);
  const voucher = props.voucher_redeem === true ? "可" : props.voucher_redeem === false ? "否" : "";
  return <>
    <Title color={color}>{str(props.name) || "愛滋自我篩檢通路"}</Title>
    <Row label="通路類型" value={labelOf(SELFTEST_CHANNEL_OPTIONS, props.channel)} color={color} />
    <Row label="場所類型" value={SELFTEST_OUTLET_TYPE_LABELS[str(props.outlet_type)] ?? str(props.outlet_type)} />
    <Row label="機台型式" value={MACHINE_TYPE_LABELS[str(props.machine_type)] ?? ""} />
    <Row label="可兌換篩檢券" value={voucher} />
    <CommonRows props={props} />
  </>;
}

export function HarmReductionHivTestingPanel({ props }: Props) {
  const color = colorOf(HIV_TESTING_CATEGORY_OPTIONS, props.category, HARM_REDUCTION_COLORS.harmReductionHivTesting);
  const subtype = str(props.subtype);
  return <>
    <Title color={color}>{str(props.name) || "愛滋篩檢與醫療機構"}</Title>
    <Row label="類別" value={labelOf(HIV_TESTING_CATEGORY_OPTIONS, props.category)} color={color} />
    <Row label="院所層級" value={subtype === "health_bureau" ? "衛生局／所" : CJK.test(subtype) ? subtype : ""} />
    <Row label="LINE 聯絡" value={str(props.contact_line)} />
    <CommonRows props={props} />
  </>;
}

export function HarmReductionPreventionCenterPanel({ props }: Props) {
  return <>
    <Title color={HARM_REDUCTION_COLORS.harmReductionPreventionCenters}>{str(props.name) || "毒品危害防制中心"}</Title>
    <CommonRows props={props} />
  </>;
}
