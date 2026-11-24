import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { abOther, abStash, countryAbStore, normalizeAb, switchAb } from "../countryAbStore";
import { compareHydrateFromUrl, compareStore } from "../compareStore";
import { countryCameraMemory } from "../countryStore";
import { countryDef, type CountryCamera } from "../../constants/countries";
import { buildUrl, parseUrlState, type UrlCompareState } from "../../lib/urlState";
import { restoreMobileCompare } from "../../utils/mobileCompareRestore";

const VISIBLE = ["TW", "JP", "GB", "KR"] as const;
const cam = (lng: number, lat: number, zoom = 9): CountryCamera => ({ center: [lng, lat], zoom, pitch: 0, bearing: 0 });

describe("手機兩國 A／B 切換（G2-2）", () => {
  beforeEach(() => { countryCameraMemory.resetForTest(); });
  afterEach(() => { countryAbStore.reset(); compareStore.reset(); });

  it("開啟：A＝目前國家、B＝下一個釘選外國（同並排右側規則）", () => {
    expect(countryAbStore.open("TW", ["TW", "GB", "JP"], VISIBLE)).toBe(true);
    expect(countryAbStore.getSnapshot()).toEqual({ a: "TW", b: "GB" });
    countryAbStore.reset();
    // 沒釘選：取清單第一個外國；偏好的 B 合法就沿用
    countryAbStore.open("TW", [], VISIBLE);
    expect(countryAbStore.getSnapshot()?.b).toBe("JP");
    countryAbStore.open("TW", [], VISIBLE, "KR");
    expect(countryAbStore.getSnapshot()).toEqual({ a: "TW", b: "KR" });
    // 台灣不能當 B；A 是外國時 B 取它之後的釘選外國
    countryAbStore.open("GB", ["TW", "GB", "JP"], VISIBLE, "TW");
    expect(countryAbStore.getSnapshot()).toEqual({ a: "GB", b: "JP" });
  });

  it("normalizeAb：從國家選單換國家 → 目前國家變 A；B 與 A 撞了就換", () => {
    const ab = { a: "TW", b: "GB" } as const;
    expect(normalizeAb(ab, "TW", [], VISIBLE)).toBe(ab);
    expect(normalizeAb(ab, "GB", [], VISIBLE)).toBe(ab);
    expect(normalizeAb(ab, "JP", [], VISIBLE)).toEqual({ a: "JP", b: "GB" });
    expect(normalizeAb(ab, "GB", [], ["TW", "JP"])).toEqual({ a: "TW", b: "JP" });   // 身分降級：英國看不到
  });

  it("切換：記下離開那一國的鏡頭，回傳目標國上次的鏡頭（沒記錄＝預設）", () => {
    const ab = { a: "TW", b: "GB" } as const;
    const london = cam(-0.1276, 51.5072, 10);
    const taipei = cam(121.5654, 25.033, 13.5);
    const toGb = switchAb(ab, "TW", taipei);
    expect(toGb.country).toBe("GB");
    expect(toGb.camera).toEqual(countryDef("GB").camera);            // 英國還沒記錄
    countryCameraMemory.record("GB", london);                          // 使用者在英國移到倫敦
    const back = switchAb(ab, "GB", london);
    expect(back).toEqual({ country: "TW", camera: taipei });           // 回台灣＝原位置
    expect(switchAb(ab, "TW", taipei).camera).toEqual(london);         // 再切英國＝倫敦
    expect(abOther(ab, "GB")).toBe("TW");
  });

  it("切換時鏡頭中心不在該國內（飛行途中／拖到別國）不污染記憶", () => {
    const ab = { a: "TW", b: "GB" } as const;
    countryCameraMemory.record("TW", cam(121.5, 25.0, 12));
    switchAb(ab, "TW", cam(-0.1, 51.5, 5));                            // 台灣顯示中卻停在倫敦座標
    expect(countryCameraMemory.get("TW")?.center[0]).toBe(121.5);
    expect(switchAb(ab, "TW", null).country).toBe("GB");              // 沒鏡頭（地圖未就緒）照樣能切
  });

  it("寄放狀態（網址）：顯示國家＝左、另一國＝右；台灣不能放右邊", () => {
    const ab = { a: "TW", b: "GB" } as const;
    expect(abStash(ab, "TW", undefined)).toEqual({ mode: "countries", rightCountry: "GB" });
    expect(abStash(ab, "GB", undefined)).toEqual({ mode: "countries" });
    const prev = { mode: "countries", rightCountry: "GB", rightCamera: { center: [0, 51], zoom: 9, pitch: 0, bearing: 0 }, scaleLocked: false } as UrlCompareState;
    expect(abStash(ab, "TW", prev)).toEqual(prev);                     // 同右國保留右圖鏡頭與比例尺設定
    expect(abStash({ a: "TW", b: "JP" }, "TW", prev)).toEqual({ mode: "countries", rightCountry: "JP" });
  });

  it("cmp=2 網址在手機與桌機之間來回：手機 A／B ↔ 桌機並排，左側期別保留", () => {
    const url = parseUrlState("?v=1&lng=121.5&lat=25&z=12&cmp=2&cmpc=gb&c=tw");
    expect(url.compare).toMatchObject({ mode: "countries", rightCountry: "GB" });
    // 手機：A＝網址的左國（台灣）、B＝cmpc
    countryAbStore.open("TW", [], VISIBLE, url.compare?.rightCountry ?? null);
    const ab = countryAbStore.getSnapshot()!;
    expect(ab).toEqual({ a: "TW", b: "GB" });
    // 在手機切到英國再寫網址：仍是 cmp=2（右國＝台灣不寫 cmpc）
    const stash = abStash(ab, "GB", url.compare);
    const mobileUrl = buildUrl({ camera: { center: [-0.1, 51.5], zoom: 9 }, country: "GB", compare: stash } as never, "/");
    expect(mobileUrl).toContain("cmp=2");
    expect(mobileUrl).not.toContain("cmpc=");
    // 回桌機：用寄放狀態還原並排（左國由 countryStore 決定，右國＝另一國）
    const back = abStash(ab, "TW", url.compare);
    compareStore.hydrate(compareHydrateFromUrl(restoreMobileCompare(back, undefined)));
    expect(compareStore.getSnapshot()).toMatchObject({ enabled: true, mode: "countries", rightCountry: "GB" });
    // 桌機回手機：從並排狀態進 A／B
    const snap = compareStore.getSnapshot();
    countryAbStore.reset();
    countryAbStore.open("TW", [], VISIBLE, snap.rightCountry);
    expect(countryAbStore.getSnapshot()).toEqual({ a: "TW", b: "GB" });
  });
});
