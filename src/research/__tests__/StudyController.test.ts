import { describe, expect, it, vi } from "vitest";

import { StudyController } from "../StudyController";
import type { BridgeConnectionContext, Command, Scene, StudyState } from "../bridgeClient";

const baseScene: Scene = { camera: { center: [121.525, 25.025], zoom: 12 }, resultMode: "empty" };

function state(revision: number, overrides: Partial<StudyState> = {}): StudyState {
  return {
    studyId: "study-1", tabId: "tab-1", revision, scene: baseScene,
    view: { revision, phase: revision === 0 ? "empty" : "applied" }, connected: true, paused: false, pendingCommand: null,
    ...overrides,
  };
}

function pending(commandId = "command-1", expectedRevision = 0): Command {
  return { protocolVersion: "1", sessionId: "session-1", studyId: "study-1", tabId: "tab-1", commandId, expectedRevision, expiresAt: Date.now() + 30_000, patch: { resultMode: "synthetic" } };
}

function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((next, fail) => { resolve = next; reject = fail; });
  return { promise, resolve, reject };
}

function setup(overrides: Partial<Record<"ack" | "manual" | "pause" | "sync", ReturnType<typeof vi.fn>>> = {}) {
  const report = vi.fn().mockResolvedValue(state(1));
  const client = {
    ack: overrides.ack ?? vi.fn().mockResolvedValue(state(1)),
    manual: overrides.manual ?? vi.fn().mockResolvedValue(state(1)),
    pause: overrides.pause ?? vi.fn().mockResolvedValue(state(0, { paused: true })),
    sync: overrides.sync ?? vi.fn().mockResolvedValue(state(0)),
    report,
  };
  const connection = { client, studyId: "study-1", tabId: "tab-1", pairingId: "pair-1" } as unknown as BridgeConnectionContext;
  const render = vi.fn<(scene: Scene, revision: number) => Promise<"ready" | "error">>().mockResolvedValue("ready");
  const onError = vi.fn();
  return { controller: new StudyController(connection, render, onError), client, render, onError };
}

