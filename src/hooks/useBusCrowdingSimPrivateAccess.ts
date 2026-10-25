import { useEffect, useState } from "react";
import { BUS_CROWDING_SIM_PRIVATE_ENDPOINT, clearBusCrowdingSimCache, type BusCrowdingSimAuth } from "../data/busCrowdingSimLoader";
import { BUS_CROWDING_SIM_ACCESS_DENIED_EVENT } from "../data/busCrowdingSimTypes";
import { withLoading } from "../lib/loadingRegistry";
import { useUser } from "../lib/auth";
import { supabase } from "../lib/supabase";

/**
 * UI convenience only（照 useBridgeResiliencePrivateAccess）：私人 endpoint 每個 Range 請求都會重新驗證帳號。
 * 非站主的 401／403 是預期結果，靜默鎖住，不當成全域錯誤。失去權限或換帳號時清掉已下載的私人資料。
 */
export function useBusCrowdingSimPrivateAccess() {
  const { user, loading } = useUser();
  const [verifiedId, setVerifiedId] = useState<string | null>(null);
  const [authGeneration, setAuthGeneration] = useState(0);

  useEffect(() => {
    const revoke = () => { setVerifiedId(null); clearBusCrowdingSimCache(); };
    window.addEventListener(BUS_CROWDING_SIM_ACCESS_DENIED_EVENT, revoke);
    return () => window.removeEventListener(BUS_CROWDING_SIM_ACCESS_DENIED_EVENT, revoke);
  }, []);
  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" && verifiedId === null) setAuthGeneration((generation) => generation + 1);
    });
    return () => subscription.subscription.unsubscribe();
  }, [verifiedId]);
  useEffect(() => {
    setVerifiedId(null);
    clearBusCrowdingSimCache();
    if (!user) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    void withLoading("bus-crowding-sim:private-access", "驗證公車擁擠模擬私人圖層存取權", (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session || data.session.user.id !== user.id) return;
        const response = await fetch(`${BUS_CROWDING_SIM_PRIVATE_ENDPOINT}/segments?access=1`, {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401 || response.status === 403) return;
        if (!response.ok) throw new Error(`公車擁擠模擬私人服務尚未就緒（HTTP ${response.status}）`);
        const access = await response.json() as { allowed?: unknown };
        if (!controller.signal.aborted && access.allowed === true) setVerifiedId(user.id);
      } finally {
        clearTimeout(timeout);
      }
    })()).catch((error: unknown) => {
      // withLoading 已把這次載入標成失敗；圖層維持鎖住，不合成「有權限」。
      if (!controller.signal.aborted) console.warn("[bus-crowding-sim] private access probe failed", error);
    });
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [user?.id, authGeneration]);
  return { allowed: !loading && !!user && verifiedId === user.id, userId: user?.id ?? null };
}

/** 每個私人請求都重新取 token（不快取）；帳號已換就拒絕。 */
export function busCrowdingSimAuth(expectedUserId: string): BusCrowdingSimAuth {
  return {
    userId: expectedUserId,
    async token() {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session || data.session.user.id !== expectedUserId) {
        const denied = new Error("bus crowding access denied") as Error & { status?: number };
        denied.status = 401;
        throw denied;
      }
      return data.session.access_token;
    },
  };
}
