import { useEffect, useState } from "react";
import { BRIDGE_RESILIENCE_ACCESS_DENIED_EVENT, BRIDGE_RESILIENCE_PRIVATE_ENDPOINT } from "../data/bridgeResilienceTypes";
import { withLoading } from "../lib/loadingRegistry";
import { useUser } from "../lib/auth";
import { supabase } from "../lib/supabase";

/**
 * UI convenience only（照 useSoilLiquefactionPrivateAccess）：私人 endpoint 每個 Range 請求都會重新驗證帳號。
 * 非站主的 401／403 是預期結果，靜默鎖住，不當成全域錯誤。
 */
export function useBridgeResiliencePrivateAccess() {
  const { user, loading } = useUser();
  const [verifiedId, setVerifiedId] = useState<string | null>(null);
  const [authGeneration, setAuthGeneration] = useState(0);

  useEffect(() => {
    const revoke = () => setVerifiedId(null);
    window.addEventListener(BRIDGE_RESILIENCE_ACCESS_DENIED_EVENT, revoke);
    return () => window.removeEventListener(BRIDGE_RESILIENCE_ACCESS_DENIED_EVENT, revoke);
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
    void withLoading("bridge-resilience:private-access", "驗證橋梁韌性私人圖層存取權", (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session || data.session.user.id !== user.id) return;
        const response = await fetch(`${BRIDGE_RESILIENCE_PRIVATE_ENDPOINT}/tiles?access=1`, {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401 || response.status === 403) return;
        if (!response.ok) throw new Error(`橋梁韌性私人服務尚未就緒（HTTP ${response.status}）`);
        const access = await response.json() as { allowed?: unknown };
        if (!controller.signal.aborted && access.allowed === true) setVerifiedId(user.id);
      } finally {
        clearTimeout(timeout);
      }
    })()).catch((error: unknown) => {
      // withLoading 已把這次載入標成失敗；圖層維持鎖住，不合成「有權限」。
      if (!controller.signal.aborted) console.warn("[bridge-resilience] private access probe failed", error);
    });
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [user?.id, authGeneration]);
  return { allowed: !loading && !!user && verifiedId === user.id, userId: user?.id ?? null };
}

/** Called by every authenticated PMTiles Range request, never cached in the source. */
export async function bridgeResiliencePrivateAccessToken(expectedUserId: string): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== expectedUserId) throw new Error("bridge resilience access denied");
  return data.session.access_token;
}
