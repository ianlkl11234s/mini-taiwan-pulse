import { describe, expect, it } from "vitest";
import { popupText } from "../shared";

describe("popupText", () => {
  it("NFD 字串轉 NFC 並標 vi", () => {
    const nfd = "Phú Thọ";
    expect(popupText(nfd)).toEqual({ text: "Phú Thọ", lang: "vi" });
  });
  it("越南文預組字母標 vi", () => {
    expect(popupText("Đà Nẵng").lang).toBe("vi");
    expect(popupText("Trạm biến áp").lang).toBe("vi");
  });
  it("中文、日文、一般拉丁字不動也不標 lang", () => {
    for (const s of ["臺北市", "東京都", "São Paulo", "Zürich", "神奈川県"]) {
      expect(popupText(s)).toEqual({ text: s });
    }
  });
});
