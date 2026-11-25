/**
 * 把一國的圖層登記搬進延後載入的國家包 src/countries/<cc>/（B1 P5a，可重跑）。
 *
 *   npx tsx scripts/layers/move-country-pack.ts <CC>          # 例：CN、GB
 *   npx tsx scripts/layers/move-country-pack.ts <CC> --dry    # 只列要搬的東西
 *
 * 做的事（全部依「索引裡這國的 key」決定，不靠行號）：
 *  1. 國家專屬模組（countryPackConfig 的 dedicated）整檔 git mv 進 src/countries/<dir>/，全 repo import 跟著改寫。
 *  2. moveNamed：共用檔裡的國家專屬具名匯出（連同只給它用的區域宣告）搬到國家目錄。
 *  3. 登記簿條目搬進國家包（以 AST 節點範圍切，含前導註解）：
 *     manifest、params、sourceInfo／notes、popup panel／標題 → 物件條目；
 *     Host、點擊、圖例 → 有序陣列，原位置換成 `countrySlot("<CC>", n)` 標記。
 *     判準：key（或 popup 類型、legend id）屬於這國；或展開（...X）的內容引用了這國的模組。
 *  4. 條目用到的區域宣告：只有搬走的條目用 → 一起搬；別處也用 → 原檔加 export、國家包 import。import 照抄並改路徑；原檔沒人用的 import 刪掉。
 *  5. 產生 keys.ts（沒有的話）、popupTypes.ts、pack.ts，並在 packKeys.ts 登記型別。
 *
 * 重跑：中央登記簿裡已經沒有這國的條目時什麼都不改（no-op）。凍結後別的 PR 新增了這國的條目，合 develop 後重跑即可補搬
 * （新條目接在國家包既有物件尾端；有序陣列用新的插槽序號）。
 * 跑完要做：npx tsc -b、npx vite-node scripts/layers/gen-layer-index.ts（索引）、
 *          npx vite-node scripts/preprocess/dump-layer-golden.ts 後 git diff 確認 golden 目錄零差異。
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { COUNTRY_PACK_CONFIG, type CountryPackConfig } from "./countryPackConfig";

const ROOT = resolve(import.meta.dirname, "..", "..");
const CC = process.argv[2];
const DRY = process.argv.includes("--dry");
const cfg: CountryPackConfig | undefined = CC ? COUNTRY_PACK_CONFIG[CC] : undefined;
if (!CC || !cfg) {
  console.error(`用法：move-country-pack.ts <CC>（可用：${Object.keys(COUNTRY_PACK_CONFIG).join("、")}）`);
  process.exit(2);
}
const PACK_DIR = `src/countries/${cfg.dir}`;
const PACK_ABS = join(ROOT, PACK_DIR);
const log: string[] = [];

// ── 0. 這國的 key／popup 類型／legend id（索引） ───────────────────
interface IndexRow { country: string; popup?: string | string[] | null; legend?: string | null }
function readIndex(): Record<string, IndexRow> {
  const text = readFileSync(join(ROOT, "src/data/layerIndex.generated.ts"), "utf8");
  const out: Record<string, IndexRow> = {};
  for (const m of text.matchAll(/^ {2}"([A-Za-z0-9_]+)": (\{.*\}),$/gm)) out[m[1]!] = JSON.parse(m[2]!) as IndexRow;
  return out;
}
const INDEX = readIndex();
const ALL_KEYS = Object.keys(INDEX).filter((k) => INDEX[k]!.country === CC).sort();
const KEYS = new Set(ALL_KEYS.filter((k) => !cfg.excludeKeys?.test(k)));
const POPUPS = new Set<string>();
const LEGENDS = new Set<string>();
for (const k of KEYS) {
  const r = INDEX[k]!;
  const p = r.popup === undefined ? k : r.popup;
  for (const t of p === null ? [] : Array.isArray(p) ? p : [p]) POPUPS.add(t);
  const l = r.legend === undefined ? k : r.legend;
  if (l !== null) LEGENDS.add(l);
}
// 共用的 popup 類型／圖例 id（例：rasterProbe、lightningStrike、historicalFlightTrails 台灣圖層也在用）留在中央：
// 索引只有外國圖層看不到台灣的使用者，所以只收「就是這國的 key」或「帶這國前綴」的 id。
const OWN_ID = cfg.ownIdPrefix ?? new RegExp(`^${cfg.dir}[A-Z0-9]`);
const SHARED_KEPT: string[] = [];
for (const set of [POPUPS, LEGENDS]) {
  for (const id of [...set]) if (!KEYS.has(id) && !OWN_ID.test(id)) { set.delete(id); SHARED_KEPT.push(id); }
}
if (SHARED_KEPT.length) console.log(`• 共用 id 留在中央：${[...new Set(SHARED_KEPT)].join("、")}`);
console.log(`${CC}：索引 ${ALL_KEYS.length} 個 key，這輪搬 ${KEYS.size} 個；popup 類型 ${POPUPS.size}、legend id ${LEGENDS.size}`);

// ── 檔案工具 ───────────────────────────────────────────────────────
const relRoot = (abs: string) => relative(ROOT, abs).split("\\").join("/");
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".") || name === "dist") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mts|mjs|js)$/.test(name) && !name.endsWith(".d.ts")) out.push(p);
  }
  return out;
}
const ROOT_PATH_FILES = ["eslint.config.js", "eslint-suppressions.json"];
const CODE_FILES = () => ["src", "scripts", "tests", "e2e"].filter((d) => existsSync(join(ROOT, d))).flatMap((d) => walk(join(ROOT, d)));
function resolveSpec(fromAbs: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(fromAbs), spec);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}
function specFrom(fromAbs: string, targetAbs: string): string {
  let r = relative(dirname(fromAbs), targetAbs).split("\\").join("/").replace(/\.(ts|tsx)$/, "");
  if (!r.startsWith(".")) r = `./${r}`;
  return r;
}
const SPEC_RE = /((?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+|\bvi\.mock\(\s*|\bvi\.importActual(?:<[^>]*>)?\(\s*|\bimportOriginal\(\s*))(["'])(\.{1,2}\/[^"']+)\2/gm;

// ── 1. 整檔搬家 ────────────────────────────────────────────────────
function moveDedicatedFiles(): Map<string, string> {
  const moves = new Map<string, string>(); // oldAbs → newAbs
  for (const abs of walk(join(ROOT, "src"))) {
    const rel = relRoot(abs);
    if (rel.includes("__tests__") || /\.test\.tsx?$/.test(rel) || rel.startsWith("src/countries/")) continue;
    if (!cfg!.dedicated.some((re) => re.test(rel))) continue;
    const name = cfg!.rename?.[rel] ?? rel.split("/").pop()!;
    moves.set(abs, join(PACK_ABS, name));
  }
  if (moves.size === 0) return moves;
  console.log(`整檔搬家 ${moves.size} 個：`);
  for (const [a, b] of moves) console.log(`  ${relRoot(a)} → ${relRoot(b)}`);
  if (DRY) return moves;
  // 先改寫所有檔案的 import（以搬家前的位置解析），再 git mv
  const newLoc = (abs: string) => moves.get(abs) ?? abs;
  for (const file of CODE_FILES()) {
    if (/scripts\/layers\/(move-country-pack|countryPackConfig)\.ts$/.test(file)) continue;
    const text = readFileSync(file, "utf8");
    let changed = false;
    const next = text.replace(SPEC_RE, (whole, pre: string, q: string, spec: string) => {
      const target = resolveSpec(file, spec);
      if (!target) return whole;
      const fileNew = newLoc(file);
      const targetNew = newLoc(target);
      if (fileNew === file && targetNew === target) return whole;
      const ns = specFrom(fileNew, targetNew);
      if (ns === spec) return whole;
      changed = true;
      return `${pre}${q}${ns}${q}`;
    });
    // 註解、測試裡寫死的 repo 路徑（例：pointTiers 的「· src/countries/cn/useCnLayers.ts」、測試讀檔路徑）一起改
    let next2 = next;
    for (const [a, b] of moves) next2 = next2.split(relRoot(a)).join(relRoot(b));
    if (next2 !== next) changed = true;
    if (changed) writeFileSync(file, next2);
  }
  // repo 根目錄的設定檔也寫死檔案路徑（lint 規則範圍、lint 例外基準）
  for (const name of ROOT_PATH_FILES) {
    const file = join(ROOT, name);
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    let next = text;
    for (const [a, b] of moves) next = next.split(relRoot(a)).join(relRoot(b));
    if (next !== text) writeFileSync(file, next);
  }
  mkdirSync(PACK_ABS, { recursive: true });
  for (const [a, b] of moves) execFileSync("git", ["mv", a, b], { cwd: ROOT });
  log.push(`整檔搬家 ${moves.size} 個檔`);
  return moves;
}

// ── AST 工具 ───────────────────────────────────────────────────────
function parse(abs: string): ts.SourceFile {
  return ts.createSourceFile(abs, readFileSync(abs, "utf8"), ts.ScriptTarget.Latest, true, abs.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

interface ImportBinding { local: string; imported: string; spec: string; typeOnly: boolean; kind: "named" | "default" | "namespace"; target: string | null }
function importBindings(sf: ts.SourceFile): Map<string, ImportBinding> {
  const out = new Map<string, ImportBinding>();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue;
    const spec = (st.moduleSpecifier as ts.StringLiteral).text;
    const target = resolveSpec(sf.fileName, spec);
    const clause = st.importClause;
    const allType = clause.isTypeOnly;
    if (clause.name) out.set(clause.name.text, { local: clause.name.text, imported: "default", spec, typeOnly: allType, kind: "default", target });
    const nb = clause.namedBindings;
    if (nb && ts.isNamespaceImport(nb)) out.set(nb.name.text, { local: nb.name.text, imported: "*", spec, typeOnly: allType, kind: "namespace", target });
    if (nb && ts.isNamedImports(nb)) {
      for (const el of nb.elements) {
        out.set(el.name.text, { local: el.name.text, imported: (el.propertyName ?? el.name).text, spec, typeOnly: allType || el.isTypeOnly, kind: "named", target });
      }
    }
  }
  return out;
}

/** 頂層宣告名稱 → statement */
function topDecls(sf: ts.SourceFile): Map<string, ts.Statement> {
  const out = new Map<string, ts.Statement>();
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) { if (ts.isIdentifier(d.name)) out.set(d.name.text, st); }
    else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isEnumDeclaration(st)) && st.name) out.set(st.name.text, st);
  }
  return out;
}

