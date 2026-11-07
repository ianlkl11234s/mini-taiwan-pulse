/**
 * 中研院人社中心 GIS 專題中心「臺灣百年歷史地圖」WMTS（GoogleMapsCompatible，可直接當 XYZ）。
 * 外部圖磚直連、已烘好的掃描圖，沒有 feature 可點。授權 CC BY-NC。
 *
 * 六個公開圖層（歷史底圖主題）各自一份清單：清單順序＝select 選項順序＝encode 索引。
 * 共用同一支 hook（useHistoricalMapLayer），層名／副檔名／bounds 取自 Capabilities
 * （測試 historicalMapPublic.test.ts 對照 __fixtures__/historicalWmtsLayers.csv）。
 * 沒接的層：Sunriver_50K_N_2017（2017 商業地圖，伺服器回固定圖）。
 */
export type HistoricalMapGroupKey =
  | "historicalMapSinica" | "historicalMapPostwar" | "historicalImagery"
  | "historicalBoundaries" | "historicalLandUse" | "historicalThematic";

export type HistoricalMapLocale = "zh-TW" | "en" | "ja";

/** 三語標籤（圖例標題與 select 選項都從這裡取） */
export interface HistoricalMapText { zh: string; en: string; ja: string }

export interface HistoricalMapEra {
  /** select 選項值（URL／參數存這個字串；舊值 jm20k-1904 等保留） */
  value: string;
  /** WMTS 層名 */
  layer: string;
  ext: "jpg" | "png";
  label: HistoricalMapText;
  /** 局部涵蓋說明（北部、山區、縣市…）；圖例標題與選單選項都會加在後面 */
  scope?: HistoricalMapText;
  /** [west, south, east, north]；WMTS Capabilities 宣告的範圍，預設範圍（全台）不設 */
  bounds?: [number, number, number, number];
}

export interface HistoricalMapGroup {
  key: HistoricalMapGroupKey;
  /** 疊加層（透明 PNG）：永遠在不透明歷史圖層之上 */
  overlay: boolean;
  defaultOpacity: number;
  defaultValue: string;
  name: HistoricalMapText;
  eras: readonly [HistoricalMapEra, ...HistoricalMapEra[]];
}

