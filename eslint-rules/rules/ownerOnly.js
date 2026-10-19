// 站主限定（owner-only／private）圖層的資安守門。套用範圍在 eslint.config.js 的 OWNER_ONLY_*，
// 由 eslint-rules/__tests__/ownerOnlyScope.test.js 釘住（新 owner-only 檔沒被覆蓋會紅）。
// 掃整份原始文字（含註解），與原本 readFileSync＋toMatch 的測試一樣嚴格或更嚴。

const URL_RE = /https?:\/\//g;
const IMPORT_META_RE = /\bimport\s*\.\s*meta\b/g;

// 從網址起點讀到空白、引號、反引號或檔尾為止的整段 token；allowUrls 要與整段字串相等才放行
// （`${...}` 插值不是結尾，所以 `https://ok/${x}` 這種接插值的寫法不等於清單內網址，照樣紅）。
function urlToken(text, start) {
  const m = /[\s"'`]/.exec(text.slice(start));
  return m ? text.slice(start, start + m.index) : text.slice(start);
}

function reportAll(context, re, messageId, skip = () => false) {
  const { sourceCode } = context;
  const text = sourceCode.text;
  for (const m of text.matchAll(re)) {
    if (skip(m.index, m[0].length)) continue;
    context.report({
      loc: { start: sourceCode.getLocFromIndex(m.index), end: sourceCode.getLocFromIndex(m.index + m[0].length) },
      messageId,
    });
  }
}

// 原 src/data/__tests__/bridgeResilienceTypes.test.ts、src/hooks/__tests__/useBssBridgeLayers.test.ts：
// 私人資料只走同源 /api/private-research/* Range API；寫死外部網址或讀 import.meta.env 都可能把資料源指向外部或讓 build 設定改變來源。
export const ownerOnlyNoExternalSource = {
  meta: {
    type: "problem",
    docs: { description: "站主限定圖層的原始碼不寫死 http(s) 網址、不讀 import.meta（含 env）" },
    schema: [
      {
        type: "object",
        properties: {
          allowUrls: { type: "array", items: { type: "string", pattern: "^https?://" } },
          // 只放行明列的 import.meta 成員路徑（如 "env.BASE_URL"，完整比對；其餘成員與裸 import.meta 照樣紅）
          allowImportMeta: { type: "array", items: { type: "string", pattern: "^[A-Za-z_$][\\w$]*(\\.[A-Za-z_$][\\w$]*)*$" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      url: "站主限定圖層不要寫死 http(s) 網址（註解也算），資料只走同源 /api/private-research/* 私人端點；來源卡用的官方連結要逐一列進 eslint.config.js 的 allowUrls（docs/development-rules.md「自訂 ESLint 規則」）",
      importMeta: "站主限定圖層不要讀 import.meta／import.meta.env（註解也算）：私人端點是寫死的同源路徑，不由 build 設定決定（docs/development-rules.md「自訂 ESLint 規則」）",
    },
  },
  create(context) {
    const allowUrls = context.options[0]?.allowUrls ?? [];
    const allowImportMeta = context.options[0]?.allowImportMeta ?? [];
    const text = context.sourceCode.text;
    const metaAllowed = (i, len) => {
      const tail = /^(?:\s*\.\s*[A-Za-z_$][\w$]*)+/.exec(text.slice(i + len));
      return tail !== null && allowImportMeta.includes(tail[0].replace(/\s+/g, "").slice(1));
    };
    return {
      Program() {
        reportAll(context, URL_RE, "url", (i) => allowUrls.includes(urlToken(text, i)));
        reportAll(context, IMPORT_META_RE, "importMeta", metaAllowed);
      },
    };
  },
};

// 原 src/hooks/__tests__/useSoilLiquefactionLayers.test.ts：土壤液化只讀私人 PMTiles，不接官方 WMTS／WMS、不寫死站點。
export const ownerOnlyBannedText = {
  meta: {
    type: "problem",
    docs: { description: "站主限定圖層的原始碼不得出現指定字串（含註解）" },
    schema: [
      {
        type: "object",
        properties: {
          patterns: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: { regex: { type: "string" }, reason: { type: "string" } },
              required: ["regex", "reason"],
              additionalProperties: false,
            },
          },
        },
        required: ["patterns"],
        additionalProperties: false,
      },
    ],
    messages: { banned: "站主限定圖層不得出現「{{text}}」：{{reason}}" },
  },
  create(context) {
    const { sourceCode } = context;
    return {
      Program() {
        for (const { regex, reason } of context.options[0].patterns) {
          for (const m of sourceCode.text.matchAll(new RegExp(regex, "g"))) {
            context.report({
              loc: { start: sourceCode.getLocFromIndex(m.index), end: sourceCode.getLocFromIndex(m.index + m[0].length) },
              messageId: "banned",
              data: { text: m[0], reason },
            });
          }
        }
      },
    };
  },
};