function isRefIdentifier(id: ts.Identifier): boolean {
  const p = id.parent;
  if (!p) return true;
  if ((ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isPropertySignature(p) || ts.isMethodDeclaration(p) || ts.isMethodSignature(p) || ts.isGetAccessor(p) || ts.isSetAccessor(p) || ts.isEnumMember(p)) && p.name === id) return false;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
  if (ts.isQualifiedName(p) && p.right === id) return false;
  if (ts.isJsxAttribute(p) && p.name === id) return false;
  if ((ts.isImportSpecifier(p) || ts.isExportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p)) ) return false;
  if ((ts.isVariableDeclaration(p) || ts.isFunctionDeclaration(p) || ts.isClassDeclaration(p) || ts.isInterfaceDeclaration(p) || ts.isTypeAliasDeclaration(p) || ts.isEnumDeclaration(p) || ts.isParameter(p) || ts.isTypeParameterDeclaration(p) || ts.isBindingElement(p)) && (p as { name?: ts.Node }).name === id) return false;
  if (ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p)) return false;
  return true;
}

function refsIn(node: ts.Node, sf: ts.SourceFile): Set<string> {
  const out = new Set<string>();
  const visit = (n: ts.Node) => {
    if (ts.isIdentifier(n) && isRefIdentifier(n)) out.add(n.text);
    if (ts.isShorthandPropertyAssignment(n)) out.add(n.name.text);
    n.forEachChild(visit);
  };
  visit(node);
  void sf;
  return out;
}

/** 範圍：含前導註解（不含上一行尾的註解），到節點結尾＋後面的逗號 */
function spanOf(node: ts.Node, sf: ts.SourceFile): [number, number] {
  const text = sf.text;
  let start = node.getFullStart();
  // 前導 trivia 從下一行開始（上一個節點同一行的尾註解留給它）
  const firstNl = text.indexOf("\n", start);
  if (firstNl >= 0 && firstNl < node.getStart(sf)) start = firstNl + 1;
  let end = node.getEnd();
  const after = text.slice(end).match(/^[ \t]*,/);
  if (after) end += after[0].length;
  // 吃掉同一行的尾註解與換行
  const tail = text.slice(end).match(/^[ \t]*(\/\/[^\n]*)?\n/);
  if (tail) end += tail[0].length;
  return [start, end];
}

interface Edit { start: number; end: number; text: string }

