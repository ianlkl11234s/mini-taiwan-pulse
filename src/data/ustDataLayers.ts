/**
 * 美國屬地第 0–1 波（2026-11-25）圖層規格 SSOT：波多黎各（c=pr）、關島（c=gu）各自獨立面板，同一份規格產生兩地圖層。
 * - 行政邊界、人口：專用 hook `useUstLayers.ts`（層級 select、人口密度 6 級）。
 * - 其餘 8×2 層重用菲律賓規格引擎（`PhLayerSpec`＋`usePhDataLayer`）。
 * 資料、處理、授權原句見 taipei-gis-analytics `docs/topic-research/puerto_rico_opendata/waves/`、`guam_opendata/waves/` 與各 `_manifest.json`。
 * 依 system-inventory §6 預設（站主 11-24 以選項同意，待正式確認）：關島排除明標 FOUO 的層，其餘 GovGuamGIS 圖例註明「授權未明示」；聯邦資料為公有領域。
 * 不畫海域主張線。
 */
import type { L3, PhCat, PhCatGetter, PhField, PhLayerSpec, PhNote } from "./intlLayerShared";
import type { UstAreaKey, UstDataKey } from "./ustDataKeys";
import type { LayerSourceInfo } from "./layerSourceInfo";
import { cat, l3, point, POLY, propGetter, PT, str } from "./idWavesLayers";

export type { L3 } from "./intlLayerShared";
export { pickL3, phText } from "./intlLayerShared";

export type UstCc = "pr" | "gu";
export const UST_FETCHED_AT = "2026-11-25";
export const UST_NOT_COVERED_COLOR = "#6b7280";
export const UST_ADMIN_COLOR = "#9ca3af";
const PD = l3("公有領域（美國聯邦政府著作）", "Public domain (U.S. federal government work)", "パブリックドメイン（米国連邦政府著作物）");
const UNSTATED = l3("授權未明示", "License not stated", "ライセンスは明示されていない");
const HIFLD = l3("HIFLD 存檔 2025-08（SeerAI／source.coop 鏡像，CC BY 4.0）", "HIFLD archive 2025-08 (SeerAI / source.coop mirror, CC BY 4.0)", "HIFLD アーカイブ 2025-08（SeerAI／source.coop ミラー、CC BY 4.0）");
const OSM = l3("© OpenStreetMap contributors（ODbL），via Geofabrik（非官方）", "© OpenStreetMap contributors (ODbL), via Geofabrik (unofficial)", "© OpenStreetMap contributors（ODbL）、Geofabrik 経由（非公式）");
const OVERTURE = l3("Overture Maps 2026-11-18.0（OSM 等衍生，非官方）", "Overture Maps 2026-11-18.0 (derived from OSM etc., unofficial)", "Overture Maps 2026-11-18.0（OSM 等の派生、非公式）");
const GOVGUAM = l3("GovGuamGIS（關島政府 ArcGIS），授權未明示", "GovGuamGIS (Government of Guam ArcGIS), license not stated", "GovGuamGIS（グアム政府 ArcGIS）、ライセンス未明示");
export const UST_DECISION_NOTE = l3("依盤點 §6 預設處理（站主 2026-11-24 以選項同意，待正式確認）", "Handled per inventory §6 defaults (owner agreed to options on 2026-11-24, pending formal confirmation)", "棚卸し §6 の既定どおり（2026-11-24 にオーナーが選択肢に同意、正式確認待ち）");
export const UST_NO_MARITIME = l3("不畫海域主張線", "No maritime claim lines", "海域の主張線は描画しない");

export const UST_NAME: Record<UstCc, L3> = { pr: l3("波多黎各", "Puerto Rico", "プエルトリコ"), gu: l3("關島", "Guam", "グアム") };

// ═════════════════════════ 行政邊界、人口（層級） ═════════════════════════

export interface UstLevel { value: string; label: string; l3: L3; srcMinzoom: number; srcMaxzoom: number }
const lv = (value: string, label: string, en: string, ja: string, srcMinzoom: number, srcMaxzoom: number): UstLevel =>
  ({ value, label, l3: l3(label, en, ja), srcMinzoom, srcMaxzoom });

export const UST_ADMIN_LEVELS: Record<UstCc, readonly UstLevel[]> = {
  pr: [
    lv("territory", "屬地界（Territory）", "Territory", "準州境（Territory）", 5, 13),
    lv("municipio", "市（Municipio，78）", "Municipio (78)", "ムニシピオ（78）", 5, 13),
    lv("barrio", "區（Barrio，901）", "Barrio (901)", "バリオ（901）", 5, 13),
  ],
  gu: [
    lv("territory", "島界（Territory）", "Territory", "島境（Territory）", 6, 14),
    lv("village", "村（Village，19）", "Village (19)", "ビレッジ（19）", 6, 14),
  ],
};
export const UST_ADMIN_DEFAULT: Record<UstCc, string> = { pr: "municipio", gu: "village" };
export const UST_POP_LEVELS: Record<UstCc, readonly UstLevel[]> = {
  pr: [UST_ADMIN_LEVELS.pr[1]!, UST_ADMIN_LEVELS.pr[2]!],
  gu: [UST_ADMIN_LEVELS.gu[1]!, lv("blockgroup", "普查區塊群（Block Group，218）", "Census block group (218)", "国勢調査ブロックグループ（218）", 6, 14)],
};
/** 人口密度欄位（人／km²，陸地面積）；值缺漏畫灰「未涵蓋」。 */
export const UST_DENSITY_PROP = "density";
/** 6 級斷點：各地、各層級取實際分布 P10／P25／P50／P75／P90（2 位有效數字）；與其他國家級距不同，不可直接比色。 */
export const UST_DENSITY_BREAKS: Record<UstCc, Record<string, readonly number[]>> = {
  pr: { municipio: [130, 190, 290, 450, 860], barrio: [36, 93, 270, 590, 1800] },
  gu: { village: [71, 110, 210, 530, 1200], blockgroup: [150, 470, 1000, 2100, 3200] },
};
const fmtBreak = (n: number) => n.toLocaleString("en-US");
export function ustDensityLabels(cc: UstCc, level: string): string[] {
  const b = UST_DENSITY_BREAKS[cc][level]!;
  return [`<${fmtBreak(b[0]!)}`, ...b.slice(0, -1).map((x, i) => `${fmtBreak(x)}–${fmtBreak(b[i + 1]!)}`), `≥${fmtBreak(b[b.length - 1]!)}`];
}

