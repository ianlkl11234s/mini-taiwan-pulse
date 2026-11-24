/**
 * 多國共用的圖層規格 helper（B1 P2，2026-11-24）：原本放在某一國的檔案裡、被別國 import，
 * 造成「國家模組互相 import」，延後載入國家包時會把別國拖回開站。本檔是中性的家：只放被兩國以上共用者，
 * 各國檔從這裡 import（原國檔對外仍 re-export 同名符號，既有 import 路徑不用改）。
 * 規則：本檔不得 import 任何國家模組（`countryModuleBoundaries` 測試把關）。
 */
import { selectedMultiSelectValues } from "./multiSelectMapbox";
import { paletteRamp, resampleRamp } from "../map/palettes";
import { NOISE_CAPTURE_COLOR_EXPR } from "./noiseTypes";

export interface L3 { zh: string; en: string; ja: string }
export function pickL3(text: L3, locale: string): string {
  return locale === "ja" ? text.ja : locale === "en" ? text.en : text.zh;
}

/** 多國共用的公車站色（原 `JP_BUS_STOP_CLASSES[0].color`，日、韓、加共用同一色）。 */
export const INTL_BUS_STOP_COLOR = "#2563eb";

// ───────────── 南韓規格引擎（愛爾蘭重用） ─────────────
export interface KrCat { id: string; values: readonly string[]; color: string; label: L3; faded?: boolean }
/** `permit`：許可期間（`lcns_bgng_`～本欄，YYYYMMDD）＋快照日判斷的許可狀態。 */
export type KrFieldKind = "text" | "num" | "year" | "measure" | "peak" | "code" | "permit";
export interface KrField { prop: string; label: L3; kind?: KrFieldKind; unit?: string; digits?: number; map?: Readonly<Record<string, L3>> }
export interface KrLayerSpec<K extends string = string> {
  key: K;
  file: string;
  sourceLayer: string;
  geom: "point" | "line" | "polygon";
  /** 主 layer id（literal；gisClickRegistry 以此比對）。polygon 另有 `${id}` fill 與 outline。 */
  layerId: string;
  outlineId?: string;
  /** 鋪滿國土的面（如通學區）：此縮放以下只畫細外框、不填色（全國視角不糊成一片），此縮放起才加填色。 */
  fillFromZoom?: number;
  /** 站主限定：圖磚只走私人 owner-data（同源 Range API，`OWNER_DATA_ASSETS` 的 key），不進公開 CDN；沒有站主存取權就不掛 source。 */
  ownerAsset?: "kr-seoul-zoning";
  srcMinzoom: number;
  srcMaxzoom: number;
  minzoom: number;
  /** V-1／P-4：拉遠改熱區（點在 `densePointsFromZoom(count, minzoom)` 起畫、之下為熱區）；intensity 依資料密度目視校正。 */
  /**
   * 序列分級面（第 6 波人口網格）：`prop` 依固定斷點 `breaks` 分 `breaks.length + 1` 級，色取色盤庫 `palette`
   * （暗／淡兩版，`paletteRamp`）重新取樣；不設外框。圖例逐級列出 `labels`。
   */
  ramp?: { prop: string; palette: "YlOrBr"; breaks: readonly number[]; labels: readonly string[]; unit: L3 };
  heat?: {
    intensity: number;
    /** 低縮放另用「格網計數」檔畫熱區（weight 吃 `count`；source maxzoom 以上自動 overzoom），點檔 `file` 從 `minzoom` 起接手。 */
    density?: { file: string; sourceLayer: string; srcMinzoom: number; srcMaxzoom: number; attribution: string };
  };
  color: string;
  tier?: "S" | "M";
  count: number;
  catProp?: string;
  /** 衍生分類（第 10 波漁場：許可到期另成一類）：`expr` 回傳分類值字串（hook 上色、類別多選共用），`of` 是 popup 標題色用的同一判斷。 */
  derivedCat?: { expr: unknown[]; of: (props: Record<string, unknown>) => string };
  cats?: readonly KrCat[];
  otherColor?: string;
  otherLabel?: L3;
  title: { props: readonly string[]; fallback: L3 };
  fields: readonly KrField[];
  legendNotes: readonly L3[];
  popupNotes: readonly L3[];
  sourceOrg: string;
  sourceUrl: string;
  license: string;
  fetchedAt: string;
  loading: L3;
}