export const HISTORICAL_MAP_GROUPS: readonly HistoricalMapGroup[] = [
  {
    key: "historicalMapSinica", overlay: false, defaultOpacity: 0.85, defaultValue: "jm20k-1904",
    name: { zh: "古地圖（清末至日治）", en: "Historical Maps (Qing to Japanese Era)", ja: "古地図（清末〜日本統治期）" },
    eras: [
    { value: "jmwar-1895", layer: "JMWar_1895", ext: "png", label: { zh: "1895 日軍攻台戰鬥地圖", en: "1895 Japanese invasion battle map", ja: "1895 日本軍台湾侵攻戦闘地図" }, scope: { zh: "北部", en: "Northern Taiwan", ja: "北部" }, bounds: [118.79899651, 21.21543381, 122.94979345, 26.08890834] },
    { value: "jm200k-1897", layer: "JM200K_1897", ext: "png", label: { zh: "1897 二十萬分一臺灣地圖", en: "1897 Taiwan map 1:200,000", ja: "1897 台湾20万分1図" } },
    { value: "jm200k-1897-new", layer: "JM200K_1897_new", ext: "png", label: { zh: "1897 二十萬分一臺灣地圖（修正版）", en: "1897 Taiwan map 1:200,000 (revised)", ja: "1897 台湾20万分1図（修正版）" }, bounds: [118.99405956, 21.32295872, 122.0398151, 25.31253696] },
    { value: "jm400k-1899", layer: "JM400K_1899", ext: "png", label: { zh: "1899 四十萬分一臺灣地圖", en: "1899 Taiwan map 1:400,000", ja: "1899 台湾40万分1図" } },
    { value: "jm20k-1904", layer: "JM20K_1904", ext: "jpg", label: { zh: "1904 臺灣堡圖（明治版）", en: "1904 Taiwan Fort Map (Meiji)", ja: "1904 台湾堡図（明治版）" } },
    { value: "jm100k-1905", layer: "JM100K_1905", ext: "png", label: { zh: "1905 十萬分一臺灣地形圖", en: "1905 Taiwan topographic map 1:100,000", ja: "1905 台湾10万分1地形図" } },
    { value: "jm50k-1916", layer: "JM50K_1916", ext: "jpg", label: { zh: "1916 五萬分一臺灣地形圖", en: "1916 Taiwan topographic map 1:50,000", ja: "1916 台湾5万分1地形図" }, scope: { zh: "山區", en: "Mountain areas", ja: "山間部" } },
    { value: "jm50k-1920", layer: "JM50K_1920", ext: "png", label: { zh: "1920 五萬分一臺灣地形圖", en: "1920 Taiwan topographic map 1:50,000", ja: "1920 台湾5万分1地形図" } },
    { value: "jm20k-1921", layer: "JM20K_1921", ext: "jpg", label: { zh: "1921 臺灣堡圖（大正版）", en: "1921 Taiwan Fort Map (Taisho)", ja: "1921 台湾堡図（大正版）" } },
    { value: "jm25k-1921", layer: "JM25K_1921", ext: "png", label: { zh: "1921 二萬五千分一臺灣地形圖", en: "1921 Taiwan topographic map 1:25,000", ja: "1921 台湾2万5千分1地形図" } },
    { value: "jm300k-1924", layer: "JM300K_1924", ext: "png", label: { zh: "1924 三十萬分一臺灣地圖", en: "1924 Taiwan map 1:300,000", ja: "1924 台湾30万分1図" }, bounds: [119.1325821, 21.7151907, 122.1868776, 25.5403769] },
    { value: "jm50k-1924", layer: "JM50K_1924", ext: "jpg", label: { zh: "1924 五萬分一臺灣地形圖", en: "1924 Taiwan topographic map 1:50,000", ja: "1924 台湾5万分1地形図" } },
    { value: "jm50k-1924-new", layer: "JM50K_1924_new", ext: "png", label: { zh: "1924 五萬分一臺灣地形圖（修正版）", en: "1924 Taiwan topographic map 1:50,000 (revised)", ja: "1924 台湾5万分1地形図（修正版）" } },
    { value: "jm200k-1932", layer: "JM200K_1932", ext: "png", label: { zh: "1932 二十萬分一臺灣地圖", en: "1932 Taiwan map 1:200,000", ja: "1932 台湾20万分1図" } },
    { value: "yushan-50k-1933", layer: "Yushan_50K_1933", ext: "png", label: { zh: "1933 新高登山地圖 五萬分一", en: "1933 Niitaka (Yushan) mountaineering map 1:50,000", ja: "1933 新高登山地図 5万分1" }, scope: { zh: "玉山", en: "Yushan area", ja: "玉山周辺" }, bounds: [120.71229, 23.38214, 121.10499, 23.65096] },
    { value: "jm300k-1934", layer: "JM300K_1934", ext: "jpg", label: { zh: "1934 三十萬分一臺灣地圖", en: "1934 Taiwan map 1:300,000", ja: "1934 台湾30万分1図" } },
    { value: "jm500k-1936", layer: "JM500K_1936", ext: "png", label: { zh: "1936 五十萬分一臺灣地圖", en: "1936 Taiwan map 1:500,000", ja: "1936 台湾50万分1図" } },
    { value: "jm300k-1939", layer: "JM300K_1939", ext: "png", label: { zh: "1939 三十萬分一臺灣地圖", en: "1939 Taiwan map 1:300,000", ja: "1939 台湾30万分1図" } },
    { value: "jm25k-1942", layer: "JM25K_1942", ext: "png", label: { zh: "1942 二萬五千分一地形圖（昭和修正版）", en: "1942 Taiwan topographic map 1:25,000 (Showa revision)", ja: "1942 台湾2万5千分1地形図（昭和修正版）" }, scope: { zh: "高雄周邊", en: "Kaohsiung area", ja: "高雄周辺" }, bounds: [120.02013144, 22.27231389, 120.75321262, 22.95000985] },
    { value: "jm25k-1944", layer: "JM25K_1944", ext: "png", label: { zh: "1944 二萬五千分一臺灣地形圖", en: "1944 Taiwan topographic map 1:25,000", ja: "1944 台湾2万5千分1地形図" } },
    { value: "jm200k-1944", layer: "JM200K_1944", ext: "png", label: { zh: "1944 二十萬分一臺灣地圖", en: "1944 Taiwan map 1:200,000", ja: "1944 台湾20万分1図" }, bounds: [119.0078937, 21.331299, 123.0081935, 25.9985212] },
    { value: "am25k-1944a", layer: "AM25K_1944A", ext: "png", label: { zh: "1944 美軍地形圖", en: "1944 US Army topographic map", ja: "1944 米軍地形図" }, bounds: [119.2580245, 21.8315325, 122.1332848, 25.6648823] },
    { value: "am50k-1944", layer: "AM50K_1944", ext: "png", label: { zh: "1944 美軍五萬分一地形圖", en: "1944 US Army topographic map 1:50,000", ja: "1944 米軍5万分1地形図" } },
    { value: "ams250k-1944", layer: "AMS250K_1944", ext: "png", label: { zh: "1944 美軍二十五萬分一地形圖", en: "1944 US Army topographic map 1:250,000", ja: "1944 米軍25万分1地形図" }, bounds: [118.90262767, 19.88167794, 123.21454613, 26.04199673] },
    { value: "amcity-1945", layer: "AMCityPlan_1945", ext: "png", label: { zh: "1945 美軍城市地圖", en: "1945 US Army city plans", ja: "1945 米軍都市地図" } },
    ],
  },
  {
    key: "historicalMapPostwar", overlay: false, defaultOpacity: 0.85, defaultValue: "tm25k-1950",
    name: { zh: "戰後地形圖（1950–2003）", en: "Postwar Topographic Maps (1950–2003)", ja: "戦後地形図（1950〜2003）" },
    eras: [
    { value: "tm25k-1950", layer: "TM25K_1950", ext: "png", label: { zh: "1950 二萬五千分一臺灣地形圖", en: "1950 Taiwan topographic map 1:25,000", ja: "1950 台湾2万5千分1地形図" }, bounds: [119.2499087, 21.8333067, 122.1250768, 25.666769] },
    { value: "tm100k-1953", layer: "TM100K_1953", ext: "png", label: { zh: "1953 十萬分一臺灣地形圖", en: "1953 Taiwan topographic map 1:100,000", ja: "1953 台湾10万分1地形図" }, bounds: [119.1678814, 21.8826745, 122.0851541, 25.3075065] },
    { value: "tm50k-1954", layer: "TM50K_1954", ext: "png", label: { zh: "1954 五萬分一臺灣地形圖", en: "1954 Taiwan topographic map 1:50,000", ja: "1954 台湾5万分1地形図" }, bounds: [119.2998126, 21.8335493, 122.1668521, 25.5833777] },
    { value: "tm25k-1955", layer: "TM25K_1955", ext: "png", label: { zh: "1955 二萬五千分一臺灣地形圖", en: "1955 Taiwan topographic map 1:25,000", ja: "1955 台湾2万5千分1地形図" }, bounds: [119.2630987, 21.8184722, 122.1582605, 25.6655868] },
    { value: "tm50k-1956", layer: "TM50K_1956", ext: "jpg", label: { zh: "1956 五萬分一臺灣地形圖", en: "1956 Taiwan topographic map 1:50,000", ja: "1956 台湾5万分1地形図" } },
    { value: "tm300k-1959", layer: "TM300K_1959", ext: "png", label: { zh: "1959 三十萬分一臺灣地圖", en: "1959 Taiwan map 1:300,000", ja: "1959 台湾30万分1図" }, bounds: [119.2144695, 21.6765002, 122.1772158, 25.6905558] },
    { value: "tm5k-1962", layer: "TM5K_1962", ext: "png", label: { zh: "1962 五千分一臺灣地形圖", en: "1962 Taiwan topographic map 1:5,000", ja: "1962 台湾5千分1地形図" }, scope: { zh: "西海岸海埔地", en: "Western coastal reclaimed land", ja: "西海岸の干拓地" }, bounds: [119.981952, 23.0997438, 120.1900142, 23.645126] },
    { value: "tm250k-1963", layer: "TM250K_1963", ext: "png", label: { zh: "1963 二十五萬分一臺灣地圖", en: "1963 Taiwan map 1:250,000", ja: "1963 台湾25万分1図" }, bounds: [118.91549766, 21.85982524, 122.55531142, 25.98629048] },
    { value: "tm25k-1966", layer: "TM25K_1966", ext: "png", label: { zh: "1957–1969 二萬五千分一臺灣地形圖", en: "1957–1969 Taiwan topographic map 1:25,000", ja: "1957–1969 台湾2万5千分1地形図" }, bounds: [119.16211784009, 21.8184526, 122.1333275, 25.6656749] },
    { value: "tm500k-1966", layer: "TM500K_1966", ext: "png", label: { zh: "1966 五十萬分一臺灣地圖", en: "1966 Taiwan map 1:500,000", ja: "1966 台湾50万分1図" }, bounds: [119.9939108, 21.88002, 123.021175, 26.0019467] },
    { value: "tm10k-1970", layer: "TM10K_1970", ext: "png", label: { zh: "1970 一萬分一臺灣地形圖", en: "1970 Taiwan topographic map 1:10,000", ja: "1970 台湾1万分1地形図" }, scope: { zh: "北部", en: "Northern Taiwan", ja: "北部" }, bounds: [121.106649, 24.0960691, 121.9123905, 25.1987445] },
    { value: "tm250k-1973", layer: "TM250K_1973", ext: "png", label: { zh: "1973 二十五萬分一臺灣地圖", en: "1973 Taiwan map 1:250,000", ja: "1973 台湾25万分1図" }, bounds: [118.91549766, 21.85982524, 122.55531142, 25.98629048] },
    { value: "tm10k-1974", layer: "TM10K_1974", ext: "png", label: { zh: "1974 一萬分一臺灣地形圖", en: "1974 Taiwan topographic map 1:10,000", ja: "1974 台湾1万分1地形図" }, scope: { zh: "北部", en: "Northern Taiwan", ja: "北部" }, bounds: [121.0590422, 24.7941643, 121.5076214, 25.1503655] },
    { value: "tm500k-1978", layer: "TM500K_1978", ext: "png", label: { zh: "1978 五十萬分一臺灣地圖", en: "1978 Taiwan map 1:500,000", ja: "1978 台湾50万分1図" }, bounds: [119.259226122, 21.7654808322, 122.089344603, 25.3881445076] },
    { value: "tm100k-1984", layer: "TM100K_1984", ext: "png", label: { zh: "1984 十萬分一臺灣地形圖", en: "1984 Taiwan topographic map 1:100,000", ja: "1984 台湾10万分1地形図" }, bounds: [119.2538476, 21.8256457, 122.1152616, 25.3044774] },
    { value: "tm100k-1987", layer: "TM100K_1987", ext: "png", label: { zh: "1987 十萬分一臺灣地形圖", en: "1987 Taiwan topographic map 1:100,000", ja: "1987 台湾10万分1地形図" } },
    { value: "tm250k-1988", layer: "TM250K_1988", ext: "png", label: { zh: "1988 二十五萬分一臺灣地圖", en: "1988 Taiwan map 1:250,000", ja: "1988 台湾25万分1図" }, bounds: [119.3722152, 21.8384253, 122.0618345, 25.335036] },
    { value: "tm25k-1989", layer: "TM25K_1989", ext: "jpg", label: { zh: "1989 二萬五千分一臺灣地形圖", en: "1989 Taiwan topographic map 1:25,000", ja: "1989 台湾2万5千分1地形図" } },
    { value: "tm50k-1990", layer: "TM50K_1990", ext: "png", label: { zh: "1990 五萬分一臺灣地形圖", en: "1990 Taiwan topographic map 1:50,000", ja: "1990 台湾5万分1地形図" } },
    { value: "tm25k-1993", layer: "TM25K_1993", ext: "jpg", label: { zh: "1993 二萬五千分一臺灣地形圖", en: "1993 Taiwan topographic map 1:25,000", ja: "1993 台湾2万5千分1地形図" } },
    { value: "tm50k-1996", layer: "TM50K_1996", ext: "png", label: { zh: "1996 五萬分一臺灣地形圖", en: "1996 Taiwan topographic map 1:50,000", ja: "1996 台湾5万分1地形図" } },
    { value: "tm25k-2001", layer: "TM25K_2001", ext: "jpg", label: { zh: "2001 二萬五千分一臺灣地形圖", en: "2001 Taiwan topographic map 1:25,000", ja: "2001 台湾2万5千分1地形図" } },
    { value: "tm25k-2003", layer: "TM25K_2003", ext: "jpg", label: { zh: "2003 二萬五千分一臺灣地形圖", en: "2003 Taiwan topographic map 1:25,000", ja: "2003 台湾2万5千分1地形図" }, scope: { zh: "北部", en: "Northern Taiwan", ja: "北部" } },
    { value: "tm50k-2003", layer: "TM50K_2003", ext: "png", label: { zh: "2003 五萬分一臺灣地形圖", en: "2003 Taiwan topographic map 1:50,000", ja: "2003 台湾5万分1地形図" }, scope: { zh: "北部", en: "Northern Taiwan", ja: "北部" } },
    ],
  },
  {
    key: "historicalImagery", overlay: false, defaultOpacity: 0.85, defaultValue: "am25k-1944",
    name: { zh: "歷史航照與衛星影像", en: "Historical Aerial and Satellite Imagery", ja: "歴史的空中写真・衛星画像" },
    eras: [
    { value: "am25k-1944", layer: "AM25K_1944B", ext: "png", label: { zh: "1944 美軍航照", en: "1944 US military aerial photos", ja: "1944 米軍航空写真" }, bounds: [119.3828649, 21.8314946, 122.0082911, 25.3317016] },
    { value: "corona-1966", layer: "Taiwan_Corona_1966", ext: "png", label: { zh: "1966 Corona 衛星影像", en: "1966 Corona satellite imagery", ja: "1966 コロナ衛星画像" }, bounds: [119.2531638, 23.2255413, 122.3217775, 25.4716521] },
    { value: "taiwan-corona-1969", layer: "Taiwan_Corona_1969", ext: "png", label: { zh: "1969 Corona 衛星影像", en: "1969 Corona satellite imagery", ja: "1969 コロナ衛星画像" }, scope: { zh: "中北部", en: "Central and northern Taiwan", ja: "中北部" }, bounds: [120.2556117, 23.595197, 122.2372394, 25.4723892] },
    { value: "tm50k-2000a", layer: "TM50K_2000A", ext: "png", label: { zh: "2000 衛星影像地圖（A）", en: "2000 satellite image map (A)", ja: "2000 衛星画像地図（A）" }, scope: { zh: "921 災區", en: "1999 Chi-Chi earthquake area", ja: "921地震被災地" }, bounds: [120.5081628, 23.4974278, 121.2600578, 24.4987522] },
    { value: "tm50k-2000b", layer: "TM50K_2000B", ext: "png", label: { zh: "2000 衛星影像地形圖（B）", en: "2000 satellite image topographic map (B)", ja: "2000 衛星画像地形図（B）" }, scope: { zh: "921 災區", en: "1999 Chi-Chi earthquake area", ja: "921地震被災地" }, bounds: [120.508064, 23.4974816, 121.2601332, 24.4988446] },
    ],
  },
  {
    key: "historicalBoundaries", overlay: true, defaultOpacity: 1, defaultValue: "admin-1901a",
    name: { zh: "歷史界線與路網", en: "Historical Boundaries and Rail Network", ja: "歴史的境界・路線網" },
    eras: [
    { value: "admin-1901a", layer: "Admin_1901a", ext: "png", label: { zh: "1901 日治行政區：廳", en: "1901 Japanese-era districts: Cho", ja: "1901 日本統治期行政区：庁" } },
    { value: "admin-1901b", layer: "Admin_1901b", ext: "png", label: { zh: "1901 日治行政區：堡里", en: "1901 Japanese-era districts: Hori (townships)", ja: "1901 日本統治期行政区：堡里" } },
    { value: "admin-1901c", layer: "Admin_1901c", ext: "png", label: { zh: "1901 日治行政區：街庄", en: "1901 Japanese-era districts: Gai-sho (villages)", ja: "1901 日本統治期行政区：街庄" } },
    { value: "admin-1930a", layer: "Admin_1930a", ext: "png", label: { zh: "1930 日治行政區：州廳", en: "1930 Japanese-era districts: Shu and Cho", ja: "1930 日本統治期行政区：州庁" } },
    { value: "admin-1930b", layer: "Admin_1930b", ext: "png", label: { zh: "1930 日治行政區：郡市", en: "1930 Japanese-era districts: Gun and Shi", ja: "1930 日本統治期行政区：郡市" } },
    { value: "admin-1930c", layer: "Admin_1930c", ext: "png", label: { zh: "1930 日治行政區：街庄", en: "1930 Japanese-era districts: Gai-sho (villages)", ja: "1930 日本統治期行政区：街庄" } },
    { value: "abm", layer: "abm", ext: "png", label: { zh: "乾隆臺灣番界", en: "Qianlong-era aboriginal boundary", ja: "乾隆期台湾蕃界" } },
    { value: "tm150k-1953", layer: "TM150K_1953", ext: "png", label: { zh: "1953 臺糖鐵道網", en: "1953 Taiwan Sugar Corp. railway network", ja: "1953 台糖鉄道網" }, bounds: [119.85060301, 22.33224526, 121.15032016, 25.0798876] },
    ],
  },
  {
    key: "historicalLandUse", overlay: false, defaultOpacity: 0.85, defaultValue: "1956-landuse",
    name: { zh: "歷史土地利用", en: "Historical Land Use", ja: "歴史的土地利用" },
    eras: [
    { value: "1956-landuse", layer: "1956_Landuse", ext: "png", label: { zh: "1956 土地利用及林型圖", en: "1956 land use and forest type map", ja: "1956 土地利用・林型図" } },
    { value: "1956-landuse-250k-1", layer: "1956_Landuse_250K_1", ext: "png", label: { zh: "1956 土地利用及林型分類圖（25 萬分一）", en: "1956 land use and forest classification 1:250,000", ja: "1956 土地利用・林型分類図（25万分1）" }, bounds: [118.8549905, 20.9829132, 122.793139, 26.0289983] },
    { value: "1956-landuse-250k-2", layer: "1956_Landuse_250K_2", ext: "png", label: { zh: "1956 材積級與保育問題等級圖（25 萬分一）", en: "1956 timber volume and conservation grade map 1:250,000", ja: "1956 材積級・保全問題等級図（25万分1）" }, bounds: [118.8549905, 20.9829132, 122.793139, 26.0289983] },
    { value: "1959-landuse-windbreak-25k", layer: "1959_Landuse_windbreak_25K", ext: "png", label: { zh: "1959 海岸及耕地防風林狀況圖", en: "1959 coastal and farmland windbreak map", ja: "1959 海岸・耕地防風林状況図" }, bounds: [119.92607786, 21.81402485, 122.02866549, 25.35205167] },
    { value: "1974-landuse-250k", layer: "1974_Landuse_250K", ext: "png", label: { zh: "1974 山坡地土地利用現況圖", en: "1974 slopeland land use map", ja: "1974 山地斜面土地利用現況図" }, bounds: [119.3283612, 21.7983225, 122.1306051, 25.7001634] },
    { value: "1979-landuse-25k-changhua", layer: "1979_Landuse_25K_Changhua", ext: "png", label: { zh: "1979 土地灌溉利用圖", en: "1979 land and irrigation use map", ja: "1979 土地灌漑利用図" }, scope: { zh: "彰化縣", en: "Changhua County", ja: "彰化県" }, bounds: [120.24750575, 23.75080046, 120.75817603, 24.24576621] },
    { value: "1979-landuse-25k-hsinchu", layer: "1979_Landuse_25K_Hsinchu", ext: "png", label: { zh: "1979 土地灌溉利用圖", en: "1979 land and irrigation use map", ja: "1979 土地灌漑利用図" }, scope: { zh: "新竹縣", en: "Hsinchu County", ja: "新竹県" }, bounds: [120.88167281, 24.42108591, 121.50201241, 24.99746833] },
    { value: "1979-landuse-25k-hualien", layer: "1979_Landuse_25K_Hualien", ext: "png", label: { zh: "1979 土地灌溉利用圖", en: "1979 land and irrigation use map", ja: "1979 土地灌漑利用図" }, scope: { zh: "花蓮縣", en: "Hualien County", ja: "花蓮県" }, bounds: [120.90334164, 23.09323763, 121.85489573, 24.40942276] },
    { value: "1979-landuse-25k-miaoli", layer: "1979_Landuse_25K_Miaoli", ext: "png", label: { zh: "1979 土地灌溉利用圖", en: "1979 land and irrigation use map", ja: "1979 土地灌漑利用図" }, scope: { zh: "苗栗縣", en: "Miaoli County", ja: "苗栗県" }, bounds: [120.62057062, 24.25031554, 121.26030514, 24.74392263] },
    { value: "1979-landuse-25k-nantou", layer: "1979_Landuse_25K_Nantou", ext: "png", label: { zh: "1979 土地灌溉利用圖", en: "1979 land and irrigation use map", ja: "1979 土地灌漑利用図" }, scope: { zh: "南投縣", en: "Nantou County", ja: "南投県" }, bounds: [120.50851962, 23.4198829, 121.3861047, 24.2524198] },
    { value: "1979-landuse-25k-pingtung", layer: "1979_Landuse_25K_Pingtung", ext: "png", label: { zh: "1979 土地灌溉利用圖", en: "1979 land and irrigation use map", ja: "1979 土地灌漑利用図" }, scope: { zh: "屏東縣", en: "Pingtung County", ja: "屏東県" }, bounds: [120.38284921, 21.83305421, 121.00615092, 22.91174345] },
    { value: "1979-landuse-25k-taichung", layer: "1979_Landuse_25K_Taichung", ext: "png", label: { zh: "1979 土地灌溉利用圖", en: "1979 land and irrigation use map", ja: "1979 土地灌漑利用図" }, scope: { zh: "臺中縣市", en: "Taichung County and City", ja: "台中県市" }, bounds: [120.37934021, 24.00026224, 121.49687019, 24.49760272] },
    { value: "1979-landuse-25k-taipei", layer: "1979_Landuse_25K_Taipei", ext: "png", label: { zh: "1979 土地灌溉利用圖", en: "1979 land and irrigation use map", ja: "1979 土地灌漑利用図" }, scope: { zh: "臺北縣市", en: "Taipei County and City", ja: "台北県市" }, bounds: [121.25358392, 24.66588456, 122.01627544, 25.3294446] },
    { value: "1979-landuse-25k-taitung", layer: "1979_Landuse_25K_Taitung", ext: "png", label: { zh: "1979 土地灌溉利用圖", en: "1979 land and irrigation use map", ja: "1979 土地灌漑利用図" }, scope: { zh: "臺東縣", en: "Taitung County", ja: "台東県" }, bounds: [120.60603034, 22.18273116, 121.51917782, 23.50248058] },
    { value: "1979-landuse-25k-taoyuan", layer: "1979_Landuse_25K_Taoyuan", ext: "png", label: { zh: "1979 土地灌溉利用圖", en: "1979 land and irrigation use map", ja: "1979 土地灌漑利用図" }, scope: { zh: "桃園縣", en: "Taoyuan County", ja: "桃園県" }, bounds: [120.87475434, 24.58076281, 121.63220228, 25.16892831] },
    { value: "1979-landuse-25k-yilan", layer: "1979_Landuse_25K_Yilan", ext: "png", label: { zh: "1979 土地灌溉利用圖", en: "1979 land and irrigation use map", ja: "1979 土地灌漑利用図" }, scope: { zh: "宜蘭縣", en: "Yilan County", ja: "宜蘭県" }, bounds: [121.25018538, 24.25200274, 122.00180883, 24.99650574] },
    ],
  },
  {
    key: "historicalThematic", overlay: false, defaultOpacity: 0.85, defaultValue: "jm1m-1931",
    name: { zh: "歷史主題圖（水利、地質、林務、測量）", en: "Historical Thematic Maps (Water, Geology, Forestry, Survey)", ja: "歴史的主題図（水利・地質・林野・測量）" },
    eras: [
    { value: "jm1m-1931", layer: "JM1M_1931", ext: "png", label: { zh: "1931 公共埤圳與水利組合灌溉排水區域圖", en: "1931 irrigation and drainage districts map", ja: "1931 公共埤圳・水利組合灌漑排水区域図" }, bounds: [118.97722596639, 21.491114844721, 122.41309285433, 25.985766478853] },
    { value: "tm50k-1966", layer: "TM50K_1966", ext: "png", label: { zh: "1966 水利工程、水文站及基準點位置圖", en: "1966 water works, hydrological stations and benchmarks", ja: "1966 水利工事・水文観測所・基準点位置図" } },
    { value: "jmgeo-1930s", layer: "JMGeo_1930s", ext: "png", label: { zh: "1930 日治時期地質圖", en: "1930 Japanese-era geological map", ja: "1930 日本統治期地質図" }, bounds: [120.5078058, 22.3316458, 122.2583625, 25.6650665] },
    { value: "jm20k-1904-triangulation", layer: "JM20K_1904_triangulation", ext: "png", label: { zh: "1904 三角測量點及水準點配置圖", en: "1904 triangulation and leveling points", ja: "1904 三角測量点・水準点配置図" }, bounds: [119.7310447, 21.8633966, 122.4125793, 25.5821163] },
    { value: "tm1m-1980", layer: "TM1M_1980", ext: "png", label: { zh: "1980 林務局林區轄區圖", en: "1980 Forestry Bureau forest district map", ja: "1980 林務局林区管轄図" }, bounds: [119.07025337, 21.83978771, 122.36408393, 25.47430429] },
    { value: "map-lsb1-hualien", layer: "Map_LSB1_Hualien", ext: "png", label: { zh: "日治官有林野圖", en: "Japanese-era state forest map", ja: "日本統治期官有林野図" }, scope: { zh: "花蓮", en: "Hualien", ja: "花蓮" }, bounds: [121.02485092, 23.40445158, 121.94933436, 24.16549592] },
    { value: "map-lsb1-taitung", layer: "Map_LSB1_Taitung", ext: "png", label: { zh: "1914 日治官有林野圖", en: "1914 Japanese-era state forest map", ja: "1914 日本統治期官有林野図" }, scope: { zh: "臺東", en: "Taitung", ja: "台東" }, bounds: [120.46839944, 22.19114896, 121.7776719, 23.58993418] },
    ],
  },
];

