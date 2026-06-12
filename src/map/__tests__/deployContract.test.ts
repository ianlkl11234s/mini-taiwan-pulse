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
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";

const registrySource = readFileSync("src/map/overlayRegistry.ts", "utf8");
const nginxConf = readFileSync("nginx.conf", "utf8");
const pullScript = readFileSync("scripts/deploy/pull-deploy-assets.sh", "utf8");

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
  return nginxConf.includes(`location /${dir}/`);
}

function pullCovers(dir: string): boolean {
  // 子前綴鏡像 sync（forestry/agriculture/medical/...）或 include filter 進 /data/<dir>/
  return (
    pullScript.includes(`$DATA_DIR/${dir}/`) || pullScript.includes(`$S3/${dir}/`)
  );
}

describe("deploy 契約（nginx + pull script）", () => {
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
