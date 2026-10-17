import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BridgeError, type AgentTokenSummary, type CreatedAgentToken } from "../bridgeClient";
import { AgentTokenPanel } from "../AgentTokenSection";
import { AgentTokenController, DEFAULT_AGENT_TOKEN_LABEL, TOKEN_SAVE_COMMAND, agentTokenErrorMessage, type AgentTokenState } from "../agentTokens";

// P3 (SPEC-prod-connect §2.5, §6.4). Named .test.ts because vitest only collects src/**/*.test.ts.
const secret = `pat_${"S".repeat(43)}`;
const created: CreatedAgentToken = { tokenId: "a".repeat(32), token: secret, label: "Claude Code", createdAt: Date.UTC(2026, 9, 3), expiresAt: Date.UTC(2026, 10, 2) };
const summary = (overrides: Partial<AgentTokenSummary> = {}): AgentTokenSummary => ({ tokenId: created.tokenId, label: created.label, createdAt: created.createdAt, expiresAt: created.expiresAt, lastUsedAt: null, activeSessions: 0, ...overrides });

function fakeTokenClient(tokens: AgentTokenSummary[] = []) {
  let listed = tokens;
  return {
    createAgentToken: vi.fn(async (_label: string) => { listed = [summary(), ...listed]; return created; }),
    listAgentTokens: vi.fn(async () => listed),
    revokeAgentToken: vi.fn(async (tokenId: string) => { listed = listed.filter(token => token.tokenId !== tokenId); }),
  };
}
const render = (state: AgentTokenState) => renderToStaticMarkup(createElement(AgentTokenPanel, { state, onCreate: () => {}, onCopy: () => {}, onDismiss: () => {}, onRevoke: () => {} }));

describe("AgentTokenController", () => {
  it("creates with the default label; the secret lives only in `created`, never in the list", async () => {
    const client = fakeTokenClient();
    const controller = new AgentTokenController(client);
    await controller.create();
    expect(client.createAgentToken).toHaveBeenCalledWith(DEFAULT_AGENT_TOKEN_LABEL);
    expect(DEFAULT_AGENT_TOKEN_LABEL).toBe("Claude Code");
    expect(controller.state.created?.token).toBe(secret);
    expect(controller.state.tokens).toHaveLength(1);
    expect(JSON.stringify(controller.state.tokens)).not.toContain(secret);
    expect(controller.state.busy).toBe(false);
  });

  it("shows the secret only once: dismiss drops it for good and a refresh cannot bring it back", async () => {
    const client = fakeTokenClient();
    const controller = new AgentTokenController(client);
    await controller.create();
    controller.dismiss();
    await controller.refresh();
    expect(controller.state.created).toBeNull();
    expect(JSON.stringify(controller.state)).not.toContain(secret);
  });

  it("revoking the just-created token also hides its secret and refreshes the list", async () => {
    const client = fakeTokenClient();
    const controller = new AgentTokenController(client);
    await controller.create();
    await controller.revoke(created.tokenId);
    expect(client.revokeAgentToken).toHaveBeenCalledWith(created.tokenId);
    expect(controller.state.created).toBeNull();
    expect(controller.state.tokens).toEqual([]);
    expect(controller.state.message).toContain("已撤銷");
  });

  it("maps gateway errors to plain messages and still refreshes after a failed revoke", async () => {
    expect(agentTokenErrorMessage(new BridgeError("TOKEN_LIMIT"))).toContain("已達 10 個");
    expect(agentTokenErrorMessage(new BridgeError("TOKEN_NOT_FOUND"))).toContain("已不存在");
    expect(agentTokenErrorMessage(new BridgeError("AUTH_REQUIRED"))).toContain("重新登入");
    const client = fakeTokenClient([summary()]);
    client.createAgentToken.mockRejectedValueOnce(new BridgeError("TOKEN_LIMIT"));
    client.revokeAgentToken.mockRejectedValueOnce(new BridgeError("TOKEN_NOT_FOUND"));
    const controller = new AgentTokenController(client);
    await controller.create();
    expect(controller.state.created).toBeNull();
    expect(controller.state.message).toContain("已達 10 個");
    await controller.revoke(created.tokenId);
    expect(client.listAgentTokens).toHaveBeenCalled();
    expect(controller.state.message).toContain("已不存在");
    expect(controller.state.busy).toBe(false);
  });

  it("ignores a second create while one is in flight", async () => {
    const client = fakeTokenClient();
    const controller = new AgentTokenController(client);
    await Promise.all([controller.create(), controller.create()]);
    expect(client.createAgentToken).toHaveBeenCalledTimes(1);
  });
});

describe("AgentTokenPanel", () => {
  const base: AgentTokenState = { tokens: [], created: null, busy: false, loaded: true, message: null };

  it("renders the one-time secret with copy, dismiss and the save command", () => {
    const html = render({ ...base, created, tokens: [summary()] });
    expect(html).toContain(secret);
    expect(html).toContain("只顯示這一次");
    expect(html).toContain("複製金鑰");
    expect(html).toContain("我已保存");
    expect(html).toContain(TOKEN_SAVE_COMMAND);
    expect(TOKEN_SAVE_COMMAND).toBe("pbpaste | npm run token:save");
    expect(html).not.toContain("產生 Agent 金鑰");
  });

  it("never renders a secret without `created`; lists label, dates, last use and one revoke button per token", () => {
    const html = render({ ...base, tokens: [summary(), summary({ tokenId: "b".repeat(32), label: "Laptop", lastUsedAt: Date.UTC(2026, 9, 3), activeSessions: 1 })] });
    expect(html).not.toContain("pat_");
    expect(html).toContain("產生 Agent 金鑰");
    expect(html).toContain("Claude Code");
    expect(html).toContain("Laptop");
    expect(html).toContain("尚未使用");
    expect(html).toContain("最後使用");
    expect(html).toContain("使用中");
    expect(html.match(/>撤銷</g)).toHaveLength(2);
    expect(html).toContain('aria-label="撤銷 Laptop"');
  });

  it("shows an empty state and a busy create button", () => {
    expect(render(base)).toContain("目前沒有金鑰");
    expect(render({ ...base, busy: true })).toContain("處理中");
    expect(render({ ...base, loaded: false })).not.toContain("目前沒有金鑰");
  });
});