export const UST_ADMIN_NOTES: Record<UstCc, readonly L3[]> = {
  pr: [
    l3("Census 製圖邊界 2024（已裁到岸線）：78 市、901 區；一次只顯示一個層級", "Census cartographic boundaries 2024 (clipped to shoreline): 78 municipios, 901 barrios; one level at a time", "Census 地図用境界 2024（海岸線で切り取り）：78 ムニシピオ・901 バリオ。一度に 1 階層"),
    l3("TIGER 另有 38 個純水域區（人口 0），製圖邊界不收", "TIGER has 38 more water-only barrios (population 0) not in the cartographic file", "TIGER には水域のみのバリオが別に 38（人口 0）あり、地図用境界には含まれない"),
    UST_NO_MARITIME,
  ],
  gu: [
    l3("Census 製圖邊界 2024：19 村；一次只顯示一個層級", "Census cartographic boundaries 2024: 19 villages; one level at a time", "Census 地図用境界 2024：19 ビレッジ。一度に 1 階層"),
    UST_NO_MARITIME,
  ],
};
export const UST_POP_NOTES: Record<UstCc, readonly L3[]> = {
  pr: [
    l3("ACS 2020–2024 五年估計（B01003 總人口，含誤差範圍）；密度＝人口 ÷ 陸地面積", "ACS 2020–2024 5-year estimate (B01003 total population, with margin of error); density = population ÷ land area", "ACS 2020–2024 年 5 年推計（B01003 総人口、誤差幅あり）。密度＝人口 ÷ 陸地面積"),
    l3("級距依波多黎各分布（市、區各自取百分位），不可與其他國家直接比色", "Classes follow Puerto Rico's own distribution (percentiles per level); not comparable with other countries", "区分はプエルトリコ国内の分布（階層ごとの百分位）。他国と色を直接比較しない"),
  ],
  gu: [
    l3("2020 Island Areas 普查（關島不在 ACS，只有十年一次）；GovGuamGIS 區塊群表加總到村（授權未明示）", "2020 Island Areas Census (Guam is not in ACS; decennial only); GovGuamGIS block-group table summed to villages (license not stated)", "2020 年 Island Areas 国勢調査（グアムは ACS 対象外で 10 年ごと）。GovGuamGIS のブロックグループ表を村に集計（ライセンス未明示）"),
    l3("來源表 9 個區塊群 2020 人口為空 → 畫灰「未涵蓋」，所在 7 村總數偏低（popup 標示）", "9 block groups have no 2020 population in the source table → grey 'not covered'; totals of the 7 villages containing them are partial (marked in popup)", "元表の 9 ブロックグループは 2020 年人口が空 → 灰色「未収録」。含まれる 7 村の合計は過小（ポップアップに表示）"),
    l3("級距依關島分布；人口 0 的區塊群（軍事用地等）屬最低級", "Classes follow Guam's own distribution; zero-population block groups (e.g. military land) fall in the lowest class", "区分はグアム国内の分布。人口 0 のブロックグループ（軍用地など）は最下位"),
  ],
};

// ═════════════════════════ 規格驅動 8×2 層 ═════════════════════════

export interface UstLayerSpec extends PhLayerSpec<UstDataKey> {
  defaultCats?: readonly string[];
  sourceNotes?: readonly L3[];
}

const ADMIN_FIELDS: Record<UstCc, readonly PhField[]> = {
  pr: [{ prop: "barrio", label: l3("區（Barrio）", "Barrio", "バリオ") }, { prop: "municipio", label: l3("市（Municipio）", "Municipio", "ムニシピオ") }],
  gu: [{ prop: "village", label: l3("村", "Village", "ビレッジ") }],
};
const NEAREST: PhNote = { text: l3("點落在行政區界外（岸邊、海上設施），行政區取最近者", "Feature lies outside admin polygons (shore, offshore); nearest used", "行政区域の外（海岸・海上施設）のため最寄りを採用"), when: (p) => str(p.admin_method) === "nearest" };
const key = <S extends string>(cc: UstCc, s: S) => `${cc}${s}` as UstDataKey;
const loading = (cc: UstCc, zh: string, en: string, ja: string) => l3(`${UST_NAME[cc].zh}${zh}載入中`, `Loading ${UST_NAME[cc].en} ${en}`, `${UST_NAME[cc].ja}の${ja}を読み込み中`);

// 站點
const MODE_CATS: readonly PhCat[] = [
  cat("bus", ["bus"], "#f59e0b", "公車站", "Bus stop", "バス停", { radius: 2.6 }),
  cat("metro", ["metro"], "#ef4444", "捷運站（Tren Urbano）", "Metro station (Tren Urbano)", "地下鉄駅（Tren Urbano）", { radius: 4.5 }),
  cat("ferry", ["ferry"], "#38bdf8", "渡輪站", "Ferry terminal", "フェリー乗り場", { radius: 4.5 }),
  cat("other", ["other"], "#a78bfa", "未標類型（市營業者，多為公車招呼站）", "Type not stated (municipal operators, mostly bus stops)", "種別未記載（市営事業者、主にバス停）", { radius: 2.6 }),
];
const MODE_MAP = Object.fromEntries(MODE_CATS.map((c) => [c.id, c.label]));

// 樞紐
const HUB_CATS: readonly PhCat[] = [
  cat("airport", ["airport"], "#f472b6", "機場", "Airport", "空港", { radius: 5 }),
  cat("heliport", ["heliport"], "#c084fc", "直升機場", "Heliport", "ヘリポート", { radius: 3.5 }),
  cat("port", ["port"], "#38bdf8", "港口", "Port", "港", { radius: 5 }),
  cat("marina", ["marina"], "#2dd4bf", "遊艇港", "Marina", "マリーナ", { radius: 3.5 }),
  cat("boat_ramp", ["boat_ramp"], "#94a3b8", "下水坡道", "Boat ramp", "ボート進水斜路", { radius: 3 }),
];
const HUB_KIND_MAP = Object.fromEntries(HUB_CATS.map((c) => [c.id, c.label]));
const HUB_SOURCE_MAP = {
  faa_nasr: l3("FAA NASR（NTAD 航空設施）", "FAA NASR (NTAD aviation facilities)", "FAA NASR（NTAD 航空施設）"),
  usace_principal_ports: l3("USACE 主要港口", "USACE Principal Ports", "USACE 主要港湾"),
  govguamgis_ng911: l3("GovGuamGIS Ng911 地標", "GovGuamGIS Ng911 points of interest", "GovGuamGIS Ng911 地物"),
};

