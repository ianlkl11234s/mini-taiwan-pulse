import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const nginx = readFileSync("nginx.conf", "utf8");
const vite = readFileSync("vite.config.ts", "utf8");
const html = readFileSync("card.html", "utf8");

describe("卡片頁部署契約（nginx／vite／entry）", () => {
  const block = nginx.match(/location \^~ \/card\/ \{([\s\S]*?)\n    \}/)?.[1] ?? "";

  it("nginx：/card/<slug> 回 card.html，放在 SPA fallback 之前", () => {
    expect(block).toContain("try_files /card.html =404;");
    expect(nginx.indexOf("location ^~ /card/")).toBeLessThan(nginx.indexOf("location / {"));
    expect(nginx).toMatch(/location = \/card \{ return 404; \}/);
  });

  it("nginx：卡片不給 iframe、不快取、不收錄，CSP 只開必要來源", () => {
    expect(block).toContain("frame-ancestors 'none'");
    expect(block).not.toContain("frame-ancestors *");
    expect(block).toContain('Cache-Control "no-store"');
    expect(block).toContain('X-Robots-Tag "noindex"');
    expect(block).toContain("X-Content-Type-Options");
    for (const host of ["https://utcmcikhvxnohbxchbrs.supabase.co", "https://data.itsmigu.com", "https://protomaps.github.io"]) expect(block).toContain(host);
  });

  it("vite：card.html 是 build entry；dev 把 /card/<slug> 導到 card.html", () => {
    expect(vite).toMatch(/card: resolve\(process\.cwd\(\), "card\.html"\)/);
    expect(vite).toContain("serveCardPage()");
  });

  it("card.html：noindex，載入獨立 entry", () => {
    expect(html).toContain('<meta name="robots" content="noindex" />');
    expect(html).toContain('src="/src/card/main.tsx"');
  });

  it("卡片 entry 不 import 主站 supabase client 或 mapbox-gl", () => {
    for (const file of readdirSync("src/card").filter(name => /\.tsx?$/.test(name))) {
      const source = readFileSync(`src/card/${file}`, "utf8");
      expect(source, file).not.toMatch(/(?:from|import)\s*\(?\s*["'][^"']*(?:lib\/supabase|@supabase\/supabase-js|mapbox-gl)["']/);
    }
  });
});
