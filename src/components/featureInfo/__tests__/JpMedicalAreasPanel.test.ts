import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JpMedicalAreasPanel } from "../jpMedicalPanels";

const render = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(JpMedicalAreasPanel, { props }));

describe("JpMedicalAreasPanel（A38 欄位對應，VP-15）", () => {
  it("二次醫療圈：標題用圈名，顯示圈內市區町村與醫療圈人口（值取自正式站 区西北部）", () => {
    const html = render({
      A38b_001: "13116,13117,13119,13120", A38b_002: "豊島区,北区,板橋区,練馬区", A38b_003: "1305", A38b_004: "区西北部",
      A38b_007: "1915881", A38b_008: "1954946", A38b_009: "212905", A38b_010: "1305016", A38b_011: "437025", feature_id: 1,
    });
    expect(html).toContain("区西北部");
    expect(html).not.toContain("醫療圈 · 2020 歷史版");
    expect(html).toContain("圈內市區町村");
    expect(html).toContain("豊島区,北区,板橋区,練馬区");
    expect(html).toContain("1,954,946");
    expect(html).toContain("437,025");
  });

  it("一次醫療圈：標題用市區町村名，並列出所屬二次醫療圈", () => {
    const html = render({ A38a_001: "13116", A38a_002: "豊島区", A38a_003: "1303", A38a_004: "区西北部" });
    expect(html).toContain("豊島区");
    expect(html).toContain("所屬二次醫療圈");
    expect(html).toContain("区西北部");
  });

  it("三次醫療圈：北海道用三次醫療圈名，其他縣以都道府縣名為標題", () => {
    expect(render({ A38c_001: "北海道", A38c_002: "道央" })).toContain("道央");
    const html = render({ A38c_001: "埼玉県", A38c_002: "" });
    expect(html).toContain("埼玉県");
  });

  it("人口欄缺值時不顯示該列，不寫成 0", () => {
    const html = render({ A38b_002: "川口市", A38b_004: "南部", A38b_008: "", A38b_011: null });
    expect(html).not.toContain("醫療圈總人口");
    expect(html).not.toContain(">0<");
  });
});
