import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!supabaseConfigured) {
  console.error(
    "[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — " +
    "請在部署平台設定環境變數（Vite 會在 build 時 inline，需於 build 階段存在）"
  );
}

/**
 * 缺少 env 時回傳一個 stub client：所有 .from() / .rpc() 呼叫會 reject，
 * 但不會在 import 階段 crash 整個 app。
 */
function createStubClient(): SupabaseClient {
  const err = new Error("Supabase not configured");
  const rejected = () => Promise.resolve({ data: null, error: err });
  const stubBuilder: any = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "then") return undefined;
        if (prop === Symbol.iterator) return undefined;
        return (..._args: unknown[]) => stubBuilder;
      },
    },
  );
  // 讓 await 取得 { data: null, error }
  stubBuilder.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: err });
  return {
    from: () => stubBuilder,
    rpc: rejected,
  } as unknown as SupabaseClient;
}

export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
  : createStubClient();

/** 取得台灣時間的今天日期 YYYY-MM-DD */
export function todayTaiwan(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}