/** 條目原文（含前導註解）＋逗號＋同一行尾註解＋換行 */
function entryText(node: ts.Node, sf: ts.SourceFile): string {
  const [s, e] = spanOf(node, sf);
  const rest = sf.text.slice(node.getEnd(), e);
  const comment = rest.match(/\/\/[^\n]*/)?.[0];
  return `${sf.text.slice(s, node.getEnd())},${comment ? ` ${comment}` : ""}\n`;
}
function applyEdits(text: string, edits: Edit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  for (let i = 1; i < sorted.length; i++) if (sorted[i]!.end > sorted[i - 1]!.start) throw new Error(`編輯範圍重疊：${sorted[i]!.start}-${sorted[i]!.end}`);
  let out = text;
  for (const e of sorted) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

const isCountryModule = (abs: string | null) => !!abs && relRoot(abs).startsWith(`${PACK_DIR}/`);

// ── 目標檔（國家包的各區段） ───────────────────────────────────────
interface Section {
  file: string; // 相對 PACK_DIR
  exportName: string;
  kind: "record" | "slots";
  /** 型別尾巴：record 用 satisfies，slots 用型別註記 */
  typeText: string;
  typeImports: string[]; // 完整 import 敘述
  body: string[]; // 條目原文
  slotBodies: Map<number, string[]>;
  imports: Map<string, ImportBinding & { fromAbs: string }>;
  decls: string[];
}
const sections = new Map<string, Section>();
function section(file: string, exportName: string, kind: Section["kind"], typeText: string, typeImports: string[]): Section {
  const id = exportName || file;
  let s = sections.get(id);
  if (!s) {
    s = { file, exportName, kind, typeText, typeImports, body: [], slotBodies: new Map(), imports: new Map(), decls: [] };
    sections.set(id, s);
  }
  return s;
}

// 每個來源檔一份待套用的編輯與「要加 export」清單
const fileEdits = new Map<string, Edit[]>();
const toExport = new Map<string, Set<string>>();
const pushEdit = (abs: string, e: Edit) => { const l = fileEdits.get(abs) ?? []; l.push(e); fileEdits.set(abs, l); };

/**
 * 把一批節點（同一來源檔）搬進 section：處理相依（區域宣告一起搬或改 export、import 照抄）。
 * 回傳「區域宣告一起搬」的名稱。
 */
function carryDependencies(sf: ts.SourceFile, nodes: ts.Node[], sec: Section): void {
  const imports = importBindings(sf);
  const decls = topDecls(sf);
  const movedDecls = new Set<ts.Statement>();
  const movedRanges: Array<[number, number]> = nodes.map((n) => [n.getStart(sf), n.getEnd()]);
  const inMoved = (pos: number) => movedRanges.some(([a, b]) => pos >= a && pos < b);
  // 參考計數：整個檔案裡，每個名稱被引用的位置
  const refPositions = new Map<string, number[]>();
  const visit = (n: ts.Node) => {
    if (ts.isIdentifier(n) && isRefIdentifier(n)) { const l = refPositions.get(n.text) ?? []; l.push(n.getStart(sf)); refPositions.set(n.text, l); }
    if (ts.isShorthandPropertyAssignment(n)) { const l = refPositions.get(n.name.text) ?? []; l.push(n.name.getStart(sf)); refPositions.set(n.name.text, l); }
    n.forEachChild(visit);
  };
  visit(sf);
  const queue: ts.Node[] = [...nodes];
  const seen = new Set<string>();
  while (queue.length) {
    const node = queue.shift()!;
    for (const name of refsIn(node, sf)) {
      if (seen.has(name)) continue;
      seen.add(name);
      const imp = imports.get(name);
      if (imp) { sec.imports.set(name, { ...imp, fromAbs: sf.fileName }); continue; }
      const decl = decls.get(name);
      if (!decl || nodes.includes(decl)) continue;
      const declRange: [number, number] = [decl.getStart(sf), decl.getEnd()];
      const outside = (refPositions.get(name) ?? []).filter((pos) => !inMoved(pos) && !(pos >= declRange[0] && pos < declRange[1]));
      if (outside.length === 0 && !hasExportKeyword(decl)) {
        movedDecls.add(decl);
        movedRanges.push(declRange);
        queue.push(decl);
      } else {
        // 別處也用：原檔 export，國家包 import
        if (!hasExportKeyword(decl)) { const set = toExport.get(sf.fileName) ?? new Set(); set.add(name); toExport.set(sf.fileName, set); }
        sec.imports.set(name, { local: name, imported: name, spec: "", typeOnly: ts.isInterfaceDeclaration(decl) || ts.isTypeAliasDeclaration(decl), kind: "named", target: sf.fileName, fromAbs: sf.fileName });
      }
    }
  }
  // 搬走的區域宣告：照原檔順序放在 section 的 decls
  const ordered = [...movedDecls].sort((a, b) => a.getStart(sf) - b.getStart(sf));
  for (const d of ordered) {
    const [s, e] = spanOf(d, sf);
    sec.decls.push(sf.text.slice(s, e).replace(/^\s*\n/, ""));
    pushEdit(sf.fileName, { start: s, end: e, text: "" });
  }
  // 再檢查一次：搬走的宣告若引用了已決定要搬的宣告以外的東西，上面的 queue 已處理
}

function hasExportKeyword(st: ts.Statement): boolean {
  return !!ts.getModifiers(st as ts.HasModifiers)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

/** 展開元素是否（經由區域宣告）引用了國家模組 */
function spreadIsCountry(sf: ts.SourceFile, expr: ts.Node): boolean {
  const imports = importBindings(sf);
  const decls = topDecls(sf);
  const seen = new Set<string>();
  const stack = [expr];
  while (stack.length) {
    const n = stack.pop()!;
    for (const name of refsIn(n, sf)) {
      if (seen.has(name)) continue;
      seen.add(name);
      const imp = imports.get(name);
      if (imp && isCountryModule(imp.target)) return true;
      const d = decls.get(name);
      if (d && !imp) stack.push(d);
    }
  }
  return false;
}

function propName(p: ts.ObjectLiteralElementLike): string | null {
  if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p) || ts.isMethodDeclaration(p)) {
    const n = p.name;
    if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n)) return n.text;
  }
  return null;
}

/** 找某變數的初始化物件／陣列（容許包在 extensibleRecord(...)／slottedList(...)、satisfies、as 裡） */
function findContainer(sf: ts.SourceFile, varName: string): ts.ObjectLiteralExpression | ts.ArrayLiteralExpression {
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== varName || !d.initializer) continue;
      let e: ts.Expression = d.initializer;
      for (;;) {
        if (ts.isSatisfiesExpression(e) || ts.isAsExpression(e) || ts.isParenthesizedExpression(e)) e = e.expression;
        else if (ts.isCallExpression(e)) e = e.arguments.find((a) => ts.isObjectLiteralExpression(a) || ts.isArrayLiteralExpression(a) || ts.isSatisfiesExpression(a) || ts.isAsExpression(a)) ?? e.arguments[1]!;
        else break;
      }
      if (ts.isObjectLiteralExpression(e) || ts.isArrayLiteralExpression(e)) return e;
    }
  }
  throw new Error(`${relRoot(sf.fileName)} 找不到 ${varName} 的物件／陣列`);
}

