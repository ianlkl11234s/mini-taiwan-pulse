import { Row, formatTaiwanTime } from "./shared";
import { COLORS, RADIUS, FONT_SIZE } from "../../styles/designTokens";
import { ROAD_CONGESTION_COLORS, ROAD_CONGESTION_LABELS } from "../../data/roadCongestionLoader";
import { CONGESTION_COLORS, CONGESTION_LABELS } from "../../data/freewayLoader";

/**
 * 省道路況 popup。level 由 feature-state 合成（見 useMapInteraction 把 f.state
 * 併入 properties）。速度不在 timeline，v1 不顯示。
 */
export function RoadCongestionPanel({ props }: { props: Record<string, unknown> }) {
  const level = Number(props.level ?? 0);
  const sectionId = String(props.section_id ?? props.section_uid ?? "");
  const color = ROAD_CONGESTION_COLORS[level] ?? ROAD_CONGESTION_COLORS[0]!;
  const label = ROAD_CONGESTION_LABELS[level] ?? ROAD_CONGESTION_LABELS[0]!;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          省道路段
        </div>
        <div style={{
          marginLeft: "auto", fontSize: FONT_SIZE.sm, padding: "1px 6px", borderRadius: RADIUS.md,
          background: color, color: "#fff", fontWeight: 600,
        }}>
          {label}
        </div>
      </div>
      {sectionId && <Row label="路段代碼" value={sectionId} />}
      <Row label="壅塞等級" value={level > 0 ? `${level}（${label}）` : "無資料"} />
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        v1 僅省道 highway；無路名／速度資料
      </div>
    </>
  );
}

/**
 * 國道壅塞 popup（W2）。
 *
 * 與省道 `RoadCongestionPanel` 的差別（刻意不共用 panel）：
 * - 欄位不同：國道有 `road_name` / `section_name` / `direction_label` / `speed`，
 *   省道那層只有 section_id + level。
 * - 等級不同：國道 0~5 六級（`CONGESTION_LABELS`），省道是 4 色 match。
 * - 資料路徑不同：國道由 `buildFreewayGeoJSON` 每個 snapshot 重烤整份 properties
 *   （非 feature-state），所以這裡讀 `props` 就是當下時間軸位置的值。
 *
 * `speed` 是該 snapshot 的路段平均時速（km/h），上游可能給 null → 不顯示該列。
 */
export function FreewayCongestionPanel({ props }: { props: Record<string, unknown> }) {
  const level = Number(props.level ?? 0);
  const color = CONGESTION_COLORS[level] ?? CONGESTION_COLORS[0]!;
  const label = CONGESTION_LABELS[level] ?? CONGESTION_LABELS[0]!;
  const roadName = String(props.road_name ?? "");
  const sectionName = String(props.section_name ?? "");
  const direction = String(props.direction_label ?? "");
  const speedRaw = props.speed;
  const speed = typeof speedRaw === "number" && Number.isFinite(speedRaw) ? speedRaw : null;
  const snapshotTs = Number(props.snapshot_ts ?? 0);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: RADIUS.full, background: color, flexShrink: 0 }} />
        <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: "#fff", letterSpacing: 0.5 }}>
          {roadName || "國道路段"}
        </div>
        <div style={{
          marginLeft: "auto", fontSize: FONT_SIZE.sm, padding: "1px 6px", borderRadius: RADIUS.md,
          background: color, color: "#fff", fontWeight: 600,
        }}>
          {label}
        </div>
      </div>
      {sectionName && <Row label="路段" value={sectionName} />}
      {direction && <Row label="方向" value={direction} />}
      {/* 時速是開這層唯一想知道的數字：色帶只給等級區間 */}
      {speed != null && <Row label="平均時速" value={`${Math.round(speed)} km/h`} color={color} />}
      <Row label="壅塞等級" value={level > 0 ? `${level}（${label}）` : "無資料"} />
      {snapshotTs > 0 && (
        <Row label="快照時間" value={formatTaiwanTime(new Date(snapshotTs * 1000).toISOString())} />
      )}
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        資料為 10 分鐘粒度快照，隨時間軸更新
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
//  內政部 TGOS 通用電子地圖 道路中線（省道 / 國道兩層共用同一份 schema）
// ══════════════════════════════════════════════════════════════════
//
// 代碼語意真值來源：內政部《臺灣通用電子地圖圖層內容說明》修訂 114.01.08，
// §貳一(一) 道路中線(ROAD) ＋ 附表1。上游 pipeline 是 Shapefile→GeoJSON 純轉檔
// 無改名（taipei-gis-analytics/pipelines/transportation/road/05_process_shp_road_network.py），
// 所以切片欄位名 = 內政部原始欄位名。
//
// ⚠️ 刻意不顯示的欄位（查證後判定不可信 / 無資訊量，不是漏做）：
//   WIDTH      —— 定義查得到（最大路面寬度含中央分隔島）但**規格書未載單位**，
//                 值域 2~88 像公尺卻無一手依據 → 整欄不顯示（同 waterLevees length_m 前例）
//   ROADCOMNUM —— 規格說是「共線路段數」，但資料自相矛盾（37,813 筆宣稱 ≥1，
//                 實際填了 ROADNUM1 的只有 2,260 筆）→ 語意不明
//   DIR        —— 代碼語意查得到，但省道 65% 標「單行道」不合常理（疑為分向數化），
//                 未經上游確認不呈現
//   RESTRICT / STATUS —— 兩層都是常數 0，無資訊量
//   SOURCE / DEFINITION / FNODE / TNODE / ROADSEGID / ROADCODE —— 生產端 metadata

