/**
 * /blog 靜態文章頁產生器（build 時由 vite.config.ts 呼叫，Node 端執行）。
 *
 * content/blog/<slug>.md → <root>/blog/<topic>/<slug>/index.html（gitignored），再交給 vite 當 HTML entry，
 * 所以全文、JSON-LD、OG 都在原始 HTML 裡：搜尋引擎與不跑 JS 的 AI 爬蟲直接讀得到（方案 B 的前提）。
 * 另產列表頁 /blog/、主題頁 /blog/<topic>/、關於頁 /blog/about/ 與 RSS。
 * 圖片放 public/blog/<topic>/<slug>/，由 vite 原樣複製到同一路徑。
 * 樣式 src/blog/blog.css；主題切換、目錄高亮、嵌入地圖、複製連結在 public/blog/blog.js（外部檔，CSP 不開 inline script）。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Marked, type Tokens } from "marked";
import { BLOG_TOPICS, topicById, type BlogTopic } from "./topics";

export const BLOG_ORIGIN = "https://mini-taiwan-pulse.itsmigu.com";
export const BLOG_NAME = "Pulse 筆記";
export const BLOG_DESCRIPTION = "Mini Taiwan Pulse 的開發筆記：台灣軌道、航班、船舶與開放資料怎麼變成一張即時地圖。";
export const BLOG_AUTHOR = {
  name: "Migu",
  jobTitle: "Senior Data Analyst / GIS",
  github: "https://github.com/ianlkl11234s",
  threads: "https://www.threads.com/@ianlkl1314",
} as const;

export interface BlogPost {
  slug: string;
  topic: string;
  title: string;
  description: string;
  date: string;
  updated: string;
  tags: string[];
  series?: string;
  cover?: string;
  coverLight?: string;
  coverAlt: string;
  mapLink?: string;
  threads: string[];
  /** Markdown 內文（不含 front matter） */
  body: string;
}

type FrontValue = string | string[];

/** 只支援本專案用到的 front matter 子集：`key: value`、`key: [a, b]`、`key:` 加 `  - item` 清單。 */
export function parseFrontMatter(source: string): { data: Record<string, FrontValue>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(source);
  if (!m) throw new Error("缺少 front matter（--- 區塊）");
  const data: Record<string, FrontValue> = {};
  let listKey: string | null = null;
  for (const raw of m[1]!.split("\n")) {
    const line = raw.replace(/\s+#.*$/, "");
    if (!line.trim()) continue;
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && listKey) {
      (data[listKey] as string[]).push(unquote(item[1]!));
      continue;
    }
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) throw new Error(`無法解析 front matter：${raw}`);
    const [, key, value] = kv as unknown as [string, string, string];
    if (value === "") {
      data[key] = [];
      listKey = key;
    } else if (/^\[.*\]$/.test(value)) {
      data[key] = value.slice(1, -1).split(",").map((v) => unquote(v.trim())).filter(Boolean);
      listKey = null;
    } else {
      data[key] = unquote(value);
      listKey = null;
    }
  }
  return { data, body: source.slice(m[0].length) };
}

