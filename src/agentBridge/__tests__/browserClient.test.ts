import { afterEach, describe, expect, it, vi } from "vitest";

import type { BrowserMapController } from "../mapController";
import {
  browserClientMessageSchema,
  type MapCommandResult,
  type MapScene,
  type MapStateSummary,
} from "../protocol";
import {
  PULSE_MCP_SESSION_ID,
  PulseMcpBrowserClient,
  type PulseMcpWebSocketFactory,
} from "../browserClient";

const URL = "ws://127.0.0.1:43821";
const TOKEN = "0123456789abcdef-test-token";

afterEach(() => {
  vi.useRealTimers();
});

describe("PulseMcpBrowserClient", () => {
  it("sends one hello and remains idempotent when start is repeated", () => {
    const sockets = createSocketHarness();
    const client = createClient(sockets.factory);

    client.start();
    client.start();
    expect(sockets.instances).toHaveLength(1);

    sockets.instances[0]!.open();
    const hello = browserClientMessageSchema.parse(
      JSON.parse(sockets.instances[0]!.sent[0]!) as unknown,
    );
    expect(hello).toEqual({
      type: "hello",
      protocolVersion: "1",
      token: TOKEN,
      sessionId: PULSE_MCP_SESSION_ID,
      client: { name: "mini-taiwan-pulse", version: "0.1.0" },
    });
    expect(PULSE_MCP_SESSION_ID).toMatch(/\S+/);

    client.stop();
  });

  it("returns a correlated get_map_state result and ignores invalid messages", async () => {
    const sockets = createSocketHarness();
    const state = mapState(3);
    const getMapState = vi.fn(() => state);
    const client = createClient(sockets.factory, { getMapState });
    client.start();
    const socket = sockets.instances[0]!;
    socket.open();

    socket.receive(new Uint8Array([1, 2, 3]));
    socket.receive("not JSON");
    socket.receive(JSON.stringify({ type: "command", commandId: "invalid" }));
    socket.receive(command("get-1", { type: "get_map_state" }));
    await flushQueue();

    expect(getMapState).toHaveBeenCalledTimes(1);
    expect(parseSent(socket, 1)).toEqual({
      type: "result",
      protocolVersion: "1",
      commandId: "get-1",
      ok: true,
      result: state,
    });
    expect(socket.sent).toHaveLength(2);
    client.stop();
  });

  it("applies scenes sequentially and preserves each commandId", async () => {
    const sockets = createSocketHarness();
    const first = deferred<MapCommandResult>();
    const scene: MapScene = { layers: [] };
    const firstResult = commandResult("apply-1", 0, 1);
    const secondResult = commandResult("apply-2", 1, 2);
    const applyScene = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(secondResult);
    const client = createClient(sockets.factory, { applyScene });
    client.start();
    const socket = sockets.instances[0]!;
    socket.open();

    socket.receive(command("apply-1", {
      type: "apply_scene",
      scene,
      expectedRevision: 0,
    }));
    socket.receive(command("apply-2", { type: "apply_scene", scene }));
    await flushQueue();

    expect(applyScene).toHaveBeenCalledTimes(1);
    expect(applyScene).toHaveBeenNthCalledWith(1, {
      commandId: "apply-1",
      scene,
      expectedRevision: 0,
    });

    first.resolve(firstResult);
    await flushQueue();
    expect(applyScene).toHaveBeenCalledTimes(2);
    expect(applyScene).toHaveBeenNthCalledWith(2, {
      commandId: "apply-2",
      scene,
    });
    expect(parseSent(socket, 1)).toMatchObject({ commandId: "apply-1", result: firstResult });
    expect(parseSent(socket, 2)).toMatchObject({ commandId: "apply-2", result: secondResult });
    client.stop();
  });

  it("returns a structured correlated error without exposing the token", async () => {
    const sockets = createSocketHarness();
    const failure = Object.assign(new Error("revision changed"), {
      code: "REVISION_CONFLICT",
    });
    const client = createClient(sockets.factory, {
      getMapState: vi.fn(() => {
        throw failure;
      }),
    });
    client.start();
    const socket = sockets.instances[0]!;
    socket.open();
    socket.receive(command("get-error", { type: "get_map_state" }));
    await flushQueue();

    expect(parseSent(socket, 1)).toEqual({
      type: "result",
      protocolVersion: "1",
      commandId: "get-error",
      ok: false,
      error: { code: "REVISION_CONFLICT", message: "revision changed" },
    });
    expect(socket.sent[1]).not.toContain(TOKEN);
    client.stop();
  });

  it("reconnects with a capped backoff and reuses the page session", async () => {
    vi.useFakeTimers();
    const sockets = createSocketHarness();
    const client = createClient(sockets.factory, {}, [10, 20]);
    client.start();
    sockets.instances[0]!.open();
    const firstHello = parseSent(sockets.instances[0]!, 0);

    sockets.instances[0]!.serverClose();
    await vi.advanceTimersByTimeAsync(9);
    expect(sockets.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets.instances).toHaveLength(2);
    sockets.instances[1]!.open();
    expect(parseSent(sockets.instances[1]!, 0)).toMatchObject({
      sessionId: firstHello.sessionId,
    });

    sockets.instances[1]!.serverClose();
    await vi.advanceTimersByTimeAsync(20);
    expect(sockets.instances).toHaveLength(3);
    sockets.instances[2]!.serverClose();
    await vi.advanceTimersByTimeAsync(19);
    expect(sockets.instances).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets.instances).toHaveLength(4);
    client.stop();
  });

  it("stop cancels reconnect and permits a StrictMode-style restart", async () => {
    vi.useFakeTimers();
    const sockets = createSocketHarness();
    const client = createClient(sockets.factory, {}, [10]);
    client.start();
    const firstSocket = sockets.instances[0]!;
    firstSocket.serverClose();
    client.stop();

    await vi.advanceTimersByTimeAsync(100);
    expect(sockets.instances).toHaveLength(1);

    client.start();
    expect(sockets.instances).toHaveLength(2);
    client.stop();
    client.stop();
    expect(sockets.instances[1]!.closeCalls).toEqual([
      { code: 1000, reason: "Client stopped" },
    ]);
  });
});

