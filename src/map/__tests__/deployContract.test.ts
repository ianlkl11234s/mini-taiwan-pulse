/**
 * 部署契約 ratchet — 防止「林班事件」（2026-06-10/12）重演。
 *
 * 事件回顧：FORESTRY 圖層上傳端（upload-deploy-assets.sh）6/7 就有，但
 * pull-deploy-assets.sh 與 nginx.conf 漏接 /forestry/ → 容器上大檔全 404；
 * 又因 registry 指向已 gitignore 且本機刪除的 219MB geojson，本機 dev 也 404。
 * 兩個洞疊在一起 = 「林班資料不見了」且無人察覺。
 *
 * 本測試固化三個不變量：
 *   1. 前端引用的每個 public/ 子目錄，nginx.conf 必須有對應 location
 *   2. 同子目錄，pull-deploy-assets.sh 必須有對應同步（S3 → /data）
 *   3. 引用的檔案若本機不存在（gitignored 大檔），其子目錄必須已被
 *      1+2 涵蓋（即確定由 S3 deploy-assets 管理），否則 fail
 *
 * 新增資產子目錄時：upload 腳本（自己跑會發現）、pull 腳本、nginx.conf
 * 三處都要接 — 漏任何一處本測試直接紅。
 *
 * ── 2026-08-12 升級：目錄級 → 逐檔級（觸點 #20）────────────────────────
 *
 * 上面三條**只到目錄層級**（`nginxCovers` / `pullCovers` 是子字串比對），
 * 而 upload 腳本是**逐檔清單**。「目錄接了但那一檔沒進清單」整類缺口
 * 因此完全在射程外 —— 5 個真缺口（hillshade / flood / fishery×3 /
 * power_poles，加上建立本斷言時多抓到的 real_estate_points_buffer.bin）
 * 就是這樣長期潛伏的。枚舉來源也只掃 OVERLAY_REGISTRY，看不見
 * `kind:"custom"` 那批自建 source 的層（slope/aspect/powerPoles/農業 factory…）。
 *
 * 升級後：枚舉改 **manifest 驅動**（348 entry 的 url / fallbackUrl /
 * staticAssets），逐檔跑正向斷言，另加一條反向斷言。OVERLAY_REGISTRY
 * 掃描保留當交叉驗證（registry 有的 manifest 必須也有）。
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { LAYER_MANIFEST, MANIFEST_KEYS, type LayerManifestEntry } from "../../data/layerManifest";

const registrySource = readFileSync("src/map/overlayRegistry.ts", "utf8");
const nginxConf = readFileSync("nginx.conf", "utf8");
const pullScript = readFileSync("scripts/deploy/pull-deploy-assets.sh", "utf8");
const uploadScript = readFileSync("scripts/deploy/upload-deploy-assets.sh", "utf8");
const gfwTracksLoader = readFileSync("src/data/gfwHourlyTracksLoader.ts", "utf8");
const gfwGridLoader = readFileSync("src/data/gfwHourlyGridLoader.ts", "utf8");
const gfwDarkLoader = readFileSync("src/data/gfwDarkVesselsLoader.ts", "utf8");
const gfwManifestContract = readFileSync("src/data/gfwHourlyReleaseManifest.ts", "utf8");
const gfwRefreshScript = readFileSync("scripts/deploy/refresh-gfw-hourly.sh", "utf8");
const entrypoint = readFileSync("scripts/deploy/entrypoint.sh", "utf8");
const dockerfile = readFileSync("Dockerfile", "utf8");
const viteConfig = readFileSync("vite.config.ts", "utf8");

/** overlayRegistry 的所有 sourceUrl（"./geo/xxx.geojson" → "geo/xxx.geojson"） */
const sourceUrls = [...registrySource.matchAll(/sourceUrl:\s*"\.\/([^"]+)"/g)].map(
  (m) => m[1] as string,
);

/** factory 檔的 BASE 目錄（`${import.meta.env.BASE_URL ?? "/"}agriculture` → "agriculture"） */
const factoryDirs = readdirSync("src/map")
  .filter((f) => f.endsWith(".ts"))
  .flatMap((f) => {
    const src = readFileSync(`src/map/${f}`, "utf8");
    return [...src.matchAll(/BASE_URL \?\? "\/"\}(\w+)/g)].map((m) => m[1] as string);
  });

