import { useEffect, useState } from "react";
import { useUser } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { CORAL_REEF_SOURCE_URL } from "../data/coralReefTypes";

/** UI convenience only: the server verifies the exact account on every Range request. */
export function useCoralPrivateAccess() {
  const { user, loading } = useUser();
  const [verifiedId, setVerifiedId] = useState<string | null>(null);
  useEffect(() => {
    setVerifiedId(null);
    if (!user) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || data.session?.user.id !== user.id) return;
        const res = await fetch(`${CORAL_REEF_SOURCE_URL}?access=1`, {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          cache: "no-store", signal: controller.signal,
        });
        if (!res.ok) return;
        const access = await res.json();
        if (!controller.signal.aborted && access.allowed === true) setVerifiedId(user.id);
      } catch { /* Fail closed, including expired sessions and unavailable backend. */ }
      finally { clearTimeout(timeout); }
    })();
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [user?.id]);
  return { allowed: !loading && !!user && verifiedId === user.id, userId: user?.id ?? null };
}

export async function coralAccessToken(expectedUserId: string): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== expectedUserId) {
    throw new Error("Coral access denied");
  }
  return data.session.access_token;
}
