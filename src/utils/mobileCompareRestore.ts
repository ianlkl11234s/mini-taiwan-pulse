import type { UrlState } from "../lib/urlState";

/**
 * 回到桌機寬度還原比較時，左側期別／細項以手機單地圖「目前」的選擇為準
 * （使用者在手機上可能改過；compareUrlState 寫網址時也是這個口徑），右側沿用寄放值。
 */
export function restoreMobileCompare(
  stashed: NonNullable<UrlState["compare"]>,
  currentLeftSelection: Record<string, Record<string, string>> | undefined,
): NonNullable<UrlState["compare"]> {
  const { leftSelection: _stale, ...rest } = stashed;
  return { ...rest, ...(currentLeftSelection ? { leftSelection: currentLeftSelection } : {}) };
}
