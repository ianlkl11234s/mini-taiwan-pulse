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
