import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const nginx = readFileSync("nginx.conf", "utf8");
const vite = readFileSync("vite.config.ts", "utf8");
const html = readFileSync("privacy.html", "utf8");
const HSTS = 'add_header Strict-Transport-Security "max-age=31536000" always;';

function block(header: string): string {
  const start = nginx.indexOf(`${header} {`);
  expect(start, header).toBeGreaterThanOrEqual(0);
  return nginx.slice(start, nginx.indexOf("\n    }", start));
}

describe("隱私頁部署契約（nginx／vite／entry）", () => {
  it("nginx：/privacy 與 /privacy.html 回 privacy.html，放在 SPA fallback 之前", () => {
    for (const header of ["location = /privacy", "location = /privacy.html"]) {
      const b = block(header);
      expect(b, header).toContain("try_files /privacy.html =404;");
      expect(nginx.indexOf(header)).toBeLessThan(nginx.indexOf("location / {"));
    }
  });

  it("nginx：安全標頭各自重複宣告、不給 iframe、HTML 每次 revalidate、可被收錄", () => {
    for (const header of ["location = /privacy", "location = /privacy.html"]) {
      const b = block(header);
      expect(b, header).toContain(HSTS);
      expect(b, header).toContain('add_header X-Content-Type-Options "nosniff" always;');
      expect(b, header).toContain("frame-ancestors 'none'");
      expect(b, header).toContain('Cache-Control "no-cache"');
      expect(b, header).not.toContain("X-Robots-Tag");
    }
  });

  it("vite：privacy.html 是 build entry；dev 把 /privacy 導到 privacy.html", () => {
    expect(vite).toMatch(/privacy: resolve\(process\.cwd\(\), "privacy\.html"\)/);
    expect(vite).toContain("/privacy.html");
  });

  it("privacy.html：可收錄（無 noindex），載入獨立 entry", () => {
    expect(html).not.toContain("noindex");
    expect(html).toContain('src="/src/privacy/main.tsx"');
  });

  // 隱私頁 entry 不 import supabase、mapbox-gl 或 localeStore（含動態 import）：改由 ESLint 檢查（eslint.config.js 的 src/privacy 區塊）
});
