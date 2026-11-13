/**
 * 聲景網格計算核心（W6-4）：Worker 與「沒有 Worker 時的後備」共用同一份（純模組，不碰 DOM／loadingRegistry）。
 *
 * - 狀態：每族一份 set（Worker 端還原的副本）＋空間場（雨每格最近站、道路每格近鄰路、自然三族空間場）＋10 分格快取。
 *   空間場在這裡建（node 量 100–650 ms，以前在主執行緒 useMemo）；每族換 set 時清快取與場。
 * - 幀：與舊 hook 相同的函式（rainGridFrame／roadGridFrame／potentialPackFrame／railGridFrame／naturalGridFrame），
 *   整幀判定（no_full_area_source、no_pack_for_date…）也從舊 hook 搬來，規則不變。
 * - 綜合：同一個 10 分格的七幀 → compositeFrames（甲、乙、丙＋七族分級打包一起算，切版本不重算）。
 */
import type { SetOrigin } from "../soundAtlasData";
import type { PreparedTrack } from "../sourceAdapters/railAdapter";
import type { AnyRainRecord } from "../sourceAdapters/rainFieldAdapter";
import type { SoundSourceSet } from "../types";
import { COMPOSITE_FAMILIES, compositeFrames } from "./compositeGrid";
import { decodeRailSet, decodeRoadSet, type EncodedFamily, type GridFamily } from "./gridWire";
import { GRID_CELLS, GRID_UNKNOWN, inScopeCells } from "./gridSpec";
import { buildNaturalField, naturalGridFrame, type NaturalFamily, type NaturalField } from "./naturalGrid";
import { potentialPackFrame, type PotentialPack } from "./potentialPack";
import { railGridFrame } from "./railGrid";
import { buildRainGaugeField, rainGridFrame, type RainGaugeField } from "./rainGrid";
import { buildRoadGridField, roadGridFrame, roadNetworkRecordOf, type RoadGridField } from "./roadGrid";
import type { RoadNetwork } from "./roadNetwork";

export const GRID_STEP_S = 600;
/** 每族最多快取幾個 10 分格（一天 144 格；鐵道冷算 70–280 ms，36 格≈6 小時來回拖曳都是查表） */
const CACHE_FRAMES = 36;
const COMPOSITE_CACHE = 12;

const NATURAL = new Set<GridFamily>(["wind_vegetation", "coastal_wave", "river_water"]);

export interface FrameOut { values: Uint8Array; note: string | null }

interface FamState {
  version: number;
  origin: SetOrigin | null;
  set: SoundSourceSet | null;
  pack: PotentialPack | null;
  packNote: string | null;
  field: RainGaugeField | RoadGridField | NaturalField | null;
  cache: Map<number, FrameOut>;
  /** 收過 set 訊息（沒收過＝「還沒載」，不是無法判斷） */
  received: boolean;
}

const blank = (): FamState => ({ version: 0, origin: null, set: null, pack: null, packNote: null, field: null, cache: new Map(), received: false });

export class SoundGridCore {
  private fams = new Map<GridFamily, FamState>(COMPOSITE_FAMILIES.map((f) => [f, blank()]));
  private tracks = new Map<number, PreparedTrack>();
  private nets = new Map<number, RoadNetwork>();
  private compositeCache = new Map<string, { a: Uint8Array; b: Uint8Array; c: Uint8Array; lv: Uint32Array; notes: Record<GridFamily, string | null> }>();
  /** 量測：每族實際重算（非查表）的次數，測試用來確認「換幀不重算」 */
  readonly computeCount: Record<GridFamily, number> = Object.fromEntries(COMPOSITE_FAMILIES.map((f) => [f, 0])) as Record<GridFamily, number>;
  private cells = inScopeCells();

  version(f: GridFamily): number { return this.fams.get(f)!.version; }
  has(f: GridFamily): boolean { return this.fams.get(f)!.received; }

  setFamily(family: GridFamily, version: number, origin: SetOrigin | null, data: EncodedFamily | null): void {
    const st = this.fams.get(family)!;
    st.version = version;
    st.origin = origin;
    st.received = true;
    st.set = null; st.pack = null; st.packNote = null; st.field = null;
    st.cache.clear();
    this.compositeCache.clear();
    if (!data) return;
    if (data.kind === "rail") st.set = decodeRailSet(data, this.tracks);
    else if (data.kind === "road") st.set = decodeRoadSet(data, this.nets);
    else if (data.kind === "aviation") { st.pack = data.pack; st.packNote = data.note; st.set = null; }
    else st.set = data.set;
  }

