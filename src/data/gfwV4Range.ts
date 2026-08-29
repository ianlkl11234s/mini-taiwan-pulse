export interface ByteRange { start: number; end: number; }
/** RFC 7233 single byte range only. Multi-range is deliberately refused for local PMTiles staging. */
export function parseSingleByteRange(header: string | undefined, size: number): ByteRange | null | "invalid" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || !Number.isInteger(size) || size < 1) return "invalid";
  const [, startText, endText] = match;
  if (!startText && !endText) return "invalid";
  if (!startText) { const suffix = Number(endText); return Number.isInteger(suffix) && suffix > 0 ? { start: Math.max(0, size - suffix), end: size - 1 } : "invalid"; }
  const start = Number(startText), end = endText ? Number(endText) : size - 1;
  return Number.isInteger(start) && Number.isInteger(end) && start >= 0 && start <= end && start < size ? { start, end: Math.min(size - 1, end) } : "invalid";
}