function unquote(v: string): string {
  return /^(["']).*\1$/.test(v) ? v.slice(1, -1) : v;
}

function str(data: Record<string, FrontValue>, key: string, required = true): string {
  const v = data[key];
  if (typeof v === "string" && v) return v;
  if (required) throw new Error(`front matter 缺少 ${key}`);
  return "";
}

export function toPost(source: string): BlogPost {
  const { data, body } = parseFrontMatter(source);
  const date = str(data, "date");
  const list = (k: string) => (Array.isArray(data[k]) ? (data[k] as string[]) : []);
  const post: BlogPost = {
    slug: str(data, "slug"),
    topic: str(data, "topic"),
    title: str(data, "title"),
    description: str(data, "description"),
    date,
    updated: str(data, "updated", false) || date,
    tags: list("tags"),
    series: str(data, "series", false) || undefined,
    cover: str(data, "cover", false) || undefined,
    coverLight: str(data, "coverLight", false) || undefined,
    coverAlt: str(data, "coverAlt", false),
    mapLink: str(data, "mapLink", false) || undefined,
    threads: list("threads"),
    body,
  };
  if (!/^[a-z0-9-]+$/.test(post.slug)) throw new Error(`slug 只能用小寫英數與連字號：${post.slug}`);
  if (!topicById(post.topic)) throw new Error(`未知主題 ${post.topic}（請先登記在 src/blog/topics.ts）`);
  for (const d of [post.date, post.updated]) if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`日期格式應為 YYYY-MM-DD：${d}`);
  return post;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** JSON-LD 放在 <script> 內：避免內文出現 `</script>` 提早結束區塊。 */
function jsonLd(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/</g, "\\u003c");
}

/** 中文長文約每分鐘 450 字；英數單字另計。 */
export function readingMinutes(markdown: string): number {
  const cjk = (markdown.match(/[㐀-鿿]/g) ?? []).length;
  const words = (markdown.replace(/[㐀-鿿]/g, " ").match(/[A-Za-z0-9]+/g) ?? []).length;
  return Math.max(1, Math.round(cjk / 450 + words / 220));
}

export interface FaqItem { question: string; answer: string }

/** 「## 常見問題」底下的每個 `### 問題` 與其後段落 → FAQPage 結構化資料。 */
export function extractFaq(markdown: string): FaqItem[] {
  const section = /^## 常見問題\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(markdown);
  if (!section) return [];
  const items: FaqItem[] = [];
  for (const block of section[1]!.split(/^### /m).slice(1)) {
    const [q, ...rest] = block.split("\n");
    const answer = rest.join(" ").replace(/\s+/g, " ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`]/g, "").trim();
    if (q && answer) items.push({ question: q.trim(), answer });
  }
  return items;
}

export const postPath = (p: Pick<BlogPost, "topic" | "slug">) => `/blog/${p.topic}/${p.slug}/`;
const postUrl = (p: Pick<BlogPost, "topic" | "slug">) => `${BLOG_ORIGIN}${postPath(p)}`;
const assetPath = (p: Pick<BlogPost, "topic" | "slug">, file: string) => `${postPath(p)}${file}`;

export interface MapEmbed { src: string; caption: string; height: number }

/**
 * 文章內嵌互動地圖：```map 區塊，內容為 `src: /embed?v=1&…`、`caption: …`、`height: 440`（選填）。
 * 只接受站內 /embed 網址（CSP frame-src 'self'；也避免文章把讀者帶去外站 iframe）。
 */
export function parseMapBlock(text: string): MapEmbed {
  const fields: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = /^\s*([a-z]+):\s*(.+?)\s*$/.exec(line);
    if (m) fields[m[1]!] = m[2]!;
  }
  const src = fields.src ?? "";
  if (!/^\/embed\?v=1&/.test(src)) throw new Error(`map 區塊的 src 必須是 /embed?v=1&…：${src}`);
  const height = Number(fields.height ?? 440);
  return { src, caption: fields.caption ?? "", height: Number.isFinite(height) ? Math.min(Math.max(height, 240), 720) : 440 };
}

/** 嵌入版網址 → 主站同畫面網址（主站不吃 rsys／p.*，其餘參數相同）。 */
export function mainMapLink(embedSrc: string): string {
  const url = new URL(embedSrc, BLOG_ORIGIN);
  for (const key of [...url.searchParams.keys()]) if (key === "rsys" || key.startsWith("p.")) url.searchParams.delete(key);
  return `/${url.search}`;
}

export interface TocItem { id: string; text: string }

export interface RenderedBody { html: string; toc: TocItem[] }

/** 文章內文：h2 加錨點並收進目錄；圖片改成文章資料夾的絕對路徑並包 figure；```map 轉成嵌入地圖。 */
export function renderBody(post: BlogPost, publicDir: string, warn: (msg: string) => void = () => {}): RenderedBody {
  const toc: TocItem[] = [];
  const md = new Marked({ gfm: true });
  md.use({
    renderer: {
      heading({ tokens, depth, text }) {
        const inner = this.parser.parseInline(tokens);
        if (depth !== 2) return `<h${depth}>${inner}</h${depth}>\n`;
        const id = `s${toc.length + 1}`;
        toc.push({ id, text: text.replace(/[*_`]/g, "") });
        return `<h2 id="${id}">${inner}</h2>\n`;
      },
      code({ text, lang }: Tokens.Code) {
        if (lang !== "map") return `<pre><code>${escapeHtml(text)}</code></pre>\n`;
        const map = parseMapBlock(text);
        const title = escapeHtml(map.caption || "互動地圖");
        // 文章是中文：嵌入地圖的圖例與按鈕也用中文（不看讀者瀏覽器語言）
        const embedSrc = /[?&]lang=/.test(map.src) ? map.src : `${map.src}&lang=zh-TW`;
        return `<figure class="blog-map">
  <div class="blog-map__frame" style="height:${map.height}px"><iframe data-embed-src="${escapeHtml(embedSrc)}" title="${title}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
  <figcaption>${map.caption ? `${escapeHtml(map.caption)} · ` : ""}<a href="${escapeHtml(mainMapLink(map.src))}" data-map-link>在完整地圖打開 →</a></figcaption>
</figure>\n`;
      },
      image({ href, text }) {
        // /blog 的 CSP img-src 只開 'self' data:，外站圖片在正式站會被擋：build 時就報錯，要求下載到文章資料夾
        if (/^(https?:)?\/\//.test(href)) throw new Error(`[blog] ${post.slug}：不支援外站圖片 ${href}，請下載到 public/blog/${post.topic}/${post.slug}/`);
        if (!existsSync(join(publicDir, "blog", post.topic, post.slug, href))) {
          warn(`[blog] ${post.slug}：找不到圖片 public/blog/${post.topic}/${post.slug}/${href}，先略過`);
          return "";
        }
        const src = assetPath(post, href);
        return `<figure class="blog-figure"><img src="${escapeHtml(src)}" alt="${escapeHtml(text)}" loading="lazy" decoding="async"><figcaption>${escapeHtml(text)}</figcaption></figure>`;
      },
      link({ href, text, tokens }) {
        const inner = tokens ? this.parser.parseInline(tokens) : escapeHtml(text);
        const external = /^https?:\/\//.test(href) && !href.startsWith(BLOG_ORIGIN);
        return `<a href="${escapeHtml(href)}"${external ? ' rel="noopener" target="_blank"' : ""}>${inner}</a>`;
      },
      paragraph({ tokens }) {
        const html = this.parser.parseInline(tokens);
        // 單獨一張圖的段落不要包 <p>（figure 不能在 p 裡）
        return html.startsWith("<figure") || html === "" ? `${html}\n` : `<p>${html}</p>\n`;
      },
    },
  });
  const html = md.parse(post.body, { async: false }) as string;
  return { html, toc };
}

function formatDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${y} 年 ${Number(m)} 月 ${Number(day)} 日`;
}

function head(opts: { title: string; description: string; canonical: string; ogType: string; image?: string; jsonLd: unknown }): string {
  const image = opts.image ? `${BLOG_ORIGIN}${opts.image}` : undefined;
  return `<!doctype html>
<html lang="zh-TW" class="blog-theme--dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(opts.title)}</title>
    <meta name="description" content="${escapeHtml(opts.description)}" />
    <link rel="canonical" href="${opts.canonical}" />
    <meta name="color-scheme" content="dark light" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="alternate" type="application/rss+xml" title="${BLOG_NAME}" href="/blog/feed.xml" />
    <meta property="og:site_name" content="Mini Taiwan Pulse" />
    <meta property="og:type" content="${opts.ogType}" />
    <meta property="og:title" content="${escapeHtml(opts.title)}" />
    <meta property="og:description" content="${escapeHtml(opts.description)}" />
    <meta property="og:url" content="${opts.canonical}" />
    <meta property="og:locale" content="zh_TW" />${image ? `
    <meta property="og:image" content="${image}" />` : ""}
    <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />
    <script src="/blog/blog.js"></script>
    <link rel="stylesheet" href="/src/blog/blog.css" />
    <script type="application/ld+json">
${jsonLd(opts.jsonLd)}
    </script>
  </head>`;
}

function topNav(): string {
  return `
    <header class="blog-nav">
      <div class="blog-nav__inner">
        <a class="blog-nav__back" href="/?v=1&style=dark" data-map-link>← 回到地圖</a>
        <a class="blog-nav__brand" href="/blog/">${BLOG_NAME}<span>Mini Taiwan Pulse</span></a>
        <nav class="blog-nav__links" aria-label="部落格"><a href="/blog/">文章</a><a href="/blog/about/">關於</a></nav>
        <button class="blog-nav__theme" type="button" data-theme-toggle aria-label="切換淺色／深色">淺色</button>
      </div>
    </header>`;
}

function footer(): string {
  return `
    <footer class="blog-footer">
      <div class="blog-footer__inner">
        <span>© Migu · <a href="/">Mini Taiwan Pulse</a></span>
        <span><a href="/blog/">所有文章</a> · <a href="/blog/about/">關於</a> · <a href="/blog/feed.xml">RSS</a> · <a href="${BLOG_AUTHOR.threads}" rel="noopener" target="_blank">Threads</a></span>
      </div>
    </footer>`;
}

const personLd = {
  "@type": "Person",
  "@id": `${BLOG_ORIGIN}/#author`,
  name: BLOG_AUTHOR.name,
  jobTitle: BLOG_AUTHOR.jobTitle,
  url: `${BLOG_ORIGIN}/blog/about/`,
  sameAs: [BLOG_AUTHOR.github, BLOG_AUTHOR.threads],
};

function coverFigure(post: BlogPost): string {
  if (!post.cover) return "";
  const dark = assetPath(post, post.cover);
  const light = post.coverLight ? assetPath(post, post.coverLight) : dark;
  const alt = escapeHtml(post.coverAlt || post.title);
  const open = post.mapLink
    ? `<a class="blog-cover__open" href="${escapeHtml(post.mapLink)}" data-map-link>在地圖上打開這個畫面 →</a>`
    : "";
  return `
        <figure class="blog-cover">
          <img${light !== dark ? ' class="blog-only-dark"' : ""} src="${dark}" alt="${alt}" width="1600" height="900" decoding="async" fetchpriority="high">
          ${light !== dark ? `<img class="blog-only-light" src="${light}" alt="${alt}" width="1600" height="900" loading="lazy" decoding="async">` : ""}
          ${open}
        </figure>`;
}

function coverImgs(p: BlogPost, cls = ""): string {
  if (!p.cover) return `<span class="blog-card__ph${cls ? ` ${cls}` : ""}"></span>`;
  const c = cls ? ` ${cls}` : "";
  // 只有一張封面時兩種主題都顯示它（blog-only-dark 在淺色主題會被藏起來）
  if (!p.coverLight) return `<img${cls ? ` class="${cls}"` : ""} src="${assetPath(p, p.cover)}" alt="" width="1600" height="900" loading="lazy" decoding="async">`;
  return `<img class="blog-only-dark${c}" src="${assetPath(p, p.cover)}" alt="" width="1600" height="900" loading="lazy" decoding="async">${p.coverLight ? `<img class="blog-only-light${c}" src="${assetPath(p, p.coverLight)}" alt="" width="1600" height="900" loading="lazy" decoding="async">` : ""}`;
}

function postCard(p: BlogPost): string {
  const topic = topicById(p.topic)!;
  return `
            <li class="blog-card">
              <a href="${postPath(p)}">
                <div class="blog-card__media">${coverImgs(p)}</div>
                <p class="blog-card__meta"><span>${escapeHtml(topic.name)}</span><time datetime="${p.date}">${formatDate(p.date)}</time></p>
                <h3>${escapeHtml(p.title)}</h3>
              </a>
            </li>`;
}

/** 上一篇／下一篇：全站依發布日排序（新→舊）；「上一篇」是較早的那篇。 */
export function neighbors(posts: BlogPost[], post: BlogPost): { prev?: BlogPost; next?: BlogPost } {
  const i = posts.findIndex((p) => p.slug === post.slug);
  return { prev: posts[i + 1], next: i > 0 ? posts[i - 1] : undefined };
}

/** 相關文章：同主題優先，不足再補其他最新文章，最多 3 篇。 */
export function relatedPosts(posts: BlogPost[], post: BlogPost, limit = 3): BlogPost[] {
  const others = posts.filter((p) => p.slug !== post.slug);
  const same = others.filter((p) => p.topic === post.topic);
  return [...same, ...others.filter((p) => p.topic !== post.topic)].slice(0, limit);
}

function shareLinks(post: BlogPost): string {
  const url = encodeURIComponent(postUrl(post));
  const text = encodeURIComponent(`${post.title} ${postUrl(post)}`);
  return `<div class="blog-share">
            <a href="https://www.threads.net/intent/post?text=${text}" rel="noopener" target="_blank">Threads</a>
            <a href="https://social-plugins.line.me/lineit/share?url=${url}" rel="noopener" target="_blank">LINE</a>
            <button type="button" data-copy-link="${postUrl(post)}">複製連結</button>
          </div>`;
}

export function renderPostPage(post: BlogPost, posts: BlogPost[], publicDir: string, warn?: (msg: string) => void): string {
  const url = postUrl(post);
  const topic = topicById(post.topic)!;
  const { html: body, toc } = renderBody(post, publicDir, warn);
  const faq = extractFaq(post.body);
  const minutes = readingMinutes(post.body);
  const image = post.cover ? assetPath(post, post.cover) : undefined;
  const { prev, next } = neighbors(posts, post);
  const related = relatedPosts(posts, post);
  const seriesPosts = post.series ? posts.filter((p) => p.series === post.series).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const graph: unknown[] = [
    {
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.updated,
      inLanguage: "zh-Hant-TW",
      mainEntityOfPage: url,
      articleSection: topic.name,
      ...(image ? { image: [`${BLOG_ORIGIN}${image}`] } : {}),
      keywords: post.tags.join(", "),
      author: { "@id": `${BLOG_ORIGIN}/#author` },
      publisher: { "@id": `${BLOG_ORIGIN}/#author` },
      isPartOf: { "@id": `${BLOG_ORIGIN}/blog/#blog` },
      ...(post.threads.length ? { isBasedOn: post.threads } : {}),
    },
    personLd,
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: BLOG_NAME, item: `${BLOG_ORIGIN}/blog/` },
        { "@type": "ListItem", position: 2, name: topic.name, item: `${BLOG_ORIGIN}/blog/${topic.id}/` },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  ];
  if (faq.length) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
    });
  }
  const tocList = toc.map((t) => `<li><a href="#${t.id}">${escapeHtml(t.text)}</a></li>`).join("");
  const series = seriesPosts.length > 1
    ? `
          <div class="blog-side__block">
            <p class="blog-side__title">系列：${escapeHtml(post.series!)}</p>
            <ol class="blog-series">${seriesPosts.map((p) => (p.slug === post.slug ? `<li aria-current="page">${escapeHtml(p.title)}</li>` : `<li><a href="${postPath(p)}">${escapeHtml(p.title)}</a></li>`)).join("")}</ol>
          </div>`
    : "";
  const threads = post.threads.length
    ? `
        <section class="blog-source">
          <h2>原始 Threads 串</h2>
          <p>這篇由我在 Threads 上的開發日記整理擴寫而成：</p>
          <ul>${post.threads.map((t, i) => `<li><a href="${escapeHtml(t)}" rel="noopener" target="_blank">第 ${i + 1} 則</a></li>`).join("")}</ul>
        </section>`
    : "";
  const pager = prev || next
    ? `
        <nav class="blog-pager" aria-label="上一篇與下一篇">
          ${prev ? `<a class="blog-pager__prev" href="${postPath(prev)}"><span>← 上一篇</span>${escapeHtml(prev.title)}</a>` : "<span></span>"}
          ${next ? `<a class="blog-pager__next" href="${postPath(next)}"><span>下一篇 →</span>${escapeHtml(next.title)}</a>` : "<span></span>"}
        </nav>`
    : "";
  const relatedBlock = related.length
    ? `
        <section class="blog-related">
          <h2>相關文章</h2>
          <ul class="blog-cards blog-cards--grid">${related.map(postCard).join("")}
          </ul>
        </section>`
    : "";
  return `${head({ title: `${post.title}｜${BLOG_NAME}`, description: post.description, canonical: url, ogType: "article", image, jsonLd: { "@context": "https://schema.org", "@graph": graph } })}
  <body class="blog">${topNav()}
    <main class="blog-main blog-main--post">
      <aside class="blog-side" aria-label="本文目錄">
        <details class="blog-side__toc" open>
          <summary>本文目錄</summary>
          <ol data-toc>${tocList}</ol>
        </details>${series}
        <div class="blog-side__block blog-side__share">
          <p class="blog-side__title">分享</p>
          ${shareLinks(post)}
        </div>
      </aside>
      <article class="blog-article">
        <nav class="blog-crumb" aria-label="麵包屑"><a href="/blog/">${BLOG_NAME}</a><span aria-hidden="true">/</span><a href="/blog/${topic.id}/">${escapeHtml(topic.name)}</a>${post.tags.map((t) => `<span class="blog-tag">${escapeHtml(t)}</span>`).join("")}</nav>
        <h1>${escapeHtml(post.title)}</h1>
        <p class="blog-byline">
          <a class="blog-byline__name" href="/blog/about/">${BLOG_AUTHOR.name}</a>
          <time datetime="${post.date}">${formatDate(post.date)}</time>${post.updated !== post.date ? `<span>更新於 <time datetime="${post.updated}">${formatDate(post.updated)}</time></span>` : ""}
          <span>約 ${minutes} 分鐘</span>
        </p>${coverFigure(post)}
        <div class="blog-prose">
${body}
        </div>
        <div class="blog-share-end"><p class="blog-side__title">分享這篇</p>${shareLinks(post)}</div>${threads}
        <aside class="blog-author">
          <p class="blog-author__name"><a href="/blog/about/">${BLOG_AUTHOR.name}</a><span>${BLOG_AUTHOR.jobTitle}</span></p>
          <p>做 Mini Taiwan Pulse 的人。把台灣的交通、環境與統計開放資料放上同一張即時地圖。</p>
          <p class="blog-author__links"><a href="${BLOG_AUTHOR.threads}" rel="noopener" target="_blank">Threads</a><a href="${BLOG_AUTHOR.github}" rel="noopener" target="_blank">GitHub</a></p>
        </aside>${pager}${relatedBlock}
      </article>
    </main>${footer()}
  </body>
</html>
`;
}

function topicTabs(active: string | null, topics: BlogTopic[]): string {
  const tab = (href: string, name: string, on: boolean) => `<a href="${href}"${on ? ' aria-current="page"' : ""}>${escapeHtml(name)}</a>`;
  return `<nav class="blog-tabs" aria-label="主題">${tab("/blog/", "全部", active === null)}${topics.map((t) => tab(`/blog/${t.id}/`, t.name, active === t.id)).join("")}</nav>`;
}

/** 有文章的主題，依 BLOG_TOPICS 順序。 */
export function activeTopics(posts: BlogPost[]): BlogTopic[] {
  return BLOG_TOPICS.filter((t) => posts.some((p) => p.topic === t.id));
}

export function renderIndexPage(posts: BlogPost[]): string {
  const url = `${BLOG_ORIGIN}/blog/`;
  const topics = activeTopics(posts);
  const [featured] = posts;
  const hero = featured
    ? `
        <a class="blog-hero" href="${postPath(featured)}">
          <div class="blog-hero__media">${coverImgs(featured)}</div>
          <div class="blog-hero__text">
            <p class="blog-card__meta"><span>${escapeHtml(topicById(featured.topic)!.name)}</span><span>最新</span><time datetime="${featured.date}">${formatDate(featured.date)}</time></p>
            <h2>${escapeHtml(featured.title)}</h2>
            <p>${escapeHtml(featured.description)}</p>
          </div>
        </a>`
    : "";
  const sections = topics
    .map((t) => {
      const list = posts.filter((p) => p.topic === t.id);
      return `
        <section class="blog-shelf">
          <div class="blog-shelf__head"><h2><a href="/blog/${t.id}/">${escapeHtml(t.name)}</a></h2><a href="/blog/${t.id}/">全部 ${list.length} 篇 →</a></div>
          <ul class="blog-cards blog-cards--grid">${list.slice(0, 3).map(postCard).join("")}
          </ul>
        </section>`;
    })
    .join("");
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": `${url}#blog`,
        name: BLOG_NAME,
        description: BLOG_DESCRIPTION,
        url,
        inLanguage: "zh-Hant-TW",
        author: { "@id": `${BLOG_ORIGIN}/#author` },
        blogPost: posts.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: postUrl(p), datePublished: p.date })),
      },
      personLd,
    ],
  };
  return `${head({ title: `${BLOG_NAME}｜Mini Taiwan Pulse`, description: BLOG_DESCRIPTION, canonical: url, ogType: "website", image: featured?.cover ? assetPath(featured, featured.cover) : undefined, jsonLd: ld })}
  <body class="blog">${topNav()}
    <main class="blog-main blog-main--wide">
      <div class="blog-listing">
        <h1>${BLOG_NAME}</h1>
        <p class="blog-listing__lead">${BLOG_DESCRIPTION}</p>
        ${topicTabs(null, topics)}${hero}${sections}
      </div>
    </main>${footer()}
  </body>
</html>
`;
}

