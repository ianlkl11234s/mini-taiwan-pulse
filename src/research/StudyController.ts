import type { BridgeConnectionContext, Scene, StudyState } from "./bridgeClient";

type Render = (scene: Scene, revision: number, patch?: Partial<Scene>) => Promise<"ready" | "error">;
/** Serializes server mutations; local edits invalidate in-flight render reports immediately. */
export class StudyController {
  private state: StudyState | null = null;
  private busy = false;
  private stopped = false;
  private interacting = false;
  private generation = 0;
  private queued: Scene | null = null;
  /** An ack may have committed after its response was lost; never replay it blindly. */
  private uncertainCommandId: string | null = null;
  constructor(private readonly connection: BridgeConnectionContext, private readonly render: Render, private readonly onError: () => void) {}

  receive(state: StudyState): void {
    if (this.stopped || this.busy || this.interacting || state.studyId !== this.connection.studyId || state.tabId !== this.connection.tabId || (this.state && state.revision < this.state.revision)) return;
    const changed = !this.state || state.revision !== this.state.revision;
    this.state = state;
    if (this.uncertainCommandId && state.pendingCommand?.commandId !== this.uncertainCommandId) this.uncertainCommandId = null;
    if (state.pendingCommand && !state.paused && state.pendingCommand.commandId !== this.uncertainCommandId) { void this.applyCommand(state); return; }
    if (changed) this.present(state.scene, state.revision, state.view.phase === "applied");
  }

  beginManual(): void { this.interacting = true; ++this.generation; }

  manual(scene: Scene): void {
    this.interacting = false;
    if (this.stopped || !this.state) return;
    ++this.generation;
    this.queued = scene;
    if (!this.busy) void this.flushManual();
  }

  stop(): void { this.stopped = true; ++this.generation; this.queued = null; }

  private present(scene: Scene, revision: number, report: boolean): void {
    const generation = ++this.generation;
    let rendered: Promise<"ready" | "error">;
    try { rendered = this.render(scene, revision); } catch { this.onError(); return; }
    void rendered.then(async phase => {
      if (!report || this.stopped || generation !== this.generation || this.state?.revision !== revision) return;
      const { client, studyId, tabId } = this.connection;
      await client.report(studyId, tabId, revision, phase);
    }).catch(() => { if (!this.stopped && generation === this.generation) this.onError(); });
  }

  private async applyCommand(state: StudyState): Promise<void> {
    const pending = state.pendingCommand;
    if (!pending || pending.expectedRevision !== state.revision || pending.studyId !== state.studyId || pending.tabId !== state.tabId || pending.expiresAt <= Date.now()) return;
    this.busy = true;
    const generation = ++this.generation;
    const { client, studyId, tabId } = this.connection;
    let ackStarted = false;
    try {
      // render() synchronously applies the typed scene; its promise waits for actual idle.
      const rendered = this.render({ ...state.scene, ...pending.patch }, state.revision + 1, pending.patch);
      let renderFailureNotified = false;
      const notifyRenderFailure = () => {
        if (renderFailureNotified || this.stopped || generation !== this.generation) return;
        renderFailureNotified = true;
        this.onError();
      };
      void rendered.catch(() => {
        notifyRenderFailure();
      });
      ackStarted = true;
      const applied = await client.ack(studyId, tabId, pending.commandId, state.revision);
      if (this.stopped) return;
      this.state = applied;
      void rendered.then(
        async phase => {
          if (this.stopped || generation !== this.generation || this.state?.revision !== applied.revision) return;
          try { await client.report(studyId, tabId, applied.revision, phase); } catch { notifyRenderFailure(); }
        },
        async () => {
          if (this.stopped || generation !== this.generation || this.state?.revision !== applied.revision) return;
          try { await client.report(studyId, tabId, applied.revision, "error"); } catch { notifyRenderFailure(); }
        },
      );
    } catch {
      await this.recover(ackStarted ? pending.commandId : null);
    } finally {
      this.busy = false;
      if (this.queued && !this.stopped) void this.flushManual();
    }
  }

  private async flushManual(): Promise<void> {
    if (!this.queued || !this.state || this.busy || this.stopped) return;
    this.busy = true;
    const scene = this.queued; this.queued = null;
    const { client, studyId, tabId } = this.connection;
    try {
      const next = await client.manual(studyId, tabId, this.state.revision, scene);
      if (this.stopped) return;
      this.state = next;
      if (!this.queued) this.present(scene, next.revision, true);
    } catch {
      await this.recover();
    } finally {
      this.busy = false;
      if (this.queued && !this.stopped) void this.flushManual();
    }
  }

  private async recover(uncertainCommandId: string | null = null): Promise<void> {
    ++this.generation;
    if (this.stopped) return;
    this.onError();
    if (uncertainCommandId) this.uncertainCommandId = uncertainCommandId;
    try {
      const { client, studyId, tabId } = this.connection;
      const state = await client.sync(studyId, tabId);
      if (this.stopped) return;
      this.state = state;
      if (this.uncertainCommandId && state.pendingCommand?.commandId !== this.uncertainCommandId) this.uncertainCommandId = null;
      this.present(state.scene, state.revision, state.view.phase === "applied");
    } catch { /* Preserve the error and let the next scheduled sync retry. */ }
  }
}