/** 道路分類編碼2（附表1）。只列資料中實際出現的 7 碼，其餘回退顯示原始碼 */
const ROADCLASS2_LABELS: Record<string, string> = {
  "9420101": "國道高速公路",
  "9420102": "國道快速公路",
  "9420201": "一般省道",
  "9420801": "一般市區道路",
  "9421001": "匝道",
  "9440100": "隧道",
  "9440202": "公路橋",
};

/** 道路結構碼 */
const ROADSTRUCT_LABELS: Record<string, string> = {
  "0": "一般平面",
  "1": "橋梁",
  "2": "隧道",
  "3": "匝道",
  "4": "高架",
  "5": "過水路",
  "6": "地下路段",
};

/** 道路分類編碼1（本兩層用得到的 4 種） */
const ROADCLASS1_LABELS: Record<string, string> = {
  HW: "國道",
  HU: "國道附屬道路（匝道／服務區）",
  "1W": "省道",
  "1U": "省道共線",
};

/** MDATE 是「測製年月」，格式固定 YYYYMM（規格書：2008年3月 → 200803） */
function formatSurveyMonth(raw: unknown): string {
  const s = String(raw ?? "");
  if (!/^\d{6}$/.test(s)) return "";
  return `${s.slice(0, 4)} 年 ${s.slice(4, 6)} 月`;
}

/** MVT 會逐 feature 丟掉 null 屬性 → 一律經此取值，不可假設 key 存在 */
function str(props: Record<string, unknown>, key: string): string {
  const v = props[key];
  return v == null ? "" : String(v);
}

function MoiRoadBody({ props, isHighway }: { props: Record<string, unknown>; isHighway: boolean }) {
  const roadNum = str(props, "ROADNUM");
  const alias = str(props, "ROADALIAS");
  const name = str(props, "ROADNAME");
  const sect = str(props, "RDNAMESECT");
  const fullName = name ? `${name}${sect}` : "";
  const struct = str(props, "ROADSTRUCT");
  const structLabel = ROADSTRUCT_LABELS[struct] ?? "";
  const briTun = str(props, "BRITUNNAME");
  const class1 = str(props, "ROADCLASS1");
  const class2 = str(props, "ROADCLASS2");
  const county = str(props, "COUNTY");
  const surveyed = formatSurveyMonth(props.MDATE);
  const num1 = str(props, "ROADNUM1");

  return (
    <>
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: "#fff", letterSpacing: 0.5, marginBottom: 6 }}>
        {roadNum || alias || fullName || (isHighway ? "國道" : "省道")}
      </div>
      {/* 國道：ROADALIAS 0% 空（中山高／福爾摩沙…）是最穩定的可讀名稱；
          省道：ROADALIAS 23.6% 空（縱貫公路／西部濱海公路…） */}
      {alias && alias !== roadNum && <Row label="路線別名" value={alias} />}
      {/* 國道幹線段 ROADNAME 全空、交流道／服務區才有值 → 有值本身就是資訊 */}
      {fullName && <Row label="道路名稱" value={fullName} />}
      {class2 && <Row label="道路分類" value={ROADCLASS2_LABELS[class2] ?? class2} />}
      {structLabel && struct !== "0" && <Row label="結構" value={structLabel} />}
      {/* 橋梁／隧道／地下路段才有橋隧名（其餘 93~98% 空） */}
      {briTun && <Row label="橋梁／隧道" value={briTun} />}
      {class1 && <Row label="路線分類" value={ROADCLASS1_LABELS[class1] ?? class1} />}
      {num1 && <Row label="共線編號" value={num1} />}
      {county && <Row label="縣市" value={county} />}
      {surveyed && <Row label="測製年月" value={surveyed} />}
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        內政部通用電子地圖 道路中線
      </div>
    </>
  );
}