// 道路
const ROAD_CATS_PR: readonly PhCat[] = [
  cat("interstate", ["interstate"], "#ef4444", "州際公路級（PR-52、PR-22 等，FHWA 功能分類 1）", "Interstate class (PR-52, PR-22 etc., FHWA functional class 1)", "インターステート級（PR-52・PR-22 など、FHWA 機能分類 1）"),
  cat("freeway", ["freeway"], "#f97316", "快速道路（功能分類 2）", "Freeway / expressway (functional class 2)", "高速道路（機能分類 2）"),
  cat("principal_arterial", ["principal_arterial"], "#facc15", "主要幹道（功能分類 3）", "Principal arterial (functional class 3)", "主要幹線（機能分類 3）"),
  cat("other", ["other"], "#94a3b8", "其他國道系統路段", "Other NHS segments", "その他の NHS 区間"),
  cat("metro", ["metro"], "#a78bfa", "Tren Urbano 捷運線（OSM）", "Tren Urbano metro line (OSM)", "Tren Urbano 地下鉄線（OSM）"),
];
const ROAD_W: Record<string, readonly [number, number]> = { interstate: [1.8, 3.2], freeway: [1.5, 2.8], principal_arterial: [1, 2], other: [0.8, 1.5], metro: [1.4, 2.4], secondary: [1.2, 2.4] };
const ROAD_CATS_GU: readonly PhCat[] = [
  cat("secondary", ["secondary"], "#facc15", "主要道路（TIGER S1200，島上無 S1100）", "Main road (TIGER S1200; no S1100 on the island)", "主要道路（TIGER S1200。島内に S1100 なし）"),
];

// 電廠
const PLANT_CATS: readonly PhCat[] = [
  cat("oil", ["oil"], "#d97706", "石油、柴油", "Oil, diesel", "石油・ディーゼル"),
  cat("gas", ["gas"], "#f59e0b", "天然氣", "Natural gas", "天然ガス"),
  cat("coal", ["coal"], "#a8a29e", "燃煤", "Coal", "石炭"),
  cat("solar", ["solar"], "#facc15", "太陽能", "Solar", "太陽光"),
  cat("wind", ["wind"], "#38bdf8", "風力", "Wind", "風力"),
  cat("hydro", ["hydro"], "#2dd4bf", "水力", "Hydro", "水力"),
  cat("waste", ["waste"], "#a3e635", "掩埋場沼氣、廢棄物", "Landfill gas, waste", "埋立地ガス・廃棄物"),
  cat("other", ["other"], "#94a3b8", "燃料未標", "Fuel not stated", "燃料不明"),
];
const PLANT_FUEL_MAP = Object.fromEntries(PLANT_CATS.map((c) => [c.id, c.label]));
const PLANT_SOURCE_MAP = { hifld_archive: HIFLD, overture: OVERTURE, jp_sige_mil1: l3("JP SIGE MIL1（波多黎各計畫委員會）", "JP SIGE MIL1 (Puerto Rico Planning Board)", "JP SIGE MIL1（プエルトリコ計画委員会）") };

// 電網
const KV_CATS: readonly PhCat[] = [
  cat("kv230", ["kv230"], "#ef4444", "230 kV", "230 kV", "230 kV"),
  cat("kv115", ["kv115"], "#f97316", "115 kV", "115 kV", "115 kV"),
  cat("kv38", ["kv38"], "#facc15", "34.5–38 kV", "34.5–38 kV", "34.5–38 kV"),
  cat("kv_low", ["kv_low"], "#38bdf8", "低於 34.5 kV", "Below 34.5 kV", "34.5 kV 未満"),
  cat("unknown", ["unknown"], "#94a3b8", "電壓未知", "Voltage unknown", "電圧不明"),
];
const KV_W: Record<string, readonly [number, number]> = { kv230: [1.8, 3], kv115: [1.3, 2.4], kv38: [0.8, 1.6], kv_low: [0.6, 1.2], unknown: [0.6, 1.2] };

// 再生能源
const RENEW_CATS: readonly PhCat[] = [
  cat("solar", ["solar"], "#facc15", "太陽能（發電場、板陣）", "Solar (farms, arrays)", "太陽光（発電所・アレイ）", { radius: 3.5 }),
  cat("wind", ["wind"], "#38bdf8", "風機（USWTDB）", "Wind turbine (USWTDB)", "風車（USWTDB）", { radius: 3.5 }),
];
const RENEW_KIND_MAP = { wind_turbine: l3("風機", "Wind turbine", "風車"), plant: l3("發電場", "Power plant", "発電所"), generator: l3("發電設備（板陣）", "Generator (array)", "発電設備（アレイ）") };

// 加油站
const brandCats = (cc: UstCc): readonly PhCat[] => cc === "pr" ? [
  cat("Total", ["Total", "TotalEnergies"], "#ef4444", "Total", "Total", "Total"),
  cat("Gulf", ["Gulf"], "#f97316", "Gulf", "Gulf", "Gulf"),
  cat("Mobil", ["Mobil"], "#38bdf8", "Mobil", "Mobil", "Mobil"),
  cat("Texaco", ["Texaco"], "#a78bfa", "Texaco", "Texaco", "Texaco"),
  cat("Puma", ["Puma"], "#22c55e", "Puma", "Puma", "Puma"),
  cat("Shell", ["Shell"], "#facc15", "Shell", "Shell", "Shell"),
] : [
  cat("Mobil", ["Mobil"], "#38bdf8", "Mobil", "Mobil", "Mobil"),
  cat("Shell", ["Shell"], "#facc15", "Shell", "Shell", "Shell"),
];

