/**
 * 道路車流網格（W6-2）：已載入的 road_traffic set（一筆路網 record）→ 一幀全範圍網格碼。
 *
 * 和接收點查詢**同一套規則**（網格值＝queryReceiver(格心, t) 的道路結果）：
 * - coverage gate 用 receiverQuery.gateFamilyRecords（路網讀不到＝整幀 255）；
 * - 每格候選來源用 nearRoadSources(格心) 同一支（載入時算一次）；
 * - 每幀每個來源的流量項只算一次（sourceFlowTerm），再逐格 roadEstimateFromNear 取最高 → roadGridCode。
 */
import { gateFamilyRecords } from "../engines/receiverQuery";
import { isRoadNetworkRecord, type RoadNetworkRecord } from "../sourceAdapters/roadTrafficAdapter";
import type { SoundSourceRecord, SoundSourceSet } from "../types";
import { cellCenter, GRID_CELLS, GRID_UNKNOWN, inScopeCells } from "./gridSpec";
import { nearRoadSources, roadEstimateFromNear, roadGridCode, sourceFlowTerm, type FlowTerm, type NearRoads, type RoadNetwork } from "./roadNetwork";

export interface RoadGridField {
  net: RoadNetwork;
  cells: Uint32Array;
  /** 與 cells 對齊 */
  near: NearRoads[];
}

export function buildRoadGridField(net: RoadNetwork, cells: Uint32Array = inScopeCells()): RoadGridField {
  const near: NearRoads[] = new Array(cells.length);
  for (let k = 0; k < cells.length; k++) {
    const [lon, lat] = cellCenter(cells[k]!);
    near[k] = nearRoadSources(net, lon, lat);
  }
  return { net, cells, near };
}

export function roadNetworkRecordOf(set: SoundSourceSet | null): RoadNetworkRecord | null {
  return (set?.records.find((r) => isRoadNetworkRecord(r as SoundSourceRecord<unknown, "road_traffic">)) as RoadNetworkRecord | undefined) ?? null;
}

export interface RoadGridFrame {
  values: Uint8Array;
  gateReason: string | null;
}

/** 一幀 [t0, t1]；set／field 不符或 gate 不通過 → 整幀 255（無法判斷，不是安靜） */
export function roadGridFrame(
  set: SoundSourceSet | null,
  field: RoadGridField | null,
  t0: number,
  t1: number,
  out: Uint8Array = new Uint8Array(GRID_CELLS),
): RoadGridFrame {
  out.fill(GRID_UNKNOWN);
  if (!set || !field) return { values: out, gateReason: "source_not_loaded" };
  const gate = gateFamilyRecords("road_traffic", [set], t0, t1);
  if (gate.kind !== "ok") return { values: out, gateReason: gate.reason };
  const rec = gate.records.find((r) => isRoadNetworkRecord(r as SoundSourceRecord<unknown, "road_traffic">)) as RoadNetworkRecord | undefined;
  if (!rec || rec.payload.net !== field.net) return { values: out, gateReason: "road_network_mismatch" };
  const { net, ctx } = rec.payload;
  const terms: (FlowTerm | undefined)[] = new Array(net.sources.length);
  const termOf = (si: number) => (terms[si] ??= sourceFlowTerm(ctx, net.sources[si]!, t0, t1));
  for (let k = 0; k < field.cells.length; k++) {
    out[field.cells[k]!] = roadGridCode(roadEstimateFromNear(net, ctx, field.near[k]!, t0, t1, termOf, false));
  }
  return { values: out, gateReason: null };
}
