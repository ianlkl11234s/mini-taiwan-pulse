import type { BrowserMapController } from "./mapController";
import {
  browserServerMessageSchema,
  PROTOCOL_VERSION,
  type BrowserMapCommand,
  type MapCommandResult,
  type MapStateSummary,
} from "./protocol";

const OPEN = 1;
const CONNECTING = 0;
const DEFAULT_RECONNECT_DELAYS_MS = [250, 1_000, 2_000, 5_000] as const;

export const PULSE_MCP_SESSION_ID = globalThis.crypto.randomUUID();

export type PulseMcpWebSocketFactory = (url: string) => WebSocket;

export interface PulseMcpBrowserClientOptions {
  url: string;
  token: string;
  controller: BrowserMapController;
  reconnectDelaysMs?: readonly number[];
  webSocketFactory?: PulseMcpWebSocketFactory;
  sessionId?: string;
}

interface CommandEnvelope {
  type: "command";
  protocolVersion: typeof PROTOCOL_VERSION;
  commandId: string;
  command: BrowserMapCommand;
}

interface CommandError {
  code: string;
  message: string;
}

/**
 * Browser-side transport for the local Pulse MCP bridge.
 *
 * `start` and `stop` are intentionally reusable: React StrictMode may run an
 * effect as start → stop → start during development. A generation counter
 * makes callbacks from the disposed socket inert instead of reconnecting it.
 */
export class PulseMcpBrowserClient {
  private readonly url: string;
  private readonly token: string;
  private readonly controller: BrowserMapController;
  private readonly reconnectDelaysMs: readonly number[];
  private readonly webSocketFactory: PulseMcpWebSocketFactory;
  private readonly sessionId: string;

  private running = false;
  private generation = 0;
  private reconnectIndex = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private socket: WebSocket | undefined;
  private commandQueue: Promise<void> = Promise.resolve();

  constructor(options: PulseMcpBrowserClientOptions) {
    assertLoopbackWebSocketUrl(options.url);
    if (options.token.length < 16 || options.token.length > 512) {
      throw new TypeError("Pulse MCP bridge token must be 16 to 512 characters");
    }
    if (options.sessionId !== undefined && options.sessionId.length === 0) {
      throw new TypeError("Pulse MCP sessionId must not be empty");
    }

    const reconnectDelaysMs =
      options.reconnectDelaysMs ?? DEFAULT_RECONNECT_DELAYS_MS;
    if (
      reconnectDelaysMs.some(
        (delay) => !Number.isFinite(delay) || delay < 0,
      )
    ) {
      throw new TypeError("Reconnect delays must be finite non-negative numbers");
    }

    this.url = options.url;
    this.token = options.token;
    this.controller = options.controller;
    this.reconnectDelaysMs = [...reconnectDelaysMs];
    this.webSocketFactory =
      options.webSocketFactory ?? ((url) => new WebSocket(url));
    this.sessionId = options.sessionId ?? PULSE_MCP_SESSION_ID;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.generation += 1;
    this.reconnectIndex = 0;
    this.commandQueue = Promise.resolve();
    this.connect(this.generation);
  }

  stop(): void {
    if (!this.running && this.socket === undefined && this.reconnectTimer === undefined) {
      return;
    }

    this.running = false;
    this.generation += 1;
    this.clearReconnectTimer();

    const socket = this.socket;
    this.socket = undefined;
    this.commandQueue = Promise.resolve();
    if (
      socket !== undefined &&
      (socket.readyState === CONNECTING || socket.readyState === OPEN)
    ) {
      socket.close(1000, "Client stopped");
    }
  }

  private connect(generation: number): void {
    if (!this.running || generation !== this.generation) return;

    let socket: WebSocket;
    try {
      socket = this.webSocketFactory(this.url);
    } catch {
      this.scheduleReconnect(generation);
      return;
    }

    this.socket = socket;
    socket.addEventListener("open", () => {
      if (!this.isCurrentSocket(socket, generation)) return;
      socket.send(
        JSON.stringify({
          type: "hello",
          protocolVersion: PROTOCOL_VERSION,
          token: this.token,
          sessionId: this.sessionId,
          client: {
            name: "mini-taiwan-pulse",
            version: "0.1.0",
          },
        }),
      );
    });

    socket.addEventListener("message", (event) => {
      if (!this.isCurrentSocket(socket, generation)) return;
      if (typeof event.data !== "string") return;

      const message = parseCommand(event.data);
      if (message === undefined) return;

      this.commandQueue = this.commandQueue.then(() =>
        this.executeCommand(socket, generation, message),
      );
    });

    socket.addEventListener("close", () => {
      if (!this.isCurrentSocket(socket, generation)) return;
      this.socket = undefined;
      this.scheduleReconnect(generation);
    });
  }

  private async executeCommand(
    socket: WebSocket,
    generation: number,
    envelope: CommandEnvelope,
  ): Promise<void> {
    try {
      let result: MapStateSummary | MapCommandResult;
      switch (envelope.command.type) {
        case "get_map_state":
          result = await this.controller.getMapState();
          break;
        case "apply_scene":
          result = await this.controller.applyScene({
            commandId: envelope.commandId,
            scene: envelope.command.scene,
            ...(envelope.command.expectedRevision === undefined
              ? {}
              : { expectedRevision: envelope.command.expectedRevision }),
          });
          break;
      }

      this.sendIfCurrent(socket, generation, {
        type: "result",
        protocolVersion: PROTOCOL_VERSION,
        commandId: envelope.commandId,
        ok: true,
        result,
      });
    } catch (error) {
      this.sendIfCurrent(socket, generation, {
        type: "result",
        protocolVersion: PROTOCOL_VERSION,
        commandId: envelope.commandId,
        ok: false,
        error: commandError(error),
      });
    }
  }

  private sendIfCurrent(
    socket: WebSocket,
    generation: number,
    message: object,
  ): void {
    if (!this.isCurrentSocket(socket, generation) || socket.readyState !== OPEN) {
      return;
    }
    socket.send(JSON.stringify(message));
  }

  private isCurrentSocket(socket: WebSocket, generation: number): boolean {
    return (
      this.running &&
      generation === this.generation &&
      socket === this.socket
    );
  }

  private scheduleReconnect(generation: number): void {
    if (
      !this.running ||
      generation !== this.generation ||
      this.reconnectTimer !== undefined
    ) {
      return;
    }
    if (this.reconnectDelaysMs.length === 0) return;
    const delay = this.reconnectDelaysMs[
      Math.min(this.reconnectIndex, this.reconnectDelaysMs.length - 1)
    ];
    if (delay === undefined) return;

    this.reconnectIndex += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect(generation);
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer === undefined) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
  }
}

function parseCommand(raw: string): CommandEnvelope | undefined {
  try {
    const json: unknown = JSON.parse(raw);
    const parsed = browserServerMessageSchema.safeParse(json);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function commandError(error: unknown): CommandError {
  if (error instanceof Error) {
    const errorWithCode = error as Error & { code?: unknown };
    return {
      code:
        typeof errorWithCode.code === "string"
          ? errorWithCode.code
          : "COMMAND_FAILED",
      message: error.message || "Browser command failed",
    };
  }
  return { code: "COMMAND_FAILED", message: "Browser command failed" };
}

function assertLoopbackWebSocketUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new TypeError("Pulse MCP bridge URL must be a valid URL");
  }
  if (
    parsed.protocol !== "ws:" ||
    parsed.hostname !== "127.0.0.1" ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    throw new TypeError("Pulse MCP bridge URL must use ws://127.0.0.1");
  }
}
