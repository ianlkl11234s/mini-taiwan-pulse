/**
 * 南韓行政邊界（第 0 波 C001）：來源、署名、版本、層級 SSOT。圖例（legend）與 popup（featureInfo）共用。
 * 授權原句與筆數驗算見 taipei-gis-analytics `docs/data-catalog/base_map/kr_admin_boundaries.md`
 * （2026-10-31 讀 vuski/admdongkor LICENSE-DATA）；人口代碼 join 見 `docs/topic-research/south_korea_opendata/waves/w0/code-join.md`。
 */

export const KR_ADMIN_COLOR = "#9ca3af";

/** LICENSE-DATA §3 指定的出處句（韓文原句；英文句見 catalog doc）。 */
export const KR_ADMIN_ATTRIBUTION =
  "본 데이터는 통계청 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr)에서 공공누리 제1유형으로 개방한 행정동 경계를 가공한 것이며(가공: vuski/admdongkor, https://github.com/vuski/admdongkor), CC BY 4.0으로 배포됩니다.";
/** 圖例用短版署名。 */
export const KR_ADMIN_ATTRIBUTION_SHORT = "© 통계청 SGIS（KOGL 제1유형）／vuski/admdongkor（CC BY 4.0）";
export const KR_ADMIN_SOURCE_URL = "https://github.com/vuski/admdongkor";
export const KR_ADMIN_LICENSE = "CC BY 4.0 (upstream SGIS KOGL Type 1 / 공공누리 제1유형)";
export const KR_ADMIN_VERSION = "admdongkor ver20261001";
export const KR_ADMIN_FETCHED_AT = "2026-10-31";

/**
 * 三個層級（PMTiles tile layer 名＝value）。select 的 encode 順序。
 * 筆數：시·도 16、시군구 256（含一般區）、행정동 3,559；행정동圖磚 z7 起才有。
 */
export const KR_ADMIN_LEVELS = [
  { value: "sido", label: "道級（시·도）", count: 16, minzoom: 2 },
  { value: "sgg", label: "市郡區（시군구）", count: 256, minzoom: 4 },
  { value: "emd", label: "行政洞（행정동）", count: 3559, minzoom: 7 },
] as const;
export type KrAdminLevel = (typeof KR_ADMIN_LEVELS)[number]["value"];
