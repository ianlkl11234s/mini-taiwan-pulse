/**
 * Step 1: 查詢台灣機場過去 N 天的航班清單（Flight Summary Light）
 *
 * Explorer 方案限制：
 *   - Response limit: 20 筆/次
 *   - Rate limit: 10 次/分鐘
 *   - Historic: 30 天
 *   - Monthly credits: 60,000
 *
 * 分頁策略：sort=asc → 用最後一筆 datetime 作為下次查詢起點
 * 支援中斷續接：已完成的機場會自動跳過
 *
 * 使用方式：
 *   npx tsx scripts/fetch-flights.ts
 */

import dotenv from "dotenv";
import { readFileSync, writeFileSync, existsSync } from "fs";
dotenv.config();

// ── 設定 ──────────────────────────────────────────────

const TAIWAN_AIRPORTS = [
  "RCTP", // 桃園國際機場
  "RCSS", // 台北松山機場
  "RCKH", // 高雄國際機場
  "RCMQ", // 台中清泉崗機場
  "RCYU", // 花蓮機場
  "RCBS", // 金門尚義機場
  "RCFG", // 馬祖南竿機場
  "RCFN", // 台南機場
  "RCKU", // 嘉義機場
  "RCNN", // 台東豐年機場
  "RCQC", // 澎湖馬公機場
];

const DAYS_BACK = 3;
const API_BASE = "https://fr24api.flightradar24.com/api";
const PAGE_SIZE = 20;          // Explorer 方案上限
const DELAY_MS = 7000;         // 7s → 安全低於 10 次/分鐘
const MAX_RETRIES = 5;
const OUTPUT_FILE = "scripts/flight-list.json";

// ── 工具 ──────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toISO(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

// ── API 回傳格式 ──────────────────────────────────────

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

// ── 單次 API 呼叫（含 retry） ──────────────────────────

let totalRequests = 0;

