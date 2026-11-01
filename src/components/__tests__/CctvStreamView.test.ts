import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CctvStreamView, releaseMediaIfDetached, type ReleasableMedia } from "../CctvStreamView";

function fakeMedia(isConnected: boolean, src = "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.01251.jpg") {
  const el: ReleasableMedia & { attrs: Record<string, string> } = {
    isConnected,
    src,
    attrs: { src },
    removeAttribute(name: string) { delete this.attrs[name]; },
    pause: vi.fn(),
    load: vi.fn(),
  };
  return el;
}

// VIS-4：dev（React StrictMode）掛載 → cleanup → 再掛載同一個 DOM 元素。
// 舊 cleanup 無條件清空 src，React 不會補回 → 觸發 onError → 彈窗卡在「無法載入」。
// 測試環境沒有 DOM（vitest environment node），改以 cleanup 的純函式重現兩種情境。
describe("releaseMediaIfDetached（CctvStreamView effect cleanup）", () => {
  it("StrictMode 假 unmount：元素仍在 DOM，不清 src", () => {
    const el = fakeMedia(true);
    expect(releaseMediaIfDetached(el)).toBe(false);
    expect(el.src).not.toBe("");
    expect(el.attrs.src).toBeDefined();
    expect(el.pause).not.toHaveBeenCalled();
  });

  it("真的 unmount（元素已離開 DOM）：清 src 切斷下載", () => {
    const el = fakeMedia(false);
    expect(releaseMediaIfDetached(el)).toBe(true);
    expect(el.src).toBe("");
    expect(el.attrs.src).toBeUndefined();
    expect(el.pause).toHaveBeenCalled();
    expect(el.load).toHaveBeenCalled();
  });

  it("沒有元素時不報錯", () => {
    expect(releaseMediaIfDetached(null)).toBe(false);
  });
});

describe("CctvStreamView 初始畫面", () => {
  const image = "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.01251.jpg";
  const video = "https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/00001.01251.mp4";

  it("有短片時先放 <video>（靜音、循環、無控制列），外連指向 mp4", () => {
    const html = renderToStaticMarkup(createElement(CctvStreamView, {
      streamUrl: image, imageUrl: image, videoUrl: video, source: "tfl", accentColor: "#000",
    }));
    expect(html).toContain("<video");
    expect(html).toContain(`src="${video}"`);
    expect(html).toContain("loop");
    expect(html).not.toContain("controls");
    expect(html).toContain(`href="${video}"`);
    expect(html).not.toContain("<img");
  });

  it("沒有短片時維持快照 <img>", () => {
    const html = renderToStaticMarkup(createElement(CctvStreamView, {
      streamUrl: image, imageUrl: image, source: "tfl", accentColor: "#000",
    }));
    expect(html).toContain("<img");
    expect(html).not.toContain("<video");
  });
});
