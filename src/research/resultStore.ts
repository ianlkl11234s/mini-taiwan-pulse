/** Browser-session, bounded result references.  This module deliberately has no
 * module-level store: a caller's single instance is its session boundary. */
export const DEFAULT_RESULT_TTL_MS = 30 * 60 * 1000;
/** Holds a bounded route-analysis batch plus its finite presentation inputs. */
export const DEFAULT_RESULT_STORE_CAPACITY = 128;
/** Serialized JSON UTF-8 budget, not a JavaScript heap measurement. It
 * accommodates one measured 22-county raw-boundary result (14.7 MiB) without
 * making the session cache unbounded. */
export const DEFAULT_RESULT_STORE_MAX_BYTES = 96 * 1024 * 1024;
export const DEFAULT_RESULT_STORE_MAX_ENTRY_BYTES = 24 * 1024 * 1024;

export interface ResultReference { resultId: string; }
export interface ResultStoreOptions {
  maxResults?: number;
  ttlMs?: number;
  maxBytes?: number;
  maxEntryBytes?: number;
  now?: () => number;
}

type Entry<T> = { value: T; expiresAt: number; sequence: number; byteSize: number };

function copy<T>(value: T): T {
  // Results are JSON-like data contracts.  Copying prevents one tool call from
  // mutating a later tool call's receipt or rows through a shared reference.
  return structuredClone(value);
}

function byteSize(value: unknown): number {
  try { return new TextEncoder().encode(JSON.stringify(value)).byteLength; }
  catch { throw new Error("RESULT_STORE_VALUE_NOT_SERIALIZABLE"); }
}

/** A per-browser-session memory store.  Do not share an instance between studies. */
export class BrowserMemoryResultStore<T extends ResultReference = ResultReference> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly pinned = new Set<string>();
  private readonly maxResults: number;
  private readonly ttlMs: number;
  private readonly maxBytes: number;
  private readonly maxEntryBytes: number;
  private readonly now: () => number;
  private sequence = 0;
  private totalBytes = 0;

  constructor(options: ResultStoreOptions = {}) {
    this.maxResults = options.maxResults ?? DEFAULT_RESULT_STORE_CAPACITY;
    this.ttlMs = options.ttlMs ?? DEFAULT_RESULT_TTL_MS;
    this.maxBytes = options.maxBytes ?? DEFAULT_RESULT_STORE_MAX_BYTES;
    this.maxEntryBytes = options.maxEntryBytes ?? DEFAULT_RESULT_STORE_MAX_ENTRY_BYTES;
    this.now = options.now ?? Date.now;
    if (!Number.isInteger(this.maxResults) || this.maxResults < 1 || this.maxResults > DEFAULT_RESULT_STORE_CAPACITY) throw new Error("INVALID_RESULT_STORE_CAPACITY");
    if (!Number.isInteger(this.ttlMs) || this.ttlMs < 1 || this.ttlMs > DEFAULT_RESULT_TTL_MS) throw new Error("INVALID_RESULT_STORE_TTL");
    if (!Number.isInteger(this.maxBytes) || this.maxBytes < 1 || this.maxBytes > DEFAULT_RESULT_STORE_MAX_BYTES) throw new Error("INVALID_RESULT_STORE_BYTE_BUDGET");
    if (!Number.isInteger(this.maxEntryBytes) || this.maxEntryBytes < 1 || this.maxEntryBytes > this.maxBytes) throw new Error("INVALID_RESULT_STORE_ENTRY_BYTE_BUDGET");
  }

  put(value: T): T {
    if (!value || typeof value.resultId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(value.resultId)) throw new Error("INVALID_RESULT_ID");
    this.purgeExpired();
    const stored = copy(value);
    const bytes = byteSize(stored);
    if (bytes > this.maxEntryBytes) throw new Error("RESULT_STORE_ENTRY_BYTES_EXCEEDED");
    const previous = this.entries.get(value.resultId);
    // A replacement keeps its pin but must make room for its changed payload.
    if (previous) { this.entries.delete(value.resultId); this.totalBytes -= previous.byteSize; }
    try { this.makeRoom(bytes); }
    catch (error) {
      if (previous) { this.entries.set(value.resultId, previous); this.totalBytes += previous.byteSize; }
      throw error;
    }
    this.entries.set(value.resultId, { value: stored, expiresAt: this.now() + this.ttlMs, sequence: ++this.sequence, byteSize: bytes });
    this.totalBytes += bytes;
    return copy(value);
  }

  /** Pins the active presentation only. Pins neither extend TTL nor add storage. */
  setPinned(resultIds: readonly string[]): void {
    this.purgeExpired();
    if (new Set(resultIds).size !== resultIds.length || resultIds.length > this.maxResults) throw new Error("INVALID_RESULT_STORE_PIN_SET");
    for (const resultId of resultIds) if (!this.entries.has(resultId)) throw new Error("RESULT_NOT_FOUND_OR_EXPIRED");
    this.pinned.clear();
    for (const resultId of resultIds) this.pinned.add(resultId);
  }

  get(resultId: string): T | null {
    this.purgeExpired();
    const entry = this.entries.get(resultId);
    return entry ? copy(entry.value) : null;
  }

  has(resultId: string): boolean { this.purgeExpired(); return this.entries.has(resultId); }

  list(): T[] {
    this.purgeExpired();
    return [...this.entries.values()].sort((a, b) => a.sequence - b.sequence).map(entry => copy(entry.value));
  }

  remove(resultId: string): boolean {
    this.pinned.delete(resultId);
    const entry = this.entries.get(resultId);
    if (!entry) return false;
    this.entries.delete(resultId); this.totalBytes -= entry.byteSize;
    return true;
  }

  private purgeExpired(): void {
    const current = this.now();
    for (const [id, entry] of this.entries) if (entry.expiresAt <= current) { this.entries.delete(id); this.pinned.delete(id); this.totalBytes -= entry.byteSize; }
  }

  private makeRoom(incomingBytes: number): void {
    let entryCount = this.entries.size;
    let bytes = this.totalBytes;
    const victims: [string, Entry<T>][] = [];
    const excluded = new Set<string>();
    while (entryCount >= this.maxResults || bytes + incomingBytes > this.maxBytes) {
      let oldest: [string, Entry<T>] | null = null;
      for (const pair of this.entries) if (!excluded.has(pair[0]) && !this.pinned.has(pair[0]) && (!oldest || pair[1].sequence < oldest[1].sequence)) oldest = pair;
      if (!oldest) throw new Error(entryCount >= this.maxResults ? "RESULT_STORE_CAPACITY_PINNED" : "RESULT_STORE_BYTE_BUDGET_PINNED");
      victims.push(oldest); excluded.add(oldest[0]); entryCount -= 1; bytes -= oldest[1].byteSize;
    }
    for (const [id, entry] of victims) { this.entries.delete(id); this.totalBytes -= entry.byteSize; }
  }
}