/** 省道（PMTiles `provincial_road`，49,101 段） */
export function ProvincialRoadPanel({ props }: { props: Record<string, unknown> }) {
  return <MoiRoadBody props={props} isHighway={false} />;
}

/** 國道（PMTiles `national_highway`，5,394 段）。與省道同 schema，分開 layerType 只為標題標對 */
export function HighwayPanel({ props }: { props: Record<string, unknown> }) {
  return <MoiRoadBody props={props} isHighway />;
}

// ══════════════════════════════════════════════════════════════════
//  自行車道（TDX Cycling/Shape，1,749 條）
// ══════════════════════════════════════════════════════════════════

/**
 * ⚠️ 三個欄位刻意不顯示：
 *   CyclingType / AuthorityName —— TDX 回傳的是**字串字面 "NULL"**，1,749 筆全部如此
 *   FinishedTime —— 上游 ROC→西元轉換有 bug（民國 6 碼 `991202` 被當 3 碼年
 *                   → 991+1911=2902），24.4% 產出 `2902202` 這種 7 碼壞值
 *                   → 這裡用嚴格 YYYYMMDD 驗證，過不了就不顯示
 */
function validFinishedDate(raw: unknown): string {
  const s = String(raw ?? "");
  if (!/^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(s)) return "";
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

export function CyclingRoutePanel({ props }: { props: Record<string, unknown> }) {
  // 空值在這層是 `""` 或字串 "NULL"（GeoJSON 保留 key），與 PMTiles 的「key 消失」不同
  const clean = (v: unknown) => {
    const s = String(v ?? "").trim();
    return s === "NULL" ? "" : s;
  };
  const routeName = clean(props.RouteName);
  const city = clean(props.City);
  const town = clean(props.Town);
  const from = clean(props.RoadSectionStart);
  const to = clean(props.RoadSectionEnd);
  const direction = clean(props.Direction);
  const lengthM = Number(props.CyclingLength_m);
  const finished = validFinishedDate(props.FinishedTime);

  const lengthLabel = Number.isFinite(lengthM) && lengthM > 0
    ? (lengthM >= 1000 ? `${(lengthM / 1000).toFixed(1)} 公里` : `${Math.round(lengthM)} 公尺`)
    : "";

  return (
    <>
      <div style={{ fontSize: FONT_SIZE.lg, fontWeight: 700, color: "#fff", letterSpacing: 0.5, marginBottom: 6 }}>
        {routeName || "自行車道"}
      </div>
      {(city || town) && <Row label="行政區" value={[city, town].filter(Boolean).join(" ")} />}
      {(from || to) && <Row label="起訖路段" value={`${from || "—"} → ${to || "—"}`} />}
      {lengthLabel && <Row label="長度" value={lengthLabel} />}
      {direction && <Row label="通行方向" value={direction} />}
      {finished && <Row label="完工日期" value={finished} />}
      <div style={{ fontSize: FONT_SIZE.xs, color: COLORS.textFaint, marginTop: 4 }}>
        TDX 自行車道路網
      </div>
    </>
  );
}
