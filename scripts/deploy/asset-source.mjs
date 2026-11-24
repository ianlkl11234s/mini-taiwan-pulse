// check-assets 的取檔決策（BACKLOG CI-10，方案 A，2026-11-24 站主選定）。
//
// 規則：資產先從 R2 公開網域取；R2 回 404 時——
//   - 該路徑已在「基準 lock」（PR：origin/master；master push：上一個 master）→ 紅燈。正式站應該已經有，R2 缺檔是真的壞了。
//   - 不在基準 lock（本 PR 或 develop 新增、還沒發版）→ 改從 S3 deploy-assets/<s3_key> 取，一樣比對 sha256 與 bytes。
//   - 沒有 S3 金鑰（fork PR、未設 secret）、S3 也沒有、讀不到基準 lock → 紅燈，訊息寫清楚原因。
// 只有 R2 的 HTTP 404 會改走 S3；403、5xx、200 但內容不符都照舊紅。
// 從 S3 取回的檔只在 CI runner 上，不寫回 R2；發版後 deploy-workers 的 sync-assets 照舊同步。
//
// 本檔只放可注入的決策邏輯，不讀 env、不碰網路（測試：src/test/checkAssetsSource.test.ts）。

/**
 * 決定單一資產檔從哪裡取、結果如何。
 * @param {{ path: string, sha256: string, bytes: number, s3_key?: string }} entry lock 條目
 * @param {{
 *   fetchR2: (entry) => Promise<{ status: number, sha256?: string, bytes?: number }>,
 *   inBaseLock: (path: string) => Promise<boolean>,
 *   s3Configured: boolean,
 *   fetchS3: (entry) => Promise<{ status: number, sha256?: string, bytes?: number, error?: string }>,
 *   baseLabel?: string,
 * }} deps
 * @returns {Promise<{ ok: true, source: "r2" | "s3" } | { ok: false, source: "r2" | "s3", reason: string }>}
 */
export async function resolveAsset(entry, deps) {
  const baseLabel = deps.baseLabel ?? "origin/master";
  const matches = (r) => r.sha256 === entry.sha256 && r.bytes === entry.bytes;

  const r2 = await deps.fetchR2(entry);
  if (r2.status === 200) {
    return matches(r2)
      ? { ok: true, source: "r2" }
      : { ok: false, source: "r2", reason: `R2 版本與 lock 不符（bytes ${r2.bytes} vs ${entry.bytes}）` };
  }
  if (r2.status !== 404) return { ok: false, source: "r2", reason: `R2 HTTP ${r2.status}` };

  let inBase;
  try {
    inBase = await deps.inBaseLock(entry.path);
  } catch (err) {
    return { ok: false, source: "r2", reason: `R2 404，且讀不到 ${baseLabel} 的 lock，無法判斷是不是新檔（${err.message}）；CI 要先 fetch master` };
  }
  if (inBase) {
    return { ok: false, source: "r2", reason: `R2 404，但 ${baseLabel} 的 lock 已有這個檔：正式站應該已經有，R2 缺檔是真的壞了（用 deploy-workers 的 sync_only 補同步）` };
  }
  if (!deps.s3Configured) {
    return { ok: false, source: "r2", reason: "R2 404，這是還沒發版的新檔，但沒有 S3 唯讀金鑰（fork PR 或未設 PULSE_SYNC_S3_* secret），無法改從 S3 驗" };
  }
  if (!entry.s3_key) return { ok: false, source: "s3", reason: "R2 404，lock 條目沒有 s3_key，無法改從 S3 取" };

  const s3 = await deps.fetchS3(entry);
  if (s3.status !== 200) {
    const why = s3.status === 404 || s3.status === 403 ? "S3 沒有這個檔或金鑰無權讀取" : `S3 錯誤 ${s3.error ?? s3.status}`;
    return { ok: false, source: "s3", reason: `R2 404，改從 S3 ${entry.s3_key} 取失敗：${why}；先用 upload-deploy-assets.sh 上傳 S3` };
  }
  return matches(s3)
    ? { ok: true, source: "s3" }
    : { ok: false, source: "s3", reason: `S3 版本與 lock 不符（bytes ${s3.bytes} vs ${entry.bytes}）；lock 或 S3 檔要重產／重傳` };
}

/** 包一層記憶：基準 lock 只讀一次（pool 有 6 路並行），讀失敗時每次都丟同一個錯。 */
export function memoBaseLock(readPaths) {
  let promise;
  return (path) => {
    promise ??= Promise.resolve().then(readPaths).then((paths) => new Set(paths));
    return promise.then((set) => set.has(path));
  };
}