// ── 規則：物件登記簿 ───────────────────────────────────────────────
function moveRecordEntries(fileRel: string, varName: string, match: (name: string) => boolean, sec: Section, allowSpread = true): number {
  const abs = join(ROOT, fileRel);
  const sf = parse(abs);
  const obj = findContainer(sf, varName) as ts.ObjectLiteralExpression;
  const picked: ts.Node[] = [];
  for (const p of obj.properties) {
    const name = propName(p);
    if (name !== null ? match(name) : allowSpread && ts.isSpreadAssignment(p) && spreadIsCountry(sf, p.expression)) picked.push(p);
  }
  if (picked.length === 0) return 0;
  for (const p of picked) {
    const [s, e] = spanOf(p, sf);
    sec.body.push(entryText(p, sf));
    pushEdit(abs, { start: s, end: e, text: "" });
  }
  carryDependencies(sf, picked, sec);
  log.push(`${fileRel} ${varName}：搬 ${picked.length} 筆`);
  return picked.length;
}

// ── 規則：有序陣列（插槽） ─────────────────────────────────────────
function existingSlotNumbers(sf: ts.SourceFile, marker: string): number[] {
  const out: number[] = [];
  for (const m of sf.text.matchAll(new RegExp(`${marker}\\("${CC}", (\\d+)\\)`, "g"))) out.push(Number(m[1]));
  return out;
}

interface ListOptions {
  /** 插槽標記函式名（預設 countrySlot；overlay 用 overlaySlot，型別上是 OverlayConfig） */
  marker?: string;
  /** 也掃巢狀的 `...[ … ]` 陣列與 `<varName>.push(…)` 的引數（overlayRegistry 的條目散在這些地方） */
  nested?: boolean;
  /** 符合但留在中央的條目（例：由 jpHeightLifecycle 管的 overlay 樣板） */
  keep?: (el: ts.Expression) => boolean;
  /** false＝展開元素（...X）一律不搬 */
  spreads?: boolean;
}

function unwrapExpr(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e)) e = e.expression;
  return e;
}

/** 有序陣列的「條目清單」：主陣列，加上（nested 時）巢狀展開陣列與 push 呼叫的引數 */
function elementLists(sf: ts.SourceFile, arr: ts.ArrayLiteralExpression, varName: string, nested: boolean): ts.NodeArray<ts.Expression>[] {
  const out: ts.NodeArray<ts.Expression>[] = [arr.elements];
  if (!nested) return out;
  const unwrap = unwrapExpr;
  const addNested = (els: ts.NodeArray<ts.Expression>) => {
    for (const el of els) {
      if (!ts.isSpreadElement(el)) continue;
      const inner = unwrap(el.expression);
      if (ts.isArrayLiteralExpression(inner)) { out.push(inner.elements); addNested(inner.elements); }
    }
  };
  addNested(arr.elements);
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "push"
      && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === varName) {
      out.push(n.arguments);
      addNested(n.arguments);
    }
    n.forEachChild(visit);
  };
  for (const st of sf.statements) if (ts.isExpressionStatement(st)) visit(st);
  return out;
}

function moveListEntries(fileRel: string, varName: string, match: (el: ts.Expression, sf: ts.SourceFile) => boolean, sec: Section, opts: ListOptions = {}): number {
  const abs = join(ROOT, fileRel);
  const sf = parse(abs);
  const arr = findContainer(sf, varName) as ts.ArrayLiteralExpression;
  const marker = opts.marker ?? "countrySlot";
  let next = Math.max(0, ...existingSlotNumbers(sf, marker)) + 1;
  const picked: ts.Node[] = [];
  let run: ts.Expression[] = [];
  const flush = () => {
    if (!run.length) return;
    const n = next++;
    const first = run[0]!;
    const [s0] = spanOf(first, sf);
    const [, e1] = spanOf(run[run.length - 1]!, sf);
    const indent = sf.text.slice(sf.text.lastIndexOf("\n", first.getStart(sf)) + 1, first.getStart(sf)).match(/^\s*/)![0];
    const texts = run.map((el) => entryText(el, sf));
    sec.slotBodies.set(n, texts);
    pushEdit(abs, { start: s0, end: e1, text: `${indent}${marker}("${CC}", ${n}), // ${cfg!.nameZh}國家包（src/countries/${cfg!.dir}/）\n` });
    picked.push(...run);
    run = [];
  };
  for (const list of elementLists(sf, arr, varName, !!opts.nested)) {
    for (const el of list) {
      const inner = ts.isSpreadElement(el) ? el.expression : null;
      const nestedArray = inner && opts.nested && ts.isArrayLiteralExpression(unwrapExpr(inner));
      const hit = !opts.keep?.(el) && (inner ? !nestedArray && opts.spreads !== false && spreadIsCountry(sf, inner) : match(el, sf));
      if (hit) run.push(el);
      else if (!ts.isOmittedExpression(el)) flush();
    }
    flush();
  }
  if (picked.length === 0) return 0;
  carryDependencies(sf, picked, sec);
  if (!sf.text.includes("countrySlot")) {
    // 加 import（slottedList 已 import 的話併進去）
    const t = sf.text;
    const m = t.match(/import \{ slottedList \} from "([^"]+)";/);
    if (!m) throw new Error(`${fileRel} 沒有 import slottedList`);
    pushEdit(abs, { start: m.index!, end: m.index! + m[0].length, text: `import { countrySlot, slottedList } from "${m[1]}";` });
  }
  log.push(`${fileRel} ${varName}：搬 ${picked.length} 筆（插槽 ${sec.slotBodies.size} 個）`);
  return picked.length;
}

function objField(el: ts.Expression, field: string): ts.Expression | undefined {
  el = unwrapExpr(el); // `{ … } satisfies OverlayConfig`
  if (!ts.isObjectLiteralExpression(el)) return undefined;
  for (const p of el.properties) if (ts.isPropertyAssignment(p) && propName(p) === field) return p.initializer;
  return undefined;
}
const strOf = (e: ts.Expression | undefined) => (e && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) ? e.text : null);