// 油氣
const PETRO_CATS: readonly PhCat[] = [
  cat("terminal", ["terminal"], "#f97316", "油品儲運站（HIFLD）", "Petroleum product terminal (HIFLD)", "石油製品ターミナル（HIFLD）", { radius: 5 }),
  cat("storage_tank", ["storage_tank"], "#a8a29e", "儲槽（OSM 登記，內容物多未標，可能含水槽）", "Storage tank (OSM; contents mostly untagged, may include water tanks)", "貯槽（OSM。内容物はほぼ未記載で水槽を含む可能性）", { radius: 2.6 }),
  cat("pipeline", ["pipeline"], "#e879f9", "管線（OSM 登記）", "Pipeline (OSM)", "パイプライン（OSM）"),
];
const PETRO_KIND_MAP = Object.fromEntries(PETRO_CATS.map((c) => [c.id, c.label]));

const kindGetter: PhCatGetter = propGetter("kind");

/** 子圖層 id 寫成字面值（gisClickRegistry 測試以字面比對）；關島另有地下電纜、油氣面與管線。 */
const PART_IDS = {
  pr: { stops: "pr-transit-stops-circle", hubs: "pr-transport-hubs-circle", roads: "pr-major-roads-line", plantsC: "pr-power-plants-circle", plantsF: "pr-power-plants-fill", lines: "pr-power-lines-line", subsC: "pr-power-substations-circle", subsF: "pr-power-substations-fill", renewC: "pr-renewables-circle", renewF: "pr-renewables-fill", fuel: "pr-fuel-stations-circle", petroC: "pr-petroleum-circle" },
  gu: { stops: "gu-transit-stops-circle", hubs: "gu-transport-hubs-circle", roads: "gu-major-roads-line", plantsC: "gu-power-plants-circle", plantsF: "gu-power-plants-fill", lines: "gu-power-lines-line", subsC: "gu-power-substations-circle", subsF: "gu-power-substations-fill", renewC: "gu-renewables-circle", renewF: "gu-renewables-fill", fuel: "gu-fuel-stations-circle", petroC: "gu-petroleum-circle" },
} as const;

