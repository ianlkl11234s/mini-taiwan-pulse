import { describe, expect, it, vi } from "vitest";
import { createPlaceMarkerSlot } from "../placeMarkerSlot";
import type { PlaceSearchHit } from "../../lib/placeSearch";

const hit = (over: Partial<PlaceSearchHit> = {}): PlaceSearchHit =>
  ({ label: "測試路10號", kind: "address" as never, parent: "臺北市中正區", center: [121.5, 25], score: 3, ...over });

describe("placeMarkerSlot（review L1：搜尋面板卸載後私人地址撤權仍有效）", () => {
  it("撤權時撤掉私人地址標記", () => {
    const cleanup = vi.fn();
    const slot = createPlaceMarkerSlot(() => cleanup);
    slot.set(hit({ private: true }));
    slot.revokePrivate();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("公開地點的標記不受撤權影響", () => {
    const cleanup = vi.fn();
    const slot = createPlaceMarkerSlot(() => cleanup);
    slot.set(hit());
    slot.revokePrivate();
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("換選取時先撤舊標記；撤權後不會重複撤", () => {
    const c1 = vi.fn(); const c2 = vi.fn();
    const slot = createPlaceMarkerSlot((p) => (p.private ? c1 : c2));
    slot.set(hit({ private: true }));
    slot.set(hit());
    expect(c1).toHaveBeenCalledTimes(1);
    slot.revokePrivate();
    expect(c2).not.toHaveBeenCalled();
  });
});
