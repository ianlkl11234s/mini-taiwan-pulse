/**
 * PF-2：v2 路線 JSON 去掉可推導的 cumDist，前端重算。
 * 驗證重算值與原檔（preprocess 產出、round 6 位）一致，且車輛定位差 < 1 m。
 * 大檔（taipei / intercity / pingtung / tourist）gitignored，存在時才測。
 */
import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("../../lib/supabase", () => ({ supabase: {}, supabaseConfigured: false }));

import { computeCumDist, normalizeBusRoute, type RawBusRouteGeometry } from "../busLoader";
import { snapToRoute } from "../../engines/BusEngine";
import { interpolateOnLineString } from "../../engines/railUtils";
import type { BusRouteGeometry } from "../../types";

const BUS_DIR = resolve(__dirname, "../../../public/bus");
// 縣市小檔已原地去 cumDist；chiayi 保留原內容（研究資料集以其 SHA-256 為身分），可當 git 內基準
const TRACKED = ["chiayi_bus_routes.json"];
const BIG = ["intercity_bus_routes.json", "taipei_bus_routes.json", "pingtungcounty_bus_routes.json", "tourist_shuttle_routes.json"];

const DEG_TOL = 0.5 / 111_000; // 0.5 m（degree 空間）
const M_PER_DEG = 111_000;

function load(file: string): Record<string, BusRouteGeometry> {
  return JSON.parse(readFileSync(resolve(BUS_DIR, file), "utf8"));
}

/** 固定抽樣：每 k 個 key 取一個，最多 n 條 */
function sample<T>(arr: T[], n: number): T[] {
  const step = Math.max(1, Math.floor(arr.length / n));
  const out: T[] = [];
  for (let i = 0; i < arr.length && out.length < n; i += step) out.push(arr[i]!);
  return out;
}

function checkFile(file: string) {
  const routes = sample(Object.values(load(file)), 50);
  expect(routes.length).toBeGreaterThan(0);
  for (const r of routes) {
    const cum = computeCumDist(r.coords);
    expect(cum.length).toBe(r.cumDist.length);
    for (let i = 0; i < cum.length; i++) {
      expect(Math.abs(cum[i]! - r.cumDist[i]!)).toBeLessThan(DEG_TOL);
    }
    expect(Math.abs(cum[cum.length - 1]! - r.totalDist)).toBeLessThan(DEG_TOL);

    // 車輛定位：同一 GPS 點 → snap → interpolate，舊 cumDist 與重算版位置差 < 1 m
    const { cumDist: _c, totalDist: _t, ...rest } = r;
    const stripped = normalizeBusRoute(structuredClone(rest) as RawBusRouteGeometry);
    for (const t of [0.07, 0.31, 0.5, 0.73, 0.96]) {
      const i = Math.min(r.coords.length - 2, Math.floor(t * (r.coords.length - 1)));
      const a = r.coords[i]!, b = r.coords[i + 1]!;
      const lng = (a[0] + b[0]) / 2 + 0.0001, lat = (a[1] + b[1]) / 2 - 0.0001;
      const pOld = interpolateOnLineString(r.coords, snapToRoute(lat, lng, r).progress);
      const pNew = interpolateOnLineString(stripped.coords, snapToRoute(lat, lng, stripped).progress);
      const d = Math.hypot(pOld[0] - pNew[0], pOld[1] - pNew[1]) * M_PER_DEG;
      expect(d).toBeLessThan(1);
    }
  }
}

describe("bus route cumDist 重算", () => {
  for (const f of TRACKED) it(`與原檔一致：${f}`, () => checkFile(f));
  for (const f of BIG) it.skipIf(!existsSync(resolve(BUS_DIR, f)))(`與原檔一致（大檔）：${f}`, () => checkFile(f));

  it("檔案已含 cumDist 時原樣沿用（向後相容）", () => {
    const r: RawBusRouteGeometry = {
      routeUid: "X", routeName: "X", direction: 0, subRouteName: "", stopProgress: [], stopNames: [],
      coords: [[0, 0], [3, 4]], cumDist: [0, 999], totalDist: 999,
    };
    const out = normalizeBusRoute(r);
    expect(out.cumDist).toEqual([0, 999]);
    expect(out.totalDist).toBe(999);
  });

  it("缺 cumDist 時補算，totalDist = 末值", () => {
    const out = normalizeBusRoute({
      routeUid: "X", routeName: "X", direction: 0, subRouteName: "", stopProgress: [], stopNames: [],
      coords: [[0, 0], [3, 4], [3, 5]], totalDist: 6,
    });
    expect(out.cumDist).toEqual([0, 5, 6]);
    expect(out.totalDist).toBe(6);
  });
});