export function renderTopicPage(topic: BlogTopic, posts: BlogPost[]): string {
  const url = `${BLOG_ORIGIN}/blog/${topic.id}/`;
  const list = posts.filter((p) => p.topic === topic.id);
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: `${topic.name}｜${BLOG_NAME}`,
        description: topic.description,
        url,
        inLanguage: "zh-Hant-TW",
        isPartOf: { "@id": `${BLOG_ORIGIN}/blog/#blog` },
        hasPart: list.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: postUrl(p), datePublished: p.date })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: BLOG_NAME, item: `${BLOG_ORIGIN}/blog/` },
          { "@type": "ListItem", position: 2, name: topic.name, item: url },
        ],
      },
    ],
  };
  return `${head({ title: `${topic.name}｜${BLOG_NAME}`, description: topic.description, canonical: url, ogType: "website", image: list[0]?.cover ? assetPath(list[0], list[0].cover) : undefined, jsonLd: ld })}
  <body class="blog">${topNav()}
    <main class="blog-main blog-main--wide">
      <div class="blog-listing">
        <nav class="blog-crumb" aria-label="麵包屑"><a href="/blog/">${BLOG_NAME}</a><span aria-hidden="true">/</span><span>${escapeHtml(topic.name)}</span></nav>
        <h1>${escapeHtml(topic.name)}</h1>
        <p class="blog-listing__lead">${escapeHtml(topic.description)}</p>
        ${topicTabs(topic.id, activeTopics(posts))}
        <ul class="blog-cards blog-cards--grid">${list.map(postCard).join("")}
        </ul>
      </div>
    </main>${footer()}
  </body>
</html>
`;
}

