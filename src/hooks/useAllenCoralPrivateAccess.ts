import { useEffect, useState } from "react";
import { useUser } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { ALLEN_CORAL_SOURCES } from "../data/allenCoralAtlasTypes";

/** UI convenience only: the server verifies the exact account on every Range request. */
export function useAllenCoralPrivateAccess() {
  const { user, loading } = useUser();
  const [verifiedId, setVerifiedId] = useState<string | null>(null);
  const [authGeneration, setAuthGeneration] = useState(0);
  // A 401/403 during any authenticated Range request revokes the UI grant too.
  // It cannot be restored by a view change; a later auth change reruns the check.
  useEffect(() => {
    const revoke = () => setVerifiedId(null);
    window.addEventListener("allen-coral-access-denied", revoke);
    return () => window.removeEventListener("allen-coral-access-denied", revoke);
  }, []);
  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      // A healthy refresh must retain the existing grant: App closes the layer
      // when allowed becomes false. Range requests still obtain the fresh token.
      if (event === "TOKEN_REFRESHED" && verifiedId === null) {
        setAuthGeneration((generation) => generation + 1);
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, [verifiedId]);
  useEffect(() => {
    setVerifiedId(null);
    if (!user) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || data.session?.user.id !== user.id) return;
        const res = await fetch(`${ALLEN_CORAL_SOURCES.benthic.url}?access=1`, {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          cache: "no-store", signal: controller.signal,
        });
        if (!res.ok) return;
        const access = await res.json();
        if (!controller.signal.aborted && access.allowed === true) {
          sessionStorage.setItem("allen-private-session-active", "1");
          setVerifiedId(user.id);
        }
      } catch { /* Fail closed, including expired sessions and unavailable backend. */ }
      finally { clearTimeout(timeout); }
    })();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [user?.id, authGeneration]);
  return { allowed: !loading && !!user && verifiedId === user.id, userId: user?.id ?? null };
}

export async function allenCoralAccessToken(expectedUserId: string): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== expectedUserId) {
    throw new Error("Coral access denied");
  }
  return data.session.access_token;
}
