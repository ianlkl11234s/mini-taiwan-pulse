/**
 * 分類表覆蓋率 ratchet —— 前端的分色/圖例 SSOT 表必須涵蓋資料裡實際出現的所有值。
 *
 * 守的失敗模式：上游多了一個分類值（例如 `cause` 新增「野生動物攻擊」、
 * `facility_type` 新增第 5 類），前端 `match` 表達式沒有對應分支 → 那批點**靜默落成中性灰**，
 * 圖例上根本看不到這個類別存在。沒有人會發現，因為畫面「看起來正常」。
 *
 * 這正是 2026-08-02 handoff 文件裡自己標記的風險（「新增原始值若沒列進來會落到其他，
 * 不會消失但要記得補」）—— 文件提醒靠人記得，測試不用。
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { MOUNTAIN_RESCUE_CAUSES, MOUNTAIN_HUT_TYPES } from "../mountainSafetyTypes";
import { ANCESTRAL_HALL_TYPES, DEITY_FAMILIES } from "../religionTypes";
import { FUNERAL_FACILITY_TYPES, CEMETERY_ZONING_CLASSES } from "../funeralTypes";
import {
  SCHOOL_LEVEL_GROUPS, SCHOOL_LEVEL_ORDER, KINDERGARTEN_OWNERSHIP_COLORS,
} from "../educationTypes";

function distinctValues(rel: string, field: string): string[] {
  const data = JSON.parse(readFileSync(`public/${rel}`, "utf8")) as GeoJSON.FeatureCollection;
  const seen = new Set<string>();
  for (const f of data.features ?? []) {
    const v = (f.properties ?? {})[field];
    if (typeof v === "string" && v !== "") seen.add(v);
  }
  return [...seen];
}

interface Case {
  file: string;
  field: string;
  covered: string[];
  ssot: string;
  /** 有意不列入分類表的值（會落到「其他」桶且這是刻意的） */
  intentionalOther?: string[];
}

const CASES: Case[] = [
  {
    file: "hazards/mountain_rescue_incidents.geojson",
    field: "cause",
    // 9 族的 raw 清單攤平；「其他/不明」本來就在表內，故無 intentionalOther
    covered: MOUNTAIN_RESCUE_CAUSES.flatMap((c) => c.raw),
    ssot: "src/data/mountainSafetyTypes.ts MOUNTAIN_RESCUE_CAUSES[].raw",
  },
  {
    file: "forestry/mountain_huts.geojson",
    field: "facility_type",
    covered: MOUNTAIN_HUT_TYPES.map((t) => t.value),
    ssot: "src/data/mountainSafetyTypes.ts MOUNTAIN_HUT_TYPES",
  },
  {
    file: "religion/ancestral_halls.geojson",
    field: "facility_type",
    covered: ANCESTRAL_HALL_TYPES.map((t) => t.value),
    ssot: "src/data/religionTypes.ts ANCESTRAL_HALL_TYPES",
  },
  {
    file: "funeral/funeral_facilities.geojson",
    field: "facility_type",
    covered: FUNERAL_FACILITY_TYPES.map((t) => t.value),
    ssot: "src/data/funeralTypes.ts FUNERAL_FACILITY_TYPES",
  },
  {
    // zone_label 是原始中文（9 種），前端歸成 3 群 —— 上游新增用地名稱會被這裡擋下
    file: "funeral/cemetery_zoning.geojson",
    field: "zone_label",
    covered: CEMETERY_ZONING_CLASSES.flatMap((c) => c.raw),
    ssot: "src/data/funeralTypes.ts CEMETERY_ZONING_CLASSES[].raw",
  },
  {
    // 🎓 school_level 是原始中文（9 種），前端 fold 成 5 級。上游多一種學制（例如新設
    // 「XX 附設進修學校」）而沒補進 SCHOOL_LEVEL_GROUPS → 那批校從 5 個學制層全數消失，
    // 且總覽層落 fallback 色 —— 正是 handoff 只列 5 個主類別（漏 289 校）的那個坑。
    file: "education/schools.geojson",
    field: "school_level",
    covered: SCHOOL_LEVEL_ORDER.flatMap((g) => [...SCHOOL_LEVEL_GROUPS[g]]),
    ssot: "src/data/educationTypes.ts SCHOOL_LEVEL_GROUPS",
  },
  {
    // 🎓 幼兒園 `公/私立` 實測只有 2 值（公立 2,392／私立 4,297）—— 分色表就是這 2 個 key，
    // 沒有 fallback 以外的第三種歸屬。上游若冒出第三值（例如「準公共」「非營利」），
    // 那批點會靜默落成 EDUCATION_LAYER_COLORS.eduKindergarten 的粉色 fallback，
    // 看起來跟私立一模一樣 —— 圖例上完全看不出多了一類。
    // 分色表直接從 KINDERGARTEN_OWNERSHIP_COLORS 推導，不在此手寫第二份清單。
    file: "education/kindergartens.geojson",
    field: "公/私立",
    covered: Object.keys(KINDERGARTEN_OWNERSHIP_COLORS),
    ssot: "src/data/educationTypes.ts KINDERGARTEN_OWNERSHIP_COLORS",
  },
  // campus_polygon 走 PMTiles（本測試只讀 GeoJSON，不解切片）→ 其 school_level 10 類的
  // 覆蓋率無法在此守；改由 educationTypes.CAMPUS_LEVEL_COLORS 的 match fallback 兜底。
  // cram_schools 同理走 PMTiles → `短期補習班類別` 14 類的覆蓋率在此守不到；
  // 靠 cramCategoryColorExpr() 的 CRAM_CATEGORY_COLORS.other fallback 兜底（不會消失，但會被
  // 誤歸「其他」）。上游是 daily 更新的源，新類別要靠上游 pipeline 或重跑快照時人工比對。
];

