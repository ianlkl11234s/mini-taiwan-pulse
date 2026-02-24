import type { RailSystem, RailSchedule, RailData, RailStationTime, TraData, TraDeparture, TraSchedule } from "../types";
import { S3_BASE, RAIL_PREFIX } from "./s3Loader";

// 系統定義：5 系統（不含 TRA，TRA 由 TraTrainEngine 獨立處理）
const RAIL_SYSTEMS = [
  { id: "trtc", label: "台北捷運", tracksGlob: "tracks", schedulesGlob: "schedules", color: "#d90023" },
  { id: "thsr", label: "高鐵", tracksGlob: "tracks", schedulesKey: "thsr_schedules", color: "#ee6c00" },
  { id: "krtc", label: "高雄捷運", tracksGlob: "tracks", schedulesKey: "krtc_schedules", color: "#f8961e" },
  { id: "klrt", label: "高雄輕軌", tracksGlob: "tracks", schedulesKey: "klrt_schedules", color: "#43aa8b" },
  { id: "tmrt", label: "台中捷運", tracksGlob: "tracks", schedulesKey: "tmrt_schedules", color: "#577590" },
] as const;

const SYSTEM_COLOR_MAP = new Map(RAIL_SYSTEMS.map((s) => [s.id, s.color]));

const S3_RAIL = `${S3_BASE}/${RAIL_PREFIX}`;

// ── 共用工具 ──

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

/** 對 RailSystem[] + TraData 做後處理：排除貓空纜車、收集 allTracks（TRA 用 golden tracks 顯示） */
function postProcess(systems: RailSystem[], traData: TraData | null): RailData {
  const allFeatures: GeoJSON.Feature[] = [];

  for (const sys of systems) {
    // 排除貓空纜車 (MK-*)
    if (sys.id === "trtc") {
      for (const key of sys.schedules.keys()) {
        if (key.startsWith("MK-")) sys.schedules.delete(key);
      }
      for (const key of sys.tracks.keys()) {
        if (key.startsWith("MK-")) sys.tracks.delete(key);
      }
    }

    const defaultColor = SYSTEM_COLOR_MAP.get(sys.id) ?? "#ffffff";
    for (const feature of sys.tracks.values()) {
      if (!feature.properties) feature.properties = {};
      if (!feature.properties.color) {
        feature.properties.color = defaultColor;
      }
      allFeatures.push(feature);
    }
  }

  // TRA golden tracks
  if (traData?.goldenTracks) {
    for (const feature of traData.goldenTracks) {
      if (!feature.properties) feature.properties = {};
      if (!feature.properties.color) feature.properties.color = "#7B7B7B";
      allFeatures.push(feature);
    }
  }

  return {
    systems,
    traData,
    allTracks: { type: "FeatureCollection", features: allFeatures },
  };
}

// ── 本地散檔載入 ──

