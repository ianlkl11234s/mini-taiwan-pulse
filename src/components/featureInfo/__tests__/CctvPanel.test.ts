import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CctvPanel } from "../infraPanels";

describe("CCTV popup URLs", () => {
  it("顯示只有 VideoImageURL 的攝影機", () => {
    const html = renderToStaticMarkup(createElement(CctvPanel, { props: {
      CCTVID: "CCTV001-EC", source: "city", VideoStreamURL: "",
      VideoImageURL: "https://example.com/snapshot.jpg",
    } }));
    expect(html).toContain('src="https://example.com/snapshot.jpg"');
    expect(html).toContain("在新分頁開啟原始影像");
    expect(html).not.toContain("未提供串流網址");
  });

  it("修正 TDX URL 前置單引號", () => {
    const html = renderToStaticMarkup(createElement(CctvPanel, { props: {
      CCTVID: "T913240", source: "city",
      VideoStreamURL: "'https://example.com/camera230",
    } }));
    expect(html).toContain('href="https://example.com/camera230"');
    expect(html).not.toContain("&#x27;https://");
  });
});
