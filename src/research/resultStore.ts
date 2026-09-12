/** Browser-session, bounded result references.  This module deliberately has no
 * module-level store: a caller's single instance is its session boundary. */
export const DEFAULT_RESULT_TTL_MS = 30 * 60 * 1000;
export const DEFAULT_RESULT_STORE_CAPACITY = 8;

export interface ResultReference { resultId: string; }
export interface ResultStoreOptions {
  maxResults?: number;
  ttlMs?: number;
  now?: () => number;
}

type Entry<T> = { value: T; expiresAt: number; sequence: number };

function copy<T>(value: T): T {
  // Results are JSON-like data contracts.  Copying prevents one tool call from
  // mutating a later tool call's receipt or rows through a shared reference.
  return structuredClone(value);
}

/** A per-browser-session memory store.  Do not share an instance between studies. */
export class BrowserMemoryResultStore<T extends ResultReference = ResultReference> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly maxResults: number;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private sequence = 0;

  constructor(options: ResultStoreOptions = {}) {
    this.maxResults = options.maxResults ?? DEFAULT_RESULT_STORE_CAPACITY;
    this.ttlMs = options.ttlMs ?? DEFAULT_RESULT_TTL_MS;
    this.now = options.now ?? Date.now;
    if (!Number.isInteger(this.maxResults) || this.maxResults < 1 || this.maxResults > DEFAULT_RESULT_STORE_CAPACITY) throw new Error("INVALID_RESULT_STORE_CAPACITY");
    if (!Number.isInteger(this.ttlMs) || this.ttlMs < 1 || this.ttlMs > DEFAULT_RESULT_TTL_MS) throw new Error("INVALID_RESULT_STORE_TTL");
  }

  put(value: T): T {
    if (!value || typeof value.resultId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(value.resultId)) throw new Error("INVALID_RESULT_ID");
    this.purgeExpired();
    this.entries.set(value.resultId, { value: copy(value), expiresAt: this.now() + this.ttlMs, sequence: ++this.sequence });
    while (this.entries.size > this.maxResults) this.removeOldest();
    return copy(value);
  }

  get(resultId: string): T | null {
    this.purgeExpired();
    const entry = this.entries.get(resultId);
    return entry ? copy(entry.value) : null;
  }

  list(): T[] {
    this.purgeExpired();
    return [...this.entries.values()].sort((a, b) => a.sequence - b.sequence).map(entry => copy(entry.value));
  }

  remove(resultId: string): boolean { return this.entries.delete(resultId); }

  private purgeExpired(): void {
    const current = this.now();
    for (const [id, entry] of this.entries) if (entry.expiresAt <= current) this.entries.delete(id);
  }

  private removeOldest(): void {
    let oldest: [string, Entry<T>] | null = null;
    for (const pair of this.entries) if (!oldest || pair[1].sequence < oldest[1].sequence) oldest = pair;
    if (oldest) this.entries.delete(oldest[0]);
  }
}
