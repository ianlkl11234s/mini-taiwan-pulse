import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 安全標頭契約（2026-10-17 資安稽核 B4）：
 * - 主站 `/` 只允許同源 iframe；只有 `/embed`、`/embed.html` 可被任意網站嵌入。
 * - HSTS 不帶 includeSubDomains／preload（itsmigu.com 底下還有其他子網域）。
 * - dotfile 回 404，不回 SPA index.html。
 * nginx 的 add_header 不繼承，所以逐一檢查 location 區塊本身。
 */
const nginx = readFileSync("nginx.conf", "utf8");

function block(header: string): string {
  const start = nginx.indexOf(`${header} {`);
  expect(start, header).toBeGreaterThanOrEqual(0);
  return nginx.slice(start, nginx.indexOf("\n    }", start));
}

const HSTS = 'add_header Strict-Transport-Security "max-age=31536000" always;';

describe("nginx 安全標頭", () => {
  it("主站 /：只允許同源嵌入，並強制 object-src／base-uri", () => {
    const main = block("location /");
    expect(main).toContain('add_header X-Frame-Options "SAMEORIGIN" always;');
    expect(main).toContain(
      `add_header Content-Security-Policy "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" always;`,
    );
    expect(main).toContain(HSTS);
    expect(main).not.toContain("frame-ancestors *");
  });

  it("/embed 與 /embed.html：可被任意網站嵌入，不送 X-Frame-Options", () => {
    for (const header of ["location = /embed", "location = /embed.html"]) {
      const embed = block(header);
      expect(embed, header).toContain("try_files /embed.html =404;");
      expect(embed, header).toContain("frame-ancestors *; object-src 'none'; base-uri 'self'");
      expect(embed, header).not.toContain("X-Frame-Options");
      expect(embed, header).toContain(HSTS);
    }
  });

  it("HSTS 不帶 includeSubDomains／preload", () => {
    const hsts = nginx.split("\n").filter((line) => /^\s*add_header Strict-Transport-Security/.test(line));
    expect(hsts.length).toBeGreaterThan(0);
    for (const line of hsts) expect(line.trim()).toBe(HSTS);
  });

  it("dotfile 正則排在靜態資源正則之前，回 404", () => {
    const dotfile = nginx.indexOf("location ~ /\\. {");
    expect(dotfile).toBeGreaterThan(0);
    expect(dotfile).toBeLessThan(nginx.lastIndexOf("location ~* \\.(js|css"));
    expect(block("location ~ /\\.")).toContain("return 404;");
  });
});
