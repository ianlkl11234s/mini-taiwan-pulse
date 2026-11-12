/**
 * Worker 端的排程（W6-4）：收訊息 → set 立即套用；請求依 key 只留最新一筆（舊的回 superseded），一次只算一筆、每筆一個 task，
 * 所以算鐵道（70–280 ms）時新請求仍會進來並取代排隊中的舊請求。佇列空了才在背景預算鐵道前後各一格。
 * Worker 入口（soundGrid.worker.ts）與沒有 Worker 時的同執行緒後備共用這一支。
 */
import { SoundGridCore, GRID_STEP_S } from "./gridComputeCore";
import type { FromWorker, ToWorker } from "./gridWire";

type Req = Extract<ToWorker, { type: "frame" | "composite" | "cell" }>;

export function createGridHost(post: (msg: FromWorker, transfer: Transferable[]) => void, defer: (fn: () => void) => void = (fn) => setTimeout(fn, 0)) {
  const core = new SoundGridCore();
  const pending = new Map<string, Req>();
  let scheduled = false;
  const prefetch: number[] = [];

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    defer(pump);
  };

  const run = (r: Req) => {
    const s = performance.now();
    try {
      if (r.type === "frame") {
        const f = core.frame(r.family, r.bin);
        const values = f.values.slice();
        post({ type: "frame", id: r.id, family: r.family, bin: r.bin, version: core.version(r.family), values, note: f.note, ms: performance.now() - s }, [values.buffer]);
        if (r.family === "rail") for (const b of [r.bin + GRID_STEP_S, r.bin - GRID_STEP_S]) if (!core.cached("rail", b) && !prefetch.includes(b)) prefetch.push(b);
      } else if (r.type === "composite") {
        const c = core.composite(r.bin, r.gate);
        const a = c.a.slice(), b = c.b.slice();
        post({ type: "composite", id: r.id, bin: r.bin, gate: r.gate, a, b, notes: c.notes, ms: performance.now() - s }, [a.buffer, b.buffer]);
        if (core.has("rail")) for (const b2 of [r.bin + GRID_STEP_S, r.bin - GRID_STEP_S]) if (!core.cached("rail", b2) && !prefetch.includes(b2)) prefetch.push(b2);
      } else {
        const c = core.cell(r.bin, r.cell);
        post({ type: "cell", id: r.id, bin: r.bin, cell: r.cell, codes: c.codes, notes: c.notes }, []);
      }
    } catch (e) {
      post({ type: "error", id: r.id, message: e instanceof Error ? e.message : String(e) }, []);
    }
  };

  function pump() {
    scheduled = false;
    const next = pending.entries().next();
    if (!next.done) {
      const [key, r] = next.value;
      pending.delete(key);
      run(r);
      schedule();
      return;
    }
    // 閒置：預算鐵道相鄰格（播放、來回拖曳時換幀是查表）
    const b = prefetch.shift();
    if (b != null && core.has("rail")) {
      if (!core.cached("rail", b)) core.frame("rail", b);
      if (prefetch.length) schedule();
    }
  }

  return {
    core,
    onMessage(msg: ToWorker): void {
      if (msg.type === "set") {
        core.setFamily(msg.family, msg.version, msg.origin, msg.data);
        if (msg.family === "rail") prefetch.length = 0;
        return;
      }
      const old = pending.get(msg.key);
      if (old) post({ type: "superseded", id: old.id }, []);
      pending.set(msg.key, msg);
      schedule();
    },
  };
}
