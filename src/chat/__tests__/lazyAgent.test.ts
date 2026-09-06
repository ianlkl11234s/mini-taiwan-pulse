import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentRunOptions, MapBridge } from "../types";

const bridge: MapBridge = {
  bulkSetVisibility: () => {},
  allOff: () => {},
  flyTo: () => {},
  jumpToPlace: () => true,
  highlightPoint: () => {},
  getVisibleLayerKeys: () => [],
  getCurrentTimeISO: () => "2026-01-01T00:00:00Z",
  getCamera: () => ({ lng: 121, lat: 24, zoom: 7 }),
};

function options(abortSignal?: AbortSignal): AgentRunOptions {
  return {
    provider: "openai",
    model: "test-model",
    apiKey: "test-key",
    history: [],
    userText: "hello",
    bridge,
    abortSignal,
  };
}

afterEach(() => {
  vi.doUnmock("../agent");
  vi.resetModules();
});

describe("lazyAgent", () => {
  it("does not download the engine until an entry point is called", async () => {
    let imports = 0;
    vi.doMock("../agent", () => {
      imports++;
      return {
        runChatTurn: vi.fn(),
        testKey: vi.fn(),
      };
    });

    await import("../lazyAgent");
    expect(imports).toBe(0);
  });

  it("loads once and forwards run parameters to the engine", async () => {
    const engineRun = vi.fn(async () => ({
      id: "assistant-1",
      role: "assistant" as const,
      content: "done",
      createdAt: 1,
    }));
    vi.doMock("../agent", () => ({ runChatTurn: engineRun, testKey: vi.fn() }));
    const lazy = await import("../lazyAgent");
    const input = options();

    await expect(lazy.runChatTurn(input)).resolves.toMatchObject({ content: "done" });
    expect(engineRun).toHaveBeenCalledWith(input);
  });

  it("does not start the engine when aborting during lazy load", async () => {
    let resolveEngine: ((engine: unknown) => void) | undefined;
    const engineRun = vi.fn();
    vi.doMock("../agent", () =>
      new Promise<unknown>((resolve) => {
        resolveEngine = resolve;
      }),
    );
    const lazy = await import("../lazyAgent");
    const { loadingRegistry } = await import("../../lib/loadingRegistry");
    const controller = new AbortController();
    const pending = lazy.runChatTurn(options(controller.signal));

    await vi.waitFor(() => expect(resolveEngine).toBeTypeOf("function"));
    expect(loadingRegistry.snapshot()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "chat-agent" })]),
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    resolveEngine?.({ runChatTurn: engineRun, testKey: vi.fn() });
    await Promise.resolve();
    expect(engineRun).not.toHaveBeenCalled();
  });

  it("returns a fixed Chinese error when loading fails", async () => {
    vi.doMock("../agent", () => {
      throw new Error("raw internal failure");
    });
    const lazy = await import("../lazyAgent");

    await expect(lazy.runChatTurn(options())).resolves.toMatchObject({
      error: "對話引擎載入失敗，請稍後再試",
    });
    await expect(lazy.testKey("openai", "test-model", "test-key")).resolves.toEqual({
      ok: false,
      message: "對話引擎載入失敗，請稍後再試",
    });
  });
});
