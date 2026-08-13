import { Row } from "./shared";
import { RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { useFeatureTheme } from "./featureTheme";
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
 * 本檔 Title 為極簡本地版（同 funeralPanels / religionPanels 慣例）。
 *
 * ⚠️ **空值約定**：上游匯出時把空字串與 null 的 property **整個拿掉**（不是留空值）
 *    → 一律 `str(props.x)` / `"key" in props` 判斷，不可假設 key 一定存在。
 *
 * 🔴 **`permit_status` 刻意完全不顯示**。它不是「營運中／已停業」——上游沒發代碼表，
 *    本專案用兩份現行名冊回推證偽（T0501 護理之家不論在不在現行名冊全是 C04、
 *    T0705-08 老人機構全是 C01），它是隨次類別走的法規／來源代碼空間。
 *    顯示出來只會讓使用者當成狀態讀。
 */

function Title({ color, children }: { color: string; children: string }) {
  const t = useFeatureTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: t.textStrong, letterSpacing: 0.5 }}>{children}</div>
    </div>
  );
}

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
  if (!isApproxPrecision(precision)) return null;
  return <Note>⚠️ 位置為概略值：{welfarePrecisionLabel(precision)}，非實際門牌座標</Note>;
}

/** 9 層共通的尾段：地址／電話／provenance。地址欄 100% 有值，city 極少數缺（child_services 5 筆）。 */
function CommonRows({ props }: { props: Record<string, unknown> }) {
  const nSrc = typeof props.n_src === "number" ? props.n_src : 0;
  return (
    <>
      <Row label="地址" value={str(props.address)} />
      {str(props.phone) ? <Row label="電話" value={str(props.phone)} /> : null}
      {nSrc > 1 ? <Row label="跨源比對" value={`${nSrc} 個來源名冊都有這筆`} /> : null}
    </>
  );
}

/**
 * 護理機構（1,611）：nh_type 三分色，半徑隨總床數。
 * ⚠️ 床數三欄上游給的是**字串**且 112 筆整組 key 不存在 → 走 nursingBeds() 轉換。
 *    居家護理所本來就沒有床，`總床數 0` 是事實不是缺漏，故分開講。
 */
