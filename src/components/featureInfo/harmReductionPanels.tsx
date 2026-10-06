import { Row, Title } from "./shared";
import { useFeatureTheme } from "./featureTheme";
import {
  ALCOHOL_SERVICE_OPTIONS, CONDOM_OUTLET_OPTIONS, DUI_CLASS_OPTIONS,
  HARM_REDUCTION_COLORS, HIV_TESTING_CATEGORY_OPTIONS, INTERNET_SERVICE_TYPE_OPTIONS, NEEDLE_SERVICE_OPTIONS,
  PREP_FUNDING_OPTIONS, SELFTEST_CHANNEL_OPTIONS, SMOKING_FACILITY_OPTIONS,
  TREATMENT_CATEGORY_OPTIONS, harmReductionPrecisionLabel, isEstimatedPrecision, labelOf,
} from "../../data/harmReductionTypes";

/**
 * 減害服務圖層 popup。來源 footer 由 FeatureInfoPanel 統一掛（public 檔已帶
 * source_org / source_url / license / fetched_at / source_tier），這裡只補「資料日期」。
 * 類別文字讀上游中文標籤欄 `<欄>_label`（對照表 SSOT 在 analytics 各 pipeline config.yaml labels），
 * 前端不自建英文代碼對照；`*_OPTIONS` 只負責篩選值與色票。
 */
type Props = { props: Record<string, unknown> };

const str = (v: unknown): string => (v == null || v === "" ? "" : String(v));

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

/** 藥癮維持治療月報（最新月與期間平均；無月報的機構不顯示，不當成 0）。 */
function maintenanceText(props: Record<string, unknown>, suffix: "" | "_mean"): string {
  const parts = [["美沙冬", props[`methadone_patients${suffix}`]], ["丁基原啡因", props[`buprenorphine_patients${suffix}`]]]
    .filter(([, value]) => typeof value === "number")
    .map(([label, value]) => `${label} ${value} 人`);
  return parts.join("、");
}

export function HarmReductionTreatmentPanel({ props }: Props) {
  const color = colorOf(TREATMENT_CATEGORY_OPTIONS, props.category, HARM_REDUCTION_COLORS.harmReductionTreatment);
  const drugs = [props.has_methadone === true && "美沙冬", props.has_buprenorphine === true && "丁基原啡因"].filter(Boolean);
  return <>
    <Title color={color}>{str(props.name) || "藥癮治療機構"}</Title>
    <Row label="類別" value={str(props.category_label)} color={color} />
    <Row label="院所類型" value={str(props.facility_type_label)} />
    <Row label="替代治療藥物" value={drugs.join("、")} />
    <Row label="指定效期至" value={str(props.designation_valid_to)} mono />
    <Row label={`維持治療服藥人數（${str(props.maintenance_month)}）`} value={maintenanceText(props, "")} />
    <Row
      label={`期間平均（${str(props.maintenance_first_month)}–${str(props.maintenance_month)}）`}
      value={maintenanceText(props, "_mean")}
    />
    {props.maintenance_month != null && <Row label="月報說明" value="服藥人數依身分證於本機構內不重複計；跨機構加總會重複計算" />}
    <CommonRows props={props} />
  </>;
}

export function HarmReductionHivSelftestPanel({ props }: Props) {
  const color = colorOf(SELFTEST_CHANNEL_OPTIONS, props.channel, HARM_REDUCTION_COLORS.harmReductionHivSelftest);
  const voucher = props.voucher_redeem === true ? "可" : props.voucher_redeem === false ? "否" : "";
  return <>
    <Title color={color}>{str(props.name) || "愛滋自我篩檢通路"}</Title>
    <Row label="通路類型" value={str(props.channel_label)} color={color} />
    <Row label="場所類型" value={str(props.outlet_type_label)} />
    <Row label="機台型式" value={str(props.machine_type_label)} />
    <Row label="可兌換篩檢券" value={voucher} />
    <CommonRows props={props} />
  </>;
}

