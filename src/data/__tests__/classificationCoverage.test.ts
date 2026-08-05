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