const referencedDirs = new Set<string>([
  ...sourceUrls.filter((u) => u.includes("/")).map((u) => u.split("/")[0] as string),
  ...factoryDirs,
]);

function nginxCovers(dir: string): boolean {
  // `^~` 也是前綴 location（語意相同，只是命中後不再比對正則、優先序更高）
  return (
    nginxConf.includes(`location /${dir}/`) ||
    nginxConf.includes(`location ^~ /${dir}/`)
  );
}

function pullCovers(dir: string): boolean {
  // 子前綴鏡像 sync（forestry/agriculture/medical/...）或 include filter 進 /data/<dir>/
  return (
    pullScript.includes(`$DATA_DIR/${dir}/`) || pullScript.includes(`$S3/${dir}/`)
  );
}

// ══════════════════════════════════════════════════════════════════
//  枚舉：manifest 驅動的逐檔靜態資產清單
// ══════════════════════════════════════════════════════════════════

/**
 * 每個 manifest entry 宣告的靜態檔路徑（正規化成 "dir/file"，相對 public/）。
 *   - `kind:"geojson"` / `"pmtiles"` → `url`
 *   - `kind:"supabase"` → `fallbackUrl`（動態層在 RPC 掛掉時真的會去抓）
 *   - `kind:"custom"` → `staticAssets`（AR-22 補的結構化欄位；沒有靜態檔就沒有本欄）
 * 回傳 path → 引用它的 layer key 清單（訊息要指得出「誰在用」）。
 */
function manifestAssets(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (url: string, key: string) => {
    const p = url.replace(/^\.\//, "");
    if (!out.has(p)) out.set(p, []);
    (out.get(p) as string[]).push(key);
  };
  for (const key of MANIFEST_KEYS) {
    const m = LAYER_MANIFEST[key] as LayerManifestEntry;
    for (const s of Array.isArray(m.source) ? m.source : [m.source]) {
      if (s.kind === "geojson" || s.kind === "pmtiles") {
        add(s.url, key);
        if (s.kind === "pmtiles") for (const a of s.companionAssets ?? []) add(a, key);
      }
      else if (s.kind === "supabase") add(s.fallbackUrl, key);
      else for (const a of s.staticAssets ?? []) add(a, key);
    }
  }
  return out;
}

const ASSETS = manifestAssets();

// ══════════════════════════════════════════════════════════════════
//  nginx 行為建模（最長前綴匹配）
// ══════════════════════════════════════════════════════════════════

interface NginxLoc {
  /** 前綴，含頭尾斜線，例：`/base_map/` */
  prefix: string;
  /** body 有 `root /data;` → 從 persistent volume 供檔 */
  readsData: boolean;
  /** body 有 `try_files $uri @dist` → volume 找不到時退回 dist（git 小檔） */
  distFallback: boolean;
}

/**
 * ⚠️ **脆弱點（刻意的簡化，改 nginx.conf 時請一起看這裡）**：
 *   1. 只解析「前綴 location」——`location /<dir>/ {` 與 `location ^~ /<dir>/ {` 兩種寫法
 *      （`^~` 語意同前綴，差別在命中後不再比對正則、優先序更高）。
 *      **不解析** `location = ` 精確匹配與 `location ~ ` 正則匹配。
 *      真實 nginx 的正則 location 優先序**高於**無修飾符的前綴，例如檔尾那條
 *      `~* \.(js|css|png|…)$` 會截走 `/base_map/hillshade.png` 並從 dist 供檔。
 *      本模型刻意不含它 —— 那條只設快取 header 不換 root 的意圖，靠它來供大檔
 *      是意外行為不是契約。
 *      📌 2026-08-14 實例：`/climate/*.png` 就是這樣被截走的，dist 的 build 快照
 *      遮蔽了 `/data` 的 S3 新版，`refresh-climate.sh` 每輪更新使用者永遠拿不到
 *      （實測 dust_latest.png 線上 17,649B vs S3 18,027B），還被加上 7 天 immutable。
 *      修法是把該 location 改成 `^~`（治本，不必依賴「PNG 補進 upload 清單」）。
 *      `base_map/hillshade.png` 同樣被截，但 dist 與 S3 逐位元相同且為不變的靜態
 *      底圖，保留 dist fallback 較穩健，故維持無修飾符。
 *   2. location body 假設**沒有巢狀大括號**（現況成立）。
 *   3. 沒有任何前綴命中 → 落到 SPA root `location /`（`try_files $uri …`），
 *      等同 dist 供檔。
 */
const NGINX_LOCS: NginxLoc[] = [
  ...nginxConf.matchAll(/location\s+(?:\^~\s*)?(\/[A-Za-z0-9_.-]+\/)\s*\{([^}]*)\}/g),
].map((m) => ({
  prefix: m[1] as string,
  readsData: /root\s+\/data\s*;/.test(m[2] as string),
  distFallback: (m[2] as string).includes("@dist"),
}));