async function fetchPage(
  airport: string,
  from: string,
  to: string,
): Promise<FR24FlightSummary[]> {
  const token = process.env.FR24_API_TOKEN;
  if (!token) throw new Error("FR24_API_TOKEN not found in .env");

  const params = new URLSearchParams({
    flight_datetime_from: from,
    flight_datetime_to: to,
    "airports[]": airport,
    limit: String(PAGE_SIZE),
    sort: "asc",
  });

  const url = `${API_BASE}/flight-summary/light?${params}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Accept-Version": "v1",
      },
    });

    totalRequests++;

    if (res.ok) {
      const json = await res.json();
      return Array.isArray(json) ? json : json.data ?? [];
    }

    if (res.status === 429) {
      const waitSec = Math.min(15 * Math.pow(2, attempt - 1), 120);
      process.stdout.write(`\n    ⏳ Rate limit, 等待 ${waitSec}s (${attempt}/${MAX_RETRIES})... `);
      await sleep(waitSec * 1000);
      continue;
    }

    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  throw new Error(`Rate limit: ${MAX_RETRIES} 次重試後仍失敗`);
}

// ── 分頁查詢單一機場 ──────────────────────────────────

async function fetchAirportFlights(
  airport: string,
  from: Date,
  to: Date,
): Promise<FR24FlightSummary[]> {
  const allPages: FR24FlightSummary[] = [];
  let cursor = toISO(from);
  const endStr = toISO(to);
  let page = 1;

  while (true) {
    const results = await fetchPage(airport, cursor, endStr);
    allPages.push(...results);

    process.stdout.write(`[p${page}:${results.length}] `);

    // 不滿 PAGE_SIZE → 已取完
    if (results.length < PAGE_SIZE) break;

    // 用最後一筆的 datetime_takeoff 或 first_seen 作為下次 cursor
    const last = results[results.length - 1]!;
    const lastTime = last.datetime_takeoff || last.first_seen;
    if (!lastTime || lastTime <= cursor) {
      // 防止無限迴圈：時間沒前進就停止
      break;
    }
    cursor = lastTime;
    page++;

    await sleep(DELAY_MS);
  }

  return allPages;
}

// ── 進度管理 ──────────────────────────────────────────

interface ProgressData {
  completed: string[];
  flights: FR24FlightSummary[];
  updated_at: string;
}

function loadProgress(): {
  flights: Map<string, FR24FlightSummary>;
  completed: Set<string>;
} {
  const flights = new Map<string, FR24FlightSummary>();
  const completed = new Set<string>();

  if (existsSync(OUTPUT_FILE)) {
    try {
      const prev = JSON.parse(readFileSync(OUTPUT_FILE, "utf-8")) as ProgressData;
      if (prev.flights && prev.completed) {
        for (const f of prev.flights) flights.set(f.fr24_id, f);
        for (const a of prev.completed) completed.add(a);
      }
    } catch {
      // ignore
    }
  }

  return { flights, completed };
}

function saveProgress(
  flights: Map<string, FR24FlightSummary>,
  completed: Set<string>,
) {
  const data: ProgressData = {
    completed: Array.from(completed),
    flights: Array.from(flights.values()),
    updated_at: new Date().toISOString(),
  };
  writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
}

// ── 主程式 ──────────────────────────────────────────

async function main() {
  console.log("=== FR24 Flight Summary - Step 1 ===");
  console.log("Explorer 方案：20 筆/次, 10 次/分鐘\n");

  const now = new Date();
  const from = new Date(now.getTime() - DAYS_BACK * 24 * 60 * 60 * 1000);
  console.log(`時間範圍: ${toISO(from)} → ${toISO(now)}`);
  console.log(`機場: ${TAIWAN_AIRPORTS.join(", ")}\n`);

  const { flights: allFlights, completed: completedAirports } = loadProgress();

  if (completedAirports.size > 0) {
    console.log(
      `📂 載入進度: ${allFlights.size} 筆航班, ${completedAirports.size}/${TAIWAN_AIRPORTS.length} 座機場\n`,
    );
  }

  const stats: { airport: string; total: number; new: number }[] = [];

  for (const airport of TAIWAN_AIRPORTS) {
    if (completedAirports.has(airport)) {
      console.log(`${airport} ✅ 已完成，跳過`);
      continue;
    }

    process.stdout.write(`${airport} `);

    try {
      const flights = await fetchAirportFlights(airport, from, now);
      let newCount = 0;

      for (const f of flights) {
        if (!allFlights.has(f.fr24_id)) {
          allFlights.set(f.fr24_id, f);
          newCount++;
        }
      }

      console.log(`→ ${flights.length} 筆（新增 ${newCount}）`);
      stats.push({ airport, total: flights.length, new: newCount });
      completedAirports.add(airport);
      saveProgress(allFlights, completedAirports);
    } catch (err) {
      console.log(`→ ❌ ${(err as Error).message}`);
      stats.push({ airport, total: -1, new: 0 });
    }

    await sleep(DELAY_MS);
  }

  // ── 統計 ──
  console.log("\n=== 統計 ===\n");
  if (stats.length > 0) {
    console.log("機場       | 筆數     | 新增");
    console.log("-----------|----------|------");
    for (const s of stats) {
      const ap = s.airport.padEnd(10);
      const tot = s.total === -1 ? "ERR".padStart(8) : String(s.total).padStart(8);
      console.log(`${ap} | ${tot} | ${String(s.new).padStart(4)}`);
    }
  }

  const done = completedAirports.size;
  console.log(`\n進度: ${done}/${TAIWAN_AIRPORTS.length} 座機場`);
  console.log(`不重複航班: ${allFlights.size} 筆`);
  console.log(`API 請求次數: ${totalRequests}`);

  if (done < TAIWAN_AIRPORTS.length) {
    console.log("\n⚠️  尚未完成，等待 rate limit 冷卻後重新執行即可續接。");
  } else {
    console.log("\n✅ 所有機場查詢完成！");
  }

  // 範例
  if (allFlights.size > 0) {
    const sample = allFlights.values().next().value;
    console.log("\n=== 範例（第一筆）===");
    console.log(JSON.stringify(sample, null, 2));
  }
}

main().catch((err) => {
  console.error("\n致命錯誤:", err);
  process.exit(1);
});
