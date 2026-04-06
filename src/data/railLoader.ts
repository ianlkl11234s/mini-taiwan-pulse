import type { RailSystem, RailSchedule, RailData, RailStationTime, TraData, TraDeparture, TraSchedule } from "../types";
import { fetchSupabaseSchedule } from "./railScheduleLoader";
import { todayTaiwan } from "../lib/supabase";

// 系統定義：5 系統（不含 TRA，TRA 由 TraTrainEngine 獨立處理）
const RAIL_SYSTEMS = [
  { id: "trtc", label: "台北捷運", tracksGlob: "tracks", schedulesGlob: "schedules", color: "#d90023" },
  { id: "thsr", label: "高鐵", tracksGlob: "tracks", schedulesKey: "thsr_schedules", color: "#ee6c00" },
  { id: "krtc", label: "高雄捷運", tracksGlob: "tracks", schedulesKey: "krtc_schedules", color: "#f8961e" },
  { id: "klrt", label: "高雄輕軌", tracksGlob: "tracks", schedulesKey: "klrt_schedules", color: "#43aa8b" },
  { id: "tmrt", label: "台中捷運", tracksGlob: "tracks", schedulesKey: "tmrt_schedules", color: "#577590" },
] as const;

const SYSTEM_COLOR_MAP = new Map(RAIL_SYSTEMS.map((s) => [s.id, s.color]));

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

    const defaultColor = SYSTEM_COLOR_MAP.get(sys.id as typeof RAIL_SYSTEMS[number]["id"]) ?? "#ffffff";
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

/**
 * 從 Supabase 載入時刻表（_daily → _fixed fallback）
 * TRTC 資料是 array（每項含 track_id），其餘系統是 dict（key = trackId）
 */
async function loadSchedulesFromSupabase(systemId: string): Promise<Map<string, RailSchedule> | null> {
  try {
    const data = await fetchSupabaseSchedule(systemId, todayTaiwan());
    if (!data) return null;

    const map = new Map<string, RailSchedule>();

    if (Array.isArray(data)) {
      // TRTC format: array of schedules, each with track_id
      for (const item of data) {
        if (item && typeof item === "object" && item.track_id) {
          map.set(item.track_id, item as RailSchedule);
        }
      }
    } else if (typeof data === "object") {
      // KRTC/KLRT/TMRT/THSR format: { trackId: schedule }
      for (const [trackId, schedule] of Object.entries(data as Record<string, unknown>)) {
        map.set(trackId, schedule as RailSchedule);
      }
    }

    if (map.size > 0) {
      console.log(`[Rail] ${systemId} schedules from Supabase (${map.size} tracks)`);
      return map;
    }
  } catch {
    // fall through to local
  }
  return null;
}

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
        // Supabase 優先，本地散檔 fallback
        let schedules: Map<string, RailSchedule> | null = await loadSchedulesFromSupabase(sys.id);

        if (!schedules) {
          if (sys.id === "trtc") {
            schedules = await loadTrtcSchedules();
          } else if (sys.id === "thsr") {
            schedules = await loadThsrSchedules();
          } else {
            schedules = await loadGenericSchedules(sys.id, sys.schedulesKey!);
          }
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

// ── 公開 API ──

/**
 * 載入所有軌道系統資料（本地散檔 + Supabase 時刻表）
 */
export async function loadAllRail(): Promise<RailData> {
  const local = await loadFromLocalFiles();
  const { systems, traData } = local;
  const goldenCount = traData?.goldenTracks?.length ?? 0;
  const traScheduleCount = traData?.schedules?.size ?? 0;
  console.log(`[Rail] Loaded (${systems.length} systems, TRA: ${traScheduleCount} tracks, ${goldenCount} golden tracks)`);
  return postProcess(systems, traData);
}