  /** 是否已有這格的結果（不必重算） */
  cached(family: GridFamily, bin: number): boolean { return this.fams.get(family)!.cache.has(bin); }

  private ensureField(family: GridFamily, st: FamState): void {
    if (st.field || !st.set) return;
    if (family === "rain") st.field = buildRainGaugeField(st.set.records as AnyRainRecord[], this.cells);
    else if (family === "road_traffic") {
      const rec = roadNetworkRecordOf(st.set);
      if (rec) st.field = buildRoadGridField(rec.payload.net, this.cells);
    } else if (NATURAL.has(family) && st.origin === "grid") st.field = buildNaturalField(family as NaturalFamily, st.set, this.cells);
  }

  frame(family: GridFamily, bin: number): FrameOut {
    const st = this.fams.get(family)!;
    const hit = st.cache.get(bin);
    if (hit) return hit;
    this.computeCount[family]++;
    const out = new Uint8Array(GRID_CELLS);
    const t1 = bin + GRID_STEP_S - 1e-6;
    let note: string | null = null;
    if (!st.received) { out.fill(GRID_UNKNOWN); note = "source_not_loaded"; }
    else if (family === "aviation") {
      // 飛機：只讀每日包（origin＝grid 才有；雜湊不符等原因由主執行緒判定後帶 note）
      if (st.origin !== "grid") { out.fill(GRID_UNKNOWN); note = st.origin ? "no_full_area_source" : "source_not_loaded"; }
      else if (!st.pack) { out.fill(GRID_UNKNOWN); note = st.packNote ?? "no_pack_for_date"; }
      else {
        const f = potentialPackFrame(st.pack, bin);
        if (f) out.set(f); else { out.fill(GRID_UNKNOWN); note = "outside_pack_time"; }
      }
    } else if (!st.set) { out.fill(GRID_UNKNOWN); note = "source_not_loaded"; }
    else if (family === "rain") {
      this.ensureField(family, st);
      note = rainGridFrame(st.set, st.field as RainGaugeField, bin, t1, this.cells, out).gateReason;
    } else if (family === "road_traffic") {
      this.ensureField(family, st);
      note = roadGridFrame(st.set, st.field as RoadGridField | null, bin, t1, out).gateReason;
    } else if (family === "rail") {
      note = railGridFrame(st.set, bin, t1, out).gateReason;
    } else {
      // 自然三族：沒有全範圍來源檔（場景快照只有接收點附近）→ 整幀無法判斷，不畫成「沒有」
      if (st.origin !== "grid") { out.fill(GRID_UNKNOWN); note = "no_full_area_source"; }
      else {
        this.ensureField(family, st);
        note = naturalGridFrame(st.field as NaturalField, bin, t1, out).gateReason;
      }
    }
    const r = { values: out, note };
    st.cache.set(bin, r);
    while (st.cache.size > CACHE_FRAMES) st.cache.delete(st.cache.keys().next().value!);
    return r;
  }

  composite(bin: number, gate: number): { a: Uint8Array; b: Uint8Array; c: Uint8Array; lv: Uint32Array; notes: Record<GridFamily, string | null> } {
    const key = `${bin}|${gate}`;
    const hit = this.compositeCache.get(key);
    if (hit) return hit;
    const notes = {} as Record<GridFamily, string | null>;
    const frames = COMPOSITE_FAMILIES.map((f) => {
      const r = this.frame(f, bin);
      notes[f] = r.note;
      return r.values;
    });
    const out = { ...compositeFrames(frames, gate, undefined, undefined, this.cells), notes };
    this.compositeCache.set(key, out);
    while (this.compositeCache.size > COMPOSITE_CACHE) this.compositeCache.delete(this.compositeCache.keys().next().value!);
    return out;
  }

  /** 點選查詢：該格七族的碼（依 COMPOSITE_FAMILIES 順序；同網格顏色） */
  cell(bin: number, cell: number): { codes: number[]; notes: Record<GridFamily, string | null> } {
    const notes = {} as Record<GridFamily, string | null>;
    const codes = COMPOSITE_FAMILIES.map((f) => {
      const r = this.frame(f, bin);
      notes[f] = r.note;
      return r.values[cell] ?? GRID_UNKNOWN;
    });
    return { codes, notes };
  }
}
