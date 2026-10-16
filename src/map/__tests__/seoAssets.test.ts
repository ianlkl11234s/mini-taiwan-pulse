import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** SEO／AEO 速贏資產契約：索引檔存在且互相一致，index.html 帶 canonical／hreflang／JSON-LD／靜態說明。 */
const ORIGIN = "https://mini-taiwan-pulse.itsmigu.com";
const read = (p: string) => readFileSync(p, "utf8");

describe("SEO／AEO 靜態資產", () => {
  it("robots.txt 允許全部、明示 AI 爬蟲並指向 sitemap", () => {
    const robots = read("public/robots.txt");
    expect(robots).toMatch(/User-agent: \*\s+Allow: \//);
    for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
      expect(robots).toContain(`User-agent: ${bot}`);
    }
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });

  it("sitemap.xml 列出三個語言網址與 hreflang", () => {
    const sm = read("public/sitemap.xml");
    for (const loc of [`${ORIGIN}/`, `${ORIGIN}/?lang=en`, `${ORIGIN}/?lang=ja`]) {
      expect(sm).toContain(`<loc>${loc}</loc>`);
    }
    for (const lang of ["zh-Hant-TW", "en", "ja", "x-default"]) {
      expect(sm).toContain(`hreflang="${lang}"`);
    }
  });

  it("llms.txt 依 llmstxt.org：H1、引言、H2 清單", () => {
    const llms = read("public/llms.txt");
    expect(llms.startsWith("# Mini Taiwan Pulse")).toBe(true);
    expect(llms).toMatch(/\n> /);
    expect(llms).toContain("https://github.com/ianlkl11234s/mini-taiwan-pulse");
  });

  it("index.html：canonical、hreflang、JSON-LD 可解析、#root 內有 h1", () => {
    const html = read("index.html");
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/" />`);
    expect(html).toContain('hreflang="x-default"');
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    expect(ld).toBeTruthy();
    const graph = JSON.parse(ld as string)["@graph"] as { "@type": string }[];
    expect(graph.map((g) => g["@type"])).toEqual(["WebSite", "WebApplication"]);
    expect(html).toMatch(/<div id="root">[\s\S]*<h1[\s>]/);
  });

  it("main.tsx 用 createRoot（靜態說明會被取代，不可改 hydrateRoot）", () => {
    const main = read("src/main.tsx");
    expect(main).toContain("createRoot(");
    expect(main).not.toContain("hydrateRoot");
  });
});
