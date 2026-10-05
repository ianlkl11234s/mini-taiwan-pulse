// 減害服務 5 層圖例（legendKit；色票與地圖 paint 同源，皆 import harmReductionTypes）。
import { LegendNote, LegendRow, LegendTitle, SwatchDot } from "./legendKit";
import {
  HARM_REDUCTION_COLORS, HIV_TESTING_CATEGORY_OPTIONS, SELFTEST_CHANNEL_OPTIONS, TREATMENT_CATEGORY_OPTIONS,
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
    <LegendNote>{PRECISION_NOTE}衛生福利部指定藥癮戒治及替代治療機構名單（2026-08-31）＋data.gov.tw 133353。</LegendNote>
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
