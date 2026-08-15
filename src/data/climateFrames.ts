/**
 * climateFrames — 風場 / 海流粒子層的「時間軸多幀」資料層。
 *
 * 契約（collector 端平行產出，見 docs handoff）：
 *   GET /climate/frames/manifest.json
 *   { version, generated_at, datasets: { wind10m: { frames: [...] }, currents: {...} } }
 *   frame = { t, png, u_min, u_max, v_min, v_max, kind, init_at }
 *   png 相對 /climate/frames/；frames 按 t 升冪；PNG 編碼與 *_latest.png 同款
 *   （R=u G=v A=valid），min/max 改由 manifest 供給。
 *
 * 職責：
 *   - 載 manifest（TTL cache 30min，withLoading）；404/解析失敗 → 回 null（graceful fallback）
 *   - 依 timeline 時間選最近幀（pickNearestFrame，純函式可測）
 *   - 載單幀 PNG → ClimateRasterData（bbox 取自 *_latest.json，min/max 取自 manifest）
 *   - FrameRasterCache：per-dataset LRU（上限 8）+ 相鄰預載
 *
 * 座標系：同一 dataset 各幀共用同一 grid（bbox/dims 固定），故切幀只換 UV 場，
 *         粒子 normalized 位置維持有效 → 體感連續。
 */

import { withLoading } from "../lib/loadingRegistry";
import type { ClimateMeta, ClimateRasterData } from "../map/climateParticleLineLayer";

const FRAMES_BASE = "/climate/frames/";
const MANIFEST_URL = `${FRAMES_BASE}manifest.json`;
const MANIFEST_TTL_MS = 30 * 60 * 1000;
const LRU_MAX = 8;

/**
 * pickNearestFrame 的建議容差上限（18 小時）。
 *
 * 為什麼是 18h：各 dataset 過去段一律是 **daily 00Z**（wind10m / currents 皆然，
 * dust 的 CAMS leadtime 只有 0/24/48/72/96/120 也是 daily），daily 幀的「最壞合法距離」
 * ＝半個間隔＝ 12h（例如 timeline 停在 12:00，前後兩張 00Z 各差 12h）。
 * 取 18h ＝ 12h + 50% 緩衝（吸收 init cycle 偏移、缺 1 張 6h 幀之類的抖動），
 * 同時仍嚴格擋掉「差一天以上」的過期幀 —— 也就是幀窗口停在 7/24、timeline 拉到 8/14
 * 卻硬給 7/24 那張的病灶。
 */
export const FRAME_PICK_TOLERANCE_MS = 18 * 60 * 60 * 1000;

export type FrameKind = "analysis" | "forecast";

export interface ClimateFrame {
  /** ISO8601 UTC 有效時間 */
  t: string;
  /** Date.parse(t)，毫秒 */
  tMs: number;
  /** PNG 路徑（相對 /climate/frames/） */
  png: string;
  /** 向量場值域；scalar dataset（如 dust，PNG 已預烤色階）四者皆 0。 */
  u_min: number;
  u_max: number;
  v_min: number;
  v_max: number;
  kind: FrameKind;
  init_at?: string;
}

export interface ClimateDatasetFrames {
  frames: ClimateFrame[]; // 升冪 by tMs
}

export interface ClimateFramesManifest {
  version: number;
  generated_at: string;
  datasets: Record<string, ClimateDatasetFrames>;
}

// ── 路徑解析（與 climateParticleLineLayer 私有版同語意；此處自帶避免耦合）──
function resolvePublicAssetUrl(path: string): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith("data:")) return path;
  const cleanPath = path.replace(/^\.\//, "").replace(/^\//, "");
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return `${base}/${cleanPath}`;
}

// ── Manifest 載入（TTL cache + 單飛）──
let manifestCache: { at: number; value: ClimateFramesManifest | null } | null = null;
let manifestInflight: Promise<ClimateFramesManifest | null> | null = null;

function normalizeManifest(raw: unknown): ClimateFramesManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const rawDatasets = obj.datasets;
  if (!rawDatasets || typeof rawDatasets !== "object") return null;

  const datasets: Record<string, ClimateDatasetFrames> = {};
  for (const [dsKey, dsVal] of Object.entries(rawDatasets as Record<string, unknown>)) {
    const rawFrames = (dsVal as Record<string, unknown>)?.frames;
    if (!Array.isArray(rawFrames)) continue;
    const frames: ClimateFrame[] = [];
    for (const f of rawFrames) {
      const fr = f as Record<string, unknown>;
      const t = typeof fr.t === "string" ? fr.t : null;
      const png = typeof fr.png === "string" ? fr.png : null;
      const tMs = t ? Date.parse(t) : NaN;
      if (!t || !png || !Number.isFinite(tMs)) continue;
      // 向量場（wind10m / currents）四件套必須齊全且 finite；
      // scalar dataset（dust：PNG 已預烤色階，前端不解 UV）整組缺席 → 視為 0。
      // 「部分缺」仍視為壞資料丟棄，保住向量場的品質檢查。
      const uv = [fr.u_min, fr.u_max, fr.v_min, fr.v_max];
      const uvPresent = uv.filter((n) => n !== undefined && n !== null).length;
      if (uvPresent !== 0 && uvPresent !== 4) continue;
      if (uvPresent === 4 && !uv.every((n) => typeof n === "number" && Number.isFinite(n))) continue;
      frames.push({
        t,
        tMs,
        png,
        u_min: (fr.u_min as number) ?? 0,
        u_max: (fr.u_max as number) ?? 0,
        v_min: (fr.v_min as number) ?? 0,
        v_max: (fr.v_max as number) ?? 0,
        kind: fr.kind === "forecast" ? "forecast" : "analysis",
        init_at: typeof fr.init_at === "string" ? fr.init_at : undefined,
      });
    }
    frames.sort((a, b) => a.tMs - b.tMs);
    datasets[dsKey] = { frames };
  }
  return {
    version: typeof obj.version === "number" ? obj.version : 1,
    generated_at: typeof obj.generated_at === "string" ? obj.generated_at : "",
    datasets,
  };
}