/** 序列分級面的色階（色盤庫暗／淡版重新取樣成「斷點數＋1」級；圖例與 hook 共用）。 */
export function krRampColors(spec: Pick<KrLayerSpec, "ramp">, isDark: boolean): string[] {
  const r = spec.ramp!;
  return resampleRamp(paletteRamp(r.palette, isDark)!, r.breaks.length + 1);
}


// 分類多選 filter（V-4）
/** 多選「其他」選項的固定 id（圖例有「其他」列的層才有）。 */
export const KR_CAT_OTHER_ID = "other";
export interface KrFilterGroup { id: string; values: readonly string[] }

/**
 * 分類多選 → Mapbox filter。`getter` 是回傳字串的表達式（屬性值轉字串；subway 用擁擠度分級表達式）。
 * 全選／未傳 → null（不篩、含缺值 feature）；全關 → 永假 sentinel；選了「其他」→ 補上「不屬於任何已列類別」。
 */
export function krGroupFilter(getter: unknown, groups: readonly KrFilterGroup[], withOther: boolean, mask: number | undefined): unknown[] | null {
  if (mask === undefined || !Number.isFinite(mask)) return null;
  const ids = [...groups.map((g) => g.id), ...(withOther ? [KR_CAT_OTHER_ID] : [])];
  const selected = selectedMultiSelectValues(mask, ids);
  if (selected.length === ids.length) return null;
  if (selected.length === 0) return ["==", getter, "__multi_select_none__"];
  const chosen = groups.filter((g) => selected.includes(g.id)).flatMap((g) => [...g.values]);
  const hit = ["in", getter, ["literal", chosen]];
  if (!selected.includes(KR_CAT_OTHER_ID)) return hit;
  const other = ["!", ["in", getter, ["literal", groups.flatMap((g) => [...g.values])]]];
  return chosen.length ? ["any", hit, other] : other;
}

/** 屬性值（含數值型）統一轉字串，缺值＝""。 */
export const krStringProp = (prop: string): unknown[] => ["to-string", ["coalesce", ["get", prop], ""]];


/** 首爾地鐵擁擠度分級斷點。 */
export const KR_CONGESTION_BREAKS = [34, 80, 130] as const;

/** 規格的分類篩選 filter（subway 以平日尖峰擁擠度分級當類別）。 */
export function krSpecCatFilter(spec: KrLayerSpec, mask: number | undefined): unknown[] | null {
  if (!spec.cats) return null;
  const getter = spec.key === "krSeoulSubwayCongestion"
    ? ["case", ["has", "peak_wkd"], ["step", ["to-number", ["get", "peak_wkd"], 0], "<34", KR_CONGESTION_BREAKS[0], "34-80", KR_CONGESTION_BREAKS[1], "80-130", KR_CONGESTION_BREAKS[2], ">=130"], ""]
    : spec.derivedCat ? spec.derivedCat.expr : krStringProp(spec.catProp!);
  return krGroupFilter(getter, spec.cats, !!spec.otherLabel, mask);
}

// ───────────── 菲律賓規格引擎（中國、泰國、越南、加拿大 waves 重用） ─────────────
type Expr = unknown[];

