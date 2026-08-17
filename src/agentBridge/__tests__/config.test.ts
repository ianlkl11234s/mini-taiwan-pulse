import { describe, expect, it } from "vitest";

import { readAgentBridgeConfig } from "../config";

describe("readAgentBridgeConfig", () => {
  const enabled = {
    DEV: true,
    VITE_MCP_BRIDGE_ENABLED: "1",
    VITE_MCP_BRIDGE_PORT: "4731",
    VITE_MCP_BRIDGE_TOKEN: "local-test-token-1234",
  } as const;

  it("builds a fixed loopback WebSocket URL", () => {
    expect(readAgentBridgeConfig(enabled)).toEqual({
      url: "ws://127.0.0.1:4731",
      token: "local-test-token-1234",
    });
  });

  it("stays disabled outside dev mode", () => {
    expect(readAgentBridgeConfig({ ...enabled, DEV: false })).toBeNull();
  });

  it("stays disabled without the explicit feature flag", () => {
    expect(readAgentBridgeConfig({ ...enabled, VITE_MCP_BRIDGE_ENABLED: "0" })).toBeNull();
  });

  it.each(["", "0", "65536", "47.31", "abc"])("rejects invalid port %j", (port) => {
    expect(() => readAgentBridgeConfig({ ...enabled, VITE_MCP_BRIDGE_PORT: port })).toThrow(
      "VITE_MCP_BRIDGE_PORT",
    );
  });

  it("rejects short tokens", () => {
    expect(() =>
      readAgentBridgeConfig({ ...enabled, VITE_MCP_BRIDGE_TOKEN: "too-short" }),
    ).toThrow("VITE_MCP_BRIDGE_TOKEN");
  });
});