async function fetchManifest(): Promise<ClimateFramesManifest | null> {
  try {
    const r = await fetch(resolvePublicAssetUrl(MANIFEST_URL), { cache: "no-cache" });
    if (!r.ok) throw new Error(`${r.status}`);
    const parsed = normalizeManifest(await r.json());
    manifestCache = { at: Date.now(), value: parsed };
    return parsed;
  } catch {
    // 404 / 解析失敗 → 短暫 cache null，避免每次都重打；上層據此 fallback 到 latest
    manifestCache = { at: Date.now(), value: null };
    return null;
  }
}

export function loadClimateManifest(): Promise<ClimateFramesManifest | null> {
  const now = Date.now();
  if (manifestCache && now - manifestCache.at < MANIFEST_TTL_MS) {
    return Promise.resolve(manifestCache.value);
  }
  if (!manifestInflight) {
    manifestInflight = withLoading(
      "climate-frames-manifest",
      "氣候時間軸清單",
      fetchManifest(),
    ).finally(() => {
      manifestInflight = null;
    });
  }
  return manifestInflight;
}

// ── base meta（bbox/dataset）取自 *_latest.json（同 dataset 各幀共用同 grid）──
const baseMetaCache = new Map<string, Promise<ClimateMeta | null>>();

export function fetchClimateBaseMeta(metaUrl: string): Promise<ClimateMeta | null> {
  let p = baseMetaCache.get(metaUrl);
  if (!p) {
    p = (async () => {
      try {
        const r = await fetch(resolvePublicAssetUrl(metaUrl), { cache: "no-cache" });
        if (!r.ok) throw new Error(`${r.status}`);
        return (await r.json()) as ClimateMeta;
      } catch {
        return null;
      }
    })();
    p.catch(() => baseMetaCache.delete(metaUrl));
    baseMetaCache.set(metaUrl, p);
  }
  return p;
}

// ── 單幀 PNG → ImageData（幀無獨立 meta，dims 由圖片本身給）──
async function loadImageData(url: string): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const resolved = resolvePublicAssetUrl(url);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load frame image: ${resolved}`));
    img.src = resolved;
  });
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d canvas context unavailable");
  ctx.drawImage(image, 0, 0);
  return {
    width: canvas.width,
    height: canvas.height,
    data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
  };
}

export async function loadFrameRaster(frame: ClimateFrame, baseMeta: ClimateMeta): Promise<ClimateRasterData> {
  const img = await loadImageData(`${FRAMES_BASE}${frame.png}`);
  const meta: ClimateMeta = {
    width: img.width,
    height: img.height,
    u_min: frame.u_min,
    u_max: frame.u_max,
    v_min: frame.v_min,
    v_max: frame.v_max,
    bbox: baseMeta.bbox,
    dataset: baseMeta.dataset,
    valid_at: frame.t,
  };
  return { meta, data: img.data };
}

/**
 * 選最接近 targetMs 的幀（兩幀之間取較近者；相等取較早）。
 * frames 假設已依 tMs 升冪；純函式，方便單元測試。
 *
 * @param maxGapMs 容差上限：最近幀距 targetMs 超過此值 → 回 null（「這段沒資料」），
 *   避免幀窗口早已過期還默默給一張幾週前的圖。預設 Infinity ＝ 舊行為（永遠給最近的），
 *   呼叫端請明確傳 {@link FRAME_PICK_TOLERANCE_MS} 或自家 dataset 的合適值。
 */
export function pickNearestFrame(
  frames: ClimateFrame[],
  targetMs: number,
  maxGapMs: number = Infinity,
): ClimateFrame | null {
  if (frames.length === 0) return null;
  let best = frames[0]!;
  let bestDist = Math.abs(best.tMs - targetMs);
  for (let i = 1; i < frames.length; i++) {
    const d = Math.abs(frames[i]!.tMs - targetMs);
    if (d < bestDist) {
      best = frames[i]!;
      bestDist = d;
    }
  }
  return bestDist > maxGapMs ? null : best;
}

/** 幀 PNG 的可載入 URL（含 BASE_URL 前綴）；raster overlay 類圖層直接餵 mapbox image source。 */
export function frameImageUrl(frame: ClimateFrame): string {
  return resolvePublicAssetUrl(`${FRAMES_BASE}${frame.png}`);
}

/** per-dataset LRU raster cache（key = frame.png，Map 插入序即 LRU）。 */
export class FrameRasterCache {
  private readonly cache = new Map<string, Promise<ClimateRasterData>>();
  constructor(
    private readonly baseMeta: ClimateMeta,
    private readonly max: number = LRU_MAX,
  ) {}

  get(frame: ClimateFrame): Promise<ClimateRasterData> {
    const key = frame.png;
    const hit = this.cache.get(key);
    if (hit) {
      // touch LRU：刪後重插 → 移到最新端
      this.cache.delete(key);
      this.cache.set(key, hit);
      return hit;
    }
    const p = loadFrameRaster(frame, this.baseMeta);
    // 載入失敗不 cache 住 rejected promise，下次重試
    p.catch(() => {
      if (this.cache.get(key) === p) this.cache.delete(key);
    });
    this.cache.set(key, p);
    this.evict();
    return p;
  }

  private evict(): void {
    while (this.cache.size > this.max) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }
}