describe("StudyController", () => {
  it("renders one accepted command once and reports ready only after acknowledgement", async () => {
    const renderGate = deferred<"ready">(); const ackGate = deferred<StudyState>();
    const { controller, client, render } = setup({ ack: vi.fn(() => ackGate.promise) });
    render.mockReturnValueOnce(renderGate.promise);
    const commandState = state(0, { pendingCommand: pending() });
    controller.receive(commandState); controller.receive(commandState);
    expect(render).toHaveBeenCalledTimes(1);
    renderGate.resolve("ready"); await Promise.resolve();
    expect(client.report).not.toHaveBeenCalled();
    ackGate.resolve(state(1)); await vi.waitFor(() => expect(client.report).toHaveBeenCalledWith("study-1", "tab-1", 1, "ready"));
  });

  it("manual clear scene renders and reports ready", async () => {
    const { controller, client, render } = setup();
    controller.receive(state(0));
    render.mockResolvedValueOnce("ready");
    controller.manual(baseScene);
    await vi.waitFor(() => expect(client.manual).toHaveBeenCalledWith("study-1", "tab-1", 0, baseScene));
    await vi.waitFor(() => expect(client.report).toHaveBeenCalledWith("study-1", "tab-1", 1, "ready"));
  });

  it("queues manual change during pending ack and invalidates old ready", async () => {
    const renderGate = deferred<"ready">(); const ackGate = deferred<StudyState>();
    const cleared: Scene = { ...baseScene, resultMode: "empty" };
    const { controller, client, render } = setup({ ack: vi.fn(() => ackGate.promise), manual: vi.fn().mockResolvedValue(state(2, { scene: cleared })) });
    render.mockReturnValueOnce(renderGate.promise).mockResolvedValueOnce("ready");
    controller.receive(state(0, { pendingCommand: pending() }));
    controller.manual(cleared);
    renderGate.resolve("ready"); ackGate.resolve(state(1));
    await vi.waitFor(() => expect(client.manual).toHaveBeenCalledWith("study-1", "tab-1", 1, cleared));
    await vi.waitFor(() => expect(client.report).toHaveBeenCalledWith("study-1", "tab-1", 2, "ready"));
    expect(client.report).not.toHaveBeenCalledWith("study-1", "tab-1", 1, "ready");
  });

  it("does not let older sync state retreat a newer revision", async () => {
    const { controller, render } = setup();
    render.mockResolvedValue("ready");
    controller.receive(state(2)); controller.receive(state(1));
    expect(render).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith(baseScene, 2);
  });

  it("ack failure syncs without pausing and never reports ready", async () => {
    const { controller, client, render, onError } = setup({ ack: vi.fn().mockRejectedValue(new Error("ack failed")) });
    render.mockResolvedValueOnce("ready");
    controller.receive(state(0, { pendingCommand: pending() }));
    await vi.waitFor(() => expect(client.sync).toHaveBeenCalledWith("study-1", "tab-1"));
    expect(client.pause).not.toHaveBeenCalled();
    expect(client.report).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("reports a render rejection immediately when acknowledgement later fails", async () => {
    const renderGate = deferred<"ready">(); const ackGate = deferred<StudyState>();
    const { controller, client, render, onError } = setup({ ack: vi.fn(() => ackGate.promise) });
    render.mockReturnValueOnce(renderGate.promise);
    controller.receive(state(0, { pendingCommand: pending() }));
    renderGate.reject(new Error("render failed"));
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    ackGate.reject(new Error("ack failed"));
    await vi.waitFor(() => expect(client.sync).toHaveBeenCalledWith("study-1", "tab-1"));
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("reports error after acknowledgement when the render rejects", async () => {
    const renderGate = deferred<"ready">(); const ackGate = deferred<StudyState>();
    const { controller, client, render, onError } = setup({ ack: vi.fn(() => ackGate.promise) });
    render.mockReturnValueOnce(renderGate.promise);
    controller.receive(state(0, { pendingCommand: pending() }));
    renderGate.reject(new Error("render failed"));
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    ackGate.resolve(state(1));
    await vi.waitFor(() => expect(client.report).toHaveBeenCalledWith("study-1", "tab-1", 1, "error"));
    expect(client.report).toHaveBeenCalledTimes(1);
  });

  it("does not repeat an acknowledgement whose result is unknown after sync", async () => {
    const command = pending();
    const { controller, client } = setup({
      ack: vi.fn().mockRejectedValue(new Error("lost ack response")),
      sync: vi.fn().mockResolvedValue(state(0, { pendingCommand: command })),
    });
    controller.receive(state(0, { pendingCommand: command }));
    await vi.waitFor(() => expect(client.sync).toHaveBeenCalledTimes(1));
    controller.receive(state(0, { pendingCommand: command }));
    await Promise.resolve();
    expect(client.ack).toHaveBeenCalledTimes(1);
    expect(client.pause).not.toHaveBeenCalled();
  });

  it("manual revision conflict syncs the latest scene without pausing", async () => {
    const latest: Scene = { ...baseScene, resultMode: "synthetic" };
    const { controller, client, render } = setup({
      manual: vi.fn().mockRejectedValue(new Error("REVISION_CONFLICT")),
      sync: vi.fn().mockResolvedValue(state(1, { scene: latest })),
    });
    controller.receive(state(0));
    controller.manual(baseScene);
    await vi.waitFor(() => expect(client.sync).toHaveBeenCalledWith("study-1", "tab-1"));
    expect(client.pause).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(render).toHaveBeenCalledWith(latest, 1));
  });

  it("disconnect prevents late render or acknowledgement response from reporting", async () => {
    const renderGate = deferred<"ready">(); const ackGate = deferred<StudyState>();
    const { controller, client, render } = setup({ ack: vi.fn(() => ackGate.promise) });
    render.mockReturnValueOnce(renderGate.promise);
    controller.receive(state(0, { pendingCommand: pending() }));
    controller.stop();
    renderGate.resolve("ready"); ackGate.resolve(state(1));
    await Promise.resolve(); await Promise.resolve();
    expect(client.report).not.toHaveBeenCalled();
  });
});
