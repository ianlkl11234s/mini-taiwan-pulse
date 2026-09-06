import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * 會員 Auth 薄封裝（member-byok-chat-plan §6.1）。
 * Google OAuth only；session 持久化 / 自動刷新 / URL detect 皆走 supabase.ts
 * 的 supabase-js v2 預設（persistSession / autoRefreshToken / detectSessionInUrl）。
 */

/** Google OAuth 登入：導向 Google，回跳後 detectSessionInUrl 自動接手 session */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

/** 登出：清除本地 session */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * 目前登入使用者。
 * 初始以 getSession() 取一次，之後訂閱 onAuthStateChange 保持同步。
 * loading = 尚未取得初始 session（避免 UI 先閃「未登入」再跳回）。
 */
export function useUser(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

/**
 * 會員分級閘門（owner-gated 私人圖層用）。
 * 登入後 select profiles.tier where id = auth.uid()（migration 270 的 RLS 允許讀自己 row）。
 * - tier 載入為非同步：載入完成前 isOwner=false（顯示鎖），完成後才可能解鎖。
 * - 未登入：user=null / tier=null / isOwner=false。
 * - tier 用於 Phase 2 分層 gating（free/member/insider/owner，見 lib/layerGates）；
 *   isOwner 為 tier==='owner' 的捷徑（後台入口 + 舊鎖頭邏輯共用）。
 */
export function useMemberGate(): { user: User | null; tier: string | null; isOwner: boolean; loading: boolean } {
  const { user, loading: userLoading } = useUser();
  const [tier, setTier] = useState<string | null>(null);
  const [tierLoading, setTierLoading] = useState(false);
  // A tier belongs to exactly one resolved account. Keep the previous account's tier
  // unusable during an auth transition, before the next profile read returns.
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      setTier(null);
      setResolvedUserId(null);
      setTierLoading(false);
      return;
    }
    let mounted = true;
    setTierLoading(true);
    void supabase
      .from("profiles")
      .select("tier")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        setTier((data?.tier as string | undefined) ?? null);
        setResolvedUserId(userId);
        setTierLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [userId]);

  const currentTier = resolvedUserId === userId ? tier : null;

  return {
    user,
    tier: currentTier,
    isOwner: currentTier === "owner",
    loading: userLoading || (userId !== null && (tierLoading || resolvedUserId !== userId)),
  };
}