async function loadTrtcSchedules(): Promise<Map<string, RailSchedule>> {
  const map = new Map<string, RailSchedule>();
  const progress = await fetchJSON("/rail/trtc/station_progress.json");
  if (!progress) return map;

  const trackIds = Object.keys(progress);
  const results = await Promise.allSettled(
    trackIds.map(async (trackId) => {
      const data = await fetchJSON(`/rail/trtc/schedules/${trackId}.json`);
      if (data) return { trackId, data };
      return null;
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      const { trackId, data } = result.value;
      map.set(trackId, data as RailSchedule);
    }
  }
  return map;
}

async function loadThsrSchedules(): Promise<Map<string, RailSchedule>> {
  const map = new Map<string, RailSchedule>();
  let data = await fetchJSON("/rail/thsr/schedules/daily/2026-02-18.json");
  if (!data) {
    data = await fetchJSON("/rail/thsr/schedules/thsr_schedules.json");
  }
  if (!data) return map;

  for (const [trackId, schedule] of Object.entries(data)) {
    map.set(trackId, schedule as RailSchedule);
  }
  return map;
}

async function loadGenericSchedules(systemId: string, fileName: string): Promise<Map<string, RailSchedule>> {
  const map = new Map<string, RailSchedule>();
  let data = await fetchJSON(`/rail/${systemId}/${fileName}.json`);
  if (!data) {
    data = await fetchJSON(`/rail/${systemId}/schedules/${fileName}.json`);
  }
  if (!data) return map;

  if (typeof data === "object" && !Array.isArray(data)) {
    for (const [trackId, schedule] of Object.entries(data)) {
      map.set(trackId, schedule as RailSchedule);
    }
  }
  return map;
}

async function loadTracks(systemId: string): Promise<Map<string, GeoJSON.Feature>> {
  const map = new Map<string, GeoJSON.Feature>();
  const progress = await fetchJSON(`/rail/${systemId}/station_progress.json`);

  let trackIds: string[] = [];
  if (progress) {
    trackIds = Object.keys(progress);
  }

  const batchSize = 30;
  for (let i = 0; i < trackIds.length; i += batchSize) {
    const batch = trackIds.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (trackId) => {
        const data = await fetchJSON(`/rail/${systemId}/tracks/${trackId}.geojson`);
        const feature = extractFeature(data);
        if (feature) return { trackId, feature };
        return null;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        map.set(result.value.trackId, result.value.feature);
      }
    }
  }
  return map;
}

// TRA Golden Track IDs（精修顯示用，37 條）
const TRA_GOLDEN_IDS = [
  "WL-N-SL-BD-0", "WL-N-SL-BD-1",
  "WL-N-ZN-SL-0", "WL-N-ZN-SL-1",
  "WL-M-ZN-CH-0", "WL-M-ZN-CH-1", "WL-M-CH-ZN-1",
  "WL-C-CH-ZN-0", "WL-C-ZN-CH-1",
  "WL-S-CH-ZY-0", "WL-S-CH-ZY-1",
  "YL-BD-SA-0", "YL-SA-BD-1",
  "KL-BD-KL-0", "KL-KL-BD-1",
  "BH-SX-HL-0", "BH-HL-SX-1",
  "TL-0", "TL-1",
  "SK-0", "SK-1",
  "PT-0", "PT-1",
  "NW-0", "NW-1",
  "LJ-0", "LJ-1",
  "SH-0", "SH-1",
  "JJ-0", "JJ-1",
  "CZ-0", "CZ-1",
  "PX-0", "PX-1",
  "SA-RF-BD-0", "SA-BD-RF-1",
];

/** 從 GeoJSON 資料提取 Feature（支援 FeatureCollection 和 Feature 兩種格式） */
function extractFeature(data: any): GeoJSON.Feature | null {
  if (!data) return null;
  if (data.type === "FeatureCollection" && data.features?.[0]) return data.features[0] as GeoJSON.Feature;
  if (data.type === "Feature") return data as GeoJSON.Feature;
  return null;
}

/** 載入 TRA golden tracks（顯示用，37 條精修路線） */
async function loadGoldenTracks(): Promise<GeoJSON.Feature[]> {
  const features: GeoJSON.Feature[] = [];
  const results = await Promise.allSettled(
    TRA_GOLDEN_IDS.map(async (id) => {
      const data = await fetchJSON(`/rail/tra/tracks_golden/${id}.geojson`);
      return extractFeature(data);
    })
  );
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) features.push(r.value);
  }
  return features;
}

// ── TRA 專用資料載入 ──

/** 解析 TRA master_schedule.json 為 TraSchedule Map（保留完整車種欄位） */
function parseTraSchedules(masterData: any): Map<string, TraSchedule> {
  const map = new Map<string, TraSchedule>();
  if (!masterData?.schedules) return map;

  const byTrack = new Map<string, TraDeparture[]>();
  for (const train of masterData.schedules) {
    const trackId = train.od_track_id;
    if (!trackId) continue;
    if (!byTrack.has(trackId)) byTrack.set(trackId, []);
    byTrack.get(trackId)!.push({
      departure_time: train.departure_time,
      train_id: train.train_id,
      train_no: train.train_no,
      train_type: train.train_type,
      train_type_code: train.train_type_code,
      total_travel_time: train.total_travel_time,
      origin_station: train.origin_station || "",
      destination_station: train.destination_station || "",
      od_track_id: trackId,
      stations: train.stations as RailStationTime[],
    });
  }

  for (const [trackId, departures] of byTrack) {
    map.set(trackId, { departures });
  }
  return map;
}

