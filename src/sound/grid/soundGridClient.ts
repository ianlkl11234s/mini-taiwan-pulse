/**
 * 聲景網格 Worker 的主執行緒端（W6-4）。
 *
 * - 同步資料：訂閱 soundAtlasStore，七個網格族的 set（或 origin）換了就送進 Worker；飛機改送每日包（主執行緒抓、驗雜湊，
 *   沒抓完前該族「未就緒」，hook 不畫、綜合不算）。每族有版次，hook 以版次當依賴重新請求。
 * - 送出佇列：所有訊息（set 與請求）依序排隊、**一個 task 只送一則**，編碼（鐵道軌道打包、班次 JSON）也在該 task 才做 →
 *   主執行緒單次阻塞 = 單一族的編碼＋clone；同 key 的請求還在佇列中就直接取代。
 * - 回應：請求被取代 → resolve(null)；hook 另以自己的序號只套用最後一次請求（跳時間時舊結果不蓋新結果）。
 * - 沒有 Worker（node 測試）或 Worker 建立失敗 → 同執行緒後備（同一個 gridWorkerHost）。
 */
import { soundAtlasStore, type SoundAtlasState } from "../soundAtlasStore";
import type { SoundSourceSet } from "../types";
import { COMPOSITE_FAMILIES } from "./compositeGrid";
import { gridSourceSha } from "./gridSources";
import { encodeRailSet, encodeRoadSet, NetRegistry, TrackRegistry, type EncodedFamily, type FromWorker, type GridFamily, type ToWorker } from "./gridWire";
import { createGridHost } from "./gridWorkerHost";
import { fetchPotentialPack } from "./potentialPack";

type Pending = { resolve: (r: FromWorker | null) => void; reject: (e: Error) => void };
type QueueItem = { kind: "set"; family: GridFamily; version: number; origin: SoundAtlasState["origins"][GridFamily] | null; make: () => EncodedFamily | null } | { kind: "req"; msg: Extract<ToWorker, { id: number }> };

export interface Transport {
  post(msg: ToWorker, transfer: Transferable[]): void;
  onMessage(cb: (msg: FromWorker) => void): void;
  onError(cb: (message: string) => void): void;
  kind: "worker" | "inline";
}

export function inlineTransport(): Transport {
  let cb: (msg: FromWorker) => void = () => {};
  const host = createGridHost((m) => cb(m));
  return {
    kind: "inline",
    post: (msg) => setTimeout(() => host.onMessage(msg), 0),
    onMessage: (f) => { cb = f; },
    onError: () => {},
  };
}

function workerTransport(): Transport | null {
  if (typeof Worker === "undefined") return null;
  try {
    const w = new Worker(new URL("./soundGrid.worker.ts", import.meta.url), { type: "module" });
    let errCb: (m: string) => void = () => {};
    w.onerror = (e) => { e.preventDefault?.(); errCb(e.message || "worker error"); };
    return {
      kind: "worker",
      post: (msg, transfer) => w.postMessage(msg, transfer),
      onMessage: (f) => { w.onmessage = (e: MessageEvent<FromWorker>) => f(e.data); },
      onError: (f) => { errCb = f; },
    };
  } catch {
    return null;
  }
}

export interface FamilySync { version: number; ready: boolean }

export interface GridClientPerf {
  /** 主執行緒最長一次送出（編碼＋postMessage）ms 與是哪一則 */
  maxSendMs: number;
  maxSendWhat: string;
  sends: { what: string; ms: number }[];
}

export class SoundGridClient {
  private seq = 0;
  private pending = new Map<number, Pending>();
  private queue: QueueItem[] = [];
  private pumping = false;
  private tracks = new TrackRegistry();
  private nets = new NetRegistry();
  private sync = new Map<GridFamily, FamilySync>(COMPOSITE_FAMILIES.map((f) => [f, { version: 0, ready: false }]));
  private seen = new Map<GridFamily, { set: SoundSourceSet | null; origin: string | null }>();
  private listeners = new Set<() => void>();
  private snapshot: Record<GridFamily, FamilySync> = this.buildSnapshot();
  error: string | null = null;
  readonly perf: GridClientPerf = { maxSendMs: 0, maxSendWhat: "", sends: [] };

  constructor(private transport: Transport, private fetchPack: typeof fetchPotentialPack = fetchPotentialPack) {
    transport.onMessage((m) => this.receive(m));
    transport.onError((message) => {
      this.error = message;
      for (const p of this.pending.values()) p.reject(new Error(message));
      this.pending.clear();
      this.emit();
    });
  }

  get kind(): Transport["kind"] { return this.transport.kind; }

  private buildSnapshot(): Record<GridFamily, FamilySync> {
    return Object.fromEntries([...this.sync].map(([f, s]) => [f, { ...s }])) as Record<GridFamily, FamilySync>;
  }
  private emit(): void {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((l) => l());
  }
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getSync = (): Readonly<Record<GridFamily, FamilySync>> => this.snapshot;

