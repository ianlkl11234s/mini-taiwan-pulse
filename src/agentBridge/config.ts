export interface AgentBridgeConfig {
  url: string;
  token: string;
}

export interface AgentBridgeEnv {
  DEV: boolean;
  VITE_MCP_BRIDGE_ENABLED?: string;
  VITE_MCP_BRIDGE_PORT?: string;
  VITE_MCP_BRIDGE_TOKEN?: string;
}

export function readAgentBridgeConfig(env: AgentBridgeEnv): AgentBridgeConfig | null {
  if (!env.DEV || env.VITE_MCP_BRIDGE_ENABLED !== "1") return null;

  const rawPort = env.VITE_MCP_BRIDGE_PORT?.trim() ?? "";
  if (!/^\d+$/.test(rawPort)) {
    throw new Error("VITE_MCP_BRIDGE_PORT must be an integer between 1 and 65535");
  }
  const port = Number(rawPort);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("VITE_MCP_BRIDGE_PORT must be an integer between 1 and 65535");
  }

  const token = env.VITE_MCP_BRIDGE_TOKEN?.trim() ?? "";
  if (token.length < 16) {
    throw new Error("VITE_MCP_BRIDGE_TOKEN must contain at least 16 characters");
  }

  return {
    url: `ws://127.0.0.1:${port}`,
    token,
  };
}
