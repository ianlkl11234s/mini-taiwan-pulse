import type { RailSystem, RailSchedule, RailData, RailDeparture, RailStationTime } from "../types";

// 系統定義：ID、顏色、資料路徑
const RAIL_SYSTEMS = [
  { id: "trtc", label: "台北捷運", tracksGlob: "tracks", schedulesGlob: "schedules", color: "#d90023" },
  { id: "thsr", label: "高鐵", tracksGlob: "tracks", schedulesKey: "thsr_schedules", color: "#ee6c00" },
  { id: "tra",  label: "台鐵", tracksGlob: "tracks", schedulesKey: "master_schedule", color: "#6b5ce7" },
  { id: "krtc", label: "高雄捷運", tracksGlob: "tracks", schedulesKey: "krtc_schedules", color: "#f8961e" },
  { id: "klrt", label: "高雄輕軌", tracksGlob: "tracks", schedulesKey: "klrt_schedules", color: "#43aa8b" },
  { id: "tmrt", label: "台中捷運", tracksGlob: "tracks", schedulesKey: "tmrt_schedules", color: "#577590" },
] as const;

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

/**
 * 載入 TRTC 多檔時刻表：每個 track 一個 JSON
 */
async function loadTrtcSchedules(): Promise<Map<string, RailSchedule>> {
  const map = new Map<string, RailSchedule>();

  // 先取得 station_progress 來知道有哪些 track
  const progress = await fetchJSON("/rail/trtc/station_progress.json");
  if (!progress) return map;

  const trackIds = Object.keys(progress);

  // 平行載入所有時刻表
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

/**
 * 載入 THSR 時刻表（優先 daily，fallback 到通用版）
 */
async function loadThsrSchedules(): Promise<Map<string, RailSchedule>> {
  const map = new Map<string, RailSchedule>();

  // 優先用 daily/2026-02-18.json
  let data = await fetchJSON("/rail/thsr/schedules/daily/2026-02-18.json");
  if (!data) {
    data = await fetchJSON("/rail/thsr/schedules/thsr_schedules.json");
  }
  if (!data) return map;

  // THSR 格式：{ "THSR-1-0": {...}, "THSR-1-1": {...} }
  for (const [trackId, schedule] of Object.entries(data)) {
    map.set(trackId, schedule as RailSchedule);
  }

  return map;
}

/**
 * 載入 TRA master_schedule → 轉換為 per-track RailSchedule
 */
async function loadTraSchedules(): Promise<Map<string, RailSchedule>> {
  const map = new Map<string, RailSchedule>();

  const data = await fetchJSON("/rail/tra/master_schedule.json");
  if (!data?.schedules) return map;

  // 按 od_track_id 分組
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
    // 從第一班車推導 stations 列表
    const firstDep = departures[0];
    const stationIds = firstDep ? firstDep.stations.map((s: RailStationTime) => s.station_id) : [];

    map.set(trackId, {
      track_id: trackId,
      route_id: "TRA",
      name: trackId,
      train_color: "#6b5ce7",
      stations: stationIds,
      departures,
    });
  }

  return map;
}

/**
 * 載入通用格式時刻表（KRTC, KLRT, TMRT）
 */
async function loadGenericSchedules(systemId: string, fileName: string): Promise<Map<string, RailSchedule>> {
  const map = new Map<string, RailSchedule>();

  // KRTC/KLRT/TMRT 的時刻表直接放在系統根目錄（不在 schedules/ 子目錄）
  let data = await fetchJSON(`/rail/${systemId}/${fileName}.json`);
  if (!data) {
    data = await fetchJSON(`/rail/${systemId}/schedules/${fileName}.json`);
  }
  if (!data) return map;

  // 格式：{ "trackId": { ...schedule } } 或直接 array
  if (typeof data === "object" && !Array.isArray(data)) {
    for (const [trackId, schedule] of Object.entries(data)) {
      map.set(trackId, schedule as RailSchedule);
    }
  }

  return map;
}

/**
 * 載入軌道 GeoJSON
 */
async function loadTracks(systemId: string): Promise<Map<string, GeoJSON.Feature>> {
  const map = new Map<string, GeoJSON.Feature>();

  // 取得 track 列表：透過 station_progress 的 key 或直接 fetch 目錄
  // 實際策略：從已載入的 schedules 來決定需要哪些 track
  // 先嘗試 fetch manifest，如果沒有就從 station_progress 推導
  const progress = await fetchJSON(`/rail/${systemId}/station_progress.json`);

  let trackIds: string[] = [];
  if (progress) {
    trackIds = Object.keys(progress);
  }

  // TRA 使用 master_schedule.json 裡的 od_track_id
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

  // 平行載入（限制並發數避免瀏覽器限制）
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

/**
 * 載入所有軌道系統資料
 */
export async function loadAllRail(): Promise<RailData> {
  const systems: RailSystem[] = [];
  const allFeatures: GeoJSON.Feature[] = [];

  // 平行載入所有系統
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

  for (const result of results) {
    if (result.status === "fulfilled") {
      systems.push(result.value);

      // 收集所有軌道 Feature 用於 Mapbox 靜態線
      for (const feature of result.value.tracks.values()) {
        allFeatures.push(feature);
      }
    }
  }

  return {
    systems,
    allTracks: {
      type: "FeatureCollection",
      features: allFeatures,
    },
  };
}