export const HISTORICAL_MAP_GROUP_KEYS: readonly HistoricalMapGroupKey[] = HISTORICAL_MAP_GROUPS.map((g) => g.key);

export const HISTORICAL_MAP_MIN_ZOOM = 8;
export const HISTORICAL_MAP_MAX_ZOOM = 18;
export const HISTORICAL_MAP_ATTRIBUTION =
  '<a href="https://gis.sinica.edu.tw/tileserver/wmts" target="_blank" rel="noopener">中央研究院人社中心 GIS 專題中心 臺灣百年歷史地圖（CC BY-NC）</a>';

export function historicalMapGroup(key: HistoricalMapGroupKey): HistoricalMapGroup {
  return HISTORICAL_MAP_GROUPS.find((g) => g.key === key)!;
}

export function historicalMapDefaultIdx(group: HistoricalMapGroup): number {
  return Math.max(0, group.eras.findIndex((e) => e.value === group.defaultValue));
}

export function historicalMapEraByIdx(group: HistoricalMapGroup, idx: number | undefined): HistoricalMapEra {
  return group.eras[idx ?? historicalMapDefaultIdx(group)] ?? group.eras[historicalMapDefaultIdx(group)]!;
}

function pick(text: HistoricalMapText, locale: HistoricalMapLocale): string {
  return locale === "en" ? text.en : locale === "ja" ? text.ja : text.zh;
}

/** 圖例標題：年代標籤＋局部涵蓋說明 */
export function historicalMapEraTitle(era: HistoricalMapEra, locale: HistoricalMapLocale): string {
  const label = pick(era.label, locale);
  if (!era.scope) return label;
  const scope = pick(era.scope, locale);
  return locale === "zh-TW" ? `${label}（${scope}）` : locale === "ja" ? `${label}（${scope}）` : `${label} (${scope})`;
}

/** select 選項的中文原文（也是 param.<layerKey>.<中文> 翻譯鍵） */
export function historicalMapEraOptionZh(era: HistoricalMapEra): string {
  return historicalMapEraTitle(era, "zh-TW");
}

export function historicalMapTileUrl(era: HistoricalMapEra): string {
  return `https://gis.sinica.edu.tw/tileserver/file-exists.php?img=${era.layer}-${era.ext}-{z}-{x}-{y}`;
}