export interface PhCat { id: string; values: readonly string[]; color: string; label: L3; /** 屬於哪些子圖層；省略＝全部 */ parts?: readonly string[]; /** 依類別的點半徑（px，乘大小滑桿） */ radius?: number }
export interface PhField {
  prop: string; label: L3;
  /** `area`：值為 km²，依大小換 km²／公頃／m²；0 或負值視為缺值不顯示（面要素的面積不會是 0） */
  kind?: "text" | "num" | "code" | "year" | "area";
  unit?: string | L3; digits?: number; map?: Readonly<Record<string, L3>>;
  /** 與此欄同值時不顯示（例：name_en 與 name 相同） */ unlessSameAs?: string;
  /** 去掉來源值開頭的行政代碼（例 BIG 的「.01  Cilacap」「33 Jawa Tengah」）；顯示格式化，資料本身不改 */
  stripCodePrefix?: boolean;
}
/** label：數值級距寫字串（等寬數字），文字分級寫 L3（隨語系、一般字型）。 */
export interface PhSizeBands { prop: string; title: L3; bands: readonly { min: number; radius: number; label: string | L3 }[] }
/** 類別取值：Mapbox 表達式（回傳字串）與同義的 JS 版（popup 配色用）。 */
export interface PhCatGetter { expr: Expr; js: (p: Record<string, unknown>) => string }
export interface PhPart {
  /** layer id（literal；gisClickRegistry 以此比對） */
  id: string;
  sourceLayer: string;
  /** fill＝面（越南安江工業群；2026-11-13 起） */
  geom: "point" | "line" | "fill";
  minzoom: number;
  cat: PhCatGetter;
  /** 固定 filter（例：只畫電纜、排除卡拉延群島的點） */
  filter?: Expr;
  dashed?: boolean;
  /** 點：依數值分級的半徑（覆蓋類別半徑） */
  size?: PhSizeBands;
  /** 線寬（z10／z14 兩段，依類別） */
  lineWidth?: Readonly<Record<string, readonly [number, number]>>;
  /** 點描邊編碼：符合條件者白框 2px（例：Climate TRACE 補缺） */
  ring?: { when: Expr; js: (p: Record<string, unknown>) => boolean; label: L3 };
  /** 點用小號半徑（S；密集點、附屬設施） */
  small?: boolean;
  /** 點：符合條件者畫空心（只畫類別色外框；例：OSM 補缺、DOT 近似座標、里程牌）。`when` 省略＝整個子圖層空心 */
  hollow?: { when?: Expr; js?: (p: Record<string, unknown>) => boolean; label: L3 };
  /** 面：填色透明度倍率（0＝空心面，只留點擊熱區；外框另用 line 子圖層畫） */
  fillOpacity?: number;
  /**
   * 面：小面拉遠只剩次像素時，在 `maxzoom` 以下加同色模糊外框光暈（layer id `<id>-halo`，不接點擊），標出位置；
   * 放大到 `maxzoom` 起只畫面（比照 gbCoastalErosionRisk 低縮放加寬外框）。例：新斯科細亞養殖租約。
   */
  lowZoomHalo?: { maxzoom: number };
}
/** 規格文字取語系：字串原樣，L3 依 locale 取（`locale` 省略＝中文，給地圖署名、loading 等不隨語系的地方）。 */
export function phText(v: string | L3, locale = "zh"): string {
  return typeof v === "string" ? v : locale === "ja" ? v.ja : locale === "en" ? v.en : v.zh;
}
export interface PhNote { text: L3; /** 只在符合條件的 feature 顯示 */ when?: (p: Record<string, unknown>) => boolean }
/** `K`：圖層 key 型別（越南等他國重用本引擎時放寬，2026-11-13）。 */
export interface PhLayerSpec<K extends string = string> {
  key: K;
  file: string;
  sourceId: string;
  srcMinzoom: number;
  srcMaxzoom: number;
  color: string;
  count: number;
  parts: readonly PhPart[];
  cats: readonly PhCat[];
  otherColor?: string;
  otherLabel?: L3;
  /** 圖例標題後綴（例：C090「補助安裝地點，非全國光電」） */
  legendTitleNote?: L3;
  /** 虛線子圖層的圖例文字（省略＝「地下、海底電纜」；null＝虛線已有自己的分類列，不另列） */
  dashLabel?: L3 | null;
  sizeLegend?: readonly PhSizeBands[];
  title: { props: readonly string[]; fallback: L3; fallbackBy?: { prop: string; map: Readonly<Record<string, L3>> } };
  fields: readonly PhField[];
  legendNotes: readonly L3[];
  popupNotes: readonly PhNote[];
  /** 低縮放熱區（≥1 萬點，map-layers §3.8 V-1／P-4） */
  heat?: { intensity: number };
  /** 來源與授權：純字串＝各語系共用（原文名稱）；含中文說明時寫 L3，英／日介面才不會混中文（2026-11-18） */
  sourceOrg: string | L3;
  sourceUrl: string;
  license: string | L3;
  fetchedAt: string;
  loading: L3;
  /** 預設透明度（省略＝全點層依密度、其餘 0.85） */
  opacity?: number;
  /** 同一層分多支 PMTiles（範圍可重疊，例：NOAH 依緯度切北中南三檔）；各檔 tile layer 與屬性相同，子圖層 id 加 `-<suffix>` */
  /** 額外檔案；partIds 依 parts 順序寫死字面 id（gisClickRegistry 測試靠字面比對）。 */
  extraFiles?: readonly { suffix: string; file: string; partIds: readonly string[] }[];
}