function specsFor(cc: UstCc): UstLayerSpec[] {
  const A = ADMIN_FIELDS[cc];
  const I = PART_IDS[cc];
  const pr = cc === "pr";
  return [
    {
      key: key(cc, "TransitStops"), file: `${cc}_transit_stops.pmtiles`, sourceId: `${cc}-transit-stops`, srcMinzoom: 7, srcMaxzoom: 14, color: "#f59e0b", count: pr ? 5550 : 124,
      parts: [point(I.stops, "stops", 7, propGetter("mode"))],
      cats: pr ? MODE_CATS : MODE_CATS.slice(0, 1),
      title: { props: ["name"], fallback: l3("大眾運輸站點", "Transit stop", "公共交通の停留所") },
      fields: [{ prop: "mode", label: l3("類型", "Mode", "種別"), map: MODE_MAP }, { prop: "ntd_id", label: l3("NTD 業者代碼", "NTD operator ID", "NTD 事業者コード"), kind: "code" }, { prop: "gtfs_date", label: l3("GTFS 下載日", "GTFS download date", "GTFS 取得日"), kind: "code" }, ...A],
      legendNotes: [pr
        ? l3("National Transit Map 彙整各業者 GTFS：5,550 站（Tren Urbano 16、渡輪 6）；z7 起顯示", "National Transit Map aggregates operators' GTFS: 5,550 stops (Tren Urbano 16, ferry 6); shown from z7", "National Transit Map が事業者 GTFS を集約：5,550 停留所（Tren Urbano 16・フェリー 6）。z7 以上")
        : l3("關島 GRTA 公車 124 站（靜態 GTFS，站名可能與現況不符）", "Guam GRTA bus, 124 stops (static GTFS; names may be outdated)", "グアム GRTA バス 124 停留所（静的 GTFS、名称が古い可能性）")],
      popupNotes: [NEAREST], sourceOrg: l3("U.S. DOT BTS，National Transit Map Stops（NTAD）", "U.S. DOT BTS, National Transit Map Stops (NTAD)", "U.S. DOT BTS、National Transit Map Stops（NTAD）"),
      sourceUrl: "https://geodata.bts.gov/datasets/usdot::national-transit-map-stops", license: PD, fetchedAt: UST_FETCHED_AT,
      sourceNotes: pr ? [l3("ATI 官方 GTFS 未另做：NTM 中 ATI／AMA 合併 feed 1,431 站，與 ATI 站數相近，未逐站比對", "ATI's own GTFS not processed separately: the combined ATI / AMA feed in NTM has 1,431 stops, close to ATI's count; not compared stop by stop", "ATI 公式 GTFS は別途処理せず：NTM 内の ATI／AMA 統合フィード 1,431 停留所で ATI とほぼ同数。個別照合はしていない")] : [],
      loading: loading(cc, "大眾運輸站點", "transit stops", "公共交通の停留所"),
    },
    {
      key: key(cc, "TransportHubs"), file: `${cc}_transport_hubs.pmtiles`, sourceId: `${cc}-transport-hubs`, srcMinzoom: 6, srcMaxzoom: 14, color: "#38bdf8", count: pr ? 47 : 16,
      parts: [point(I.hubs, "hubs", 6, kindGetter)],
      cats: pr ? HUB_CATS.slice(0, 3) : HUB_CATS,
      title: { props: ["name"], fallback: l3("交通樞紐", "Transport hub", "交通拠点"), fallbackBy: { prop: "kind", map: HUB_KIND_MAP } },
      fields: [
        { prop: "kind", label: l3("類別", "Type", "種別"), map: HUB_KIND_MAP },
        { prop: "faa_id", label: l3("FAA 代碼", "FAA ID", "FAA コード"), kind: "code" }, { prop: "icao", label: l3("ICAO", "ICAO", "ICAO"), kind: "code" },
        { prop: "ownership", label: l3("所有權", "Ownership", "所有") }, { prop: "use", label: l3("用途", "Use", "用途") },
        ...(pr ? [{ prop: "tonnage_foreign", label: l3("國際貨運量", "Foreign tonnage", "外国貿易貨物量"), kind: "num" as const, unit: l3("短噸", "short tons", "ショートトン") }] : []),
        { prop: "source", label: l3("資料來源", "Source", "出典"), map: HUB_SOURCE_MAP }, ...A,
      ],
      legendNotes: [pr
        ? l3("FAA 機場 17、直升機場 27；USACE 主要港口 3（JP SIGE 港口層本機連線逾時，未納入）", "FAA: 17 airports, 27 heliports; USACE principal ports: 3 (JP SIGE port layer timed out locally, not included)", "FAA：空港 17・ヘリポート 27。USACE 主要港湾 3（JP SIGE の港湾レイヤは接続タイムアウトで未収録）")
        : l3("FAA 機場 3；GovGuamGIS Ng911 港口、遊艇港、下水坡道、直升機場 13（授權未明示）", "FAA: 3 airports; GovGuamGIS Ng911 ports, marinas, boat ramps, heliport: 13 (license not stated)", "FAA 空港 3。GovGuamGIS Ng911 の港・マリーナ・斜路・ヘリポート 13（ライセンス未明示）")],
      popupNotes: [NEAREST],
      sourceOrg: pr ? l3("FAA NASR（NTAD Aviation Facilities）；USACE Principal Ports", "FAA NASR (NTAD Aviation Facilities); USACE Principal Ports", "FAA NASR（NTAD Aviation Facilities）、USACE Principal Ports")
        : l3("FAA NASR（NTAD Aviation Facilities）；GovGuamGIS Ng_911 PtsOfInterest", "FAA NASR (NTAD Aviation Facilities); GovGuamGIS Ng_911 PtsOfInterest", "FAA NASR（NTAD Aviation Facilities）、GovGuamGIS Ng_911 PtsOfInterest"),
      sourceUrl: "https://geodata.bts.gov/datasets/usdot::aviation-facilities", license: pr ? PD : l3("FAA 公有領域；GovGuamGIS 授權未明示", "FAA public domain; GovGuamGIS license not stated", "FAA はパブリックドメイン、GovGuamGIS はライセンス未明示"), fetchedAt: UST_FETCHED_AT,
      loading: loading(cc, "交通樞紐", "transport hubs", "交通拠点"),
    },
    {
      key: key(cc, "MajorRoads"), file: `${cc}_major_roads.pmtiles`, sourceId: `${cc}-major-roads`, srcMinzoom: 6, srcMaxzoom: 13, color: "#facc15", count: pr ? 9701 : 347,
      parts: [{ id: I.roads, sourceLayer: "roads", geom: "line", minzoom: 6, cat: propGetter("road_class"), lineWidth: ROAD_W }],
      cats: pr ? ROAD_CATS_PR : ROAD_CATS_GU,
      title: { props: ["route", "name"], fallback: l3("主要道路", "Major road", "主要道路") },
      fields: [
        { prop: "name", label: l3("路名", "Name", "名称"), unlessSameAs: "route" },
        { prop: "road_class", label: l3("等級", "Class", "等級"), map: Object.fromEntries((pr ? ROAD_CATS_PR : ROAD_CATS_GU).map((c) => [c.id, c.label])) },
        { prop: "aadt", label: l3("年平均日交通量", "AADT", "年平均日交通量"), kind: "num", unit: l3("輛／日", "veh/day", "台／日") }, { prop: "aadt_year", label: l3("交通量年份", "AADT year", "交通量の年"), kind: "year" },
        { prop: "lanes", label: l3("車道數", "Lanes", "車線数"), kind: "num" }, ...A,
      ],
      legendNotes: [pr
        ? l3("FHWA 國道系統（NHS）9,598 段＋Tren Urbano 103 段（OSM）", "FHWA National Highway System: 9,598 segments + Tren Urbano 103 (OSM)", "FHWA 国道システム（NHS）9,598 区間＋Tren Urbano 103（OSM）")
        : l3("Census TIGER/Line 2026 主要道路 347 段（關島沒有 S1100 一級道路）", "Census TIGER/Line 2026 main roads: 347 segments (Guam has no S1100 primary roads)", "Census TIGER/Line 2026 主要道路 347 区間（グアムに S1100 一級道路はない）")],
      popupNotes: [NEAREST],
      sourceOrg: pr ? l3("FHWA National Highway System（NTAD）；Tren Urbano © OpenStreetMap contributors（ODbL）", "FHWA National Highway System (NTAD); Tren Urbano © OpenStreetMap contributors (ODbL)", "FHWA National Highway System（NTAD）、Tren Urbano © OpenStreetMap contributors（ODbL）")
        : l3("U.S. Census Bureau，TIGER/Line 2026 Roads", "U.S. Census Bureau, TIGER/Line 2026 Roads", "U.S. Census Bureau、TIGER/Line 2026 Roads"),
      sourceUrl: pr ? "https://geodata.bts.gov/datasets/usdot::national-highway-system-nhs" : "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html",
      license: pr ? l3("公有領域；Tren Urbano ODbL 1.0", "Public domain; Tren Urbano ODbL 1.0", "パブリックドメイン、Tren Urbano は ODbL 1.0") : PD, fetchedAt: UST_FETCHED_AT,
      loading: loading(cc, "主要道路", "major roads", "主要道路"),
    },
    {
      key: key(cc, "PowerPlants"), file: `${cc}_power_plants.pmtiles`, sourceId: `${cc}-power-plants`, srcMinzoom: 6, srcMaxzoom: 14, color: "#F2622E", count: pr ? 48 : 18,
      parts: [
        point(I.plantsC, "plants", 6, propGetter("fuel_class"), { filter: PT }),
        { id: I.plantsF, sourceLayer: "plants", geom: "fill", minzoom: 6, cat: propGetter("fuel_class"), filter: POLY, fillOpacity: 0.6, lowZoomHalo: { maxzoom: 11 } },
      ],
      cats: pr ? PLANT_CATS.slice(0, 7) : [PLANT_CATS[0]!, PLANT_CATS[3]!, PLANT_CATS[7]!],
      title: { props: ["name"], fallback: l3("電廠", "Power plant", "発電所") },
      fields: [
        { prop: "fuel_class", label: l3("燃料", "Fuel", "燃料"), map: PLANT_FUEL_MAP }, { prop: "plant_type", label: l3("機組類型（原文）", "Prime mover (source text)", "原動機種別（原文）") },
        { prop: "operator", label: l3("營運者", "Operator", "事業者") }, { prop: "source", label: l3("資料來源", "Source", "出典"), map: PLANT_SOURCE_MAP }, ...A,
      ],
      legendNotes: [pr
        ? l3("HIFLD 存檔 48 座；裝置容量為缺值（-999999），不畫大小、不補 0。JP SIGE 官方電廠層（有 MW）本機連線逾時，改用 HIFLD", "HIFLD archive: 48 plants; capacity missing (-999999), not sized and not zero. JP SIGE's official plant layer (with MW) timed out locally; HIFLD used instead", "HIFLD アーカイブ 48 か所。設備容量は欠損（-999999）でサイズに反映せず 0 にもしない。JP SIGE 公式レイヤ（MW あり）は接続タイムアウトのため HIFLD で代替")
        : l3("HIFLD 存檔 12 座為主（燃料未標）、Overture 補 6 處（與 HIFLD 相距 <1 km 視為同廠剔除）；關島電力局名冊未公開", "Mainly 12 from the HIFLD archive (fuel not stated), plus 6 from Overture (within 1 km of HIFLD treated as duplicates and dropped); GPA's own list is not public", "HIFLD アーカイブ 12 か所（燃料不明）が主、Overture で 6 か所補完（HIFLD から 1 km 未満は同一として除外）。GPA の一覧は非公開")],
      popupNotes: [NEAREST], sourceOrg: pr ? HIFLD : l3("HIFLD 存檔 2025-08；Overture Maps 2026-11-18.0（OSM 衍生）", "HIFLD archive 2025-08; Overture Maps 2026-11-18.0 (OSM-derived)", "HIFLD アーカイブ 2025-08、Overture Maps 2026-11-18.0（OSM 派生）"),
      sourceUrl: "https://source.coop/seerai/hifld", license: pr ? "CC BY 4.0" : l3("逐列：HIFLD 存檔 CC BY 4.0／Overture ODbL 1.0", "Per record: HIFLD archive CC BY 4.0 / Overture ODbL 1.0", "レコード別：HIFLD アーカイブ CC BY 4.0／Overture ODbL 1.0"), fetchedAt: UST_FETCHED_AT,
      sourceNotes: [l3("HIFLD 公開站 2025-08 下架，使用第三方鏡像存檔，之後不會更新", "HIFLD's public site was retired in 2025-08; a third-party mirror is used and will not be updated", "HIFLD 公開サイトは 2025-08 に終了。第三者ミラーを使用し今後更新されない")],
      loading: loading(cc, "電廠", "power plants", "発電所"),
    },
    {
      key: key(cc, "PowerGrid"), file: `${cc}_power_grid.pmtiles`, sourceId: `${cc}-power-grid`, srcMinzoom: 6, srcMaxzoom: 14, color: "#62D9AD", count: pr ? 819 : 4309,
      parts: [
        { id: I.lines, sourceLayer: "lines", geom: "line", minzoom: 6, cat: propGetter("kv_class"), lineWidth: KV_W, ...(pr ? {} : { filter: ["!=", ["get", "underground"], "yes"] }) },
        ...(pr ? [] : [{ id: "gu-power-lines-ug-line", sourceLayer: "lines", geom: "line" as const, minzoom: 6, cat: propGetter("kv_class"), lineWidth: KV_W, filter: ["==", ["get", "underground"], "yes"], dashed: true }]),
        point(I.subsC, "substations", 7, propGetter("kv_class"), { small: true, filter: PT }),
        { id: I.subsF, sourceLayer: "substations", geom: "fill", minzoom: 6, cat: propGetter("kv_class"), filter: POLY, fillOpacity: 0.6, lowZoomHalo: { maxzoom: 11 } },
      ],
      cats: pr ? KV_CATS.filter((c) => c.id !== "kv_low") : KV_CATS.filter((c) => c.id !== "kv230" && c.id !== "kv_low"),
      ...(pr ? {} : { dashLabel: l3("地下電纜（電壓未標）", "Underground cable (voltage not stated)", "地中ケーブル（電圧不明）") }),
      title: { props: ["name"], fallback: l3("電力設施", "Power facility", "電力設備") },
      fields: [
        { prop: "voltage_kv", label: l3("電壓", "Voltage", "電圧"), kind: "num", unit: "kV", digits: 1 }, { prop: "voltage_text", label: l3("電壓（原文）", "Voltage (source text)", "電圧（原文）"), kind: "code" },
        { prop: "owner", label: l3("所有者", "Owner", "所有者") }, { prop: "operator", label: l3("營運者", "Operator", "事業者") },
        { prop: "source", label: l3("資料來源", "Source", "出典"), map: { hifld_archive: HIFLD, osm: OSM, govguamgis_gpa: GOVGUAM } }, ...A,
      ],
      legendNotes: [pr
        ? l3("輸電線 268 段（HIFLD 存檔）、變電所 551 處（OSM，非官方；JP SIGE 官方變電所層連線逾時）", "268 transmission segments (HIFLD archive), 551 substations (OSM, unofficial; JP SIGE's official layer timed out)", "送電線 268 区間（HIFLD アーカイブ）、変電所 551（OSM・非公式。JP SIGE 公式レイヤは接続タイムアウト）")
        : l3("關島電力局 GPA：架空線 3,776 段、地下電纜 480 段（虛線）、變電所 53 處；明標 FOUO 的照明層不收", "Guam Power Authority: 3,776 overhead segments, 480 underground (dashed), 53 substations; the lighting layer marked FOUO is excluded", "グアム電力公社 GPA：架空線 3,776・地中 480（破線）・変電所 53。FOUO 表示の照明レイヤは除外")],
      popupNotes: [NEAREST],
      sourceOrg: pr ? l3("HIFLD 存檔 Transmission Lines；變電所 © OpenStreetMap contributors（ODbL），via Geofabrik", "HIFLD archive Transmission Lines; substations © OpenStreetMap contributors (ODbL), via Geofabrik", "HIFLD アーカイブ Transmission Lines、変電所は © OpenStreetMap contributors（ODbL）、Geofabrik 経由") : GOVGUAM,
      sourceUrl: pr ? "https://source.coop/seerai/hifld" : "https://services2.arcgis.com/FPJlJZYRsD8OhCWA/ArcGIS/rest/services/Hazard_Mitigation_GPA/FeatureServer",
      license: pr ? l3("逐列：HIFLD 存檔 CC BY 4.0／OSM ODbL 1.0", "Per record: HIFLD archive CC BY 4.0 / OSM ODbL 1.0", "レコード別：HIFLD アーカイブ CC BY 4.0／OSM ODbL 1.0") : UNSTATED, fetchedAt: UST_FETCHED_AT,
      sourceNotes: pr ? [] : [UST_DECISION_NOTE],
      loading: loading(cc, "電網", "power grid", "電力網"),
    },
    {
      key: key(cc, "Renewables"), file: `${cc}_renewables.pmtiles`, sourceId: `${cc}-renewables`, srcMinzoom: 6, srcMaxzoom: 14, color: "#F2E085", count: pr ? 111 : 84,
      parts: [
        point(I.renewC, "generators", 6, propGetter("energy"), { filter: PT }),
        { id: I.renewF, sourceLayer: "generators", geom: "fill", minzoom: 6, cat: propGetter("energy"), filter: POLY, fillOpacity: 0.7, lowZoomHalo: { maxzoom: 11 } },
      ],
      cats: RENEW_CATS,
      title: { props: ["name"], fallback: l3("再生能源", "Renewables", "再生可能エネルギー"), fallbackBy: { prop: "kind", map: RENEW_KIND_MAP } },
      fields: [
        { prop: "kind", label: l3("類型", "Type", "種別"), map: RENEW_KIND_MAP }, { prop: "capacity_kw", label: l3("單機容量", "Turbine capacity", "単機容量"), kind: "num", unit: "kW" },
        { prop: "hub_height_m", label: l3("輪轂高度", "Hub height", "ハブ高"), kind: "num", unit: "m" }, { prop: "manufacturer", label: l3("製造商", "Manufacturer", "メーカー") },
        { prop: "operator", label: l3("營運者", "Operator", "事業者") }, ...A,
      ],
      legendNotes: [pr
        ? l3("風機 63 座（USGS USWTDB，公有領域）＋太陽能發電場 48 處（OSM，非官方）", "63 wind turbines (USGS USWTDB, public domain) + 48 solar farms (OSM, unofficial)", "風車 63 基（USGS USWTDB、パブリックドメイン）＋太陽光発電所 48（OSM・非公式）")
        : l3("太陽能 83 處（Overture，多為屋頂與地面板陣，非官方）＋風機 1 座（USWTDB）", "83 solar sites (Overture, mostly rooftop / ground arrays, unofficial) + 1 wind turbine (USWTDB)", "太陽光 83（Overture、主に屋根・地上アレイ、非公式）＋風車 1（USWTDB）")],
      popupNotes: [NEAREST],
      sourceOrg: pr ? l3("USGS U.S. Wind Turbine Database；© OpenStreetMap contributors（ODbL），via Geofabrik", "USGS U.S. Wind Turbine Database; © OpenStreetMap contributors (ODbL), via Geofabrik", "USGS U.S. Wind Turbine Database、© OpenStreetMap contributors（ODbL）、Geofabrik 経由")
        : l3("USGS U.S. Wind Turbine Database；Overture Maps 2026-11-18.0", "USGS U.S. Wind Turbine Database; Overture Maps 2026-11-18.0", "USGS U.S. Wind Turbine Database、Overture Maps 2026-11-18.0"),
      sourceUrl: "https://energy.usgs.gov/uswtdb/", license: l3("逐列：USWTDB 公有領域／OSM ODbL 1.0", "Per record: USWTDB public domain / OSM ODbL 1.0", "レコード別：USWTDB パブリックドメイン／OSM ODbL 1.0"), fetchedAt: UST_FETCHED_AT,
      loading: loading(cc, "再生能源", "renewables", "再生可能エネルギー"),
    },
    {
      key: key(cc, "FuelStations"), file: `${cc}_fuel_stations.pmtiles`, sourceId: `${cc}-fuel-stations`, srcMinzoom: 7, srcMaxzoom: 14, color: "#a78bfa", count: pr ? 919 : 46,
      parts: [point(I.fuel, "stations", 7, propGetter("brand"))],
      cats: brandCats(cc), otherColor: "#94a3b8", otherLabel: l3("其他品牌、未標品牌", "Other / unbranded", "その他・ブランド不明"),
      title: { props: ["name", "brand"], fallback: l3("加油站", "Fuel station", "ガソリンスタンド") },
      fields: [{ prop: "brand", label: l3("品牌", "Brand", "ブランド") }, { prop: "operator", label: l3("營運者", "Operator", "事業者") }, ...A],
      legendNotes: [pr
        ? l3("OSM 加油站 919 處（非官方，完整度不均）", "919 OSM fuel stations (unofficial, uneven completeness)", "OSM ガソリンスタンド 919（非公式、網羅性にばらつき）")
        : l3("Overture 加油站 46 處（非官方）", "46 Overture fuel stations (unofficial)", "Overture ガソリンスタンド 46（非公式）")],
      popupNotes: [NEAREST], sourceOrg: pr ? OSM : OVERTURE, sourceUrl: pr ? "https://download.geofabrik.de/north-america/us/puerto-rico.html" : "https://overturemaps.org/",
      license: pr ? "ODbL 1.0" : "CDLA-Permissive-2.0", fetchedAt: UST_FETCHED_AT,
      loading: loading(cc, "加油站", "fuel stations", "ガソリンスタンド"),
    },
    {
      key: key(cc, "Petroleum"), file: `${cc}_petroleum.pmtiles`, sourceId: `${cc}-petroleum`, srcMinzoom: 6, srcMaxzoom: 14, color: "#f97316", count: pr ? 4 : 199,
      parts: [
        point(I.petroC, "facilities", 6, kindGetter, { filter: PT }),
        ...(pr ? [] : [
          { id: "gu-petroleum-fill", sourceLayer: "facilities", geom: "fill" as const, minzoom: 6, cat: kindGetter, filter: POLY, fillOpacity: 0.6, lowZoomHalo: { maxzoom: 12 } },
          { id: "gu-petroleum-pipelines-line", sourceLayer: "pipelines", geom: "line" as const, minzoom: 6, cat: kindGetter, lineWidth: { pipeline: [0.8, 1.6] as const } },
        ]),
      ],
      cats: pr ? PETRO_CATS.slice(0, 1) : PETRO_CATS,
      title: { props: ["name"], fallback: l3("油氣設施", "Oil & gas facility", "石油・ガス施設"), fallbackBy: { prop: "kind", map: PETRO_KIND_MAP } },
      fields: [{ prop: "kind", label: l3("類型", "Type", "種別"), map: PETRO_KIND_MAP }, { prop: "content", label: l3("內容物", "Contents", "内容物") }, { prop: "operator", label: l3("營運者", "Operator", "事業者") }, ...A],
      legendNotes: [pr
        ? l3("聯邦名冊只有 4 個油品儲運站；煉油廠、LNG 接收站（EcoEléctrica 實際存在）不在名冊", "Federal lists hold only 4 product terminals; refineries and the LNG terminal (EcoEléctrica does exist) are not listed", "連邦リストは製品ターミナル 4 か所のみ。製油所・LNG 受入基地（EcoEléctrica は実在）は未掲載")
        : l3("HIFLD 油品儲運站 1；儲槽 150、管線 48 為 OSM 登記（非官方，內容物多未標）", "1 HIFLD product terminal; 150 tanks and 48 pipelines from OSM (unofficial, contents mostly untagged)", "HIFLD 製品ターミナル 1。貯槽 150・パイプライン 48 は OSM（非公式、内容物ほぼ未記載）")],
      popupNotes: [NEAREST], sourceOrg: pr ? HIFLD : l3("HIFLD 存檔 2025-08；Overture Maps 2026-11-18.0（OSM 衍生）", "HIFLD archive 2025-08; Overture Maps 2026-11-18.0 (OSM-derived)", "HIFLD アーカイブ 2025-08、Overture Maps 2026-11-18.0（OSM 派生）"),
      sourceUrl: "https://source.coop/seerai/hifld", license: pr ? "CC BY 4.0" : l3("逐列：HIFLD 存檔 CC BY 4.0／Overture ODbL 1.0", "Per record: HIFLD archive CC BY 4.0 / Overture ODbL 1.0", "レコード別：HIFLD アーカイブ CC BY 4.0／Overture ODbL 1.0"), fetchedAt: UST_FETCHED_AT,
      loading: loading(cc, "油氣設施", "oil & gas facilities", "石油・ガス施設"),
    },
  ];
}

