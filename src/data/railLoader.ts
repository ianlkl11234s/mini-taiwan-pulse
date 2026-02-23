import type { RailSystem, RailSchedule, RailData, RailDeparture, RailStationTime } from "../types";
import { S3_BASE, RAIL_PREFIX } from "./s3Loader";

// 系統定義：ID、顏色、資料路徑
const RAIL_SYSTEMS = [
  { id: "trtc", label: "台北捷運", tracksGlob: "tracks", schedulesGlob: "schedules", color: "#d90023" },
  { id: "thsr", label: "高鐵", tracksGlob: "tracks", schedulesKey: "thsr_schedules", color: "#ee6c00" },
  { id: "tra",  label: "台鐵", tracksGlob: "tracks", schedulesKey: "master_schedule", color: "#7B7B7B" },
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

/** 對 RailSystem[] 做後處理：排除貓空纜車、收集 allTracks（TRA 用 golden tracks 顯示） */
function postProcess(systems: RailSystem[], traGoldenFeatures?: GeoJSON.Feature[]): RailData {
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

    // TRA: 有 golden tracks 則用 golden tracks 做顯示，跳過 O-D tracks
    if (sys.id === "tra" && traGoldenFeatures && traGoldenFeatures.length > 0) {
      for (const feature of traGoldenFeatures) {
        if (!feature.properties) feature.properties = {};
        if (!feature.properties.color) feature.properties.color = "#7B7B7B";
        allFeatures.push(feature);
      }
      continue;
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

  return {
    systems,
    allTracks: { type: "FeatureCollection", features: allFeatures },
  };
}

// ── 本地散檔載入（現有邏輯） ──

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

async function loadTraSchedules(): Promise<Map<string, RailSchedule>> {
  const map = new Map<string, RailSchedule>();
  const data = await fetchJSON("/rail/tra/master_schedule.json");
  if (!data?.schedules) return map;

  const byTrack = new Map<string, RailDeparture[]>();
  for (const train of data.schedules) {
    const trackId = train.od_track_id;
    if (!trackId) continue;
    if (!byTrack.has(trackId)) byTrack.set(trackId, []);
    byTrack.get(trackId)!.push({
      departure_time: train.departure_time,
      train_id: train.train_id,
      total_travel_time: train.total_travel_time,
      stations: train.stations as RailStationTime[],
    });
  }

  for (const [trackId, departures] of byTrack) {
    const firstDep = departures[0];
    const stationIds = firstDep ? firstDep.stations.map((s: RailStationTime) => s.station_id) : [];
    map.set(trackId, {
      track_id: trackId,
      route_id: "TRA",
      name: trackId,
      train_color: "#7B7B7B",
      stations: stationIds,
      departures,
    });
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

  if (systemId === "tra") {
    const masterData = await fetchJSON("/rail/tra/master_schedule.json");
    if (masterData?.schedules) {
      const ids = new Set<string>();
      for (const train of masterData.schedules) {
        if (train.od_track_id) ids.add(train.od_track_id);
      }
      trackIds = Array.from(ids);
    }
  }

  const batchSize = 30;
  for (let i = 0; i < trackIds.length; i += batchSize) {
    const batch = trackIds.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (trackId) => {
        const data = await fetchJSON(`/rail/${systemId}/tracks/${trackId}.geojson`);
        if (data?.features?.[0]) return { trackId, feature: data.features[0] as GeoJSON.Feature };
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

/** 載入 TRA golden tracks（顯示用，37 條精修路線） */
async function loadGoldenTracks(): Promise<GeoJSON.Feature[]> {
  const features: GeoJSON.Feature[] = [];
  const results = await Promise.allSettled(
    TRA_GOLDEN_IDS.map(async (id) => {
      const data = await fetchJSON(`/rail/tra/tracks_golden/${id}.geojson`);
      if (data?.features?.[0]) return data.features[0] as GeoJSON.Feature;
      return null;
    })
  );
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) features.push(r.value);
  }
  return features;
}

/** 從本地散檔載入所有系統 */
async function loadFromLocalFiles(): Promise<{ systems: RailSystem[]; traGoldenFeatures: GeoJSON.Feature[] }> {
  const results = await Promise.allSettled(
    RAIL_SYSTEMS.map(async (sys) => {
      let schedules: Map<string, RailSchedule>;

      if (sys.id === "trtc") {
        schedules = await loadTrtcSchedules();
      } else if (sys.id === "thsr") {
        schedules = await loadThsrSchedules();
      } else if (sys.id === "tra") {
        schedules = await loadTraSchedules();
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
  );

  const systems: RailSystem[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      systems.push(result.value);
    }
  }

  // 同時載入 TRA golden tracks
  const traGoldenFeatures = await loadGoldenTracks();

  return { systems, traGoldenFeatures };
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
 * 將 bundle 中 TRA 的 master_schedule 格式轉換為 per-track RailSchedule Map
 */
function convertTraSchedules(rawSchedules: Record<string, any>): Map<string, RailSchedule> {
  const map = new Map<string, RailSchedule>();

  // bundle 裡 TRA 存的是 { "master_schedule": { schedules: [...] } }
  const masterData = rawSchedules["master_schedule"];
  if (!masterData?.schedules) return map;

  const byTrack = new Map<string, RailDeparture[]>();
  for (const train of masterData.schedules) {
    const trackId = train.od_track_id;
    if (!trackId) continue;
    if (!byTrack.has(trackId)) byTrack.set(trackId, []);
    byTrack.get(trackId)!.push({
      departure_time: train.departure_time,
      train_id: train.train_id,
      total_travel_time: train.total_travel_time,
      stations: train.stations as RailStationTime[],
    });
  }

  for (const [trackId, departures] of byTrack) {
    const firstDep = departures[0];
    const stationIds = firstDep ? firstDep.stations.map((s: RailStationTime) => s.station_id) : [];
    map.set(trackId, {
      track_id: trackId,
      route_id: "TRA",
      name: trackId,
      train_color: "#7B7B7B",
      stations: stationIds,
      departures,
    });
  }
  return map;
}

/**
 * 將 bundle 中的 plain object schedules 轉為 Map<string, RailSchedule>
 */
function convertSchedules(systemId: string, rawSchedules: Record<string, any>): Map<string, RailSchedule> {
  if (systemId === "tra") {
    return convertTraSchedules(rawSchedules);
  }

  // TRTC / THSR / KRTC / KLRT / TMRT：直接 { trackId: RailSchedule }
  const map = new Map<string, RailSchedule>();
  for (const [trackId, schedule] of Object.entries(rawSchedules)) {
    map.set(trackId, schedule as RailSchedule);
  }
  return map;
}

/**
 * 將 bundle 中的 plain object tracks 轉為 Map<string, GeoJSON.Feature>
 *
 * bundle 格式：{ trackId: GeoJSON.FeatureCollection }
 */
function convertTracks(rawTracks: Record<string, any>): Map<string, GeoJSON.Feature> {
  const map = new Map<string, GeoJSON.Feature>();
  for (const [trackId, data] of Object.entries(rawTracks)) {
    if (data?.features?.[0]) {
      map.set(trackId, data.features[0] as GeoJSON.Feature);
    }
  }
  return map;
}

/** 將 S3 bundle 解包為 RailSystem[] + golden tracks */
function unbundleRailData(bundle: RailBundle): { systems: RailSystem[]; traGoldenFeatures: GeoJSON.Feature[] } {
  const systems: RailSystem[] = [];
  let traGoldenFeatures: GeoJSON.Feature[] = [];

  for (const sys of RAIL_SYSTEMS) {
    const sysData = bundle.systems[sys.id];
    if (!sysData) continue;

    systems.push({
      id: sys.id,
      tracks: convertTracks(sysData.tracks),
      schedules: convertSchedules(sys.id, sysData.schedules),
      stationProgress: sysData.station_progress,
    });

    // TRA: 解包 golden tracks
    if (sys.id === "tra" && sysData.tracks_golden) {
      const goldenMap = convertTracks(sysData.tracks_golden);
      traGoldenFeatures = Array.from(goldenMap.values());
    }
  }
  return { systems, traGoldenFeatures };
}

/** 從 S3 bundle 載入軌道資料 */
async function loadFromS3Bundle(): Promise<{ systems: RailSystem[]; traGoldenFeatures: GeoJSON.Feature[] }> {
  const manifestRes = await fetch(`${S3_RAIL}/manifest.json`);
  if (!manifestRes.ok) throw new Error("Rail S3 manifest not available");
  const manifest: RailManifest = await manifestRes.json();

  if (manifest.dates.length === 0) throw new Error("Rail S3 manifest has no dates");

  // 下載所有日期的 bundle（通常只有一個）
  const fetches = manifest.dates.map(async (d) => {
    const [y, m, dd] = d.date.split("-");
    const res = await fetch(`${S3_RAIL}/${y}/${m}/${dd}/bundle.json`);
    if (!res.ok) return null;
    return (await res.json()) as RailBundle;
  });

  const results = await Promise.all(fetches);
  const valid = results.filter((r): r is RailBundle => r !== null);

  if (valid.length === 0) throw new Error("No rail bundle from S3");

  // 取第一個有效 bundle（多日期時合併到第一個即可）
  return unbundleRailData(valid[0]!);
}

// ── 公開 API ──

/**
 * 載入所有軌道系統資料：本地散檔優先 → S3 bundle fallback
 */
export async function loadAllRail(): Promise<RailData> {
  let systems: RailSystem[];
  let traGoldenFeatures: GeoJSON.Feature[] = [];

  // 1. 嘗試本地散檔
  try {
    const local = await loadFromLocalFiles();
    systems = local.systems;
    traGoldenFeatures = local.traGoldenFeatures;
    // 檢查是否有實際資料（至少一個系統有 tracks 或 schedules）
    const hasData = systems.some((s) => s.tracks.size > 0 || s.schedules.size > 0);
    if (hasData) {
      console.log(`[Rail] Loaded from local files (${systems.length} systems, ${traGoldenFeatures.length} golden tracks)`);
      return postProcess(systems, traGoldenFeatures);
    }
  } catch {
    // fall through to S3
  }

  // 2. S3 bundle fallback
  console.log("[Rail] Local files unavailable, loading from S3 bundle...");
  const s3Result = await loadFromS3Bundle();
  systems = s3Result.systems;
  traGoldenFeatures = s3Result.traGoldenFeatures;
  console.log(`[Rail] Loaded from S3 bundle (${systems.length} systems, ${traGoldenFeatures.length} golden tracks)`);
  return postProcess(systems, traGoldenFeatures);
}