/** 載入 TRA O-D 軌道（從 schedules 提取 track IDs） */
async function loadOdTracks(schedules: Map<string, TraSchedule>): Promise<Map<string, GeoJSON.Feature>> {
  const map = new Map<string, GeoJSON.Feature>();
  const trackIds = Array.from(schedules.keys());

  const batchSize = 30;
  for (let i = 0; i < trackIds.length; i += batchSize) {
    const batch = trackIds.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (trackId) => {
        const data = await fetchJSON(`/rail/tra/tracks/${trackId}.geojson`);
        const feature = extractFeature(data);
        if (feature) return { trackId, feature };
        return null;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        map.set(result.value.trackId, result.value.feature);
      }
    }
  }
  return map;
}

/** 從本地散檔載入 TRA 專用資料 */
async function loadTraData(): Promise<TraData | null> {
  const [masterData, stationProgress] = await Promise.all([
    fetchJSON("/rail/tra/master_schedule.json"),
    fetchJSON("/rail/tra/station_progress.json").then((d) => d || {}),
  ]);

  if (!masterData?.schedules) return null;

  const schedules = parseTraSchedules(masterData);
  const [odTracks, goldenTracks] = await Promise.all([
    loadOdTracks(schedules),
    loadGoldenTracks(),
  ]);

  return { schedules, odTracks, stationProgress, goldenTracks };
}

/** 從本地散檔載入 5 系統（不含 TRA） */
async function loadFromLocalFiles(): Promise<{ systems: RailSystem[]; traData: TraData | null }> {
  const [systemResults, traData] = await Promise.all([
    Promise.allSettled(
      RAIL_SYSTEMS.map(async (sys) => {
        let schedules: Map<string, RailSchedule>;

        if (sys.id === "trtc") {
          schedules = await loadTrtcSchedules();
        } else if (sys.id === "thsr") {
          schedules = await loadThsrSchedules();
        } else {
          schedules = await loadGenericSchedules(sys.id, sys.schedulesKey!);
        }

        const [tracks, stationProgress] = await Promise.all([
          loadTracks(sys.id),
          fetchJSON(`/rail/${sys.id}/station_progress.json`).then((d) => d || {}),
        ]);

        return {
          id: sys.id,
          tracks,
          schedules,
          stationProgress,
        } as RailSystem;
      })
    ),
    loadTraData(),
  ]);

  const systems: RailSystem[] = [];
  for (const result of systemResults) {
    if (result.status === "fulfilled") {
      systems.push(result.value);
    }
  }

  return { systems, traData };
}

// ── S3 Bundle Fallback ──

interface RailBundle {
  metadata: { date: string; systems: string[] };
  systems: Record<string, {
    station_progress: Record<string, Record<string, number>>;
    tracks: Record<string, any>;
    tracks_golden?: Record<string, any>;
    schedules: Record<string, any>;
  }>;
}

interface RailManifest {
  lastUpdated: string;
  dates: { date: string; systems: string[] }[];
}

/**
 * 將 bundle 中的 plain object schedules 轉為 Map<string, RailSchedule>
 */
function convertSchedules(rawSchedules: Record<string, any>): Map<string, RailSchedule> {
  const map = new Map<string, RailSchedule>();
  for (const [trackId, schedule] of Object.entries(rawSchedules)) {
    map.set(trackId, schedule as RailSchedule);
  }
  return map;
}

/**
 * 將 bundle 中的 plain object tracks 轉為 Map<string, GeoJSON.Feature>
 */
function convertTracks(rawTracks: Record<string, any>): Map<string, GeoJSON.Feature> {
  const map = new Map<string, GeoJSON.Feature>();
  for (const [trackId, data] of Object.entries(rawTracks)) {
    const feature = extractFeature(data);
    if (feature) {
      map.set(trackId, feature);
    }
  }
  return map;
}

