import { Row, Title } from "./shared";
import { FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
import { useLocale } from "../../state/localeStore";
import {
  WELFARE_LAYER_COLORS,
  welfareClassLabel, welfareSubCodeLabel,
  welfarePrecisionLabel, isApproxPrecision,
  nursingTypeColor, nursingTypeLabel, nursingBeds,
  elderlyAttrColor, elderlyAttrLabel,
  disabilityUsage, accreditationDisplay,
  childServiceColor, mentalHealthColor,
} from "../../data/welfareTypes";

/**
 * 社福長照 9 層的 click popup。
 *
 * ⚠️ **空值約定**：上游匯出時把空字串與 null 的 property **整個拿掉**（不是留空值）
 *    → 一律 `str(props.x)` / `"key" in props` 判斷，不可假設 key 一定存在。
 *
 * 🔴 **`permit_status` 刻意完全不顯示**。它不是「營運中／已停業」——上游沒發代碼表，
 *    本專案用兩份現行名冊回推證偽（T0501 護理之家不論在不在現行名冊全是 C04、
 *    T0705-08 老人機構全是 C01），它是隨次類別走的法規／來源代碼空間。
 *    顯示出來只會讓使用者當成狀態讀。
 */

function Note({ children }: { children: React.ReactNode }) {
  const t = useFeatureTheme();
  return (
    <div style={{ fontSize: FONT_SIZE.xs, color: t.textDim, marginTop: 4, lineHeight: 1.4 }}>
      {children}
    </div>
  );
}

const str = (v: unknown): string => (v == null || v === "" ? "" : String(v));

/**
 * 座標精度誠實標記（9 層共用）。
 * ⚠️ 全主題有 98 筆（約 1%）是路段／區中心不是門牌 —— 使用者拿去導航會被誤導，
 *    故概略值一律明講；其餘精度段位不佔版面。
 */
function PrecisionNote({ precision }: { precision: string }) {
  const { t: tr } = useLocale();
  if (!isApproxPrecision(precision)) return null;
  return <Note>{tr("popup.welfare.approxPosition", { label: welfarePrecisionLabel(precision) })}</Note>;
}

/** 9 層共通的尾段：地址／電話／provenance。地址欄 100% 有值，city 極少數缺（child_services 5 筆）。 */
function CommonRows({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  const nSrc = typeof props.n_src === "number" ? props.n_src : 0;
  return (
    <>
      <Row field="address" value={str(props.address)} />
      {str(props.phone) ? <Row field="phone" value={str(props.phone)} /> : null}
      {nSrc > 1 ? <Row label={tr("popup.welfare.crossSource")} value={tr("popup.welfare.crossSourceValue", { count: nSrc })} /> : null}
    </>
  );
}

/**
 * 護理機構（1,611）：nh_type 三分色，半徑隨總床數。
 * ⚠️ 床數三欄上游給的是**字串**且 112 筆整組 key 不存在 → 走 nursingBeds() 轉換。
 *    居家護理所本來就沒有床，`總床數 0` 是事實不是缺漏，故分開講。
 */
export function WelfareNursingHomePanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr, formatNumber } = useLocale();
  const type = str(props.nh_type);
  const color = nursingTypeColor(type);
  const beds = nursingBeds(props);
  const homecare = type === "居家護理所"; // 資料值（nh_type）
  return (
    <>
      <Title color={color}>{str(props.name) || tr("popup.welfare.nursingHome")}</Title>
      <Row label={tr("popup.welfare.nhType")} value={nursingTypeLabel(type)} color={color} />
      {!beds.hasData ? (
        <Row label={tr("popup.welfare.beds")} value={tr("popup.welfare.notProvided")} />
      ) : homecare ? (
        <Row label={tr("popup.welfare.beds")} value={tr("popup.welfare.noBeds")} />
      ) : (
        <>
          <Row label={tr("popup.welfare.totalBeds")} value={tr("popup.welfare.bedsCount", { count: formatNumber(beds.total) })} />
          {beds.nh > 0 ? <Row label={tr("popup.welfare.bedsGeneral")} value={tr("popup.welfare.bedsCount", { count: formatNumber(beds.nh) })} /> : null}
          {beds.postpartum > 0 ? <Row label={tr("popup.welfare.bedsPostpartum")} value={tr("popup.welfare.bedsCount", { count: formatNumber(beds.postpartum) })} /> : null}
          {beds.infant > 0 ? <Row label={tr("popup.welfare.bedsInfant")} value={tr("popup.welfare.bedsCount", { count: formatNumber(beds.infant) })} /> : null}
        </>
      )}
      {accreditationDisplay(str(props.accreditation))
        ? <Row label={tr("popup.welfare.accreditation")} value={accreditationDisplay(str(props.accreditation))} /> : null}
      {str(props.valid_until) ? <Row label={tr("popup.welfare.validUntil")} value={str(props.valid_until)} /> : null}
      <Row field="county" value={str(props.city)} />
      <CommonRows props={props} />
      <PrecisionNote precision={str(props.coord_precision)} />
    </>
  );
}

