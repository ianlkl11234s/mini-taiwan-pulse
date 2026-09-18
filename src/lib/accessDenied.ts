/**
 * Classify only explicit authorization failures. Transport and Mapbox runtime
 * errors deliberately remain retryable rather than being treated as logout signals.
 */
export function isExplicitAccessDenied(error: unknown): boolean {
  const value = error as { code?: string | number; status?: number; statusCode?: number; message?: string } | null;
  const code = String(value?.code ?? "");
  const status = value?.status ?? value?.statusCode;
  const message = value?.message ?? String(error ?? "");
  return code === "42501" || code === "401" || code === "403"
    || status === 401 || status === 403
    || /\b(?:401|403)\b|access denied|permission denied|unauthoriz(?:ed|ation)|authenticat(?:ion|ed)|authorization/i.test(message);
}
