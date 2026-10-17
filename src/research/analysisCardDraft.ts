/**
 * relay `analysis_card_draft`（mcp `pulse_publish_card`）的參數驗證。
 * 參數：{ draftId, resultId, bytes, expiresAt, gate:{publishable,message}, payload }。
 * payload 以卡片頁同一個 validator 驗（未知版本、禁止欄位、超過上限一律拒收）。
 */
import { validateCardPayload, type CardPayloadV1 } from "../card/cardPayload";

export type AnalysisCardDraft = {
  draftId: string;
  resultId: string;
  bytes: number;
  /** mcp 估算的到期時間（發布時 DB 以 now()+30 天重算，這裡只作預覽提示）。 */
  expiresAt: string | null;
  gate: { publishable: boolean; message: string };
  payload: CardPayloadV1;
};

export type DraftParse = { ok: true; draft: AnalysisCardDraft } | { ok: false; error: string };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export function parseAnalysisCardDraft(args: unknown): DraftParse {
  if (!isObject(args)) return { ok: false, error: "CARD_DRAFT_INVALID" };
  const { draftId, resultId, bytes, expiresAt, gate, payload } = args;
  if (typeof draftId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(draftId)) return { ok: false, error: "CARD_DRAFT_INVALID" };
  if (typeof resultId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(resultId)) return { ok: false, error: "CARD_DRAFT_INVALID" };
  if (typeof bytes !== "number" || !Number.isInteger(bytes) || bytes < 0) return { ok: false, error: "CARD_DRAFT_INVALID" };
  if (!isObject(gate) || typeof gate.publishable !== "boolean" || typeof gate.message !== "string") return { ok: false, error: "CARD_DRAFT_INVALID" };
  const validation = validateCardPayload(payload);
  if (!validation.ok) return { ok: false, error: validation.reason === "UNKNOWN_SCHEMA_VERSION" ? "CARD_SCHEMA_UNSUPPORTED" : "CARD_PAYLOAD_INVALID" };
  return {
    ok: true,
    draft: { draftId, resultId, bytes, expiresAt: typeof expiresAt === "string" && !Number.isNaN(Date.parse(expiresAt)) ? expiresAt : null, gate: { publishable: gate.publishable, message: gate.message.slice(0, 400) }, payload: validation.payload },
  };
}