// ── 2. moveNamed ───────────────────────────────────────────────────
/** moveNamed 搬走的名稱：`<原檔絕對路徑>#<名稱>` → 新檔絕對路徑（各段落的 import 由原檔改指向新檔） */
const NAMED_MOVES = new Map<string, string>();
function moveNamed(): void {
  for (const mv of cfg!.moveNamed ?? []) {
    const abs = join(ROOT, mv.file);
    for (const n of mv.names) NAMED_MOVES.set(`${abs}#${n}`, join(PACK_ABS, mv.to));
    const sf = parse(abs);
    const decls = topDecls(sf);
    // 重跑：已搬走的名稱略過（目標檔已有就算搬過）；兩邊都沒有才是設定錯
    const toText = existsSync(join(PACK_ABS, mv.to)) ? readFileSync(join(PACK_ABS, mv.to), "utf8") : "";
    const names = mv.names.filter((n) => {
      if (decls.get(n)) return true;
      if (new RegExp(`\\b(function|const|class)\\s+${n}\\b`).test(toText)) return false;
      throw new Error(`${mv.file} 沒有 ${n}`);
    });
    if (!names.length) continue;
    const nodes = names.map((n) => decls.get(n)!);
    const toFile = join(PACK_ABS, mv.to);
    const sec = section(mv.to, "", "record", "", []);
    for (const d of nodes) {
      const [s, e] = spanOf(d, sf);
      sec.decls.push(sf.text.slice(s, e));
      pushEdit(abs, { start: s, end: e, text: "" });
    }
    carryDependencies(sf, nodes, sec);
    // 改寫 importer：從共用檔 import 這些名稱的，改從新檔
    for (const file of CODE_FILES()) {
      if (file === abs) continue;
      const fsf = parse(file);
      for (const st of fsf.statements) {
        if (!ts.isImportDeclaration(st) || !st.importClause?.namedBindings || !ts.isNamedImports(st.importClause.namedBindings)) continue;
        if (resolveSpec(file, (st.moduleSpecifier as ts.StringLiteral).text) !== abs) continue;
        const els = st.importClause.namedBindings.elements;
        const moved = els.filter((el) => mv.names.includes((el.propertyName ?? el.name).text));
        if (!moved.length) continue;
        const kept = els.filter((el) => !moved.includes(el));
        const q = (st.moduleSpecifier as ts.StringLiteral).getText(fsf)[0];
        const newImp = `import { ${moved.map((el) => el.getText(fsf)).join(", ")} } from ${q}${specFrom(file, toFile)}${q};`;
        const oldImp = kept.length ? `import { ${kept.map((el) => el.getText(fsf)).join(", ")} } from ${(st.moduleSpecifier as ts.StringLiteral).getText(fsf)};\n` : "";
        pushEdit(file, { start: st.getStart(fsf), end: st.getEnd(), text: `${oldImp}${newImp}` });
      }
    }
    log.push(`moveNamed ${mv.file}：${mv.names.length} 個 → ${PACK_DIR}/${mv.to}`);
  }
}

// ── 產生 import 敘述 ───────────────────────────────────────────────
function renderImports(targetAbs: string, imps: Iterable<ImportBinding & { fromAbs: string }>, extra: string[] = []): string {
  const extraNames = new Set(extra.flatMap((l) => (l.match(/\{([^}]*)\}/)?.[1] ?? "").split(",").map((x) => x.replace(/^\s*type\s+/, "").trim()).filter(Boolean)));
  const byTarget = new Map<string, { named: Map<string, string>; def?: string; ns?: string }>();
  for (let i of imps) {
    if (extraNames.has(i.local)) continue;
    const movedTo = i.target && i.kind === "named" ? NAMED_MOVES.get(`${i.target}#${i.imported}`) : undefined;
    if (movedTo) i = { ...i, target: movedTo };
    const key = i.target ? specFrom(targetAbs, i.target) : i.spec;
    if (i.target && i.target === targetAbs) continue;
    const g = byTarget.get(key) ?? { named: new Map() };
    if (i.kind === "default") g.def = i.local;
    else if (i.kind === "namespace") g.ns = i.local;
    else {
      const t = i.imported === i.local ? i.local : `${i.imported} as ${i.local}`;
      const prev = g.named.get(t);
      g.named.set(t, prev === "value" || !i.typeOnly ? "value" : "type");
    }
    byTarget.set(key, g);
  }
  const lines = [...extra];
  for (const [spec, g] of [...byTarget].sort(([a], [b]) => a.localeCompare(b))) {
    if (g.ns) lines.push(`import * as ${g.ns} from "${spec}";`);
    const named = [...g.named].sort(([a], [b]) => a.localeCompare(b)).map(([n, k]) => (k === "type" ? `type ${n}` : n));
    if (g.def || named.length) lines.push(`import ${[g.def, named.length ? `{ ${named.join(", ")} }` : ""].filter(Boolean).join(", ")} from "${spec}";`);
  }
  return lines.join("\n");
}

// ── 寫檔 ───────────────────────────────────────────────────────────
const HEADER = (what: string) => `// ${cfg!.nameZh}國家包：${what}（B1 P5a；由 scripts/layers/move-country-pack.ts 從中央登記簿搬來，之後就在這裡維護）。\n// ⚠️ 只能經 src/countries/packs.ts 的 ensureCountryPack 動態載入，不可從國家目錄以外靜態 import（lint 擋）。\n`;

function writeSection(sec: Section): void {
  const abs = join(PACK_ABS, sec.file);
  const existing = existsSync(abs) ? readFileSync(abs, "utf8") : null;
  if (!sec.exportName) {
    // moveNamed：純宣告檔（具名匯出），已存在就接在後面
    const imports = renderImports(abs, sec.imports.values());
    const body = sec.decls.join("\n");
    const text = existing ? mergeImports(existing, imports) + "\n" + body : `${HEADER("從共用檔搬來的國家專屬元件")}${imports}\n\n${body}`;
    writeFileSync(abs, text);
    return;
  }
  const imports = renderImports(abs, sec.imports.values(), sec.typeImports);
  if (existing) {
    // 重跑：接在既有物件尾端（以 `// <codemod:append ${exportName}>` 標記定位）
    const marker = `// <codemod:append ${sec.exportName}>`;
    const i = existing.indexOf(marker);
    if (i < 0) throw new Error(`${relRoot(abs)} 找不到 ${marker}`);
    let add = "";
    if (sec.kind === "record") add = sec.body.map((b) => b.replace(/^\n+/, "")).join("");
    else for (const [n, texts] of sec.slotBodies) add += `  ${n}: [\n${texts.join("")}  ],\n`;
    let text = existing.slice(0, i) + add + existing.slice(i);
    text = mergeImports(text, imports);
    if (sec.decls.length) text = text.replace(/\n(export const )/, `\n${sec.decls.join("\n")}\n$1`);
    writeFileSync(abs, text);
    return;
  }
  const decls = sec.decls.length ? `\n${sec.decls.join("\n")}\n` : "";
  let body: string;
  if (sec.kind === "record") {
    body = `export const ${sec.exportName} = {\n${sec.body.map((b) => b.replace(/^\n+/, "")).join("")}  // <codemod:append ${sec.exportName}>\n} ${sec.typeText};\n`;
  } else {
    let slots = "";
    for (const [n, texts] of [...sec.slotBodies].sort(([a], [b]) => a - b)) slots += `  ${n}: [\n${texts.join("")}  ],\n`;
    body = `/** 插槽序號 → 條目；序號對應中央陣列裡的 countrySlot("${CC}", n)。 */\nexport const ${sec.exportName}: ${sec.typeText} = {\n${slots}  // <codemod:append ${sec.exportName}>\n};\n`;
  }
  writeFileSync(abs, `${HEADER(sec.file)}${imports}\n${decls}\n${body}`);
}