export function WelfareNursingHomePanel({ props }: { props: Record<string, unknown> }) {
  const type = str(props.nh_type);
  const color = nursingTypeColor(type);
  const beds = nursingBeds(props);
  const homecare = type === "居家護理所";
  return (
    <>
      <Title color={color}>{str(props.name) || "護理機構"}</Title>
      <Row label="型別" value={nursingTypeLabel(type)} color={color} />
      {!beds.hasData ? (
        <Row label="床數" value="上游未提供" />
      ) : homecare ? (
        <Row label="床數" value="無床位（到宅服務）" />
      ) : (
        <>
          <Row label="總床數" value={`${beds.total.toLocaleString()} 床`} />
          {beds.nh > 0 ? <Row label="・一般護理" value={`${beds.nh.toLocaleString()} 床`} /> : null}
          {beds.postpartum > 0 ? <Row label="・產後護理" value={`${beds.postpartum.toLocaleString()} 床`} /> : null}
          {beds.infant > 0 ? <Row label="・嬰兒室" value={`${beds.infant.toLocaleString()} 床`} /> : null}
        </>
      )}
      {accreditationDisplay(str(props.accreditation))
        ? <Row label="評鑑" value={accreditationDisplay(str(props.accreditation))} /> : null}
      {str(props.valid_until) ? <Row label="效期至" value={str(props.valid_until)} /> : null}
      <Row label="縣市" value={str(props.city)} />
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
  const attr = str(props.attr_type);
  const color = elderlyAttrColor(attr);
  const hasBeds = "beds_approved" in props;
  const beds = Number(props.beds_approved);
  return (
    <>
      <Title color={color}>{str(props.name) || "老人住宿機構"}</Title>
      <Row label="公私別" value={elderlyAttrLabel(attr)} color={color} />
      <Row
        label="核定床數"
        value={hasBeds && Number.isFinite(beds) ? `${beds.toLocaleString()} 床` : "上游未提供"}
      />
      {str(props.target) ? <Row label="收容對象" value={str(props.target)} /> : null}
      {str(props.licensed_at) ? <Row label="立案日期" value={str(props.licensed_at)} /> : null}
      {str(props.sub_code) ? <Row label="機構類別" value={welfareSubCodeLabel(str(props.sub_code))} /> : null}
      <Row label="行政區" value={`${str(props.city)}${str(props.district)}`} />
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
  const usage = disabilityUsage(props);
  return (
    <>
      <Title color={usage.color}>{str(props.name) || "身心障礙福利機構"}</Title>
      {str(props.inst_type) ? <Row label="機構型態" value={str(props.inst_type)} /> : null}
      {usage.hasData ? (
        <>
          <Row
            label="使用率"
            value={`${(usage.ratio * 100).toFixed(0)}%（${usage.actual.toLocaleString()} / ${usage.quota.toLocaleString()}）`}
            color={usage.color}
          />
          <Row label="分級" value={usage.label} />
        </>
      ) : (
        <>
          <Row label="使用率" value="無核定量資料" color={usage.color} />
          <Note>ⓘ 上游未提供核定安置量（或核定量為 0，多為不收容的福利服務中心）—— 這不是使用率 0%。</Note>
        </>
      )}
      {accreditationDisplay(str(props.accreditation))
        ? <Row label="評鑑" value={accreditationDisplay(str(props.accreditation))} /> : null}
      {str(props.sub_code) ? <Row label="機構類別" value={welfareSubCodeLabel(str(props.sub_code))} /> : null}
      <Row label="縣市" value={str(props.city)} />
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
  const sub = str(props.sub_code);
  return (
    <>
      <Title color={WELFARE_LAYER_COLORS.welfareLtcInstitutions}>{str(props.name) || "長照服務機構"}</Title>
      <Row label="服務型態" value={welfareSubCodeLabel(sub)} />
      <Row label="統一編號" value={str(props.uni_no)} />
      <Row label="縣市" value={str(props.city)} />
      <CommonRows props={props} />
      <Note>
        ⓘ 這是《長期照顧服務法》<b>立案機構</b>，與醫療主題「長照機構」圖層的
        長照 2.0 <b>特約單位</b>是兩套登記體系（名稱交集僅 2,365）—— 兩者不可相加。
      </Note>
      <PrecisionNote precision={str(props.coord_precision)} />
    </>
  );
}

/** 托嬰中心（1,578）。⚠️ 名單約 21 個月舊，且不含居家托育（保母）。 */
export function WelfareChildcarePanel({ props }: { props: Record<string, unknown> }) {
  return (
    <>
      <Title color={WELFARE_LAYER_COLORS.welfareChildcare}>{str(props.name) || "托嬰中心"}</Title>
      <Row label="類別" value={welfareClassLabel(str(props.welfare_class))} />
      <Row label="統一編號" value={str(props.uni_no)} />
      <Row label="縣市" value={str(props.city)} />
      <CommonRows props={props} />
      <Note>
        ⚠️ 名單約 21 個月舊（上游檔 Last-Modified 停在 2024-11-12），托嬰中心異動頻繁，
        開／停業請以主管機關公告為準。本層<b>不含</b>居家托育（保母），該類無全國資料源。
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
  const cls = str(props.welfare_class);
  const color = childServiceColor(cls);
  return (
    <>
      <Title color={color}>{str(props.name) || "兒少服務據點"}</Title>
      <Row label="類別" value={welfareClassLabel(cls)} color={color} />
      {str(props.unit_type) ? <Row label="單位別" value={str(props.unit_type)} /> : null}
      {str(props.service_mode) ? <Row label="服務方式" value={str(props.service_mode)} /> : null}
      {str(props.service_content) ? <Row label="服務內容" value={str(props.service_content)} /> : null}
      {str(props.service_hours) ? <Row label="服務時間" value={str(props.service_hours)} /> : null}
      <Row label="縣市" value={str(props.city)} />
      <CommonRows props={props} />
      {cls === "child_dev" ? (
        <Note>ⓘ 早期療育單位<b>含醫院／診所</b>（單位別可辨），要看「純社福早療」請先依單位別篩選。</Note>
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
  return (
    <>
      <Title color={WELFARE_LAYER_COLORS.welfareGovOffices}>{str(props.name) || "公部門社福據點"}</Title>
      <Row label="單位類別" value={welfareSubCodeLabel(str(props.sub_code))} />
      <Row label="統一編號" value={str(props.uni_no)} />
      <Row label="縣市" value={str(props.city)} />
      <CommonRows props={props} />
      <Note>
        ⓘ 本層<b>不含</b>社會福利服務中心（162 處）—— 那批在「基礎建設 › 公共設施 › 社福中心」，
        兩層零重疊；要算全部公部門社福據點請把兩層相加。
      </Note>
      <PrecisionNote precision={str(props.coord_precision)} />
    </>
  );
}

/** 心理衛生機構（70）：sub_code 五類分色。 */
export function WelfareMentalHealthPanel({ props }: { props: Record<string, unknown> }) {
  const sub = str(props.sub_code);
  const color = mentalHealthColor(sub);
  return (
    <>
      <Title color={color}>{str(props.name) || "心理衛生機構"}</Title>
      <Row label="機構類別" value={welfareSubCodeLabel(sub)} color={color} />
      <Row label="統一編號" value={str(props.uni_no)} />
      <Row label="縣市" value={str(props.city)} />
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
  return (
    <>
      <Title color={WELFARE_LAYER_COLORS.welfareSocialWorkOrgs}>{str(props.name) || "社福團體"}</Title>
      <Row label="組織類別" value={welfareSubCodeLabel(str(props.sub_code))} />
      <Row label="統一編號" value={str(props.uni_no)} />
      <Row label="縣市" value={str(props.city)} />
      <CommonRows props={props} />
      <Note>
        ⚠️ 這是<b>登記組織</b>不是服務設施，地址多為<b>辦公室／立案地</b>，
        服務往往在別處發生 —— 不可當服務可近性指標。
      </Note>
      <PrecisionNote precision={str(props.coord_precision)} />
    </>
  );
}
