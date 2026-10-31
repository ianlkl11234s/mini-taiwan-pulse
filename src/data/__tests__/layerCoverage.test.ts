import { describe, expect, it } from "vitest";
import { LAYER_MANIFEST } from "../layerManifest";
import { COVERAGE_AREAS, LAYER_COVERAGE } from "../layerCoverage";

/**
 * 守門（design-system spec §5.42.1）：名稱寫了城市／縣市的圖層，多半只有那裡有資料，
 * 要登記資料範圍，視野提示卡才能給「前往〇〇」。判斷法：themed entry（排除模擬 SIM）的
 * 中文名、外文名、限定詞或 key 命中城市名 regex。誤判（名稱有城市、但其實全國或範圍另有說明）列進例外並寫理由。
 * 只是盡力：名稱沒寫城市的局部層抓不到，新增局部層時要自己登記。
 */
const CITY = /(倫敦|London|首爾|Seoul|서울|臺北|台北|Taipei|新北|雙北|北市|桃園|Taoyuan|新竹|Hsinchu|臺中|台中|Taichung|臺南|台南|Tainan|高雄|Kaohsiung|彰化|Changhua|基隆|嘉義|宜蘭|花蓮|臺東|台東|屏東|苗栗|南投|雲林|金門|連江|澎湖|釜山|Busan|東京|Tokyo|大阪|Osaka|京都|Kyoto|Paris|巴黎)/;

/** 名稱含城市但不需要資料範圍的層（key → 理由） */
const EXCEPTIONS: Record<string, string> = {
  parksTaipei: "key 沿用舊名，資料實際含臺北、臺中、臺南三市公園（2026-10-31 查 parks_taipei.geojson），不是單一城市",
};

type Entry = { section: unknown; country?: string; label?: string; name?: { zh: string; alt?: string; qualifier?: string } };

describe("layerCoverage", () => {
  it("名稱含城市的圖層都有登記資料範圍", () => {
    const missing: string[] = [];
    for (const [key, entry] of Object.entries(LAYER_MANIFEST as Record<string, Entry>)) {
      if (!entry.section || entry.country === "SIM") continue;
      const text = [key, entry.label, entry.name?.alt, entry.name?.qualifier].filter(Boolean).join(" ");
      if (CITY.test(text) && !(key in LAYER_COVERAGE) && !(key in EXCEPTIONS)) missing.push(`${key}（${entry.label}）`);
    }
    expect(missing).toEqual([]);
  });

  it("登記的 key 都存在、範圍合理", () => {
    for (const key of Object.keys(LAYER_COVERAGE)) expect(LAYER_MANIFEST, key).toHaveProperty(key);
    for (const [id, { bbox: [w, s, e, n] }] of Object.entries(COVERAGE_AREAS)) {
      expect(w < e && s < n, id).toBe(true);
      expect(e - w < 3 && n - s < 3, `${id} 範圍太大，不像局部資料`).toBe(true);
    }
  });
});