function mergeImports(text: string, imports: string): string {
  const have = new Set(text.split("\n").filter((l) => l.startsWith("import ")));
  const add = imports.split("\n").filter((l) => l && !have.has(l));
  if (!add.length) return text;
  const lines = text.split("\n");
  let last = -1;
  lines.forEach((l, i) => { if (l.startsWith("import ")) last = i; });
  lines.splice(last + 1, 0, ...add);
  return lines.join("\n");
}

/** 套用來源檔編輯，加 export，刪掉沒人用的 import */
function flushSourceEdits(): void {
  const files = new Set([...fileEdits.keys(), ...toExport.keys()]);
  for (const abs of files) {
    let text = readFileSync(abs, "utf8");
    const edits = [...(fileEdits.get(abs) ?? [])];
    const exp = toExport.get(abs);
    if (exp) {
      const sf = parse(abs);
      const decls = topDecls(sf);
      for (const name of exp) {
        const d = decls.get(name)!;
        if (!hasExportKeyword(d)) edits.push({ start: d.getStart(sf), end: d.getStart(sf), text: "export " });
      }
    }
    text = applyEdits(text, edits);
    writeFileSync(abs, pruneImports(abs, text));
  }
}

function pruneImports(abs: string, text: string): string {
  const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.Latest, true, abs.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const used = new Set<string>();
  const visit = (n: ts.Node) => {
    if (ts.isImportDeclaration(n)) return;
    if (ts.isIdentifier(n) && isRefIdentifier(n)) used.add(n.text);
    if (ts.isShorthandPropertyAssignment(n)) used.add(n.name.text);
    n.forEachChild(visit);
  };
  visit(sf);
  const edits: Edit[] = [];
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue;
    const c = st.importClause;
    const keepDef = c.name && used.has(c.name.text) ? c.name.getText(sf) : null;
    let named: string[] | null = null;
    let ns: string | null = null;
    if (c.namedBindings && ts.isNamedImports(c.namedBindings)) {
      const all = c.namedBindings.elements;
      const kept = all.filter((el) => used.has(el.name.text));
      if (kept.length === all.length && (!c.name || keepDef)) continue;
      named = kept.map((el) => el.getText(sf));
    } else if (c.namedBindings && ts.isNamespaceImport(c.namedBindings)) {
      if (used.has(c.namedBindings.name.text)) continue;
      ns = null;
    } else if (keepDef) continue;
    const [s, e] = spanOf(st, sf);
    const spec = (st.moduleSpecifier as ts.StringLiteral).getText(sf);
    const parts = [keepDef, named && named.length ? `{ ${named.join(", ")} }` : null, ns].filter(Boolean);
    const lead = sf.text.slice(s, st.getStart(sf));
    edits.push({ start: s, end: e, text: parts.length ? `${lead}import ${c.isTypeOnly ? "type " : ""}${parts.join(", ")} from ${spec};\n` : "" });
  }
  return applyEdits(text, edits);
}

// ── 主流程 ─────────────────────────────────────────────────────────
const moves = moveDedicatedFiles();
if (DRY) {
  console.log("（--dry：其餘步驟略）");
  process.exit(0);
}
void moves;
moveNamed();

const Cc = CC.charAt(0) + CC.slice(1).toLowerCase();
const KEY_T = cfg.keyType;
const allMoved = ALL_KEYS.every((k) => KEYS.has(k));
const keyTypeImport = `import type { ${KEY_T} } from "./keys";`;
const popupTypeImport = `import type { ${Cc}PopupType } from "./popupTypes";`;
const inKeys = (n: string) => KEYS.has(n);
const inPopups = (n: string) => POPUPS.has(n);

// manifest 要完整：這國沒搬的 key（例：英國統計層仍在中央登記）明列排除，其餘一個都不能少
const UNMOVED_KEYS = ALL_KEYS.filter((k) => !KEYS.has(k));
const MANIFEST_KEY_T = allMoved ? KEY_T : `Exclude<${KEY_T}, ${UNMOVED_KEYS.map((k) => `"${k}"`).join(" | ")}>`;
const MANIFEST_TYPE_TEXT = `satisfies Record<${MANIFEST_KEY_T}, LayerManifestEntry>`;
const sManifest = section("manifest.ts", `${CC}_PACK_MANIFEST`, "record", MANIFEST_TYPE_TEXT,
  [keyTypeImport, 'import type { LayerManifestEntry } from "../../data/layerManifest";']);
moveRecordEntries("src/data/layerManifest.ts", "STATIC_LAYER_MANIFEST", inKeys, sManifest);
const sParams = section("params.ts", `${CC}_PACK_PARAMS`, "record", `satisfies Partial<Record<${KEY_T}, LayerParamSpec[]>>`,
  [keyTypeImport, 'import type { LayerParamSpec } from "../../data/layerParamsSpec";']);
moveRecordEntries("src/data/layerParamsSpec.ts", "STATIC_LAYER_PARAMS_SPEC", inKeys, sParams);
const sSource = section("sourceInfo.ts", `${CC}_PACK_SOURCE_INFO`, "record", `satisfies Partial<Record<${KEY_T}, LayerSourceInfo>>`,
  [keyTypeImport, 'import type { LayerSourceInfo } from "../../data/layerSourceInfo";']);
moveRecordEntries("src/data/layerSourceInfo.data.ts", "LAYER_SOURCE_INFO_DATA", inKeys, sSource);
const sNotes = section("notes.ts", `${CC}_PACK_NOTES`, "record", `satisfies Partial<Record<${KEY_T}, SourceText[]>>`,
  [keyTypeImport, 'import type { SourceText } from "../../data/layerSourceInfo";']);
moveRecordEntries("src/data/layerSourceInfo.data.ts", "LAYER_NOTES_DATA", inKeys, sNotes, false);
const sPanels = section("panels.tsx", `${CC}_PACK_PANELS`, "record", `satisfies Partial<Record<${Cc}PopupType, FC<PanelProps>>>`,
  [popupTypeImport, 'import type { FC } from "react";', 'import type { PanelProps } from "../../components/featureInfo/registry";']);
moveRecordEntries("src/components/featureInfo/registry.tsx", "PANEL_REGISTRY", inPopups, sPanels);
const sLabels = section("headerLabels.ts", `${CC}_PACK_HEADER_LABELS`, "record", `satisfies Record<${Cc}PopupType, string>`, [popupTypeImport]);
moveRecordEntries("src/components/featureInfo/registry.tsx", "HEADER_LABELS", inPopups, sLabels);
const sHosts = section("hosts.tsx", `${CC}_PACK_HOST_SLOTS`, "slots", "Readonly<Record<number, readonly LayerHookEntry[]>>",
  ['import type { LayerHookEntry } from "../../layers/layerHookRegistry";']);