describe("分類表覆蓋資料實際值", () => {
  for (const c of CASES) {
    it(`${c.file} 的 ${c.field} 沒有分類表漏掉的值`, () => {
      if (!existsSync(`public/${c.file}`)) {
        console.log(`⚠ ${c.file} 本機不存在，跳過`);
        return;
      }
      const known = new Set([...c.covered, ...(c.intentionalOther ?? [])]);
      const uncovered = distinctValues(c.file, c.field).filter((v) => !known.has(v));
      expect(
        uncovered,
        `上游出現分類表沒有的 ${c.field} 值 —— 這些點會靜默落成中性灰、圖例也看不到：\n` +
        `  ${uncovered.join("\n  ")}\n→ 補進 ${c.ssot}`,
      ).toEqual([]);
    });
  }
});

// ── 跨 repo：deity_family 的族清單必須與上游 pipeline 規則一致 ──
//
// temples 走 PMTiles（測試環境不解切片），改為直接比對上游規則檔的 family key。
// 上游改了族數/key 而下游沒跟，會讓整組寺廟落成中性灰 —— 而且 tsc 完全看不出來。
const UPSTREAM_RULE = "../taipei-gis-analytics/pipelines/religion/_shared/deity_family.py";

describe("deity_family 上下游 SSOT 一致性", () => {
  it("religionTypes.DEITY_FAMILIES 與上游 deity_family.py 的 family key 相同", () => {
    if (!existsSync(UPSTREAM_RULE)) {
      console.log("⚠ taipei-gis-analytics 不在 sibling 路徑；跳過跨 repo 檢查");
      return;
    }
    const py = readFileSync(UPSTREAM_RULE, "utf8");
    // 規則列形如：("mazu", "媽祖", (...)),  加上兩個常數 OTHER / UNKNOWN
    const upstream = new Set<string>([
      ...[...py.matchAll(/\(\s*"(\w+)"\s*,\s*"[^"]+"\s*,\s*\(/g)].map((m) => m[1] as string),
      "other",
      "unknown",
    ]);
    const local = new Set(DEITY_FAMILIES.map((d) => d.value));
    const missingLocally = [...upstream].filter((k) => !local.has(k));
    const extraLocally = [...local].filter((k) => !upstream.has(k));
    expect(
      { missingLocally, extraLocally },
      `deity_family 分族上下游不一致 —— 上游多出的族會在前端落成中性灰：\n` +
      `  上游有、前端沒有：${missingLocally.join(", ") || "（無）"}\n` +
      `  前端有、上游沒有：${extraLocally.join(", ") || "（無）"}\n` +
      `→ SSOT 在上游 ${UPSTREAM_RULE}；改那邊要同步 src/data/religionTypes.ts`,
    ).toEqual({ missingLocally: [], extraLocally: [] });
  });
});