const zhOf = (t: string | L3 | undefined) => (t == null ? "" : typeof t === "string" ? t : t.zh);
const GOVGUAM_NOTE = l3("含 GovGuamGIS 資料，授權未明示", "Includes GovGuamGIS data; license not stated", "GovGuamGIS のデータを含む。ライセンス未明示");
const HIFLD_NOTE = l3("含 HIFLD 存檔 2025-08 資料", "Includes HIFLD archive 2025-08 data", "HIFLD アーカイブ 2025-08 のデータを含む");
/** 盤點 §4 授權規則：GovGuamGIS 圖例註明「授權未明示」、HIFLD 存檔圖例寫「HIFLD 存檔 2025-08」（規格本身已寫的不重複）。 */
function withLicenseNotes(spec: UstLayerSpec): UstLayerSpec {
  const src = zhOf(spec.sourceOrg) + " " + zhOf(spec.license);
  const said = spec.legendNotes.map((n) => n.zh).join(" ");
  const extra: L3[] = [];
  if (src.includes("GovGuamGIS") && !said.includes("授權未明示")) extra.push(GOVGUAM_NOTE);
  if (src.includes("HIFLD") && !said.includes("HIFLD 存檔 2025-08")) extra.push(HIFLD_NOTE);
  return extra.length ? { ...spec, legendNotes: [...spec.legendNotes, ...extra] } : spec;
}

