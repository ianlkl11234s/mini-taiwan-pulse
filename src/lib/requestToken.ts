/**
 * 「只認最新一次」的請求代號：await 之前 `begin()` 取號，await 之後用 `isCurrent(token)` 確認沒被
 * 更新的請求或 `invalidate()`（例如帳號切換）作廢。
 */
export function createRequestToken() {
  let current = 0;
  return {
    begin: () => ++current,
    isCurrent: (token: number) => token === current,
    invalidate: () => { current += 1; },
  };
}
