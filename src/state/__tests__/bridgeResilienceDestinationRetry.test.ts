import { describe, expect, it } from "vitest";
import { bridgeResilienceDestinationStatus, bridgeResilienceOrigin } from "../../data/bridgeResilienceStore";
import { bridgeResilienceDestinationRetryNonce, selectBridgeResilienceOrigin } from "../bridgeResilienceDestinationRetry";

describe("selectBridgeResilienceOrigin（失敗後再點同村里可重試）", () => {
  it("正常點擊設定起點、不觸發重試", () => {
    bridgeResilienceOrigin.clear();
    bridgeResilienceDestinationStatus.set("idle");
    const before = bridgeResilienceDestinationRetryNonce();
    selectBridgeResilienceOrigin("A01");
    expect(bridgeResilienceOrigin.get()).toBe("A01");
    selectBridgeResilienceOrigin("A01");
    expect(bridgeResilienceDestinationRetryNonce()).toBe(before);
  });

  it("載入失敗後再點同一個村里：遞增 nonce 觸發重試；換村里則換起點", () => {
    bridgeResilienceOrigin.clear();
    selectBridgeResilienceOrigin("A01");
    bridgeResilienceDestinationStatus.set("error");
    const before = bridgeResilienceDestinationRetryNonce();
    selectBridgeResilienceOrigin("A01");
    expect(bridgeResilienceDestinationRetryNonce()).toBe(before + 1);
    expect(bridgeResilienceOrigin.get()).toBe("A01");
    selectBridgeResilienceOrigin("B02");
    expect(bridgeResilienceOrigin.get()).toBe("B02");
    bridgeResilienceOrigin.clear();
    bridgeResilienceDestinationStatus.set("idle");
  });
});
