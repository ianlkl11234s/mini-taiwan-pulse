/**
 * 靜態資料契約 ratchet —— 驗 `public/` 下被 OVERLAY_REGISTRY 引用的 GeoJSON。
 *
 * 守的是「檔案還在、但內容悄悄不對」這類**不會報錯的失敗**：
 *   - 座標系沒轉（TWD97 TM2 當成經緯度）→ 點跑到地圖外，圖層看起來是空的
 *   - 檔案變成空的 / 結構壞掉 → 圖層靜默消失
 *   - 前端硬依賴的欄位改名或改型別 → popup 空白、分色全落灰
 *
 * 最後一項是 2026-08-02 山屋實例：`ele` 上游給的是**字串** `"2588"`，前端寫
 * `typeof props.ele === "number"` → 41 筆海拔全部靜默不顯示，tsc 與所有測試全綠。
 *
 * PMTiles 不在本測試範圍（需解切片；那層的點數/欄位守門該做在上游 pipeline）。
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { OVERLAY_REGISTRY } from "../../map/overlayRegistry";

// ── 已知壞掉、待上游修（ratchet：修好後要從這裡移除，否則測試會提醒）──
//
// 2026-08-02 首掃抓到兩個上游產製 bug，同日皆已修復並清空本名單：
//   - forestry_treatment_works：夜跑通用 pipeline 的 parse_lat_lon_fields() 用單字母 'Y'
//     模糊比對欄名，`'y' in 'planyear'` 成立 → 把民國年當緯度。6,275 點全錯。
//     修法：pipelines/forestry/forestry_treatment_works/01_rebuild_geometry.py 由 x1/y1 重建
//   - geo/active_faults：02_fetch_active_faults.py 寫 `if gdf.crs and ...`，
//     shapefile 沒有 .prj 時 crs is None → 整段轉換被跳過（22 個來源有 8 個沒 .prj）。
//     修法：crs is None 時依座標量級推定 EPSG:3826 再轉
//
// 兩者的共同特徵：**壞掉不會叫**。要新增條目請一併寫清楚成因與修法。
const KNOWN_BROKEN_CRS: Record<string, string> = {};

/** dynamicData 圖層的 sourceUrl 只是 placeholder（資料由 loader setData 餵入） */
function staticGeojsonUrls(): string[] {
  const urls = new Set<string>();
  for (const config of OVERLAY_REGISTRY) {
    if (config.dynamicData) continue;
    if (!config.sourceUrl.endsWith(".geojson")) continue;
    urls.add(config.sourceUrl.replace(/^\.\//, ""));
  }
  return [...urls];
}

function loadFeatures(rel: string): GeoJSON.Feature[] {
  const data = JSON.parse(readFileSync(`public/${rel}`, "utf8")) as GeoJSON.FeatureCollection;
  return data.features ?? [];
}

/** 取任意巢狀深度的第一組座標 */
function firstCoord(geometry: GeoJSON.Geometry | null): number[] | null {
  if (!geometry || !("coordinates" in geometry)) return null;
  let c: unknown = geometry.coordinates;
  while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
  return Array.isArray(c) && typeof c[0] === "number" ? (c as number[]) : null;
}

describe("靜態 GeoJSON 契約", () => {
  const urls = staticGeojsonUrls().filter((u) => existsSync(`public/${u}`));

  it("registry 引用的靜態 GeoJSON 本機都存在（缺檔 = dev 上該層直接空白）", () => {
    const missing = staticGeojsonUrls().filter((u) => !existsSync(`public/${u}`));
    // 走 S3 的大檔本機可能沒有 → deployContract 測試負責確認它們屬已接線的 S3 目錄，
    // 這裡只在「本機有 public/ 完整副本」時提供額外一層提醒，故不硬性失敗。
    if (missing.length) console.log(`⚠ 本機缺 ${missing.length} 個 geojson（應由 S3 管理）：${missing.join(", ")}`);
    expect(urls.length).toBeGreaterThan(50); // 掃描範圍沒有整批消失
  });

  // ⚠️ 這兩條要逐一讀完 public/ 底下所有靜態 geojson（>50 檔、數百 MB）。單獨跑約 5s，
  // 但 vitest 平行跑其他檔案時 I/O 競爭會拉到 12s+，撞上預設 5s timeout 隨機紅。
  // 不是資料壞掉 —— 給足時間即可，別把它當成真的契約失敗去追。
  it("每個檔案都是非空的 FeatureCollection", { timeout: 60_000 }, () => {
    const bad: string[] = [];
    for (const url of urls) {
      try {
        if (loadFeatures(url).length === 0) bad.push(`${url}: features 是空的`);
      } catch (err) {
        bad.push(`${url}: 解析失敗 — ${(err as Error).message}`);
      }
    }
    expect(bad, `這些靜態資料壞了（圖層會靜默空白）：\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("座標都在合法經緯度範圍內（抓沒轉 WGS84 的 TWD97 TM2）", { timeout: 60_000 }, () => {
    const bad: string[] = [];
    for (const url of urls) {
      if (url in KNOWN_BROKEN_CRS) continue;
      let offRange = 0;
      let sample: number[] | null = null;
      for (const f of loadFeatures(url)) {
        const c = firstCoord(f.geometry);
        if (!c) continue;
        const [lon, lat] = c;
        if (!(lon! >= -180 && lon! <= 180 && lat! >= -90 && lat! <= 90)) {
          offRange++;
          sample ??= [Math.round(lon!), Math.round(lat!)];
        }
      }
      if (offRange > 0) bad.push(`${url}: ${offRange} 筆座標超出經緯度範圍（樣本 ${JSON.stringify(sample)}）`);
    }
    expect(
      bad,
      `座標系可能沒轉（TWD97 TM2 的數值約 x≈200000 / y≈2600000）—— ` +
      `這些 feature 會落在地圖外，圖層看起來是空的：\n  ${bad.join("\n  ")}`,
    ).toEqual([]);
  });

  it("KNOWN_BROKEN_CRS 名單只進不退（上游修好就要從名單移除）", () => {
    const fixed: string[] = [];
    for (const [url, note] of Object.entries(KNOWN_BROKEN_CRS)) {
      if (!existsSync(`public/${url}`)) continue;
      const off = loadFeatures(url).filter((f) => {
        const c = firstCoord(f.geometry);
        return c ? !(c[0]! >= -180 && c[0]! <= 180 && c[1]! >= -90 && c[1]! <= 90) : false;
      }).length;
      if (off === 0) fixed.push(`${url}（原因：${note.slice(0, 40)}…）`);
    }
    expect(
      fixed,
      `這些檔案的座標已經修好了 → 請從 KNOWN_BROKEN_CRS 移除：\n  ${fixed.join("\n  ")}`,
    ).toEqual([]);
  });
});

// ── 前端硬依賴欄位契約 ────────────────────────────────────────────
//
// 只列「改了前端一定壞」的欄位（分色 / 篩選 / popup 主要資訊），不求覆蓋全欄位。
// type 寫**上游實際給的型別**，不是「應該是什麼」—— 例如 OSM 來的數值欄多半是 string，
// 前端要照著寫 parse，寫 typeof === "number" 就會靜默失效（2026-08-02 山屋 ele 實例）。
type FieldType = "string" | "number" | "boolean";
interface FieldContract {
  field: string;
  type: FieldType;
  /** 允許 null（上游誠實保留的缺值，前端必須有 fallback） */
  nullable?: boolean;
  /** 至少要有幾成的 feature 帶這個欄位（預設 1 = 全部） */
  minCoverage?: number;
}

const FIELD_CONTRACTS: Record<string, FieldContract[]> = {
  "geo/internet_exchange_points.geojson": [
    { field: "ixp_id", type: "string" },
    { field: "name", type: "string" },
    { field: "region", type: "string" },           // 五洲區分色
    { field: "participants", type: "string" },     // Mapbox to-number 後控制點大小
    { field: "coord_qc_status", type: "string" },  // ok / swapped
    { field: "source_org", type: "string" },
    { field: "license", type: "string" },
  ],
  "business_registry/common_registration_addresses_202608.geojson": [
    { field: "address", type: "string" },
    { field: "n_companies", type: "number" },
    { field: "capital_median", type: "number" },
  ],
  // 2026-08-01 批次（本次上線）
  "hazards/mountain_rescue_incidents.geojson": [
    { field: "case_id", type: "string" },
    { field: "year", type: "number" },                       // ⚠️ number 不是 string，年份 filter 靠它
    { field: "cause", type: "string", nullable: true },      // 9 族分色；null 落「其他・不明」
    { field: "deaths", type: "number", nullable: true },     // >0 → 紅描邊
    { field: "fire_local_persons", type: "number", nullable: true }, // 6 欄加總 → 點大小
    { field: "city", type: "string", nullable: true },
  ],
  "forestry/mountain_huts.geojson": [
    { field: "facility_type", type: "string" },              // 4 類分色
    { field: "name", type: "string", nullable: true },       // 12 筆無名工寮
    { field: "ele", type: "string", nullable: true, minCoverage: 0.2 },      // ⚠️ 字串！OSM tag 原樣
    { field: "capacity", type: "string", nullable: true, minCoverage: 0 },   // ⚠️ 同上，覆蓋率極低
  ],
  "forestry/forestry_treatment_works.geojson": [
    // 2026-08-02 重建後新增：標記該筆座標是用哪條規則救回來的
    { field: "coord_rule", type: "string" },
    { field: "x1", type: "string" },   // ⚠️ 字串！重建 geometry 的來源欄，勿刪
    { field: "y1", type: "string" },
    { field: "eng_name", type: "string" },
  ],
  "religion/churches.geojson": [
    { field: "in_moi_registry", type: "boolean" },           // 雙態 filter
    { field: "name", type: "string", nullable: true },
    { field: "source", type: "string" },                     // === "osm_overpass" 才顯示 ODbL
  ],
  "religion/ancestral_halls.geojson": [
    { field: "facility_type", type: "string" },              // 3 類分色
    { field: "in_moi_registry", type: "boolean" },
  ],
  "religion/other_worship.geojson": [
    { field: "name", type: "string", nullable: true },       // 859/1319 是 null
    { field: "source", type: "string" },
  ],
  "religion/foundations.geojson": [
    { field: "name", type: "string" },
    { field: "county", type: "string" },
  ],
  "religion/top100.geojson": [
    { field: "name", type: "string" },
    { field: "county", type: "string" },
  ],
  "funeral/funeral_facilities.geojson": [
    { field: "facility_uid", type: "string" },            // 前端 key（跨批次穩定）
    { field: "facility_type", type: "string" },           // 6 類分色 + 篩選的唯一依據
    { field: "precision", type: "string" },               // 概略座標警示 + 精度篩選
    { field: "operator_type", type: "string" },
  ],
  "funeral/funeral_operators.geojson": [
    { field: "operator_id", type: "string" },
    { field: "entity_type", type: "string" },             // 2 類分色
    // ⚠️ boolean！預設 filter 只畫 true —— 型別若漂成字串，`== true` 全不成立 → 整層空白
    { field: "is_active", type: "boolean" },
    { field: "precision", type: "string" },
  ],
  "funeral/cemetery_zoning.geojson": [
    { field: "zoning_id", type: "string" },
    { field: "zone_label", type: "string" },              // 3 群分色（raw 9 值）
    { field: "county", type: "string" },
    { field: "area_ha", type: "number" },
  ],
  // ── 🤝 社福長照（第 40 主題，2026-08-13）9 檔 ──────────────────────────
  //
  // 🔴 本主題最容易靜默壞掉的是**型別**：床數／核定量欄位上游給的是**字串**
  //    （`"56"` 不是 `56`）。前端 paint 已一律用 `to-number` + `coalesce`，
  //    但若上游哪天改成 number 而前端沒跟，`to-number` 仍能吃 —— 反過來
  //    （前端改成直接 `["get"]` 算術）就會整層泡泡消失。契約在此把型別焊死。
  //
  // ⚠️ minCoverage 都是 2026-08-12 實測值往下取整：專屬欄位只有「帶專表欄位」
  //    的那批有（骨幹 165355 只補得到基本欄），不是資料壞了。掉到門檻以下才是異常。
  "welfare/nursing_homes_national.geojson": [
    { field: "uid", type: "string" },                      // 主題內唯一鍵
    { field: "name", type: "string" },
    { field: "coord_precision", type: "string" },          // 高 zoom 降階顯示 + 精度篩選的唯一依據
    { field: "nh_type", type: "string", minCoverage: 0.9 },// 三分色（1,499/1,611 = 93.0%）
    // ⚠️ **字串**！三欄相加才是總床數（只看 beds_nh 會讓 989/1,499 縮成最小點）
    { field: "beds_nh", type: "string", minCoverage: 0.9 },
    { field: "beds_postpartum", type: "string", minCoverage: 0.9 },
    { field: "beds_infant", type: "string", minCoverage: 0.9 },
  ],
  "welfare/elderly_care_homes_national.geojson": [
    { field: "uid", type: "string" },
    { field: "name", type: "string" },
    { field: "coord_precision", type: "string" },
    { field: "attr_type", type: "string", minCoverage: 0.9 },     // 公私別分色（1,090/1,160 = 94.0%）
    { field: "beds_approved", type: "string", minCoverage: 0.9 }, // ⚠️ 字串；半徑來源
  ],
  "welfare/disability_facilities_national.geojson": [
    { field: "uid", type: "string" },
    { field: "name", type: "string" },
    { field: "coord_precision", type: "string" },
    // ⚠️ 字串；使用率的分子分母（266/334 = 79.6%，其餘 68 筆整組 key 不存在 → 灰）
    { field: "quota_resident", type: "string", minCoverage: 0.75 },
    { field: "actual_resident", type: "string", minCoverage: 0.75 },
  ],
  "welfare/ltc_institutions_national.geojson": [
    { field: "uid", type: "string" },
    { field: "name", type: "string" },
    { field: "coord_precision", type: "string" },
    { field: "sub_code", type: "string" },                 // T0601-T0604 四分色，100%
  ],
  "welfare/childcare_centers_national.geojson": [
    { field: "uid", type: "string" },
    { field: "name", type: "string" },
    { field: "coord_precision", type: "string" },
  ],
  "welfare/child_services_national.geojson": [
    { field: "uid", type: "string" },
    { field: "name", type: "string" },
    { field: "coord_precision", type: "string" },
    { field: "welfare_class", type: "string" },            // 三類混裝分色，100%
    // ⚠️ 唯一非 100% 的基本欄（1,391/1,396）—— 5 筆地址解不出縣市，不是漏抓
    { field: "city", type: "string", minCoverage: 0.99 },
  ],
  "welfare/welfare_gov_offices_national.geojson": [
    { field: "uid", type: "string" },
    { field: "name", type: "string" },
    { field: "coord_precision", type: "string" },
    { field: "sub_code", type: "string" },                 // popup 類別名；⚠️ T0103 已在上游排除
  ],
  "welfare/mental_health_facilities_national.geojson": [
    { field: "uid", type: "string" },
    { field: "name", type: "string" },
    { field: "coord_precision", type: "string" },
    { field: "sub_code", type: "string" },                 // 五分色，100%
  ],
  "welfare/social_work_orgs_national.geojson": [
    { field: "uid", type: "string" },
    { field: "name", type: "string" },
    { field: "coord_precision", type: "string" },
    { field: "sub_code", type: "string" },
  ],
  // 🎓 教育（第 38 主題）：6 個點層共用此檔，全靠 school_level / region_type 做 filter
  "education/schools.geojson": [
    { field: "school_level", type: "string" },            // 9 種原始值 → fold 成 5 級（educationTypes）；null 會讓該點從 5 個學制層全數消失
    { field: "school_name", type: "string" },
    // ⚠️ nullable！4,315 筆中 3,163 筆是 JSON null（非偏遠）→ 前端不能用 ["has"] 判斷
    { field: "region_type", type: "string", nullable: true },
    { field: "city", type: "string" },
    { field: "district", type: "string" },
  ],
  // 🎓 教育 學區面（W2）：高中就學區 15 面（縣市級）
  // ⚠️ 國中小學區 school_district_k12 是 PMTiles，本測試只吃 GeoJSON → 不在此列。
  //    那層的欄位守門（lin_specs 空字串比例、is_shared、level 分布）該做在上游 pipeline。
  "education/school_district_senior.geojson": [
    { field: "district", type: "string" },               // popup 標題（如「基北區」）
    { field: "counties", type: "string" },               // 涵蓋縣市字串
    { field: "cross_district_rules", type: "string" },   // 跨區就讀規則，最長 685 字
    // ⚠️ 字串！15 筆實測全是 str（上游 06_enrich.py 排序時還要 .astype(int)）。
    //    分色 districtSeniorColorExpr 因此必須 to-number 再取模，前端也不能用 typeof === "number"。
    { field: "district_no", type: "string" },
  ],
  // 🎓 教育 幼托補習（W3）：⚠️ 這幾份保留上游**原始中文欄位名**，popup 直接取中文 key
  //    → 上游一改欄名，popup 不會報錯只會整片空白，這裡是唯一守門。
  // ⚠️ cram_schools 是 PMTiles（17,137 點），本測試只吃 GeoJSON → 不在此列。
  //    那層的欄位守門（`短期補習班類別` 14 值、`各地短期補習班數量` 禁用欄）該做在上游 pipeline。
  "education/kindergartens.geojson": [
    { field: "學校名稱", type: "string" },
    { field: "公/私立", type: "string" },              // 公立/私立 二色分色的唯一依據
    { field: "地址", type: "string" },
    { field: "precision", type: "string" },            // interpolated → opacity 降 45% + popup 標示
  ],
  "education/afterschool_care.geojson": [
    // ⚠️ 名稱欄是 `名稱` 不是「學校名稱」、縣市欄是 `縣市` 不是「縣市名稱」 —— 與幼兒園不同套
    { field: "名稱", type: "string" },
    { field: "地址", type: "string" },
    { field: "precision", type: "string" },
  ],
  "education/mutual_care.geojson": [
    { field: "學校名稱", type: "string" },             // 與幼兒園同名（故 popup 共用 panel）
    { field: "地址", type: "string" },
    { field: "precision", type: "string" },
  ],
  // 🎓 大專校別學生數：⚠️ 這份是**英文欄位**（與上面三份中文欄位不同套）
  "education/university_students.geojson": [
    { field: "school_name", type: "string" },
    // ⚠️ nullable！159 筆中 21 筆是 null（進修學院/空大 10 歸母校、宗教研修 9 不在統計、
    //    停辦改名 2）→ bubble 半徑走 case 分支給固定小灰點，popup 顯示「無學生數統計」。
    //    契約若漏寫 nullable，minCoverage 預設 1 會直接紅燈提醒（也提醒別把 null 當 0）。
    { field: "students_total", type: "number", nullable: true },
  ],
};

describe("前端硬依賴欄位契約", () => {
  for (const [url, contracts] of Object.entries(FIELD_CONTRACTS)) {
    it(`${url} 的關鍵欄位型別/覆蓋率未漂移`, () => {
      if (!existsSync(`public/${url}`)) {
        console.log(`⚠ ${url} 本機不存在（S3 管理），跳過`);
        return;
      }
      const features = loadFeatures(url);
      const problems: string[] = [];
      for (const c of contracts) {
        let present = 0;
        const wrongTypes = new Set<string>();
        for (const f of features) {
          const v = (f.properties ?? {})[c.field];
          if (v === null || v === undefined) continue;
          present++;
          if (typeof v !== c.type) wrongTypes.add(typeof v);
        }
        const coverage = present / features.length;
        const minCoverage = c.minCoverage ?? (c.nullable ? 0 : 1);
        if (wrongTypes.size > 0) {
          problems.push(
            `${c.field}: 契約寫 ${c.type}，實際出現 ${[...wrongTypes].join("/")} ` +
            `→ 前端若用 typeof 判型會靜默失效`,
          );
        }
        if (coverage < minCoverage) {
          problems.push(`${c.field}: 覆蓋率 ${(coverage * 100).toFixed(1)}% < 契約要求 ${(minCoverage * 100).toFixed(0)}%`);
        }
      }
      expect(
        problems,
        `${url} 欄位契約不符（上游改了欄位，下游要跟改）：\n  ${problems.join("\n  ")}`,
      ).toEqual([]);
    });
  }
});
