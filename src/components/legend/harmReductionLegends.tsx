// 減害服務圖層圖例（legendKit；色票與地圖 paint 同源，皆 import harmReductionTypes）。
import { LegendNote, LegendRow, LegendTitle, SwatchDot } from "./legendKit";
import {
  CONDOM_OUTLET_OPTIONS, DUI_CLASS_OPTIONS, HARM_REDUCTION_COLORS, HIV_TESTING_CATEGORY_OPTIONS,
  INTERNET_SERVICE_TYPE_OPTIONS, SELFTEST_CHANNEL_OPTIONS, SMOKING_FACILITY_OPTIONS, TREATMENT_CATEGORY_OPTIONS,
} from "../../data/harmReductionTypes";

const PRECISION_NOTE = "座標由地址定位，少數為推估位置（popup 會標示）。";

function CategoryRows({ options }: { options: readonly { value: string; label: string; color: string }[] }) {
  return <>{options.map((option) => <LegendRow key={option.value} swatch={<SwatchDot color={option.color} />}>{option.label}</LegendRow>)}</>;
}

export function HarmReductionNeedleLegend() {
  return <div>
    <LegendTitle zh="清潔針具據點" en="Needle & Syringe Services" />
    <LegendRow swatch={<SwatchDot color={HARM_REDUCTION_COLORS.harmReductionNeedle} />}>衛教諮詢站／針具自動服務機／回收桶</LegendRow>
    <LegendNote>一個據點可同時提供多類服務；篩選時符合任一勾選類型即顯示。{PRECISION_NOTE}衛生福利部疾病管制署清潔針具執行點名冊（2026-07-14）＋縣市衛生局名單。</LegendNote>
  </div>;
}

export function HarmReductionTreatmentLegend() {
  return <div>
    <LegendTitle zh="替代療法與藥癮戒治" en="Substitution & Addiction Treatment" />
    <CategoryRows options={TREATMENT_CATEGORY_OPTIONS} />
    <LegendNote>130 處附維持治療服藥人數（衛福部月報 2026-01–08）。{PRECISION_NOTE}衛生福利部指定藥癮戒治及替代治療機構名單（2026-08-31）＋data.gov.tw 133353。</LegendNote>
  </div>;
}

export function HarmReductionHivSelftestLegend() {
  return <div>
    <LegendTitle zh="愛滋自我篩檢通路" en="HIV Self-test Outlets" />
    <CategoryRows options={SELFTEST_CHANNEL_OPTIONS} />
    <LegendNote>不含即時庫存，前往前請先電洽。{PRECISION_NOTE}衛生福利部疾病管制署愛滋自我篩檢通路（快照 2026-10-06）。</LegendNote>
  </div>;
}

export function HarmReductionHivTestingLegend() {
  return <div>
    <LegendTitle zh="愛滋篩檢與指定醫療" en="HIV Testing & Care" />
    <CategoryRows options={HIV_TESTING_CATEGORY_OPTIONS} />
    <LegendNote>{PRECISION_NOTE}衛生福利部疾病管制署匿名篩檢院所（2026-09-22）、衛生局所（2026-07-22）、指定醫事機構與藥局（2026-07-15）；衛生福利部多元性別健康中心（2026-06-12）。</LegendNote>
  </div>;
}

export function HarmReductionPreventionCentersLegend() {
  return <div>
    <LegendTitle zh="毒品危害防制中心" en="Drug Abuse Prevention Centers" />
    <LegendRow swatch={<SwatchDot color={HARM_REDUCTION_COLORS.harmReductionPreventionCenters} />}>各縣市毒品危害防制中心</LegendRow>
    <LegendNote>法務部 data.gov.tw 13717（2024-02-01）· 政府資料開放授權條款第1版。</LegendNote>
  </div>;
}

// ══════════ 第二批（2026-10-06）══════════

function SingleColorLegend({ zh, en, color, row, note }: { zh: string; en: string; color: string; row: string; note: string }) {
  return <div>
    <LegendTitle zh={zh} en={en} />
    <LegendRow swatch={<SwatchDot color={color} />}>{row}</LegendRow>
    <LegendNote>{note}</LegendNote>
  </div>;
}

