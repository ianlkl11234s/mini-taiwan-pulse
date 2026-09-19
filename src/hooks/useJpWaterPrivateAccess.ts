import { useEffect, useState, useSyncExternalStore } from "react";
import { JP_WATER_PRIVATE_ENDPOINTS, type JpWaterLocalArchive } from "../data/jpWaterTypes";
import { getJpWaterRuntime, reportJpWaterError, subscribeJpWaterRuntime } from "../data/jpWaterLoader";
import { withLoading } from "../lib/loadingRegistry";
import { useUser } from "../lib/auth";
import { supabase } from "../lib/supabase";

export const JP_WATER_ACCESS_DENIED_EVENT = "jp-water-access-denied";

/** UI convenience only; the private endpoint verifies the exact account on every request. */
export function useJpWaterPrivateAccess() {
  const { user, loading } = useUser();
  const runtime = useSyncExternalStore(subscribeJpWaterRuntime, getJpWaterRuntime, getJpWaterRuntime);
  const [verifiedId, setVerifiedId] = useState<string | null>(null);
  const [authGeneration, setAuthGeneration] = useState(0);

  useEffect(() => {
    const revoke = () => setVerifiedId(null);
    window.addEventListener(JP_WATER_ACCESS_DENIED_EVENT, revoke);
    return () => window.removeEventListener(JP_WATER_ACCESS_DENIED_EVENT, revoke);
  }, []);
  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" && verifiedId === null) setAuthGeneration((generation) => generation + 1);
    });
    return () => subscription.subscription.unsubscribe();
  }, [verifiedId]);
  useEffect(() => {
    setVerifiedId(null);
    if (!user) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    void withLoading("jp-water:private-access", "驗證日本水資源私人圖層存取權", (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session || data.session.user.id !== user.id) return;
        const accessToken = data.session.access_token;
        const probe = async (archive: JpWaterLocalArchive) => {
          const response = await fetch(`${JP_WATER_PRIVATE_ENDPOINTS[archive]}?access=1`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store",
            signal: controller.signal,
          });
          if (response.status === 401 || response.status === 403) {
            // Expected for every signed-in non-owner. Keep the catalog locked
            // without surfacing a global failure for a layer they never opened.
            return false;
          }
          if (!response.ok) throw new Error(`日本水資源私人服務尚未就緒（HTTP ${response.status}）`);
          const access = await response.json() as { allowed?: unknown };
          return access.allowed === true;
        };
        const allowed = await Promise.all((["water", "extra-water"] as const).map(probe));
        if (!controller.signal.aborted && allowed.every(Boolean)) setVerifiedId(user.id);
      } catch (error) {
        if (!controller.signal.aborted) reportJpWaterError(error);
      } finally {
        clearTimeout(timeout);
      }
    })());
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [user?.id, authGeneration, runtime.revision]);
  return { allowed: !loading && !!user && verifiedId === user.id, userId: user?.id ?? null };
}

/** Called by every authenticated PMTiles Range request, never cached in the source. */
export async function jpWaterPrivateAccessToken(expectedUserId: string): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== expectedUserId) throw new Error("Japan water access denied");
  return data.session.access_token;
}
