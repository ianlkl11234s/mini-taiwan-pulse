/**
 * 國家包的延後註冊點（B1 P5a，2026-11-24）。本檔零 import，任何登記簿都能用，不會造成循環。
 *
 * 兩種登記簿：
 *  - 有序陣列（Host、點擊、圖例）：靜態陣列裡用 `countrySlot("GB", 1)` 標出國家包條目原本的位置，
 *    `slottedList` 會把標記拿掉並記下「插在哪個靜態條目後面」。國家包載入後 `fillSlots` 依標記插回，
 *    所以不論載入順序、載入幾國，結果都等於「完整陣列濾掉沒載入的國家」（first-hit-wins、疊放順序不變）。
 *    陣列本身是同一個物件（原地 splice），直接 import 陣列的讀者在載入後讀到的就是新內容。
 *  - 以 key 為索引的物件（manifest、params、sourceInfo、popup panel…）：`extensibleRecord` 登記，
 *    `extendRecord` 原地 Object.assign；重複的 key 直接 throw（國家包不可覆寫既有條目）。
 *
 * 登記簿模組可能比國家包晚載入（例如圖例面板是 lazy chunk）：先到的內容會排隊，登記簿建立時補上。
 * 需要副作用的讀者（params store 補預設值、MANIFEST_KEYS…）用 `onRecordExtended` 訂閱，已發生的擴充會補播。
 */

const SLOT_MARK = "__countrySlot__";

/** 陣列裡的國家包插槽標記；id＝`<國碼>:<序號>`。 */
export interface CountrySlot {
  readonly [SLOT_MARK]: string;
}

export function countrySlot(country: string, n: number): CountrySlot {
  return { [SLOT_MARK]: `${country}:${n}` };
}

function isSlot(value: unknown): value is CountrySlot {
  return typeof value === "object" && value !== null && SLOT_MARK in value;
}

interface SlotPos {
  /** 插槽前一個靜態條目（null＝陣列開頭） */
  anchor: unknown;
  ordinal: number;
  filled: unknown[] | null;
}

interface ListState {
  name: string;
  items: unknown[];
  slots: Map<string, SlotPos>;
  onFill?: (items: unknown[]) => void;
}

const lists = new Map<string, ListState>();
const pendingFills = new Map<string, Array<[string, unknown[]]>>();

function fillNow(state: ListState, id: string, payload: unknown[]): void {
  const pos = state.slots.get(id);
  if (!pos) throw new Error(`[countrySlot] ${state.name} 沒有插槽 ${id}（靜態陣列的 countrySlot 標記與國家包不一致，重跑 codemod）`);
  if (pos.filled) return;
  let at = 0;
  if (pos.anchor !== null) {
    const i = state.items.indexOf(pos.anchor);
    if (i < 0) throw new Error(`[countrySlot] ${state.name} 插槽 ${id} 的前一個條目已不在陣列裡`);
    at = i + 1;
  }
  // 同一個前導條目後面可能有好幾個插槽（GB:1 緊接 CN:1）：依標記順序排，序號小的在前
  for (const other of state.slots.values()) {
    if (other !== pos && other.anchor === pos.anchor && other.filled && other.ordinal < pos.ordinal) at += other.filled.length;
  }
  state.items.splice(at, 0, ...payload);
  pos.filled = payload;
  state.onFill?.(payload);
}

/**
 * 建立有序登記簿。`entries` 可以夾 `countrySlot` 標記；回傳的陣列不含標記，之後由 `fillSlots` 原地插入。
 * `onFill` 在每次插入後呼叫（例如點擊表要對新條目補代表點 layer id）。
 */
export function slottedList<T>(name: string, entries: ReadonlyArray<T | CountrySlot>, onFill?: (items: T[]) => void): T[] {
  if (lists.has(name)) throw new Error(`[countrySlot] 登記簿 ${name} 重複建立`);
  const items: T[] = [];
  const slots = new Map<string, SlotPos>();
  let ordinal = 0;
  for (const entry of entries) {
    if (isSlot(entry)) {
      const id = entry[SLOT_MARK];
      if (slots.has(id)) throw new Error(`[countrySlot] ${name} 插槽 ${id} 重複`);
      slots.set(id, { anchor: items.length ? items[items.length - 1] : null, ordinal: ordinal++, filled: null });
    } else items.push(entry);
  }
  const state: ListState = { name, items, slots, onFill: onFill as ((items: unknown[]) => void) | undefined };
  lists.set(name, state);
  for (const [id, payload] of pendingFills.get(name) ?? []) fillNow(state, id, payload);
  pendingFills.delete(name);
  return items;
}