moveListEntries("src/layers/layerHookRegistry.tsx", "LAYER_HOOK_REGISTRY", (el, sf) => {
  const keys = objField(el, "keys");
  if (!keys || !ts.isArrayLiteralExpression(keys) || keys.elements.length === 0) return false;
  return keys.elements.every((k) => { const s = strOf(k as ts.Expression); return s !== null && KEYS.has(s); }) && !!sf;
}, sHosts);
const sClicks = section("clicks.ts", `${CC}_PACK_CLICK_SLOTS`, "slots", "Readonly<Record<number, readonly GisLayerEntry[]>>",
  ['import type { GisLayerEntry } from "../../map/gisClickRegistry";']);
moveListEntries("src/map/gisClickRegistry.ts", "GIS_LAYERS", (el) => { const t = strOf(objField(el, "type")); return t !== null && POPUPS.has(t); }, sClicks);
const sLegends = section("legends.tsx", `${CC}_PACK_LEGEND_SLOTS`, "slots", "Readonly<Record<number, readonly LegendEntry[]>>",
  ['import type { LegendEntry } from "../../components/LegendPanel";']);
moveListEntries("src/components/LegendPanel.tsx", "LEGEND_REGISTRY", (el) => { const id = strOf(objField(el, "id")); return id !== null && LEGENDS.has(id); }, sLegends);
const sOverlays = section("overlays.ts", `${CC}_PACK_OVERLAY_SLOTS`, "slots", "Readonly<Record<number, readonly OverlayConfig[]>>",
  ['import type { OverlayConfig } from "../../types";']);
const keepOverlay = (el: ts.Expression) => { const id = strOf(objField(el, "id")); return id !== null && !!cfg.keepOverlays?.includes(id); };
moveListEntries("src/map/overlayRegistry.ts", "OVERLAY_REGISTRY", (el) => { const id = strOf(objField(el, "id")); return id !== null && KEYS.has(id); }, sOverlays,
  // overlay 的展開（...G36_SAFETY_OVERLAYS 等）多半混了台灣圖層：不整包搬，留在中央
  { marker: "overlaySlot", nested: true, keep: keepOverlay, spreads: false });

const nonEmpty = [...sections.values()].filter((s) => s.exportName && (s.body.length || s.slotBodies.size));
if (nonEmpty.length === 0 && moves.size === 0 && !(cfg.moveNamed?.length)) {
  console.log("中央登記簿已沒有這國的條目：no-op");
  process.exit(0);
}
flushSourceEdits();
for (const s of sections.values()) if (s.exportName === "" || s.body.length || s.slotBodies.size) writeSection(s);

