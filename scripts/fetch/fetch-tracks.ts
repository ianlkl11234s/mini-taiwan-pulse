/**
 * Step 2: 根據 Step 1 的航班清單，逐一撈取飛行軌跡
 *
 * 使用方式：
 *   npx tsx scripts/fetch-tracks.ts --date 2026-02-18
 *
 * 參數：
 *   --date YYYY-MM-DD  只處理該日期的航班（依 datetime_takeoff）
 *   不帶 --date 則處理全部航班
 *
 * Explorer 方案限制：
 *   - Response limit: 20 筆/次
 *   - Rate limit: 10 次/分鐘
 *
 * 支援中斷續接：已取得軌跡的航班會自動跳過
 */

import dotenv from "dotenv";
import { readFileSync, writeFileSync, existsSync } from "fs";
dotenv.config();

// ── 設定 ──────────────────────────────────────────────

const API_BASE = "https://fr24api.flightradar24.com/api";
const DELAY_MS = 7000;
const MAX_RETRIES = 5;

const INPUT_FILE = "scripts/flight-list.json";
const PROGRESS_FILE = "scripts/track-progress.json";
const OUTPUT_FILE = "public/aviation_data.json";

// ── 型別 ──────────────────────────────────────────────

interface FR24FlightSummary {
  fr24_id: string;
  flight: string;
  callsign: string;
  operating_as: string;
  painted_as: string;
  type: string;
  reg: string;
  orig_icao: string;
  dest_icao: string;
  dest_icao_actual: string;
  datetime_takeoff: string;
  datetime_landed: string;
  hex: string;
  first_seen: string;
  last_seen: string;
  flight_ended: boolean;
  [key: string]: unknown;
}

/** 最終輸出格式（與 app 的 Flight 介面一致） */
interface FlightOutput {
  fr24_id: string;
  callsign: string;
  registration: string;
  aircraft_type: string;
  origin_icao: string;
  origin_iata: string;
  dest_icao: string;
  dest_iata: string;
  dep_time: number;
  arr_time: number;
  status: string;
  trail_points: number;
  path: [number, number, number, number][];
}

// ── 工具 ──────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isoToUnix(iso: string): number {
  return iso ? Math.floor(new Date(iso).getTime() / 1000) : 0;
}

// ── API 呼叫 ──────────────────────────────────────────

let totalRequests = 0;