/** 國家包把條目填回插槽：`slots` 是「插槽序號 → 條目」。登記簿還沒建立就排隊。 */
export function fillSlots(name: string, country: string, slots: Readonly<Record<number, readonly unknown[]>>): void {
  const state = lists.get(name);
  for (const [n, payload] of Object.entries(slots)) {
    const id = `${country}:${n}`;
    if (state) fillNow(state, id, [...payload]);
    else {
      const queue = pendingFills.get(name) ?? [];
      queue.push([id, [...payload]]);
      pendingFills.set(name, queue);
    }
  }
}

/** 某個登記簿還沒填的插槽 id（測試與開發檢查用）。 */
export function unfilledSlots(name: string): string[] {
  const state = lists.get(name);
  return state ? [...state.slots].filter(([, pos]) => !pos.filled).map(([id]) => id) : [];
}

// ── 以 key 為索引的登記簿 ──────────────────────────────────────────

type Rec = Record<string, unknown>;
type Listener = (added: Rec) => void;

const records = new Map<string, Rec>();
const history = new Map<string, Rec[]>();
const listeners = new Map<string, Set<Listener>>();

/** 國家包的 key 在全域宣告順序裡的位置：[錨點＝前一個靜態 key, 全域序號]（由索引提供，見 setRecordOrder） */
export type RecordOrderHint = readonly [anchor: string, rank: number];
const orderHints = new Map<string, (key: string) => RecordOrderHint | undefined>();
const extendedKeys = new Map<string, Set<string>>();

/**
 * 登記簿的 key 順序也是契約（MANIFEST_KEYS、MCP 能力清單分頁、熱區色盤清單都依宣告順序）。
 * 設了順序提示的登記簿，國家包併入後依「錨點＋全域序號」把 key 排回搬家前的位置，與載入先後無關。
 */
export function setRecordOrder(name: string, hint: (key: string) => RecordOrderHint | undefined): void {
  orderHints.set(name, hint);
  const target = records.get(name);
  if (target) reorder(name, target);
}

/** 由國家包併入的 key（索引產生器用來判斷哪些 key 要寫順序提示）。 */
export function extendedRecordKeys(name: string): ReadonlySet<string> {
  return extendedKeys.get(name) ?? new Set();
}

function reorder(name: string, target: Rec): void {
  const hint = orderHints.get(name);
  const ext = extendedKeys.get(name);
  if (!hint || !ext?.size) return;
  const hinted: { key: string; anchor: string; rank: number }[] = [];
  const base: string[] = [];
  for (const key of Object.keys(target)) {
    const h = ext.has(key) ? hint(key) : undefined;
    if (h) hinted.push({ key, anchor: h[0], rank: h[1] });
    else base.push(key);
  }
  if (!hinted.length) return;
  hinted.sort((a, b) => a.rank - b.rank);
  const after = new Map<string, string[]>();
  for (const h of hinted) {
    // 錨點不在（理論上不會：錨點是靜態 key）就排到最後
    const anchor = base.includes(h.anchor) ? h.anchor : "";
    const list = after.get(anchor) ?? [];
    list.push(h.key);
    after.set(anchor, list);
  }
  const order: string[] = [];
  for (const key of base) {
    order.push(key);
    for (const k of after.get(key) ?? []) order.push(k);
  }
  for (const k of after.get("") ?? []) order.push(k);
  const entries = order.map((k) => [k, target[k]] as const);
  for (const k of order) delete target[k];
  for (const [k, v] of entries) target[k] = v;
}

function assignInto(name: string, target: Rec, added: Rec): void {
  for (const key of Object.keys(added)) {
    if (Object.prototype.hasOwnProperty.call(target, key)) throw new Error(`[countryPack] ${name} 已有 ${key}，國家包不可覆寫`);
  }
  Object.assign(target, added);
  const ext = extendedKeys.get(name) ?? new Set<string>();
  for (const key of Object.keys(added)) ext.add(key);
  extendedKeys.set(name, ext);
  reorder(name, target);
}

export function extensibleRecord<T extends object>(name: string, obj: T): T {
  if (records.has(name)) throw new Error(`[countryPack] 登記簿 ${name} 重複建立`);
  records.set(name, obj as Rec);
  for (const added of history.get(name) ?? []) assignInto(name, obj as Rec, added);
  return obj;
}

export function extendRecord(name: string, added: Readonly<Rec>): void {
  const copy = { ...added };
  const list = history.get(name) ?? [];
  list.push(copy);
  history.set(name, list);
  const target = records.get(name);
  if (target) assignInto(name, target, copy);
  for (const l of listeners.get(name) ?? []) l(copy);
}

/** 訂閱某登記簿的擴充；已發生的擴充會立刻補播。回傳取消訂閱。 */
export function onRecordExtended(name: string, listener: Listener): () => void {
  for (const added of history.get(name) ?? []) listener(added);
  const set = listeners.get(name) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(name, set);
  return () => set.delete(listener);
}