export function HarmReductionAlcoholLegend() {
  return <SingleColorLegend zh="酒癮治療與酒駕酒癮評估" en="Alcohol Treatment & DUI Assessment"
    color={HARM_REDUCTION_COLORS.harmReductionAlcohol} row="酒癮治療指定／費用補助／酒駕酒癮評估機構"
    note={`一機構可具多種身分，篩選時符合任一勾選項目即顯示。${PRECISION_NOTE}衛生福利部心理健康司名單（2026-08-07）。`} />;
}

export function HarmReductionPrepLegend() {
  return <SingleColorLegend zh="PrEP 服務醫院" en="HIV PrEP Providers"
    color={HARM_REDUCTION_COLORS.harmReductionPrep} row="提供公費或自費 PrEP 的醫院診所"
    note={`${PRECISION_NOTE}衛生福利部疾病管制署 PrEP 服務醫院名單（2026-09-02）。`} />;
}

export function HarmReductionInternetAddictionLegend() {
  return <div>
    <LegendTitle zh="網路成癮治療資源" en="Internet Addiction Services" />
    <CategoryRows options={INTERNET_SERVICE_TYPE_OPTIONS} />
    <LegendNote>機構類型依名稱歸類，非官方分類；來源不含連江縣。{PRECISION_NOTE}衛生福利部各縣市網路成癮治療服務資源表（2026-07-28）。</LegendNote>
  </div>;
}

export function HarmReductionAftercareLegend() {
  return <SingleColorLegend zh="更生保護會" en="Offender Aftercare Offices"
    color={HARM_REDUCTION_COLORS.harmReductionAftercare} row="臺灣更生保護會總會、分會與福建更生保護會"
    note="資料為 2023-06 版（法務部 data.gov.tw 10060，3 年未更新）· 政府資料開放授權條款第1版。" />;
}

export function HarmReductionSmokingCessationLegend() {
  return <div>
    <LegendTitle zh="戒菸服務機構" en="Smoking Cessation Providers" />
    <CategoryRows options={SMOKING_FACILITY_OPTIONS} />
    <LegendNote>{PRECISION_NOTE}衛生福利部國民健康署戒菸服務合約機構（2026-10-06 官網匯出）。</LegendNote>
  </div>;
}

export function HarmReductionAntiDrugPharmaciesLegend() {
  return <SingleColorLegend zh="社區藥局反毒站" en="Community Anti-drug Pharmacies"
    color={HARM_REDUCTION_COLORS.harmReductionAntiDrugPharmacies} row="新北防毒保衛站／高雄社區毒品防制關懷站"
    note="僅新北、高雄（其他縣市無開放名冊）。新北 data.gov.tw 125302（2026-08-07）；高雄 107877（113 年清冊）。" />;
}

export function HarmReductionCondomOutletsLegend() {
  return <div>
    <LegendTitle zh="保險套販售點" en="Condom Outlets" />
    <CategoryRows options={CONDOM_OUTLET_OPTIONS} />
    <LegendNote>僅高雄、新竹市、屏東、嘉義市（其他縣市無開放名冊）；少數點品項待確認（popup 會標示）。各縣市 data.gov.tw（2023-08～2026-08）。</LegendNote>
  </div>;
}

export function HarmReductionTherapeuticCommunitiesLegend() {
  return <SingleColorLegend zh="治療性社區與中途之家" en="Therapeutic Communities & Halfway Houses"
    color={HARM_REDUCTION_COLORS.harmReductionTherapeuticCommunities} row="衛福部藥癮治療性社區／社區復健方案承辦機構"
    note="座標為機構辦公處，非安置地點；2 處查無位置未畫。衛生福利部心理健康司（2025-07-29）。" />;
}

export function HarmReductionDuiCrashesLegend() {
  return <div>
    <LegendTitle zh="酒駕肇事事故" en="Drunk-driving Crashes" />
    <CategoryRows options={DUI_CLASS_OPTIONS} />
    <LegendNote>107–114 年 A1＋A2 事故，任一當事者肇因為酒醉駕駛即收（一事故一點）；縮小時以熱區呈現。與減害服務群組的酒癮治療／酒駕酒癮評估機構可對照。內政部警政署 · 政府資料開放授權條款第1版。</LegendNote>
  </div>;
}