/** 最長前綴匹配；沒有命中回 null（= 落到 SPA root，從 dist 供檔） */
function locationFor(path: string): NginxLoc | null {
  let best: NginxLoc | null = null;
  for (const loc of NGINX_LOCS) {
    if (!`/${path}`.startsWith(loc.prefix)) continue;
    if (!best || loc.prefix.length > best.prefix.length) best = loc;
  }
  return best;
}

// ══════════════════════════════════════════════════════════════════
//  upload 腳本解析（逐檔陣列 + for-loop glob + 整夾 sync）
// ══════════════════════════════════════════════════════════════════

/**
 * ⚠️ **脆弱點（ratchet 性質，按現有腳本慣例寫死三種形狀）**：
 *   A. 逐檔陣列元素 —— 獨佔一行的 `"public/…"` 字串（FILES / AGRI_FILES /
 *      FOREST_FILES / FISHERY_FILES / BUS_BIG_FILES / TOURISM_FILES 都是這個排版）。
 *      被註解掉的行不會匹配（`#` 開頭），這正是 owner-gated 兩檔「刻意不上傳」的表達方式。
 *   B. `for f in <pattern…>; do` 的 glob / 字面路徑（可多個，空白分隔）。
 *   C. `aws s3 sync public/<dir>/ …` 的整夾鏡像（embed-snapshots / embed-rail）。
 * 腳本若改用其他寫法（變數展開、間接引用、`find`），本解析器會**靜默漏看**
 * → 表現成假紅（該檔其實有上傳卻被判缺）。假紅比假綠安全，但修的時候要來改這裡。
 */
