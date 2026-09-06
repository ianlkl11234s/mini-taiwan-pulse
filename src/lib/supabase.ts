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

// ── AR-01: 韌性 fetch wrapper（併發上限 / timeout / retry） ──
//
// DB 變慢時用戶重整會讓瀏覽器同時射出數十個 RPC 雪崩，故：
// 1. 全域同時進行請求上限 8，超過進 FIFO queue
// 2. 每請求 30s timeout（AbortController；與 caller 自帶 signal 合成）
// 3. 網路層錯誤（fetch TypeError）與 5xx / 429 最多 retry 2 次
//    （backoff 500ms / 1500ms + jitter）；caller 主動 abort、timeout 不 retry
// 4. REST 寫入、Auth POST 與寫入類 RPC 一律不 retry（重送會重複寫入）
// 錯誤最終仍 throw / 交給 supabase-js 轉成 { error } 給 caller —— 不吞錯，
// loadingRegistry 錯誤態依賴這點。

const MAX_CONCURRENT_REQUESTS = 8;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_BACKOFF_MS = [500, 1500] as const;

/** 寫入類 RPC denylist（2026-07 盤點：全 repo 僅 log_session_events 會寫入） */
const WRITE_RPC_DENYLIST = ["log_session_events"] as const;

let activeRequests = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      activeRequests++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeRequests--;
  waitQueue.shift()?.();
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function isWriteRpc(input: RequestInfo | URL): boolean {
  const url = requestUrl(input);
  return WRITE_RPC_DENYLIST.some((name) => url.includes(`/rpc/${name}`));
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  return (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
}

/** 只有明確 read 的 REST，以及 denylist 外的 RPC 可以重試。 */
function isRetryableRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const url = requestUrl(input);
  const method = requestMethod(input, init);
  if (url.includes("/rpc/")) return !isWriteRpc(input);
  if (url.includes("/auth/")) return method === "GET" || method === "HEAD";
  return method === "GET" || method === "HEAD";
}

function backoffDelay(attempt: number): number {
  const base = RETRY_BACKOFF_MS[attempt] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]!;
  return base + Math.random() * 250; // jitter
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : null);
  const retryable = isRetryableRequest(input, init);

  for (let attempt = 0; ; attempt++) {
    await acquireSlot();
    const timeoutCtrl = new AbortController();
    const timer = setTimeout(
      () =>
        timeoutCtrl.abort(
          new DOMException(`Supabase request timeout (${REQUEST_TIMEOUT_MS}ms)`, "TimeoutError"),
        ),
      REQUEST_TIMEOUT_MS,
    );
    const signal = callerSignal
      ? AbortSignal.any([callerSignal, timeoutCtrl.signal])
      : timeoutCtrl.signal;

    let retryDelay: number | null = null;
    try {
      const res = await fetch(input, { ...init, signal });
      if (retryable && attempt < MAX_RETRIES && (res.status >= 500 || res.status === 429)) {
        void res.body?.cancel().catch(() => {});
        retryDelay = backoffDelay(attempt);
      } else {
        return res;
      }
    } catch (err) {
      // abort（caller 主動或 timeout）拋的是 DOMException，不是 TypeError → 不 retry
      const isNetworkError = err instanceof TypeError;
      if (retryable && isNetworkError && !callerSignal?.aborted && attempt < MAX_RETRIES) {
        retryDelay = backoffDelay(attempt);
      } else {
        throw err;
      }
    } finally {
      clearTimeout(timer);
      releaseSlot();
    }
    await sleep(retryDelay ?? 0);
  }
}

/** 測試用：避免把 retry 分類規則散落在測試的 mock 實作。 */
export const __test__ = { resilientFetch, isRetryableRequest };

export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { fetch: resilientFetch },
    })
  : createStubClient();

/** 取得台灣時間的今天日期 YYYY-MM-DD */
export function todayTaiwan(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}
