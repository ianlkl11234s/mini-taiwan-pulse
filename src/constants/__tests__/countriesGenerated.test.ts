/**
 * countries.generated.ts 是否最新（owner-local；照 layerRegistryCoverage.test.ts 的慣例）。
 *
 * 正本 pulse-data countries/countries.json 在私有 repo，CI 讀不到 → 略過；真正的守門在 pulse-data CI
 * （scripts/check_countries.py --mini-generated 比對 develop 的產生檔）。手改產生檔由 countries.test.ts 的雜湊檢查抓。
 *
 * 讀取位置：env PULSE_DATA_ROOT 優先；否則 owner 模式（npm run test:owner）讀隔壁 ../pulse-data 主 checkout。
 * PULSE_DATA_ROOT 指到的 checkout 還沒有 countries/（舊版 pulse-data，其他測試也讀這個變數）→ 略過，不報錯。
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OWNER_TESTS } from "../../test/ownerAssets";
import { GENERATED_PATH, renderCountriesModule } from "./countriesCodegen";

const ROOT = join(__dirname, "..", "..", "..");

function resolveSource(): string | null {
  const envRoot = process.env.PULSE_DATA_ROOT;
  const candidates = envRoot ? [resolve(envRoot)] : OWNER_TESTS ? [resolve(ROOT, "../pulse-data"), resolve(ROOT, "../../../pulse-data")] : [];
  return candidates.map((dir) => resolve(dir, "countries/countries.json")).find((file) => existsSync(file)) ?? null;
}

const source = resolveSource();

describe.skipIf(!source)("countries.generated.ts ↔ pulse-data 正本（owner-local）", () => {
  it("產生檔是最新的（改了正本請跑 PULSE_DATA_ROOT=<pulse-data> npx tsx scripts/countries/gen-countries.ts）", () => {
    expect(readFileSync(join(ROOT, GENERATED_PATH), "utf8")).toBe(renderCountriesModule(readFileSync(source!, "utf8")));
  });
});
