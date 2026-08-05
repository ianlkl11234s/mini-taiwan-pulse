/**
 * 嵌入版 popup 的欄位過濾與跳脫（EM-20）
 *
 * XSS 那組是**安全測試**：嵌入頁跑在別人的網站裡，properties 全部來自資料檔，
 * 一旦有欄位帶標籤而沒跳脫，就會在對方頁面上執行。
 */
import { describe, it, expect } from "vitest";
import { buildPopupHtml, escapeHtml } from "../embedPopup";

const html = (props: Record<string, unknown>, limit?: number) =>
  buildPopupHtml("測試圖層", props, true, limit);

describe("escapeHtml", () => {
  it("跳脫全部五個危險字元", () => {
    expect(escapeHtml(`<a href="x" data='y'>&`)).toBe(
      "&lt;a href=&quot;x&quot; data=&#39;y&#39;&gt;&amp;",
    );
  });
});

describe("buildPopupHtml — 安全", () => {
  it("🔒 property 值中的標籤被跳脫，不會變成真的元素", () => {
    const out = html({ name: `<img src=x onerror="alert(1)">` });
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
  });

  it("🔒 property key 也會被跳脫（欄位名同樣來自資料）", () => {
    const out = html({ "<script>": "v" });
    expect(out).not.toContain("<script>");
  });

  it("🔒 圖層名稱被跳脫", () => {
    expect(buildPopupHtml("<b>x</b>", { name: "a" }, true)).not.toContain("<b>x</b>");
  });
});

describe("buildPopupHtml — 欄位過濾", () => {
  it("隱藏內部 id 與幾何欄位", () => {
    const out = html({ name: "廟", osm_id: 1, lon: 121, lat: 25, geom_json: {}, entity_id: "x" });
    expect(out).toContain("廟");
    for (const k of ["osm_id", "lon", "lat", "geom_json", "entity_id"]) {
      expect(out, `${k} 不該出現`).not.toContain(k);
    }
  });

  it("用 pattern 擋掉後設欄位（逐個列舉擋不完）", () => {
    const out = html({ name: "廟", source_tier: 6, coord_source: "osm", license: "ODbL", confidence: 0.75 });
    for (const k of ["source_tier", "coord_source", "license", "confidence"]) {
      expect(out, `${k} 不該出現`).not.toContain(k);
    }
  });

  it("布林 false 不顯示（「不是古蹟」沒有資訊量），true 顯示為「是」", () => {
    const out = html({ name: "廟", heritage: true, closed: false });
    expect(out).toContain("是");
    expect(out).not.toContain("closed");
  });

  it("空值一律略過（含 MVT 常見的 \"[]\" / \"{}\" 字串）", () => {
    const out = html({ name: "廟", a: "", b: null, c: "[]", d: "{}", e: [], f: "null" });
    for (const k of ["a", "b", "c", "d", "e", "f"]) {
      expect(out, `${k} 不該出現`).not.toMatch(new RegExp(`>${k}<`));
    }
  });

  it("有中文標籤就用中文，沒有就用原 key", () => {
    const out = html({ address: "台南市", weird_field: "v" });
    expect(out).toContain("地址");
    expect(out).toContain("weird_field");
  });

  it("數字加千分位", () => {
    expect(html({ modules: 12345 })).toContain("12,345");
  });

  it("超過上限的欄位被截掉（小嵌入框塞不下數十欄）", () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`f${i}`, `v${i}`]));
    const rows = (html(many, 5).match(/class="ep-row"/g) ?? []).length;
    expect(rows).toBe(5);
  });

  it("完全沒有可顯示欄位時給提示，不是空白框", () => {
    expect(html({ osm_id: 1, lon: 121, lat: 25 })).toContain("沒有可顯示的欄位");
  });
});
