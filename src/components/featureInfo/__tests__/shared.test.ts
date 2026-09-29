import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SourceFooter } from "../shared";

/**
 * SourceFooter F2 規格（proposal.md §6.1 / handoff.md §4a 第三輪拍板）：
 * 第一行「機關 · Tier N · 原始下載頁 ↗」缺項省略；第二行 license ＋ 抓取時間；
 * 完全沒有 org/url 時整段改顯示「來源資訊待補」。
 */
describe("SourceFooter (F2)", () => {
  it("完整欄位：機關 · Tier N · 原始下載頁，license/抓取時間另起一行", () => {
    const html = renderToStaticMarkup(createElement(SourceFooter, {
      props: {
        source_org: "環境部環境資料開放平台",
        source_tier: 1,
        source_url: "https://data.moenv.gov.tw/api/v2/fac_p_07",
        license: "政府資料開放授權條款 OGDL-Taiwan-1.0",
        fetched_at: "2026-07-17",
      },
    }));

    expect(html).toContain("環境部環境資料開放平台");
    expect(html).toContain("Tier 1");
    expect(html).toContain("原始下載頁");
    expect(html).toContain("政府資料開放授權條款 OGDL-Taiwan-1.0");
    expect(html).toContain("抓取於 2026-07-17");
    expect(html).not.toContain("來源資訊待補");
  });

  it("缺 org、只有 url：不補空的 Tier/機關字樣，只顯示下載連結", () => {
    const html = renderToStaticMarkup(createElement(SourceFooter, {
      props: { source_url: "https://example.test/data.zip" },
    }));

    expect(html).toContain("原始下載頁");
    expect(html).not.toContain("Tier");
    expect(html).not.toContain("來源資訊待補");
  });

  it("只帶 attribution / attribution_href 的 loader 也算有來源", () => {
    const html = renderToStaticMarkup(createElement(SourceFooter, {
      props: { attribution: "Global Fishing Watch", attribution_href: "https://globalfishingwatch.org/" },
    }));

    expect(html).toContain("Global Fishing Watch");
    expect(html).toContain("https://globalfishingwatch.org/");
    expect(html).not.toContain("來源資訊待補");
  });

  it("完全沒有 org/url 時顯示「來源資訊待補」而非整段省略", () => {
    const html = renderToStaticMarkup(createElement(SourceFooter, {
      props: { license: "CC-BY 4.0" },
    }));

    expect(html).toContain("來源資訊待補");
    // 待補狀態下不半調子顯示其他欄位
    expect(html).not.toContain("CC-BY 4.0");
  });

  it("跨來源溯源 > 1 筆才收合展開，1 筆不重複顯示", () => {
    const multi = renderToStaticMarkup(createElement(SourceFooter, {
      props: {
        source_org: "測試機關",
        _provenance: JSON.stringify([
          { tier: 1, source_org: "機關甲", source_url: "https://a.test" },
          { tier: 2, source_org: "機關乙" },
        ]),
      },
    }));
    expect(multi).toContain("溯源 2 筆");

    const single = renderToStaticMarkup(createElement(SourceFooter, {
      props: {
        source_org: "測試機關",
        _provenance: JSON.stringify([{ tier: 1, source_org: "機關甲" }]),
      },
    }));
    expect(single).not.toContain("溯源");
  });
});
