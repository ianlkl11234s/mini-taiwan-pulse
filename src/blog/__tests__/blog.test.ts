/**
 * /blog 靜態文章頁契約：全文與結構化資料在原始 HTML、每篇都登記在 sitemap／llms.txt、nginx 有獨立 location。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  activeTopics,
  extractFaq,
  loadPosts,
  mainMapLink,
  neighbors,
  parseFrontMatter,
  parseMapBlock,
  postPath,
  relatedPosts,
  renderFeed,
  renderIndexPage,
  renderPostPage,
  renderTopicPage,
  toPost,
} from "../generator";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const read = (p: string) => readFileSync(join(root, p), "utf8");
const posts = loadPosts(join(root, "content/blog"));
const ORIGIN = "https://mini-taiwan-pulse.itsmigu.com";

function ldGraph(html: string): Array<Record<string, unknown>> {
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  expect(m, "JSON-LD 區塊").not.toBeNull();
  return (JSON.parse(m![1]!) as { "@graph": Array<Record<string, unknown>> })["@graph"];
}

describe("front matter", () => {
  it("支援純值、行內陣列、縮排清單與引號", () => {
    const { data, body } = parseFrontMatter('---\ntitle: 標題\ntags: [a, b]\nlink: "/?v=1&x=2"\nlist:\n  - one\n  - two\n---\n內文');
    expect(data).toEqual({ title: "標題", tags: ["a", "b"], link: "/?v=1&x=2", list: ["one", "two"] });
    expect(body).toBe("內文");
  });

  it("FAQ 只取「常見問題」小節的 ### 問答", () => {
    const faq = extractFaq("## 前言\n\n### 不算\n內容\n\n## 常見問題\n\n### 問一？\n答一。\n\n### 問二？\n答 [連結](https://x)。\n\n## 下一步\n\n### 也不算\n");
    expect(faq).toEqual([{ question: "問一？", answer: "答一。" }, { question: "問二？", answer: "答 連結。" }]);
  });

  it("slug 不可與主題頁或保留路徑撞名（文章與主題頁共用 /blog/<x>/）", () => {
    expect(() => toPost("---\nslug: layers\ntopic: layers\ntitle: t\ndescription: d\ndate: 2026-01-01\n---\n")).toThrow(/保留路徑/);
    expect(() => toPost("---\nslug: about\ntopic: layers\ntitle: t\ndescription: d\ndate: 2026-01-01\n---\n")).toThrow(/保留路徑/);
  });

  it("主題必須登記在 topics.ts", () => {
    expect(() => toPost("---\nslug: x\ntopic: nope\ntitle: t\ndescription: d\ndate: 2026-01-01\n---\n")).toThrow(/未知主題/);
  });
});

describe("嵌入地圖區塊", () => {
  it("只接受站內 /embed，主站連結去掉 rsys", () => {
    const m = parseMapBlock("src: /embed?v=1&lng=121&lat=25&z=11&layers=rail&rsys=trtc&date=2026-08-06\ncaption: 台北捷運\nheight: 9999");
    expect(m).toEqual({ src: "/embed?v=1&lng=121&lat=25&z=11&layers=rail&rsys=trtc&date=2026-08-06", caption: "台北捷運", height: 720 });
    expect(mainMapLink(m.src)).toBe("/?v=1&lng=121&lat=25&z=11&layers=rail&date=2026-08-06");
    expect(() => parseMapBlock("src: https://evil.example/embed?v=1&x")).toThrow();
  });
});

describe("上一篇／下一篇、相關文章", () => {
  const mk = (slug: string, date: string, topic = "layers") => toPost(`---\nslug: ${slug}\ntopic: ${topic}\ntitle: ${slug}\ndescription: d\ndate: ${date}\n---\n`);
  const list = [mk("c", "2026-03-01"), mk("b", "2026-02-01", "analysis"), mk("a", "2026-01-01")];

  it("依發布日：上一篇較早、下一篇較新", () => {
    expect(neighbors(list, list[1]!)).toEqual({ prev: list[2], next: list[0] });
    expect(neighbors(list, list[0]!).next).toBeUndefined();
    expect(neighbors(list, list[2]!).prev).toBeUndefined();
  });

  it("相關文章同主題優先、不含自己", () => {
    expect(relatedPosts(list, list[0]!).map((p) => p.slug)).toEqual(["a", "b"]);
  });

  it("主題頁只列該主題；列表頁只列有文章的主題", () => {
    expect(activeTopics(list).map((t) => t.id)).toEqual(["layers", "analysis"]);
    const page = renderTopicPage(activeTopics(list)[0]!, list);
    expect(page).toContain('href="/blog/c/"');
    expect(page).not.toContain('href="/blog/b/"');
  });
});

describe("文章頁", () => {
  it("至少有一篇文章，slug 不重複", () => {
    expect(posts.length).toBeGreaterThan(0);
    expect(new Set(posts.map((p) => p.slug)).size).toBe(posts.length);
  });

  for (const post of posts) {
    it(`${post.slug}：全文、canonical、BlogPosting／Person JSON-LD 都在靜態 HTML`, () => {
      const html = renderPostPage(post, posts, join(root, "public"));
      expect(html).toContain(`<link rel="canonical" href="${ORIGIN}${postPath(post)}" />`);
      expect(html).toContain('<ol data-toc><li><a href="#s1">');
      expect(html).toContain(`<h1>`);
      // 內文第一段（去掉 markdown 連結語法）必須直接出現在 HTML，不靠 JS 渲染
      const firstPara = post.body.trim().split("\n")[0]!.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").slice(0, 20);
      expect(html).toContain(firstPara);
      const graph = ldGraph(html);
      const article = graph.find((n) => n["@type"] === "BlogPosting");
      expect(article?.headline).toBe(post.title);
      expect(article?.datePublished).toBe(post.date);
      expect(graph.some((n) => n["@type"] === "Person" && n.name === "Migu")).toBe(true);
      // CSP 只開 script-src 'self'：除了 JSON-LD 資料區塊，不可有 inline script
      const scripts = html.match(/<script\b[^>]*>/g) ?? [];
      for (const tag of scripts) expect(tag === '<script type="application/ld+json">' || /\ssrc="\/blog\//.test(tag), tag).toBe(true);
      // 不把首頁的 en/ja hreflang 帶到文章頁（文章只有中文）
      expect(html).not.toContain("hreflang");
    });

    it(`${post.slug}：已登記在 sitemap.xml 與 llms.txt`, () => {
      expect(read("public/sitemap.xml")).toContain(`<loc>${ORIGIN}${postPath(post)}</loc>`);
      expect(read("public/sitemap.xml")).toContain(`<loc>${ORIGIN}/blog/${post.topic}/</loc>`);
      expect(read("public/llms.txt")).toContain(`${ORIGIN}${postPath(post)}`);
    });
  }

  it("列表頁與 RSS 列出每一篇", () => {
    const index = renderIndexPage(posts);
    const feed = renderFeed(posts);
    for (const p of posts) {
      expect(index).toContain(`href="${postPath(p)}"`);
      expect(feed).toContain(`<link>${ORIGIN}${postPath(p)}</link>`);
    }
    for (const loc of ["/blog/", "/blog/about/"]) expect(read("public/sitemap.xml")).toContain(`<loc>${ORIGIN}${loc}</loc>`);
  });
});

describe("nginx /blog", () => {
  const nginx = read("nginx.conf");
  const start = nginx.indexOf("location ^~ /blog/ {");
  const block = nginx.slice(start, nginx.indexOf("\n    }", start));

  it("在 SPA fallback 之前，缺頁回 404、無斜線 301", () => {
    expect(start).toBeGreaterThan(0);
    expect(start).toBeLessThan(nginx.indexOf("    location / {"));
    expect(block).toContain("try_files $uri $uri/ =404;");
    expect(block).toContain('rewrite "^(/blog(?:/[a-z0-9-]+){1,2})$" $1/ permanent;');
    expect(nginx).toContain("location = /blog { absolute_redirect off; return 301 /blog/; }");
    expect(block).toContain("absolute_redirect off;");
  });

  it("v2.13.0 已發布的 /blog/rail/… 舊網址 301 到新網址（在通用斜線規則之前）", () => {
    const old = block.indexOf('rewrite "^/blog/rail/([a-z0-9-]+)(/.*)?$" /blog/$1$2 permanent;');
    expect(block).toContain('rewrite "^/blog/rail/?$" /blog/layers/ permanent;');
    expect(old).toBeGreaterThan(0);
    expect(old).toBeLessThan(block.indexOf('rewrite "^(/blog(?:/[a-z0-9-]+){1,2})$"'));
  });

  it("重寫安全標頭：一條 Cache-Control、CSP script-src 只開 self", () => {
    expect(block.match(/add_header Cache-Control/g)?.length).toBe(1);
    expect(block).toContain("X-Content-Type-Options");
    expect(block).toContain("Strict-Transport-Security");
    expect(block).toMatch(/Content-Security-Policy "[^"]*script-src 'self';/);
  });
});

describe("封面與圖片", () => {
  const base = (extra: string) => toPost(`---\nslug: one\ntopic: layers\ntitle: t\ndescription: d\ndate: 2026-01-01\n${extra}---\n內文\n`);

  it("只有一張封面時不加 blog-only-dark（淺色主題也看得到）", () => {
    const post = base("cover: c.jpg\n");
    const html = renderPostPage(post, [post], join(root, "public"));
    expect(html).toContain('<img src="/blog/one/c.jpg"');
    expect(html).not.toContain("blog-only-dark");
    expect(renderIndexPage([post])).not.toContain("blog-only-dark");
  });

  it("深淺兩張封面各自標主題", () => {
    const post = base("cover: d.jpg\ncoverLight: l.jpg\n");
    const html = renderPostPage(post, [post], join(root, "public"));
    expect(html).toContain('class="blog-only-dark" src="/blog/one/d.jpg"');
    expect(html).toContain('class="blog-only-light" src="/blog/one/l.jpg"');
  });

  it("外站圖片在 build 時報錯（CSP img-src 只開 self）", () => {
    const post = toPost("---\nslug: one\ntopic: layers\ntitle: t\ndescription: d\ndate: 2026-01-01\n---\n![x](https://example.com/a.jpg)\n");
    expect(() => renderPostPage(post, [post], join(root, "public"))).toThrow(/不支援外站圖片/);
  });
});