// ── 5. keys.ts／popupTypes.ts／specNotes.ts／styleIds.ts／pack.ts／packKeys.ts ──────
if (cfg.styleIds && !existsSync(join(PACK_ABS, "styleIds.ts"))) {
  mkdirSync(PACK_ABS, { recursive: true });
  writeFileSync(join(PACK_ABS, "styleIds.ts"), `${HEADER("規格層自建的 style layer id（視野提示卡判斷「看不到」用，map/layerVisibilityHint）")}import { ${cfg.styleIds.specsName} } from "${cfg.styleIds.specsImport}";

export const ${CC}_PACK_STYLE_IDS: Record<string, readonly string[]> = Object.fromEntries(
  ${cfg.styleIds.specsName}.map((spec) => [spec.key, [spec.layerId]] as const),
);
`);
  log.push(`產生 ${PACK_DIR}/styleIds.ts（設定 styleIds）`);
}
mkdirSync(PACK_ABS, { recursive: true });
const keysAbs = join(PACK_ABS, "keys.ts");
if (!existsSync(keysAbs)) {
  const constName = `${CC}_LAYER_KEYS`;
  writeFileSync(keysAbs, `/**
 * ${cfg.nameZh}圖層 key（B1 P5a）。國家目錄裡**唯一**可以從外面靜態 import 的檔（只有 key 字串，開站成本可忽略）：
 * 型別給 LayerVisibility、packKeys 用；執行期清單給需要「這國有哪些圖層」又不想載入整包的地方。
 * 新增這國的圖層時在這裡加 key（types/index.ts 的 LayerVisibility 由這個型別展開）。
 */
export const ${constName} = [
${ALL_KEYS.map((k) => `  "${k}",`).join("\n")}
] as const;
export type ${KEY_T} = (typeof ${constName})[number];
`);
  log.push(`產生 ${PACK_DIR}/keys.ts（${ALL_KEYS.length} 個 key）`);
} else if (!new RegExp(`export type ${KEY_T}\\b`).test(readFileSync(keysAbs, "utf8"))) {
  // 既有 key 檔（例：xxDataKeys.ts 改名成 keys.ts）只列了規格層：補上這國全部圖層的 key 與型別
  const constName = `${CC}_LAYER_KEYS`;
  writeFileSync(keysAbs, `${readFileSync(keysAbs, "utf8").trimEnd()}

/** ${cfg.nameZh}全部圖層 key（B1 P5；索引裡這國的 key）。型別給 LayerVisibility、packKeys 用。 */
export const ${constName} = [
${ALL_KEYS.map((k) => `  "${k}",`).join("\n")}
] as const;
export type ${KEY_T} = (typeof ${constName})[number];
`);
  log.push(`${PACK_DIR}/keys.ts 補上 ${KEY_T}（${ALL_KEYS.length} 個 key）`);
}
writeFileSync(join(PACK_ABS, "popupTypes.ts"), `// ⚠️ 自動產生（move-country-pack.ts，依索引的 popup 欄位）：這國搬進國家包的 popup 類型，HEADER_LABELS 的完整性型別用。
export type ${Cc}PopupType =
${[...POPUPS].sort().map((p) => `  | "${p}"`).join("\n")};
`);
if (cfg.specNotes) {
  const p = join(PACK_ABS, "specNotes.ts");
  if (!existsSync(p)) {
    const fn = cfg.specNotes.all ? "specLayerNotesAll" : "specLayerNotes";
    writeFileSync(p, `${HEADER("規格層 popupNotes 的固定備註（圖層側說明）")}import { ${fn} } from "../../data/layerSourceInfo";
import type { SourceText } from "../../data/layerSourceInfo";
import { ${cfg.specNotes.specsName} } from "${cfg.specNotes.specsImport}";

export const ${CC}_PACK_SPEC_NOTES: Record<string, SourceText[]> = Object.fromEntries(
  ${cfg.specNotes.specsName}.map((spec) => [spec.key, ${fn}(spec)] as const).filter(([, notes]) => notes.length > 0),
);
`);
    log.push(`產生 ${PACK_DIR}/specNotes.ts（設定 specNotes）`);
  }
  // layerSourceInfo.ts 的中央 SPEC_NOTES 拿掉這國的規格（改由國家包登記），沒人用的 import 一起刪
  const lsAbs = join(ROOT, "src/data/layerSourceInfo.ts");
  let ls = readFileSync(lsAbs, "utf8");
  const name = cfg.specNotes.specsName;
  const before = ls;
  ls = ls.replace(new RegExp(`\\.\\.\\.${name}, |, \\.\\.\\.${name}\\b|\\.\\.\\.${name}\\b`), "");
  ls = ls.replace(/^\s*for \(const spec of \[\]\) [^\n]*\n/m, "");
  // 兩個迴圈都清空了：整個區塊（只剩沒人用的 add）一起刪
  ls = ls.replace(/\{\n  const add = \(key: string, notes: SourceText\[\]\) => \{[^\n]*\};\n\}\n/, "");
  if (!new RegExp(`\\b${name}\\b`).test(ls.replace(new RegExp(`^import \\{ ${name} \\} from "[^"]+";\\n`, "m"), ""))) {
    ls = ls.replace(new RegExp(`^import \\{ ${name} \\} from "[^"]+";\\n`, "m"), "");
  }
  if (ls !== before) { writeFileSync(lsAbs, ls); log.push(`layerSourceInfo.ts 中央 SPEC_NOTES 拿掉 ${name}`); }
}
// pack.ts：依實際存在的區段檔接線
const REC: Array<[string, string, string]> = [
  ["layerManifest", "manifest", `${CC}_PACK_MANIFEST`], ["layerParamsSpec", "params", `${CC}_PACK_PARAMS`],
  ["layerSourceInfo", "sourceInfo", `${CC}_PACK_SOURCE_INFO`], ["layerNotes", "notes", `${CC}_PACK_NOTES`],
  ["layerSpecNotes", "specNotes", `${CC}_PACK_SPEC_NOTES`], ["featurePanels", "panels", `${CC}_PACK_PANELS`],
  ["featureHeaderLabels", "headerLabels", `${CC}_PACK_HEADER_LABELS`],
  ["layerStyleIds", "styleIds", `${CC}_PACK_STYLE_IDS`],
];
const LIST: Array<[string, string, string]> = [
  ["legends", "legends", `${CC}_PACK_LEGEND_SLOTS`], ["gisClickLayers", "clicks", `${CC}_PACK_CLICK_SLOTS`],
  ["overlays", "overlays", `${CC}_PACK_OVERLAY_SLOTS`], ["layerHosts", "hosts", `${CC}_PACK_HOST_SLOTS`],
];
const exists = (f: string) => existsSync(join(PACK_ABS, `${f}.ts`)) || existsSync(join(PACK_ABS, `${f}.tsx`));
const recs = REC.filter(([, f]) => exists(f));
const lists = LIST.filter(([, f]) => exists(f));
writeFileSync(join(PACK_ABS, "pack.ts"), `// ⚠️ 自動產生（move-country-pack.ts）：${cfg.nameZh}國家包的進入點，只由 src/countries/packs.ts 動態 import。
import type { CountryPack } from "../types";
${[...recs, ...lists].map(([, f, n]) => `import { ${n} } from "./${f}";`).join("\n")}

const pack: CountryPack = {
  country: "${CC}",
  records: {
${recs.map(([r, , n]) => `    ${r}: ${n},`).join("\n")}
  },
  slots: {
${lists.map(([r, , n]) => `    ${r}: ${n},`).join("\n")}
  },
};

export default pack;
`);
// manifest.ts 已存在（重跑）：型別尾巴跟著目前的「沒搬的 key」更新
{
  const mf = join(PACK_ABS, "manifest.ts");
  if (existsSync(mf)) {
    const text = readFileSync(mf, "utf8");
    const next = text.replace(/\} satisfies [^\n]*Record<[^\n]*LayerManifestEntry>+;\s*$/, `} ${MANIFEST_TYPE_TEXT};\n`);
    if (next !== text) { writeFileSync(mf, next); log.push(`${PACK_DIR}/manifest.ts 型別尾巴更新`); }
  }
}
// packKeys.ts
const pk = join(ROOT, "src/countries/packKeys.ts");
let pkText = readFileSync(pk, "utf8");
if (!pkText.includes(`from "./${cfg.dir}/keys"`)) {
  pkText = pkText.replace(/(\nexport type PackLayerKey =)/, `\nimport type { ${KEY_T} } from "./${cfg.dir}/keys";$1`).replace(/(export type PackLayerKey =[^;]*);/, `$1\n  | ${KEY_T};`);
}
if (!pkText.includes(`from "./${cfg.dir}/popupTypes"`)) {
  pkText = pkText.replace(/(\nexport type PackPopupType =)/, `\nimport type { ${Cc}PopupType } from "./${cfg.dir}/popupTypes";$1`).replace(/(export type PackPopupType =[^;]*);/, `$1\n  | ${Cc}PopupType;`);
}
writeFileSync(pk, pkText);
// types/index.ts：LayerVisibility 改由這國的 key 型別展開（extends Record<…>），刪掉介面內這國 key 的逐行宣告
{
  const typesAbs = join(ROOT, "src/types/index.ts");
  let t = readFileSync(typesAbs, "utf8");
  const head = "export interface LayerVisibility extends Record<";
  const start = t.indexOf(head);
  if (start < 0) throw new Error("types/index.ts 找不到 LayerVisibility 介面");
  const end = t.indexOf("\n}\n", start);
  const extendsEnd = t.indexOf(", boolean>", start);
  let body = t.slice(start, end);
  if (!t.slice(start, extendsEnd).includes(`| ${KEY_T}`) && !t.slice(start, extendsEnd).includes(`<${KEY_T}`)) {
    body = body.replace(", boolean>", ` | ${KEY_T}, boolean>`);
  }
  const keySet = new Set<string>(ALL_KEYS);
  let removed = 0;
  body = body.split("\n").filter((line) => {
    const m = line.match(/^\s+([A-Za-z0-9_]+)\??: boolean;/);
    if (m && keySet.has(m[1])) { removed++; return false; }
    return true;
  }).join("\n");
  t = t.slice(0, start) + body + t.slice(end);
  const imp = `import type { ${KEY_T} } from "../countries/${cfg.dir}/keys";\n`;
  if (!t.includes(imp)) t = imp + t;
  writeFileSync(typesAbs, t);
  if (removed) log.push(`types/index.ts LayerVisibility：改由 ${KEY_T} 展開，刪 ${removed} 行逐行宣告`);
}
// packs.ts：登記動態 import
const packsAbs = join(ROOT, "src/countries/packs.ts");
const packsText = readFileSync(packsAbs, "utf8");
if (!packsText.includes(`import("./${cfg.dir}/pack")`)) {
  writeFileSync(packsAbs, packsText.replace("  // <codemod:pack-loaders>", `  ${CC}: () => import("./${cfg.dir}/pack"),\n  // <codemod:pack-loaders>`));
}

console.log(log.map((l) => `• ${l}`).join("\n"));
console.log(`完成。接著：npx tsc -b；npx vite-node scripts/layers/gen-layer-index.ts；npx vite-node scripts/preprocess/dump-layer-golden.ts`);
