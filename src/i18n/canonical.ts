/**
 * 每個語版網址自我指向的 canonical（與 index.html 的 hreflang 一致）。
 * 靜態 HTML 只能寫根網址；`?lang=en|ja` 的頁面在執行時把 `<link rel="canonical">` 改成自己的語版網址
 * （Googlebot 會渲染 JS 並採用）。其他情況（無 lang、zh-TW、未知值）維持根網址。
 */
const ORIGIN = "https://mini-taiwan-pulse.itsmigu.com";
const SELF_REFERENCING = new Set(["en", "ja"]);

export function canonicalHrefFor(search: string): string {
  const lang = new URLSearchParams(search).get("lang");
  return lang && SELF_REFERENCING.has(lang) ? `${ORIGIN}/?lang=${lang}` : `${ORIGIN}/`;
}

export function syncCanonicalLink(doc: Document | undefined = typeof document === "undefined" ? undefined : document, search: string = typeof location === "undefined" ? "" : location.search): void {
  const link = doc?.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (link) link.setAttribute("href", canonicalHrefFor(search));
}