export function renderAboutPage(): string {
  const url = `${BLOG_ORIGIN}/blog/about/`;
  const projects = [
    { name: "Mini Taiwan Pulse", desc: "台灣多運具即時脈動地圖（本站）", site: `${BLOG_ORIGIN}/`, github: "https://github.com/ianlkl11234s/mini-taiwan-pulse" },
    { name: "Mini-Taiwan 軌道運輸模擬", desc: "台灣軌道運輸即時模擬視覺化", site: "https://mini-taiwan-learning-project.zeabur.app/", github: "https://github.com/ianlkl11234s/mini-taiwan-learning-project" },
    { name: "Taiwan Flight Arc", desc: "台灣航班弧線 3D 視覺化", site: "https://flight-arc.zeabur.app/", github: "https://github.com/ianlkl11234s/flight-arc-graph" },
    { name: "Taiwan Weather Timelapse", desc: "台灣氣象時序動畫視覺化", site: "https://taiwan-weather-timelapse.zeabur.app/", github: "https://github.com/ianlkl11234s/taiwan-weather-timelapse" },
    { name: "Ship GIS", desc: "台灣海域船舶動態視覺化平台", github: "https://github.com/ianlkl11234s/tw-ship-viz" },
  ];
  const ld = {
    "@context": "https://schema.org",
    "@graph": [{ "@type": "ProfilePage", url, name: `關於 ${BLOG_AUTHOR.name}`, mainEntity: { "@id": `${BLOG_ORIGIN}/#author` } }, personLd],
  };
  return `${head({ title: `關於 ${BLOG_AUTHOR.name}｜${BLOG_NAME}`, description: `${BLOG_AUTHOR.name}，${BLOG_AUTHOR.jobTitle}，Mini Taiwan Pulse 作者。`, canonical: url, ogType: "profile", jsonLd: ld })}
  <body class="blog">${topNav()}
    <main class="blog-main">
      <article class="blog-article blog-article--solo">
        <h1>關於 ${BLOG_AUTHOR.name}</h1>
        <p class="blog-byline"><span class="blog-byline__name">${BLOG_AUTHOR.jobTitle}</span></p>
        <div class="blog-prose">
          <p>我是 ${BLOG_AUTHOR.name}，做 Mini Taiwan Pulse 的人。把台灣的交通、環境與統計開放資料放上同一張即時地圖，這裡的文章是開發過程與資料故事的紀錄，多數先發在 Threads，再整理擴寫成長文。</p>
          <h2>作品</h2>
          <ul>${projects.map((p) => `<li><strong>${escapeHtml(p.name)}</strong>：${escapeHtml(p.desc)}${p.site ? ` · <a href="${p.site}" rel="noopener" target="_blank">網站</a>` : ""} · <a href="${p.github}" rel="noopener" target="_blank">GitHub</a></li>`).join("")}</ul>
          <h2>聯絡與追蹤</h2>
          <ul><li><a href="${BLOG_AUTHOR.threads}" rel="noopener" target="_blank">Threads @ianlkl1314</a></li><li><a href="${BLOG_AUTHOR.github}" rel="noopener" target="_blank">GitHub ianlkl11234s</a></li></ul>
        </div>
      </article>
    </main>${footer()}
  </body>
</html>
`;
}