/** `extraFiles` 展開成多份規格（第一份＝原檔、原 id）；host 依序各畫一次（hook 數固定）。 */
export function phFileSpecs<K extends string>(spec: PhLayerSpec<K>): PhLayerSpec<K>[] {
  return [spec, ...(spec.extraFiles ?? []).map((f) => ({
    ...spec, file: f.file, sourceId: `${spec.sourceId}-${f.suffix}`, extraFiles: undefined,
    parts: spec.parts.map((p, i) => ({ ...p, id: f.partIds[i] ?? `${p.id}-${f.suffix}` })),
  }))];
}


/** 多選「其他」選項的固定 id（有 `otherLabel` 的層才有）。 */
export const PH_CAT_OTHER_ID = "other_brand";
/** 類別多選選項 id（宣告順序＝bitmask；有 `otherLabel` 者最後加「其他」）。 */
export const phCatOptionIds = (spec: Pick<PhLayerSpec<string>, "cats" | "otherLabel">): string[] =>
  [...spec.cats.map((c) => c.id), ...(spec.otherLabel ? [PH_CAT_OTHER_ID] : [])];

/** feature 屬於哪個類別（popup 配色）；不屬於任何已列類別回 undefined。 */
export function phCatOf(spec: PhLayerSpec<string>, props: Record<string, unknown>): PhCat | undefined {
  for (const part of spec.parts) {
    const v = part.cat.js(props);
    const hit = spec.cats.find((c) => (!c.parts || c.parts.includes(part.id)) && c.values.includes(v));
    if (hit) return hit;
  }
  return undefined;
}

// ───────────── 加拿大共用（愛爾蘭、菲律賓、泰國、越南、中國的 popup 重用） ─────────────
export interface CaSource { org: string; url: string; license: string; short: string; shortL3?: L3 }

export const caText = (value: unknown): string => {
  if (value == null) return "";
  const s = String(value).trim();
  return /^(none|nan|nat|null|\.\.|\?)$/i.test(s) ? "" : s;
};

// ───────────── 電廠容量分級（南韓、加拿大共用） ─────────────
/** 裝置容量分級（MW），半徑沿用台灣電廠 `CAPACITY_RADIUS`；未標容量用最小級。 */
export const CAPACITY_RADIUS_BANDS: readonly { min: number; radius: number; label: string }[] = [
  { min: 0, radius: 3, label: "<10" },
  { min: 10, radius: 4.5, label: "10–100" },
  { min: 100, radius: 7, label: "100–1,000" },
  { min: 1000, radius: 11, label: "≥1,000" },
];


// ───────────── 噪音色階（英國、愛爾蘭共用） ─────────────
/** 台灣 NoiseCapture dB 色階（45–85 dB 每 10 dB 一停點）重取樣到每 2.5 dB，取各 Lden 帶中點 dB 的色。 */
const NOISE_RAMP = (NOISE_CAPTURE_COLOR_EXPR.slice(3) as unknown[]).filter((_, i) => i % 2 === 1) as string[];
const NOISE_RAMP_MIN_DB = Number(NOISE_CAPTURE_COLOR_EXPR[3]);
const NOISE_RAMP_STEP = 2.5;
const NOISE_FINE = resampleRamp(NOISE_RAMP, (NOISE_RAMP.length - 1) * (10 / NOISE_RAMP_STEP) + 1);
export const noiseColorAt = (db: number) => NOISE_FINE[Math.round((db - NOISE_RAMP_MIN_DB) / NOISE_RAMP_STEP)]!;
