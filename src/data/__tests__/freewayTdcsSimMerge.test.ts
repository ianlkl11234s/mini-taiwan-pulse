import { describe, expect, it } from "vitest";
import {
  SEGPOS_LEN, decodeFreewayTdcsBase, mergeFreewayTdcsParts, tripPosition,
  type FreewayTdcsLayout, type FreewayTdcsMeta, type FreewayTdcsNetwork, type FreewayTdcsPart,
} from "../freewayTdcsSimModel";

/** 一條 5 節點直線、一趟一段：影格 t=0,10,20,30,40（相對 t_base），切成 [0,20)、[20,40] 兩檔 */
const net: FreewayTdcsNetwork = {
  nodes: [121.5, 25, 121.501, 25, 121.502, 25, 121.503, 25, 121.504, 25],
  line_of: [0, 0, 0, 0, 0], lines: [{ road: "N1", lanes: 2, start: 0, end: 4 }], lane_w: 3.6,
  range_bbox: [121.5, 24.99, 121.504, 25.01],
};
const meta: FreewayTdcsMeta = { date: "20260928", window: [100, 140], t_base: 100, n_trips: 1, names: [], lane_change_s: 2.5 };

function bin(arrays: Record<string, Uint8Array | Uint16Array | Uint32Array>): { buf: ArrayBuffer; layout: FreewayTdcsLayout } {
  const layout: FreewayTdcsLayout = {};
  let off = 0;
  for (const [k, a] of Object.entries(arrays)) { off += (4 - (off % 4)) % 4; layout[k] = { offset: off, length: a.length, dtype: a instanceof Uint8Array ? "uint8" : a instanceof Uint16Array ? "uint16" : "uint32" }; off += a.byteLength; }
  const buf = new ArrayBuffer(off), u8 = new Uint8Array(buf);
  for (const [k, a] of Object.entries(arrays)) u8.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), layout[k]!.offset);
  return { buf, layout };
}

const segs = bin({ trip: Uint32Array.of(0), start: Uint16Array.of(0), end: Uint16Array.of(40) });
const trips = bin({ on: Uint16Array.of(0), off: Uint16Array.of(0), first: Uint16Array.of(0), last: Uint16Array.of(40), vt: Uint8Array.of(0), spd: Uint8Array.of(90), flags: Uint8Array.of(0) });
const base = decodeFreewayTdcsBase(meta, net, segs.buf, segs.layout, trips.buf, trips.layout);

function part(t0: number, t1: number, kfBase: number, nodes: number[], times: number[]): FreewayTdcsPart {
  return {
    t0, t1, segId: Uint32Array.of(0), kfBase: Uint32Array.of(kfBase), kfOff: Uint32Array.of(0, nodes.length),
    evBase: Uint32Array.of(0), evOff: Uint32Array.of(0, 1),
    kn: Uint16Array.from(nodes), kt: Uint16Array.from(times), evT: Uint16Array.of(0), evL: Uint8Array.of(0),
  };
}
// 切檔規則（build-freeway-tdcs-sim-bundle.py）：第一檔帶到最後一個 ≤ t1 的影格再多一點（30），
// 第二檔從最後一個 < t0 的影格開始（10）
const p0 = part(100, 120, 0, [0, 1, 2, 3], [0, 10, 20, 30]);
const p1 = part(120, 140, 1, [1, 2, 3, 4], [10, 20, 30, 40]);

describe("mergeFreewayTdcsParts", () => {
  it("跨檔的段去掉重疊影格後與原段相同", () => {
    const D = mergeFreewayTdcsParts(base, [p0, p1], 1);
    expect(D.nSeg).toBe(1);
    expect(Array.from(D.kn)).toEqual([0, 1, 2, 3, 4]);
    expect(Array.from(D.kt)).toEqual([0, 10, 20, 30, 40]);
    expect([D.coverStart, D.coverEnd]).toEqual([100, 140]);
    expect(D.gen).toBe(1);
  });

  it("邊界前後的位置連續，且與只載單檔時相同", () => {
    const both = mergeFreewayTdcsParts(base, [p0, p1], 1), first = mergeFreewayTdcsParts(base, [p0], 2), second = mergeFreewayTdcsParts(base, [p1], 3);
    const a = new Float64Array(SEGPOS_LEN), b = new Float64Array(SEGPOS_LEN);
    for (const t of [115, 119.5, 120]) {
      expect(tripPosition(both, 0, t, a)).toBe(true); expect(tripPosition(first, 0, t, b)).toBe(true);
      expect(Array.from(a)).toEqual(Array.from(b));
    }
    for (const t of [120, 125, 139]) {
      expect(tripPosition(both, 0, t, a)).toBe(true); expect(tripPosition(second, 0, t, b)).toBe(true);
      expect(Array.from(a)).toEqual(Array.from(b));
    }
  });

  it("跟隨用的首末時間來自 trips.bin（不受只載部分時段影響）", () => {
    const D = mergeFreewayTdcsParts(base, [p1], 1);
    expect([D.tripFirst[0], D.tripLast[0]]).toEqual([100, 140]);
  });

  it("不相鄰的時段檔拒絕合併", () => {
    expect(() => mergeFreewayTdcsParts(base, [p1, p0], 1)).toThrow("不相鄰");
  });
});