/**
 * 老人住宿機構（1,160）：attr_type 公私別分色，半徑隨核定床數。
 * ⚠️ `beds_approved` 是字串；70 筆整組 key 不存在（只有骨幹基本欄）。
 */
export function WelfareElderlyHomePanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr, formatNumber } = useLocale();
  const attr = str(props.attr_type);
  const color = elderlyAttrColor(attr);
  const hasBeds = "beds_approved" in props;
  const beds = Number(props.beds_approved);
  return (
    <>
      <Title color={color}>{str(props.name) || tr("popup.welfare.elderlyHome")}</Title>
      <Row label={tr("popup.welfare.publicPrivate")} value={elderlyAttrLabel(attr)} color={color} />
      <Row
        label={tr("popup.welfare.approvedBeds")}
        value={hasBeds && Number.isFinite(beds) ? tr("popup.welfare.bedsCount", { count: formatNumber(beds) }) : tr("popup.welfare.notProvided")}
      />
      {str(props.target) ? <Row label={tr("popup.welfare.target")} value={str(props.target)} /> : null}
      {str(props.licensed_at) ? <Row label={tr("popup.welfare.licensedAt")} value={str(props.licensed_at)} /> : null}
      {str(props.sub_code) ? <Row label={tr("popup.welfare.instCategory")} value={welfareSubCodeLabel(str(props.sub_code))} /> : null}
      <Row field="district" value={`${str(props.city)}${str(props.district)}`} />
      <CommonRows props={props} />
      <PrecisionNote precision={str(props.coord_precision)} />
    </>
  );
}

/**
 * 身障福利機構（334）：使用率＝實際安置／核定量（三種安置型態加總）。
 * 🔴 分母為 0（88 筆：68 筆無欄位＋20 筆三項核定量都是 0，多為福利服務中心）
 *    一律顯示「無核定量資料」，**不可**當成使用率 0%。
 */
export function WelfareDisabilityPanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr, formatNumber } = useLocale();
  const usage = disabilityUsage(props);
  return (
    <>
      <Title color={usage.color}>{str(props.name) || tr("popup.welfare.disability")}</Title>
      {str(props.inst_type) ? <Row label={tr("popup.welfare.instType")} value={str(props.inst_type)} /> : null}
      {usage.hasData ? (
        <>
          <Row
            label={tr("popup.welfare.usage")}
            value={`${(usage.ratio * 100).toFixed(0)}%（${formatNumber(usage.actual)} / ${formatNumber(usage.quota)}）`}
            color={usage.color}
          />
          <Row label={tr("popup.welfare.grade")} value={usage.label} />
        </>
      ) : (
        <>
          <Row label={tr("popup.welfare.usage")} value={tr("popup.welfare.noQuota")} color={usage.color} />
          <Note>{tr("popup.welfare.noQuotaNote")}</Note>
        </>
      )}
      {accreditationDisplay(str(props.accreditation))
        ? <Row label={tr("popup.welfare.accreditation")} value={accreditationDisplay(str(props.accreditation))} /> : null}
      {str(props.sub_code) ? <Row label={tr("popup.welfare.instCategory")} value={welfareSubCodeLabel(str(props.sub_code))} /> : null}
      <Row field="county" value={str(props.city)} />
      <CommonRows props={props} />
      <PrecisionNote precision={str(props.coord_precision)} />
    </>
  );
}

/**
 * 長照立案機構（3,117）：sub_code 四種服務型態分色。
 * 🔴 這是《長照服務法》**立案機構**，與醫療主題 medLTC 的**特約單位**是兩套體系。
 */
export function WelfareLtcInstitutionPanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  const sub = str(props.sub_code);
  return (
    <>
      <Title color={WELFARE_LAYER_COLORS.welfareLtcInstitutions}>{str(props.name) || tr("popup.welfare.ltc")}</Title>
      <Row label={tr("popup.welfare.serviceForm")} value={welfareSubCodeLabel(sub)} />
      <Row field="businessId" value={str(props.uni_no)} />
      <Row field="county" value={str(props.city)} />
      <CommonRows props={props} />
      <Note>
        {tr("popup.welfare.ltcNoteA")}<b>{tr("popup.welfare.ltcNoteB")}</b>{tr("popup.welfare.ltcNoteC")}<b>{tr("popup.welfare.ltcNoteD")}</b>{tr("popup.welfare.ltcNoteE")}
      </Note>
      <PrecisionNote precision={str(props.coord_precision)} />
    </>
  );
}