  /** store → Worker：只送有變的族 */
  syncFromStore(state: Pick<SoundAtlasState, "sets" | "origins">): void {
    let changed = false;
    for (const f of COMPOSITE_FAMILIES) {
      const set = (state.sets[f] as SoundSourceSet | undefined) ?? null;
      const origin = state.origins[f] ?? null;
      const prev = this.seen.get(f);
      if (prev && prev.set === set && prev.origin === origin) continue;
      if (!prev && !set) continue;
      this.seen.set(f, { set, origin });
      const s = this.sync.get(f)!;
      s.version++;
      const version = s.version;
      changed = true;
      if (f === "aviation") {
        s.ready = false;
        if (!set || origin !== "grid") {
          s.ready = !!set;
          this.enqueue({ kind: "set", family: f, version, origin, make: () => (set ? { kind: "aviation", pack: null, note: origin ? null : "source_not_loaded" } : null) });
          continue;
        }
        const dateKey = set.dateKey;
        void this.fetchPack("aviation", dateKey).then((p) => {
          if (this.sync.get(f)!.version !== version) return; // 又換了
          const sha = gridSourceSha("aviation", dateKey);
          const note = !p ? "no_pack_for_date" : sha && p.meta.source.sha256 !== sha ? "pack_source_mismatch" : null;
          this.enqueue({ kind: "set", family: f, version, origin, make: () => ({ kind: "aviation", pack: note ? null : p, note }) });
          this.sync.get(f)!.ready = true;
          this.emit();
        });
        continue;
      }
      s.ready = !!set;
      this.enqueue({
        kind: "set", family: f, version, origin,
        make: () => (!set ? null : f === "rail" ? encodeRailSet(set, this.tracks) : f === "road_traffic" ? encodeRoadSet(set, this.nets) : { kind: "plain", set }),
      });
    }
    if (changed) this.emit();
  }

  private enqueue(item: QueueItem): void {
    if (item.kind === "req") {
      const i = this.queue.findIndex((q) => q.kind === "req" && q.msg.key === item.msg.key);
      if (i >= 0) {
        const old = this.queue[i] as Extract<QueueItem, { kind: "req" }>;
        this.queue[i] = item;
        this.settle(old.msg.id, null);
        this.kick();
        return;
      }
    }
    this.queue.push(item);
    this.kick();
  }

  private kick(): void {
    if (this.pumping) return;
    this.pumping = true;
    setTimeout(() => this.pump(), 0);
  }

  private pump(): void {
    this.pumping = false;
    const item = this.queue.shift();
    if (!item) return;
    const s = performance.now();
    let what: string;
    if (item.kind === "set") {
      const data = item.make();
      const transfer: Transferable[] = data?.kind === "rail" ? data.tracks.flatMap((t) => [t.coords.buffer, t.cum.buffer]) : [];
      this.transport.post({ type: "set", family: item.family, version: item.version, origin: item.origin ?? null, data }, transfer);
      what = `set:${item.family}`;
    } else {
      this.transport.post(item.msg, []);
      what = `${item.msg.type}:${item.msg.key}`;
    }
    const ms = performance.now() - s;
    if (ms > this.perf.maxSendMs) { this.perf.maxSendMs = ms; this.perf.maxSendWhat = what; }
    if (item.kind === "set") { this.perf.sends.push({ what, ms }); if (this.perf.sends.length > 40) this.perf.sends.shift(); }
    if (this.queue.length) this.kick();
  }

  private settle(id: number, r: FromWorker | null): void {
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    p.resolve(r);
  }

  private receive(m: FromWorker): void {
    if (m.type === "error") {
      const p = this.pending.get(m.id);
      this.pending.delete(m.id);
      p?.reject(new Error(m.message));
      return;
    }
    this.settle(m.id, m.type === "superseded" ? null : m);
  }

  private request<T extends FromWorker>(msg: Extract<ToWorker, { id: number }>): Promise<T | null> {
    if (this.error) return Promise.reject(new Error(this.error));
    return new Promise<T | null>((resolve, reject) => {
      this.pending.set(msg.id, { resolve: resolve as (r: FromWorker | null) => void, reject });
      this.enqueue({ kind: "req", msg });
    });
  }

  frame(key: string, family: GridFamily, bin: number) {
    return this.request<Extract<FromWorker, { type: "frame" }>>({ type: "frame", id: ++this.seq, key, family, bin });
  }
  composite(key: string, bin: number, gate: number) {
    return this.request<Extract<FromWorker, { type: "composite" }>>({ type: "composite", id: ++this.seq, key, bin, gate });
  }
  cell(key: string, bin: number, cell: number) {
    return this.request<Extract<FromWorker, { type: "cell" }>>({ type: "cell", id: ++this.seq, key, bin, cell });
  }
}

/** 只套用最後一次請求的回應（hook 用；跳時間時晚回來的舊格不蓋新格） */
export function createLatestGate(): { next(): number; isLatest(token: number): boolean } {
  let latest = 0;
  return { next: () => ++latest, isLatest: (t) => t === latest };
}

let client: SoundGridClient | null = null;
let unsub: (() => void) | null = null;

/** 全站共用一個（第一個聲景網格 hook 開啟時建立） */
export function soundGridClient(): SoundGridClient {
  if (client) return client;
  client = new SoundGridClient(workerTransport() ?? inlineTransport());
  const c = client;
  c.syncFromStore(soundAtlasStore.get());
  unsub = soundAtlasStore.subscribe(() => c.syncFromStore(soundAtlasStore.get()));
  if (import.meta.env?.DEV && typeof window !== "undefined") (window as unknown as Record<string, unknown>).__soundGridClient = c;
  return c;
}

/** 測試用 */
export function _resetSoundGridClient(): void {
  unsub?.();
  unsub = null;
  client = null;
}