async function fetchTrack(fr24Id: string): Promise<unknown> {
  const token = process.env.FR24_API_TOKEN;
  if (!token) throw new Error("FR24_API_TOKEN not found in .env");

  const url = `${API_BASE}/flight-tracks?flight_id=${fr24Id}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Accept-Version": "v1",
      },
    });

    totalRequests++;

    if (res.ok) {
      return await res.json();
    }

    if (res.status === 429) {
      const waitSec = Math.min(15 * Math.pow(2, attempt - 1), 120);
      process.stdout.write(
        `\n    ⏳ Rate limit, 等待 ${waitSec}s (${attempt}/${MAX_RETRIES})... `,
      );
      await sleep(waitSec * 1000);
      continue;
    }

    if (res.status === 404) {
      return null; // 軌跡不存在
    }

    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  throw new Error(`Rate limit: ${MAX_RETRIES} 次重試後仍失敗`);
}

// ── 軌跡解析 ──────────────────────────────────────────

function parseTrackPoints(
  raw: unknown,
): [number, number, number, number][] | null {
  if (!raw || typeof raw !== "object") return null;

  // 嘗試多種可能的回傳結構
  const data = (raw as Record<string, unknown>).data ?? raw;
  let tracks: unknown[] = [];

  if (Array.isArray(data)) {
    // { data: [ { fr24_id, tracks: [...] } ] }
    const first = data[0] as Record<string, unknown> | undefined;
    if (first?.tracks && Array.isArray(first.tracks)) {
      tracks = first.tracks;
    } else {
      tracks = data;
    }
  } else if (
    typeof data === "object" &&
    data !== null &&
    "tracks" in data
  ) {
    tracks = (data as Record<string, unknown>).tracks as unknown[];
  }

  if (tracks.length === 0) return null;

  const points: [number, number, number, number][] = [];

  for (const pt of tracks) {
    if (!pt || typeof pt !== "object") continue;
    const p = pt as Record<string, unknown>;

    // 嘗試多種欄位名
    const lat = Number(p.lat ?? p.latitude ?? 0);
    const lng = Number(p.lng ?? p.lon ?? p.longitude ?? 0);
    const alt = Number(
      p.alt ?? p.altitude ?? p.alt_baro ?? p.altitude_m ?? 0,
    );
    const ts = Number(
      p.timestamp
        ? typeof p.timestamp === "string"
          ? isoToUnix(p.timestamp)
          : p.timestamp
        : p.ts ?? 0,
    );

    if (lat !== 0 && lng !== 0 && ts !== 0) {
      // 如果高度單位是 feet，轉換為 meters
      // FR24 API 通常回傳 feet
      const altM = alt > 1000 ? Math.round(alt * 0.3048) : alt;
      points.push([lat, lng, altM, ts]);
    }
  }

  return points.length > 0 ? points : null;
}

// ── 進度管理 ──────────────────────────────────────────

interface ProgressData {
  completed: Record<string, FlightOutput>; // fr24_id → output
  failed: string[]; // fr24_id list
  updated_at: string;
}

function loadProgress(): ProgressData {
  if (existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
    } catch {
      // ignore
    }
  }
  return { completed: {}, failed: [], updated_at: "" };
}

function saveProgress(progress: ProgressData) {
  progress.updated_at = new Date().toISOString();
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress));
}

// ── 主程式 ──────────────────────────────────────────

async function main() {
  console.log("=== FR24 Flight Tracks - Step 2 ===\n");

  // 解析 --date 參數
  const dateIdx = process.argv.indexOf("--date");
  const dateFilter = dateIdx !== -1 ? process.argv[dateIdx + 1] : null;

  // 讀取 Step 1 航班清單
  if (!existsSync(INPUT_FILE)) {
    console.error(`❌ 找不到 ${INPUT_FILE}，請先執行 Step 1`);
    process.exit(1);
  }

  const inputData = JSON.parse(readFileSync(INPUT_FILE, "utf-8"));
  const allSummaries: FR24FlightSummary[] = inputData.flights ?? inputData;

  // 篩選日期
  let targets: FR24FlightSummary[];
  if (dateFilter) {
    targets = allSummaries.filter((f) => {
      const dt = (f.datetime_takeoff || f.first_seen || "").slice(0, 10);
      return dt === dateFilter;
    });
    console.log(`日期篩選: ${dateFilter}`);
  } else {
    targets = allSummaries;
    console.log("日期篩選: 全部");
  }
  console.log(`目標航班: ${targets.length} 筆\n`);

  // 載入進度
  const progress = loadProgress();
  const doneCount = Object.keys(progress.completed).length;
  const failSet = new Set(progress.failed);

  if (doneCount > 0) {
    console.log(
      `📂 載入進度: ${doneCount} 筆已完成, ${failSet.size} 筆失敗\n`,
    );
  }

  // 篩掉已完成的
  const todo = targets.filter(
    (f) => !progress.completed[f.fr24_id] && !failSet.has(f.fr24_id),
  );
  console.log(`待處理: ${todo.length} 筆\n`);

  if (todo.length === 0 && doneCount > 0) {
    console.log("✅ 所有航班已處理完成！");
    writeOutput(progress);
    return;
  }

  let successCount = 0;
  let failCount = 0;
  let emptyCount = 0;
  let firstLogged = doneCount === 0;

  for (let i = 0; i < todo.length; i++) {
    const flight = todo[i]!;
    const pct = ((doneCount + i + 1) / targets.length * 100).toFixed(1);
    process.stdout.write(
      `[${doneCount + i + 1}/${targets.length}] ${pct}% ${flight.callsign || flight.flight} (${flight.fr24_id}) ... `,
    );

    try {
      const raw = await fetchTrack(flight.fr24_id);

      // 第一筆成功時 log 完整回傳結構
      if (!firstLogged && raw) {
        console.log("\n\n=== 首筆 API 回傳結構 ===");
        console.log(JSON.stringify(raw, null, 2).slice(0, 2000));
        console.log("=== END ===\n");
        firstLogged = true;
      }

      const points = parseTrackPoints(raw);

      if (points && points.length >= 2) {
        const output: FlightOutput = {
          fr24_id: flight.fr24_id,
          callsign: flight.callsign || flight.flight || "",
          registration: flight.reg || "",
          aircraft_type: flight.type || "",
          origin_icao: flight.orig_icao || "",
          origin_iata: "",
          dest_icao: flight.dest_icao || "",
          dest_iata: "",
          dep_time: isoToUnix(flight.datetime_takeoff),
          arr_time: isoToUnix(flight.datetime_landed),
          status: flight.flight_ended ? "landed" : "active",
          trail_points: points.length,
          path: points,
        };

        progress.completed[flight.fr24_id] = output;
        successCount++;
        console.log(`✅ ${points.length} 點`);
      } else {
        progress.failed.push(flight.fr24_id);
        emptyCount++;
        console.log("⚪ 無軌跡");
      }
    } catch (err) {
      progress.failed.push(flight.fr24_id);
      failCount++;
      console.log(`❌ ${(err as Error).message}`);
    }

    // 每 10 筆存一次進度
    if ((i + 1) % 10 === 0) {
      saveProgress(progress);
    }

    await sleep(DELAY_MS);
  }

  saveProgress(progress);

  // ── 統計 ──
  const totalDone = Object.keys(progress.completed).length;
  console.log("\n=== 統計 ===\n");
  console.log(`成功取得軌跡: ${successCount} 筆（本次）`);
  console.log(`無軌跡資料:   ${emptyCount} 筆`);
  console.log(`失敗:         ${failCount} 筆`);
  console.log(`累計完成:     ${totalDone} 筆`);
  console.log(`API 請求次數: ${totalRequests}`);

  // 寫出最終檔案
  writeOutput(progress);
}

function writeOutput(progress: ProgressData) {
  const flights = Object.values(progress.completed);
  if (flights.length === 0) {
    console.log("\n⚠️ 沒有軌跡資料可輸出");
    return;
  }

  // 依 dep_time 排序
  flights.sort((a, b) => a.dep_time - b.dep_time);
  writeFileSync(OUTPUT_FILE, JSON.stringify(flights, null, 2));
  console.log(`\n📁 已輸出 ${flights.length} 筆至 ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("\n致命錯誤:", err);
  process.exit(1);
});