export function renderFeed(posts: BlogPost[]): string {
  const items = posts
    .map((p) => `
    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${postUrl(p)}</link>
      <guid>${postUrl(p)}</guid>
      <category>${escapeHtml(topicById(p.topic)!.name)}</category>
      <pubDate>${new Date(`${p.date}T00:00:00+08:00`).toUTCString()}</pubDate>
      <description>${escapeHtml(p.description)}</description>
    </item>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${BLOG_NAME}</title>
    <link>${BLOG_ORIGIN}/blog/</link>
    <description>${BLOG_DESCRIPTION}</description>
    <language>zh-tw</language>${items}
  </channel>
</rss>
`;
}

export function loadPosts(contentDir: string): BlogPost[] {
  if (!existsSync(contentDir)) return [];
  const posts = readdirSync(contentDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const post = toPost(readFileSync(join(contentDir, f), "utf8"));
      if (`${post.slug}.md` !== f) throw new Error(`檔名 ${f} 要與 slug ${post.slug} 一致`);
      return post;
    });
  const slugs = new Set<string>();
  for (const p of posts) {
    if (slugs.has(p.slug)) throw new Error(`slug 重複：${p.slug}`);
    slugs.add(p.slug);
  }
  return posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

/**
 * 產生 <root>/blog/**（gitignored 中繼檔），回傳給 vite 的 HTML entry 對照。
 * feed.xml 寫進 <root>/blog/ 不會被 vite 複製，所以另寫到 public/blog/feed.xml（gitignored）。
 */
export function generateBlog(root: string, warn: (msg: string) => void = console.warn): Record<string, string> {
  const outDir = resolve(root, "blog");
  const publicDir = resolve(root, "public");
  const posts = loadPosts(resolve(root, "content/blog"));
  rmSync(outDir, { recursive: true, force: true });
  if (!posts.length) return {};
  const inputs: Record<string, string> = {};
  const write = (key: string, rel: string, html: string) => {
    const dir = join(outDir, rel);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html);
    inputs[key] = join(dir, "index.html");
  };
  for (const post of posts) write(`blog-${post.slug}`, join(post.topic, post.slug), renderPostPage(post, posts, publicDir, warn));
  for (const topic of activeTopics(posts)) write(`blog-topic-${topic.id}`, topic.id, renderTopicPage(topic, posts));
  write("blog-about", "about", renderAboutPage());
  write("blog-index", "", renderIndexPage(posts));
  mkdirSync(join(publicDir, "blog"), { recursive: true });
  writeFileSync(join(publicDir, "blog", "feed.xml"), renderFeed(posts));
  return inputs;
}