/** 從 bundle 中提取 TRA 專用資料 */
function extractTraDataFromBundle(sysData: RailBundle["systems"][string]): TraData | null {
  // bundle 裡 TRA 存的是 { "master_schedule": { schedules: [...] } }
  const masterData = sysData.schedules["master_schedule"];
  if (!masterData?.schedules) return null;

  const schedules = parseTraSchedules(masterData);
  const odTracks = convertTracks(sysData.tracks);
  const stationProgress = sysData.station_progress;

  let goldenTracks: GeoJSON.Feature[] = [];
  if (sysData.tracks_golden) {
    const goldenMap = convertTracks(sysData.tracks_golden);
    goldenTracks = Array.from(goldenMap.values());
  }

  return { schedules, odTracks, stationProgress, goldenTracks };
}

/** 將 S3 bundle 解包為 RailSystem[] + TraData */
function unbundleRailData(bundle: RailBundle): { systems: RailSystem[]; traData: TraData | null } {
  const systems: RailSystem[] = [];
  let traData: TraData | null = null;

  // 5 個非 TRA 系統
  for (const sys of RAIL_SYSTEMS) {
    const sysData = bundle.systems[sys.id];
    if (!sysData) continue;

    systems.push({
      id: sys.id,
      tracks: convertTracks(sysData.tracks),
      schedules: convertSchedules(sysData.schedules),
      stationProgress: sysData.station_progress,
    });
  }

  // TRA 獨立提取
  const traSysData = bundle.systems["tra"];
  if (traSysData) {
    traData = extractTraDataFromBundle(traSysData);
  }

  return { systems, traData };
}

/** 從 S3 bundle 載入軌道資料 */
async function loadFromS3Bundle(): Promise<{ systems: RailSystem[]; traData: TraData | null }> {
  const manifestRes = await fetch(`${S3_RAIL}/manifest.json`);
  if (!manifestRes.ok) throw new Error("Rail S3 manifest not available");
  const manifest: RailManifest = await manifestRes.json();

  if (manifest.dates.length === 0) throw new Error("Rail S3 manifest has no dates");

  const fetches = manifest.dates.map(async (d) => {
    const [y, m, dd] = d.date.split("-");
    const res = await fetch(`${S3_RAIL}/${y}/${m}/${dd}/bundle.json`);
    if (!res.ok) return null;
    return (await res.json()) as RailBundle;
  });

  const results = await Promise.all(fetches);
  const valid = results.filter((r): r is RailBundle => r !== null);

  if (valid.length === 0) throw new Error("No rail bundle from S3");

  return unbundleRailData(valid[0]!);
}

// ── 公開 API ──

/**
 * 載入所有軌道系統資料：本地散檔優先 → S3 bundle fallback
 */
export async function loadAllRail(): Promise<RailData> {
  let systems: RailSystem[];
  let traData: TraData | null = null;

  // 1. 嘗試本地散檔
  try {
    const local = await loadFromLocalFiles();
    systems = local.systems;
    traData = local.traData;
    const hasData = systems.some((s) => s.tracks.size > 0 || s.schedules.size > 0) || traData !== null;
    if (hasData) {
      const goldenCount = traData?.goldenTracks?.length ?? 0;
      const traScheduleCount = traData?.schedules?.size ?? 0;
      console.log(`[Rail] Loaded from local files (${systems.length} systems, TRA: ${traScheduleCount} tracks, ${goldenCount} golden tracks)`);
      return postProcess(systems, traData);
    }
  } catch {
    // fall through to S3
  }

  // 2. S3 bundle fallback
  console.log("[Rail] Local files unavailable, loading from S3 bundle...");
  const s3Result = await loadFromS3Bundle();
  systems = s3Result.systems;
  traData = s3Result.traData;
  const goldenCount = traData?.goldenTracks?.length ?? 0;
  console.log(`[Rail] Loaded from S3 bundle (${systems.length} systems, ${goldenCount} golden tracks)`);
  return postProcess(systems, traData);
}
