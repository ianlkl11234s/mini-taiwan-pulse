import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IntlMediaPreviewNotice } from "../IntlMediaPreviewNotice";

describe("IntlMediaPreviewNotice", () => {
  it("clearly distinguishes research samples from live accepted reports", () => {
    const html = renderToStaticMarkup(createElement(IntlMediaPreviewNotice));
    expect(html).toContain("7 日研究樣本");
    expect(html).toContain("非即時資料");
    expect(html).toContain("不代表正式收錄");
    expect(html).toContain("9 筆 GDELT 實測 metadata");
  });
});