export const UST_DATA_SPECS: readonly UstLayerSpec[] = [...specsFor("pr"), ...specsFor("gu")].map(withLicenseNotes);
export const UST_SPEC_BY_KEY = Object.fromEntries(UST_DATA_SPECS.map((s) => [s.key, s])) as Readonly<Record<UstDataKey, UstLayerSpec>>;

// ═════════════════════════ 圖層來源表（「說明・來源」） ═════════════════════════

const st = (t: string | L3) => (typeof t === "string" ? t : { "zh-TW": t.zh, en: t.en, ja: t.ja });
const srcRow = (org: string | L3, license: string | L3, url: string, notes?: readonly L3[]): LayerSourceInfo => ({
  org: st(org), license: st(license), url, asOf: UST_FETCHED_AT, ...(notes?.length ? { notes: notes.map((n) => st(n) as never) } : {}), from: "popup",
});
const CB = l3("U.S. Census Bureau，Cartographic Boundary Files 2024（500k）", "U.S. Census Bureau, Cartographic Boundary Files 2024 (500k)", "U.S. Census Bureau、Cartographic Boundary Files 2024（500k）");
const CB_URL = "https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html";
export const UST_AREA_SOURCE: Record<UstAreaKey, { org: L3; license: L3; url: string; notes: readonly L3[] }> = {
  prAdminBoundaries: { org: CB, license: PD, url: CB_URL, notes: UST_ADMIN_NOTES.pr },
  guAdminBoundaries: { org: CB, license: PD, url: CB_URL, notes: UST_ADMIN_NOTES.gu },
  prPopulation: { org: l3("U.S. Census Bureau，ACS 2020–2024 五年估計 B01003（PRCS）；邊界 Census 製圖邊界 2024", "U.S. Census Bureau, ACS 2020–2024 5-year B01003 (PRCS); boundaries Census cartographic 2024", "U.S. Census Bureau、ACS 2020–2024 年 5 年推計 B01003（PRCS）。境界は Census 地図用境界 2024"), license: PD, url: "https://www.census.gov/programs-surveys/acs", notes: UST_POP_NOTES.pr },
  guPopulation: { org: l3("GovGuamGIS 2020 Census 區塊群人口住宅表；邊界 Census 製圖邊界 2024", "GovGuamGIS 2020 Census block-group population & housing table; boundaries Census cartographic 2024", "GovGuamGIS 2020 年国勢調査ブロックグループ人口住宅表。境界は Census 地図用境界 2024"), license: UNSTATED, url: "https://services2.arcgis.com/FPJlJZYRsD8OhCWA/ArcGIS/rest/services", notes: [...UST_POP_NOTES.gu, UST_DECISION_NOTE] },
};
/** 美國屬地 20 層來源表；layerSourceInfo.data.ts 展開進總表。 */
export const UST_SOURCE_INFO: Record<string, LayerSourceInfo> = {
  ...Object.fromEntries(Object.entries(UST_AREA_SOURCE).map(([k, v]) => [k, srcRow(v.org, v.license, v.url, v.notes)])),
  ...Object.fromEntries(UST_DATA_SPECS.map((sp) => [sp.key, srcRow(sp.sourceOrg, sp.license, sp.sourceUrl, [...sp.legendNotes, ...(sp.sourceNotes ?? [])])])),
};