export function HarmReductionHivTestingPanel({ props }: Props) {
  const color = colorOf(HIV_TESTING_CATEGORY_OPTIONS, props.category, HARM_REDUCTION_COLORS.harmReductionHivTesting);
  return <>
    <Title color={color}>{str(props.name) || "愛滋篩檢與醫療機構"}</Title>
    <Row label="類別" value={str(props.category_label)} color={color} />
    <Row label="院所層級" value={str(props.subtype_label)} />
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

// ══════════ 第二批（2026-10-06）══════════

const yesNo = (v: unknown): string => (v === true ? "是" : v === false ? "否" : "");

export function HarmReductionAlcoholPanel({ props }: Props) {
  const services = str(props.service_type_label)
    || ALCOHOL_SERVICE_OPTIONS.filter((option) => props[option.flag] === true).map((option) => option.label).join("、");
  return <>
    <Title color={HARM_REDUCTION_COLORS.harmReductionAlcohol}>{str(props.name) || "酒癮治療機構"}</Title>
    <Row label="服務項目" value={services} color={HARM_REDUCTION_COLORS.harmReductionAlcohol} />
    <Row label="院所類型" value={str(props.facility_type_label)} />
    <Row label="也提供藥癮治療" value={props.also_drug_treatment === true ? "是（同列替代療法與藥癮戒治名單）" : yesNo(props.also_drug_treatment)} />
    <CommonRows props={props} />
  </>;
}

export function HarmReductionPrepPanel({ props }: Props) {
  const funding = PREP_FUNDING_OPTIONS.filter((option) => props[option.flag] === true).map((option) => option.label);
  return <>
    <Title color={HARM_REDUCTION_COLORS.harmReductionPrep}>{str(props.name) || "PrEP 服務醫院"}</Title>
    <Row label="PrEP 給付" value={funding.join("、")} color={HARM_REDUCTION_COLORS.harmReductionPrep} />
    <Row label="院所類型" value={str(props.facility_type_label)} />
    <CommonRows props={props} />
  </>;
}

export function HarmReductionInternetAddictionPanel({ props }: Props) {
  const color = colorOf(INTERNET_SERVICE_TYPE_OPTIONS, props.service_type, HARM_REDUCTION_COLORS.harmReductionInternetAddiction);
  return <>
    <Title color={color}>{str(props.name) || "網路成癮治療資源"}</Title>
    <Row label="機構類型" value={labelOf(INTERNET_SERVICE_TYPE_OPTIONS, props.service_type)} color={color} />
    <Row label="科別" value={str(props.dept)} />
    {props.special_clinic === true && <Row label="特別門診" value="開設網路成癮特別門診／心理治療／諮商" />}
    <CommonRows props={props} />
  </>;
}

export function HarmReductionAftercarePanel({ props }: Props) {
  const t = useFeatureTheme();
  return <>
    <Title color={HARM_REDUCTION_COLORS.harmReductionAftercare}>{str(props.name) || "更生保護會"}</Title>
    <Row label="單位" value={str(props.office_type_label)} />
    <Row label="資料版本" value="2023-06 版（來源 3 年未更新，地址電話可能已異動）" color={t.warn} />
    <CommonRows props={props} />
  </>;
}

export function HarmReductionSmokingCessationPanel({ props }: Props) {
  const color = colorOf(SMOKING_FACILITY_OPTIONS, props.facility_type, HARM_REDUCTION_COLORS.harmReductionSmokingCessation);
  return <>
    <Title color={color}>{str(props.name) || "戒菸服務機構"}</Title>
    <Row label="機構類型" value={str(props.facility_type_label)} color={color} />
    <Row label="戒菸服務" value={str(props.services_label)} />
    <CommonRows props={props} />
  </>;
}

export function HarmReductionAntiDrugPharmacyPanel({ props }: Props) {
  return <>
    <Title color={HARM_REDUCTION_COLORS.harmReductionAntiDrugPharmacies}>{str(props.name) || "社區藥局反毒站"}</Title>
    <Row label="計畫" value={str(props.program)} />
    <Row label="涵蓋範圍" value="本圖層僅含新北市、高雄市" />
    <CommonRows props={props} />
  </>;
}

export function HarmReductionCondomOutletPanel({ props }: Props) {
  const t = useFeatureTheme();
  const color = colorOf(CONDOM_OUTLET_OPTIONS, props.outlet_type, HARM_REDUCTION_COLORS.harmReductionCondomOutlets);
  return <>
    <Title color={color}>{str(props.name) || "保險套販售點"}</Title>
    <Row label="類型" value={str(props.outlet_type_label)} color={color} />
    <Row label="品項說明" value={str(props.item_note)} />
    {props.item_confirmed === false && <Row label="品項" value="品項待確認（來源未明確標示為保險套）" color={t.warn} />}
    <Row label="涵蓋範圍" value="本圖層僅含高雄市、新竹市、屏東縣、嘉義市" />
    <CommonRows props={props} />
  </>;
}

export function HarmReductionTherapeuticCommunityPanel({ props }: Props) {
  const t = useFeatureTheme();
  return <>
    <Title color={HARM_REDUCTION_COLORS.harmReductionTherapeuticCommunities}>{str(props.name) || "治療性社區與中途之家"}</Title>
    <Row label="服務模式" value={str(props.service_modes)} />
    <Row label="計畫" value={str(props.programs)} />
    <Row label="治療性社區" value={yesNo(props.is_therapeutic_community)} />
    <Row label="位置說明" value="座標為機構辦公處，非安置／住宿地點" color={t.warn} />
    <CommonRows props={props} />
  </>;
}

export function HarmReductionDuiCrashPanel({ props }: Props) {
  const color = colorOf(DUI_CLASS_OPTIONS, props.accident_class, HARM_REDUCTION_COLORS.harmReductionDuiCrashes);
  const casualties = [
    typeof props.deaths === "number" ? `死亡 ${props.deaths}` : "",
    typeof props.injuries === "number" ? `受傷 ${props.injuries}` : "",
  ].filter(Boolean).join("、");
  return <>
    <Title color={color}>酒駕肇事事故</Title>
    <Row label="類別" value={str(props.accident_class_label)} color={color} />
    <Row label="發生時間" value={`${str(props.accident_date)} ${str(props.accident_time)}`.trim()} mono />
    <Row label="傷亡" value={casualties} />
    <Row label="地點" value={str(props.location)} />
    <Row label="主要肇因" value={str(props.cause_main)} />
    <Row label="酒駕判定" value={str(props.dui_cause_basis_label)} />
    <Row label="酒駕當事者" value={typeof props.n_dui_parties === "number" ? `${props.n_dui_parties} 人` : ""} />
    <Row label="座標" value="警方事故紀錄座標" />
    <Row label="資料日期" value={str(props.vintage)} mono />
  </>;
}