function uploadPatterns(): { globs: string[]; syncDirs: Set<string> } {
  const globs = [
    ...[...uploadScript.matchAll(/^\s*"(public\/[^"]+)"\s*$/gm)].map((m) => m[1] as string),
    ...[...uploadScript.matchAll(/^\s*for\s+f\s+in\s+([^;]+);\s*do/gm)].flatMap((m) =>
      (m[1] as string).split(/\s+/).filter((w) => w.startsWith("public/")),
    ),
  ];
  const syncDirs = new Set(
    [...uploadScript.matchAll(/aws s3 sync\s+public\/([A-Za-z0-9_.-]+)\//g)].map(
      (m) => m[1] as string,
    ),
  );
  return { globs, syncDirs };
}

const UPLOAD = uploadPatterns();

/** glob → RegExp（`*` 不跨 `/`，其餘字元字面比對） */
function globToRe(glob: string): RegExp {
  const body = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp(`^${body}$`);
}
const UPLOAD_RES = UPLOAD.globs.map(globToRe);

/** 這個檔有沒有真的被 upload 腳本推上 S3（檔案級，不是目錄級） */
function uploadCovers(path: string): boolean {
  if (UPLOAD.syncDirs.has(path.split("/")[0] as string)) return true;
  return UPLOAD_RES.some((re) => re.test(`public/${path}`));
}

/** git 追蹤中的 public/ 檔案（→ build 後會進 dist，dist fallback 那條路才活） */
const TRACKED = new Set(
  execSync("git ls-files public", { encoding: "utf8" }).split("\n").filter(Boolean),
);
function gitTracked(path: string): boolean {
  return TRACKED.has(`public/${path}`);
}

// ══════════════════════════════════════════════════════════════════
//  豁免 ledger（比照 layerConsistency 的 NO_POPUP_LEDGER 雙向凍結 idiom）
// ══════════════════════════════════════════════════════════════════

/**
 * **真檔但刻意不部署** —— 前端仍留著 fallbackUrl（dev 本機有檔可跑），
 * 但 prod 供應被有意識地切斷。加一筆必須寫下理由；
 * 哪天它又進了上傳清單，下方的雙向斷言會叫你把它移除（ratchet 只進不退）。
 */
const DEPLOY_EXEMPT_LEDGER = new Set<string>([
  // owner-gated（docs/features/owner-gated-layers）：改走 owner-only RPC，
  // upload 的 AGRI_FILES 把兩行註解掉，pull 端另有 --exclude ＋ rm -f 清 volume 殘留。
  "agriculture/livestock_farms.geojson",
  "agriculture/slaughterhouses.geojson",
  // GFW 7-day hourly-grid POC is a local 579 MiB acceptance artifact. It is
  // gitignored and stripped from dist until a production storage/RPC contract exists.
  "gfw_hourly_grid_poc/manifest.json",
  // GFW sampled-track POC is likewise local-only, gitignored, and stripped from dist.
  "gfw_hourly_tracks_poc/manifest.json",
]);

/**
 * **推送端不在本 repo** —— 檔案確實上得了 S3，但推它的管線不是
 * `scripts/deploy/upload-deploy-assets.sh`，所以檔案級斷言在這裡拿不到證據。
 * 目錄為單位；pull + nginx 兩端仍照常斷言（那兩端在本 repo 內）。
 * 哪天上傳段搬進本腳本，下方雙向斷言會叫你把它移除。
 */
const EXTERNAL_UPLOAD_LEDGER = new Set<string>([
  // 19 個 dataset 子目錄共 172MB：dev 用 symlink → taipei-gis-analytics/
  // data/processed/police_justice/（見 .gitignore），prod 走 deploy-assets/police_justice/。
  // 本 repo 的 upload 腳本從來沒有這一段，pull 端有。
  "police_justice",
]);

/** `_empty.geojson` 是「動態層起手用的空殼」，不是要部署的資料檔 */
function isEmptyShell(path: string): boolean {
  return path.split("/").pop() === "_empty.geojson";
}

// ══════════════════════════════════════════════════════════════════

describe("deploy 契約（nginx + pull script）", () => {
  it("Ookla dist publication assets retain cache headers, MIME types, and Range-capable static serving", () => {
    const match = nginxConf.match(
      /location ~ \^\/geo\/ookla_\(fixed_global\|mobile_global\|tw_z14\|tw_z16\).*?\{([\s\S]*?)\n    \}/,
    );
    expect(match, "Ookla exact publication location missing").not.toBeNull();
    const body = match?.[1] ?? "";
    expect(body).toContain("root /usr/share/nginx/html;");
    expect(body).toContain("try_files $uri =404;");
    expect(body).toContain("application/geo+json geojson;");
    expect(body).toContain("application/vnd.pmtiles pmtiles;");
    expect(body).toContain("expires 1d;");
    expect(body).toContain('add_header Cache-Control "public";');
  });

  it("前端引用的每個 public/ 子目錄都有 nginx location", () => {
    const missing = [...referencedDirs].filter((d) => !nginxCovers(d));
    expect(
      missing,
      `這些目錄缺 nginx location（容器上會走 SPA fallback → 大檔 404）：` +
      `${missing.join(", ")}\n→ nginx.conf 加 "location /<dir>/ { root /data; try_files $uri @dist; }"`,
    ).toEqual([]);
  });

  it("前端引用的每個 public/ 子目錄都有 pull 同步", () => {
    const missing = [...referencedDirs].filter((d) => !pullCovers(d));
    expect(
      missing,
      `這些目錄缺 pull-deploy-assets.sh 同步（容器拉不到 S3 檔案）：` +
      `${missing.join(", ")}\n→ 比照 forestry 段加 "aws s3 sync $S3/<dir>/ $DATA_DIR/<dir>/"`,
    ).toEqual([]);
  });

  it("registry 引用但本機不存在的檔案，必須屬於已接線的 S3 管理目錄", () => {
    const orphans = sourceUrls.filter((u) => {
      if (existsSync(`public/${u}`)) return false; // 本機有 → OK（git 小檔或已 sync）
      const dir = u.includes("/") ? (u.split("/")[0] as string) : "";
      // 本機沒有 → 必須是 nginx+pull 已涵蓋的子目錄（S3 deploy-assets 管理）
      return !(dir && nginxCovers(dir) && pullCovers(dir));
    });
    expect(
      orphans,
      `這些 sourceUrl 本機不存在且不屬於任何 S3 管理目錄（dev 與容器都會 404）：` +
      `${orphans.join(", ")}\n→ 不是檔案忘了產，就是部署管線（nginx/pull）漏接`,
    ).toEqual([]);
  });

  it("sanity：有掃到東西（防 regex 失效讓測試默默變空轉）", () => {
    expect(sourceUrls.length).toBeGreaterThan(30);
    expect(referencedDirs.size).toBeGreaterThanOrEqual(3); // geo / forestry / agriculture ...
  });
});

describe("deploy 契約（manifest 逐檔）", () => {
  it("GFW production 預設同域 unified root，可選 CDN override，local POC 不進 dist", () => {
    expect(gfwManifestContract).toContain("VITE_GLOBAL_MARITIME_CDN_BASE");
    expect(gfwManifestContract).toContain("global-maritime/gfw-hourly/manifest.json");
    expect(gfwManifestContract).toContain("VITE_GFW_HOURLY_V3_SHADOW_ENABLED");
    expect(gfwManifestContract).toContain("VITE_GFW_HOURLY_USE_LOCAL_POC");
    expect(gfwManifestContract).toContain("global-maritime/gfw-hourly/v3-shadow/manifest.json");
    expect(gfwManifestContract).toContain("const path = shadowEnabled ? GFW_HOURLY_V3_SHADOW_ROOT_PATH : ROOT_PATH");
    expect(gfwTracksLoader).toContain('fetch(manifestUrl, { cache: "no-cache" })');
    expect(gfwTracksLoader).toContain('{ cache: "force-cache" }');
    expect(gfwGridLoader).toContain('fetch(manifestUrl, { cache: "no-cache" })');
    expect(gfwDarkLoader).toContain('fetch(url, { cache: "no-cache" })');
    expect(viteConfig).toContain('"gfw_hourly_tracks_poc.geojson"');
    expect(viteConfig).toContain('"gfw_hourly_tracks_poc"');
    expect(viteConfig).toContain('"gfw_hourly_grid_poc"');
    expect(viteConfig).toContain('"/global-maritime/gfw-hourly"');
    expect(viteConfig).not.toContain('"/global-maritime":');
    expect(viteConfig).toContain('target: "https://mini-taiwan-pulse.itsmigu.com"');
    expect(viteConfig).toContain('proxyReq.removeHeader("authorization")');
    expect(viteConfig).toContain('proxyReq.removeHeader("cookie")');
    expect(viteConfig).toContain('proxyReq.setHeader("range", range)');
  });

  it("GFW S3 先同步 immutable releases 再原子切 root，container 週期追新", () => {
    const refreshSync = gfwRefreshScript.indexOf("aws s3 sync");
    const refreshManifest = gfwRefreshScript.indexOf("manifest.json.tmp");
    expect(refreshSync).toBeGreaterThanOrEqual(0);
    expect(refreshManifest).toBeGreaterThan(refreshSync);
    expect(gfwRefreshScript).toContain('--exclude "manifest.json"');
    expect(gfwRefreshScript).toContain('mv "/data/global-maritime/gfw-hourly/manifest.json.tmp"');
    expect(gfwRefreshScript).toContain('v3-shadow/manifest.json.tmp');
    expect(pullScript).toContain('$S3/global-maritime/gfw-hourly/');
    expect(pullScript).toContain('--exclude "v3-shadow/manifest.json"');
    expect(pullScript).toContain('v3-shadow/manifest.json.tmp');
    expect(pullScript.indexOf('--exclude "manifest.json"'))
      .toBeLessThan(pullScript.indexOf('manifest.json.tmp'));
    expect(entrypoint).toContain("GFW_HOURLY_REFRESH_SEC:-21600");
    expect(entrypoint).toContain("/usr/local/bin/refresh-gfw-hourly.sh");
    expect(dockerfile).toContain("COPY scripts/deploy/refresh-gfw-hourly.sh");
  });

  it("GFW same-origin cache headers 符合 root 60s/SWR300 與 release 7d immutable", () => {
    expect(nginxConf).toContain("location = /global-maritime/gfw-hourly/manifest.json");
    expect(nginxConf).toContain("location = /global-maritime/gfw-hourly/v3-shadow/manifest.json");
    expect(nginxConf).toContain('Cache-Control "public,max-age=60,s-maxage=60,stale-while-revalidate=300"');
    expect(nginxConf).toContain("location ^~ /global-maritime/gfw-hourly/releases/");
    expect(nginxConf).toContain("location ^~ /global-maritime/gfw-hourly/v3-shadow/releases/");
    expect(nginxConf).toContain('Cache-Control "public,max-age=604800,s-maxage=604800,immutable"');
    expect(nginxConf).toContain("gzip off;");
    expect(gfwManifestContract).toContain('root_manifest !== "public,max-age=60,s-maxage=60,stale-while-revalidate=300"');
    expect(gfwManifestContract).toContain('immutable_release !== "public,max-age=604800,s-maxage=604800,immutable"');
  });
  it("business_registry immutable asset 可安全重跑，相同 checksum 不覆寫也不阻斷後續上傳", () => {
    expect(uploadScript).toContain("local_sha256=$(openssl dgst -sha256");
    expect(uploadScript).toContain('[ "$remote_sha256" = "$local_sha256" ]');
    expect(uploadScript).toContain("Skipping immutable business_registry/$name (same SHA-256)");
    expect(uploadScript).toContain('--metadata "sha256=$local_sha256"');
    expect(uploadCovers("business_registry/company_filters_202608_r2.json")).toBe(true);
  });

  it("industrial_zone immutable PMTiles 有 upload / pull / nginx 完整供應鏈", () => {
    expect(uploadCovers("industrial_zone/industrial_park_boundaries_20260818.pmtiles")).toBe(true);
    expect(pullCovers("industrial_zone")).toBe(true);
    expect(locationFor("industrial_zone/industrial_park_boundaries_20260818.pmtiles")?.readsData).toBe(true);
    expect(uploadScript).toContain("Skipping immutable industrial_zone/$name (same SHA-256)");
  });

  it("sanity：三個解析器都有掃到東西（空轉 = 假綠，比缺口更危險）", () => {
    expect(ASSETS.size, "manifest 靜態資產枚舉為空 → 收集器壞了").toBeGreaterThan(150);
    expect(NGINX_LOCS.length, "nginx location 解析為空").toBeGreaterThan(20);
    expect(UPLOAD.globs.length, "upload 清單解析為空").toBeGreaterThan(50);
    expect(TRACKED.size, "git ls-files public 為空").toBeGreaterThan(100);
    // 解析器至少要認得出這幾種形狀，否則後面的斷言是空轉
    expect(uploadCovers("agriculture/ftw_fields_2025.pmtiles"), "逐檔陣列沒解析到").toBe(true);
    expect(uploadCovers("urban/street_trees_national.pmtiles"), "for-loop glob 沒解析到").toBe(true);
    expect(locationFor("base_map/hillshade.png")?.prefix).toBe("/base_map/");
    expect(locationFor("geo/cctv.geojson")?.distFallback).toBe(true);
  });

  it("交叉驗證：OVERLAY_REGISTRY 的每個 sourceUrl 都在 manifest 的枚舉裡", () => {
    const missing = [...new Set(sourceUrls)].filter((u) => !ASSETS.has(u)).sort();
    expect(
      missing,
      `這些 registry sourceUrl 在 manifest 枚舉不到 —— manifest 漏宣告，` +
      `逐檔斷言就跟著漏掉它們：${missing.join(", ")}`,
    ).toEqual([]);
  });

  /**
   * 正向：manifest 引用的每個檔，照 nginx 實際會怎麼供它，去對應的那一端要證據。
   *   純 volume location（無 dist fallback）→ 必須 upload 有該檔 ＋ pull 有該目錄
   *   有 dist fallback              → upload 有該檔 **或** git 追蹤（兩條路活一條即可）
   *   沒有 location（SPA root）      → 只能靠 dist ⇒ 必須 git 追蹤
   */
  it("manifest 引用的每個靜態檔都有一條活的供應路徑", () => {
    const broken: string[] = [];
    for (const [path, keys] of [...ASSETS].sort()) {
      if (isEmptyShell(path)) continue;
      if (DEPLOY_EXEMPT_LEDGER.has(path)) continue;
      const dir = path.split("/")[0] as string;
      if (EXTERNAL_UPLOAD_LEDGER.has(dir)) {
        if (!pullCovers(dir)) broken.push(`${path}（${keys.join("/")}）: pull 沒同步 ${dir}/`);
        continue;
      }
      const loc = locationFor(path);
      const who = `${path}（${keys.join("/")}）`;
      if (!loc || !loc.readsData) {
        if (!gitTracked(path)) {
          broken.push(`${who}: 落到 SPA root/dist 但不在 git ⇒ dist 裡不會有這個檔`);
        }
      } else if (loc.distFallback) {
        if (!uploadCovers(path) && !gitTracked(path)) {
          broken.push(
            `${who}: nginx ${loc.prefix} 有 dist fallback，但 upload 清單沒有它、git 也沒追蹤 ⇒ 兩條路都空`,
          );
        }
      } else {
        if (!uploadCovers(path)) {
          broken.push(
            `${who}: nginx ${loc.prefix} 是純 volume（無 dist fallback）⇒ 只能從 S3 來，` +
            `但 upload 清單沒有它`,
          );
        } else if (!pullCovers(dir)) {
          broken.push(`${who}: nginx ${loc.prefix} 是純 volume，但 pull 沒同步 ${dir}/`);
        }
      }
    }
    expect(
      broken,
      `這些 manifest 引用的靜態檔在 prod 拿不到（404）：\n  ${broken.join("\n  ")}\n` +
      `→ 純 volume 目錄：把檔案加進 upload-deploy-assets.sh 的清單/glob\n` +
      `→ 要走 dist：檔案得 git 追蹤，且 nginx location 要有 try_files $uri @dist\n` +
      `→ 真的刻意不部署：加進本檔的 DEPLOY_EXEMPT_LEDGER 並寫下理由`,
    ).toEqual([]);
  });

  /** ledger 雙向凍結：登記的東西若已經被部署了，就該從 ledger 移除 */
  it("DEPLOY_EXEMPT_LEDGER 沒有過期條目（ratchet 只進不退）", () => {
    const stale = [...DEPLOY_EXEMPT_LEDGER].filter((p) => uploadCovers(p)).sort();
    expect(
      stale,
      `這些檔已經進了 upload 清單（= 有在部署），請從 DEPLOY_EXEMPT_LEDGER 移除：${stale.join(", ")}`,
    ).toEqual([]);
    const unreferenced = [...DEPLOY_EXEMPT_LEDGER].filter((p) => !ASSETS.has(p)).sort();
    expect(
      unreferenced,
      `這些檔 manifest 已經不引用了，ledger 留著只會誤導：${unreferenced.join(", ")}`,
    ).toEqual([]);
  });

  it("EXTERNAL_UPLOAD_LEDGER 沒有過期條目（上傳段搬進本 repo 就該移除）", () => {
    const stale = [...EXTERNAL_UPLOAD_LEDGER].filter((dir) => {
      const files = [...ASSETS.keys()].filter((p) => p.split("/")[0] === dir);
      return files.length > 0 && files.every((p) => uploadCovers(p));
    });
    expect(
      stale,
      `這些目錄的檔案已全數進了本 repo 的 upload 清單，` +
      `請從 EXTERNAL_UPLOAD_LEDGER 移除：${stale.join(", ")}`,
    ).toEqual([]);
  });

  /**
   * 反向：deploy 腳本推到 /data/<dir>/ 的每個目錄，nginx 都要有讀 /data 的 location。
   * 沒有的話那條 S3 路徑整條是死的 —— 檔案躺在 volume 上但沒人服務它
   * （`/flood/` 修復前正是這個形狀：upload/pull 都推了，nginx 沒有 location）。
   */
  it("deploy 腳本推送的每個目錄，nginx 都有讀 /data 的 location", () => {
    const pushed = new Set([
      ...[...uploadScript.matchAll(/\$PREFIX\/([A-Za-z0-9_-]+)\//g)].map((m) => m[1] as string),
      ...[...pullScript.matchAll(/\$DATA_DIR\/([A-Za-z0-9_-]+)\//g)].map((m) => m[1] as string),
      ...[...pullScript.matchAll(/\$S3\/([A-Za-z0-9_-]+)\//g)].map((m) => m[1] as string),
    ]);
    const orphanDirs = [...pushed]
      .filter((d) => {
        const loc = NGINX_LOCS.find((l) => l.prefix === `/${d}/`);
        return !loc || !loc.readsData;
      })
      .sort();
    expect(
      orphanDirs,
      `deploy 管線把檔案推進 /data/<dir>/ 但 nginx 沒有讀得到它的 location ` +
      `⇒ 那條 S3 路徑整條死掉（檔案躺在 volume 上沒人服務）：${orphanDirs.join(", ")}\n` +
      `→ nginx.conf 加 "location /<dir>/ { root /data; … }"（有 git 小檔就再加 try_files $uri @dist）`,
    ).toEqual([]);
    expect(pushed.size, "反向枚舉為空 → 腳本解析壞了").toBeGreaterThan(15);
  });
});
