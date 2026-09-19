# Dynamic candidate budget

Global Events AI candidates use keyset pages of 200 rows, with a maximum of five pages (1,000 rows) per window request. If the RPC reports more data after that budget, the result is `PARTIAL` and retains the exact `after_candidate_id`, loaded page count, and loaded row count for a later continuation. A caller `AbortSignal` bypasses the shared cache and cancels the active Supabase transport; aborted requests never imply an empty or complete result.

Static RPC snapshots are fail-closed: missing, malformed, or unreachable CDN files return explicit errors and never trigger an automatic Supabase fallback. Only concurrent reads of the same snapshot share an in-flight request; settled results are not retained.
