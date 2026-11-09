import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dredgingSiblingImages, fetchWraCctvList, resetWraCctvListCache, resolveDisasterImage, safeWraImageUrl, wraCameraId,
} from "../wraDisasterCctv";

const FMG = "https://fmg.wra.gov.tw/109wraweb/getImage.aspx?mode=getNewImageS&CCTV_SN=0xAB";
const web = (cpk: number) => `https://web.wra.gov.tw/rmnocweb/MaintainAPI/GET?CPK=${cpk}&OfficeId=1&RT=true&type=n`;

describe("wraDisasterCctv", () => {
  afterEach(() => resetWraCctvListCache());

  it("只放行水利署兩個影像主機的 https 網址", () => {
    expect(safeWraImageUrl(FMG)).toBe(FMG);
    expect(safeWraImageUrl(web(1))).toBe(web(1));
    expect(safeWraImageUrl("http://fmg.wra.gov.tw/x.jpg")).toBeNull();
    expect(safeWraImageUrl("https://evil.example.com/x.jpg")).toBeNull();
    expect(safeWraImageUrl("javascript:alert(1)")).toBeNull();
    expect(safeWraImageUrl(null)).toBeNull();
  });

  it("cctv_id 對回上游 cameraid，取當天網址", () => {
    expect(wraCameraId("wra_17457_0")).toBe("17457");
    expect(wraCameraId("wra_17457")).toBe("17457");
    expect(wraCameraId("dredge_1_0")).toBeNull();
    const list = [{ cameraid: "1", imageurl: "https://evil.example.com/a" }, { cameraid: "17457", imageurl: FMG }];
    expect(resolveDisasterImage(list, "wra_17457_0")).toBe(FMG);
    expect(resolveDisasterImage(list, "wra_1_0")).toBeNull();
    expect(resolveDisasterImage(list, "wra_999_0")).toBeNull();
  });

  it("疏濬工區列出同名攝影機，依序號排序並去重", () => {
    const list = [
      { stationname: "甲工區", ccdidentifier: 3, imageurl: web(3) },
      { stationname: "甲工區 ", ccdidentifier: 1, imageurl: web(1) },
      { stationname: "甲工區", ccdidentifier: 2, imageurl: web(1) },
      { stationname: "乙工區", ccdidentifier: 4, imageurl: web(4) },
    ];
    expect(dredgingSiblingImages(list, "甲工區")).toEqual([web(1), web(3)]);
    expect(dredgingSiblingImages(list, "")).toEqual([]);
  });

  it("清單不是 JSON 陣列（F5 挑戰頁）視為失敗，且不留快取", async () => {
    const bad = vi.fn(async () => new Response("<html></html>", { status: 200 }));
    await expect(fetchWraCctvList("disaster", bad as unknown as typeof fetch, 0)).rejects.toThrow();
    const good = vi.fn(async () => new Response(JSON.stringify([{ cameraid: "1" }]), { status: 200 }));
    await expect(fetchWraCctvList("disaster", good as unknown as typeof fetch, 1)).resolves.toHaveLength(1);
    await fetchWraCctvList("disaster", good as unknown as typeof fetch, 2);
    expect(good).toHaveBeenCalledTimes(1);
  });
});
