/**
 * Shadow POC is opt-in even in development.  Do not turn this into a DEV default:
 * a missing RPC or shadow data must never affect the production Monitor route.
 */
export function isNewsLocationEvidencePocEnabled(
  env: Record<string, unknown> = import.meta.env ?? {},
): boolean {
  return env.VITE_NEWS_LOCATION_EVIDENCE_POC === "true";
}

/** Kept pure so the no-mount/no-request gate can be tested without rendering Monitor. */
export function shouldMountNewsLocationEvidencePoc(open: boolean, enabled: boolean): boolean {
  return open && enabled;
}
