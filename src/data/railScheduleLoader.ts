/**
 * Supabase 鐵道時刻表載入器
 * 參考 mini-taipei-v3 的 useTraData.ts 模式
 *
 * 優先順序：Supabase → S3 → 本地
 */

import { S3_BASE, RAIL_PREFIX } from "./s3Loader";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const S3_RAIL = `${S3_BASE}/${RAIL_PREFIX}`;

/**
 * 從 Supabase reference.daily_schedules 查詢時刻表
 * 嘗試 _daily（指定日期）→ _fixed（固定時刻表）
 */
export async function fetchSupabaseSchedule(
  system: string,
  date: string,
): Promise<unknown | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  for (const suffix of ["_daily", "_fixed"]) {
    const params = new URLSearchParams({
      system: `eq.${system}${suffix}`,
      select: "data",
      ...(suffix === "_daily" ? { schedule_date: `eq.${date}` } : {}),
    });
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/daily_schedules?${params}`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            "Accept-Profile": "reference",
          },
        },
      );
      if (res.ok) {
        const rows = await res.json();
        if (rows.length > 0) return rows[0].data;
      }
    } catch {
      // continue to next suffix
    }
  }
  return null;
}

/**
 * 從 Supabase 查詢可用日期清單
 */
export async function fetchSupabaseDates(
  system: string,
  days: number = 30,
): Promise<string[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [];

  const params = new URLSearchParams({
    system: `eq.${system}_daily`,
    select: "schedule_date",
    order: "schedule_date.desc",
    limit: String(days),
  });
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/daily_schedules?${params}`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          "Accept-Profile": "reference",
        },
      },
    );
    if (res.ok) {
      const rows = await res.json();
      return rows.map((r: { schedule_date: string }) => r.schedule_date);
    }
  } catch {
    // fallthrough
  }
  return [];
}

/**
 * 載入指定日期的 TRA 時刻表（Supabase → S3 → 本地 fallback）
 * 回傳原始 JSON（含 schedules 陣列），由呼叫端 parse
 */
export async function fetchTraDailySchedule(
  date: string,
): Promise<{ schedules: unknown[] } | null> {
  // 1. Supabase
  const supaData = await fetchSupabaseSchedule("tra", date);
  if (supaData && typeof supaData === "object" && (supaData as any).schedules) {
    console.log(`[Rail] TRA schedule from Supabase: ${date}`);
    return supaData as { schedules: unknown[] };
  }

  // 2. S3
  try {
    const [y, m, d] = date.split("-");
    const res = await fetch(`${S3_RAIL}/tra/daily/${y}/${m}/${d}.json`);
    if (res.ok) {
      const data = await res.json();
      if (data?.schedules) {
        console.log(`[Rail] TRA schedule from S3: ${date}`);
        return data;
      }
    }
  } catch {
    // fallthrough
  }

  // 3. 本地
  try {
    const res = await fetch(`/rail/tra/schedules_real/daily/${date}.json`);
    if (res.ok) {
      const data = await res.json();
      if (data?.schedules) {
        console.log(`[Rail] TRA schedule from local: ${date}`);
        return data;
      }
    }
  } catch {
    // fallthrough
  }

  return null;
}

/**
 * 載入指定日期的 THSR 時刻表（Supabase → S3 → 本地 fallback）
 * 回傳 Record<trackId, RailSchedule> 格式
 */
export async function fetchThsrDailySchedule(
  date: string,
): Promise<Record<string, unknown> | null> {
  // 1. Supabase
  const supaData = await fetchSupabaseSchedule("thsr", date);
  if (supaData && typeof supaData === "object") {
    console.log(`[Rail] THSR schedule from Supabase: ${date}`);
    return supaData as Record<string, unknown>;
  }

  // 2. S3
  try {
    const [y, m, d] = date.split("-");
    const res = await fetch(`${S3_RAIL}/thsr/daily/${y}/${m}/${d}.json`);
    if (res.ok) {
      const data = await res.json();
      console.log(`[Rail] THSR schedule from S3: ${date}`);
      return data;
    }
  } catch {
    // fallthrough
  }

  // 3. 本地
  try {
    const res = await fetch(`/rail/thsr/schedules/daily/${date}.json`);
    if (res.ok) {
      const data = await res.json();
      console.log(`[Rail] THSR schedule from local: ${date}`);
      return data;
    }
  } catch {
    // fallthrough
  }

  return null;
}