/** 托嬰中心（1,578）。⚠️ 名單約 21 個月舊，且不含居家托育（保母）。 */
export function WelfareChildcarePanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  return (
    <>
      <Title color={WELFARE_LAYER_COLORS.welfareChildcare}>{str(props.name) || tr("popup.welfare.childcare")}</Title>
      <Row field="category" value={welfareClassLabel(str(props.welfare_class))} />
      <Row field="businessId" value={str(props.uni_no)} />
      <Row field="county" value={str(props.city)} />
      <CommonRows props={props} />
      <Note>
        {tr("popup.welfare.childcareNoteA")}<b>{tr("popup.welfare.childcareNoteB")}</b>{tr("popup.welfare.childcareNoteC")}
      </Note>
      <PrecisionNote precision={str(props.coord_precision)} />
    </>
  );
}

/**
 * 兒少服務（1,396）：早療／親子館／兒少安置三類混裝，用 welfare_class 分色。
 * ⚠️ 早療的 unit_type **含醫院／診所**，與醫療主題重疊。
 */
export function WelfareChildServicePanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  const cls = str(props.welfare_class);
  const color = childServiceColor(cls);
  return (
    <>
      <Title color={color}>{str(props.name) || tr("popup.welfare.childService")}</Title>
      <Row field="category" value={welfareClassLabel(cls)} color={color} />
      {str(props.unit_type) ? <Row label={tr("popup.welfare.unitType")} value={str(props.unit_type)} /> : null}
      {str(props.service_mode) ? <Row label={tr("popup.welfare.serviceMode")} value={str(props.service_mode)} /> : null}
      {str(props.service_content) ? <Row label={tr("popup.welfare.serviceContent")} value={str(props.service_content)} /> : null}
      {str(props.service_hours) ? <Row label={tr("popup.welfare.serviceHours")} value={str(props.service_hours)} /> : null}
      <Row field="county" value={str(props.city)} />
      <CommonRows props={props} />
      {cls === "child_dev" ? (
        <Note>{tr("popup.welfare.devNoteA")}<b>{tr("popup.welfare.devNoteB")}</b>{tr("popup.welfare.devNoteC")}</Note>
      ) : null}
      <PrecisionNote precision={str(props.coord_precision)} />
    </>
  );
}

/**
 * 公部門社福據點（151）。
 * ⚠️ 已排除 T0103 社福服務中心 —— 那 162 筆是基礎建設主題的 welfareCenters 圖層。
 */
export function WelfareGovOfficePanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  return (
    <>
      <Title color={WELFARE_LAYER_COLORS.welfareGovOffices}>{str(props.name) || tr("popup.welfare.govOffice")}</Title>
      <Row label={tr("popup.welfare.unitCategory")} value={welfareSubCodeLabel(str(props.sub_code))} />
      <Row field="businessId" value={str(props.uni_no)} />
      <Row field="county" value={str(props.city)} />
      <CommonRows props={props} />
      <Note>
        {tr("popup.welfare.govNoteA")}<b>{tr("popup.welfare.govNoteB")}</b>{tr("popup.welfare.govNoteC")}
      </Note>
      <PrecisionNote precision={str(props.coord_precision)} />
    </>
  );
}

/** 心理衛生機構（70）：sub_code 五類分色。 */
export function WelfareMentalHealthPanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  const sub = str(props.sub_code);
  const color = mentalHealthColor(sub);
  return (
    <>
      <Title color={color}>{str(props.name) || tr("popup.welfare.mentalHealth")}</Title>
      <Row label={tr("popup.welfare.instCategory")} value={welfareSubCodeLabel(sub)} color={color} />
      <Row field="businessId" value={str(props.uni_no)} />
      <Row field="county" value={str(props.city)} />
      <CommonRows props={props} />
      <PrecisionNote precision={str(props.coord_precision)} />
    </>
  );
}

/**
 * 社福團體／社工事務所／基金會（587）。
 * 🔴 這是**登記組織**不是服務設施，地址多為辦公室 —— popup 必須講清楚，
 *    否則使用者會把它讀成「這裡有社福服務」。
 */
export function WelfareSocialWorkOrgPanel({ props }: { props: Record<string, unknown> }) {
  const { t: tr } = useLocale();
  return (
    <>
      <Title color={WELFARE_LAYER_COLORS.welfareSocialWorkOrgs}>{str(props.name) || tr("popup.welfare.socialOrg")}</Title>
      <Row label={tr("popup.welfare.orgCategory")} value={welfareSubCodeLabel(str(props.sub_code))} />
      <Row field="businessId" value={str(props.uni_no)} />
      <Row field="county" value={str(props.city)} />
      <CommonRows props={props} />
      <Note>
        {tr("popup.welfare.orgNoteA")}<b>{tr("popup.welfare.orgNoteB")}</b>{tr("popup.welfare.orgNoteC")}<b>{tr("popup.welfare.orgNoteD")}</b>{tr("popup.welfare.orgNoteE")}
      </Note>
      <PrecisionNote precision={str(props.coord_precision)} />
    </>
  );
}