function createClient(
  webSocketFactory: PulseMcpWebSocketFactory,
  overrides: Partial<BrowserMapController> = {},
  reconnectDelaysMs: readonly number[] = [],
): PulseMcpBrowserClient {
  const controller: BrowserMapController = {
    getMapState: () => mapState(0),
    applyScene: ({ commandId }) => commandResult(commandId, 0, 1),
    ...overrides,
  };
  return new PulseMcpBrowserClient({
    url: URL,
    token: TOKEN,
    controller,
    reconnectDelaysMs,
    webSocketFactory,
  });
}

function mapState(revision: number): MapStateSummary {
  return {
    revision,
    camera: { center: [121.5, 24], zoom: 7 },
    layers: [],
  };
}

function commandResult(
  commandId: string,
  previousRevision: number,
  newRevision: number,
): MapCommandResult {
  return {
    commandId,
    success: true,
    previousRevision,
    newRevision,
    applied: [],
    denied: [],
    warnings: [],
    actualState: mapState(newRevision),
  };
}

function command(commandId: string, mapCommand: object): string {
  return JSON.stringify({
    type: "command",
    protocolVersion: "1",
    commandId,
    command: mapCommand,
  });
}

function parseSent(socket: FakeWebSocket, index: number): Record<string, unknown> {
  return JSON.parse(socket.sent[index]!) as Record<string, unknown>;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve: ((value: T) => void) | undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return {
    promise,
    resolve: (value) => resolve?.(value),
  };
}

async function flushQueue(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function createSocketHarness(): {
  instances: FakeWebSocket[];
  factory: PulseMcpWebSocketFactory;
} {
  const instances: FakeWebSocket[] = [];
  return {
    instances,
    factory: (url) => {
      const socket = new FakeWebSocket(url);
      instances.push(socket);
      return socket as unknown as WebSocket;
    },
  };
}

class FakeWebSocket extends EventTarget {
  readonly sent: string[] = [];
  readonly closeCalls: Array<{ code?: number; reason?: string }> = [];
  readyState = 0;

  constructor(readonly url: string) {
    super();
  }

  open(): void {
    this.readyState = 1;
    this.dispatchEvent(new Event("open"));
  }

  receive(data: unknown): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }

  serverClose(): void {
    this.readyState = 3;
    this.dispatchEvent(new Event("close"));
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
    this.serverClose();
  }
}
