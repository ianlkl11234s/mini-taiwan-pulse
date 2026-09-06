/** Renderer-free GFW grid release-window state for legends and timeline UI. */
export interface GfwHourlyGridDataWindowState {
  readonly status: "in-window" | "out-of-window";
  readonly startIso: string;
  readonly endIsoExclusive: string;
  readonly utcDateLabel: string;
}

let snapshot: GfwHourlyGridDataWindowState | null = null;
const listeners = new Set<() => void>();

export function setGfwHourlyGridDataWindowState(next: GfwHourlyGridDataWindowState | null): void {
  const previous = snapshot;
  if (previous === next) return;
  if (previous && next && previous.status === next.status && previous.startIso === next.startIso
    && previous.endIsoExclusive === next.endIsoExclusive && previous.utcDateLabel === next.utcDateLabel) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

export function subscribeGfwHourlyGridDataWindow(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getGfwHourlyGridDataWindowSnapshot(): GfwHourlyGridDataWindowState | null {
  return snapshot;
}
