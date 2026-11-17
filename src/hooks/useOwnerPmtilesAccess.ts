import { useEffect, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useUser } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { OWNER_DATA_ENDPOINT, type OwnerDataAssetName } from "../data/ownerDataAssets";
import type { PrivatePmtilesSource } from "./useGbWaterLayers";

/**
 * 站主限定 PMTiles（owner-data 家族）的存取判斷：同源 `/api/private-research/owner-data/<asset>`，
 * 由 coral-private sidecar 每次 Range 請求重新驗站主 JWT。這裡只做 UI 便利判斷——探 `?access=1`，
 * 通過才把 `PrivatePmtilesSource` 交給 `useGbPmtilesLayers` 掛 source；沒通過就回 null，呼叫端不掛任何 source
 * （**不可**退回公開 `./world/<file>`）。作法比照中國第 0–1 波（useCnLayers 的 owner-data 存取）。
 * 401／403（非站主）與 404（sidecar 白名單尚未收錄該檔）一律靜默當成未開放；撤權事件清掉重探。
 */
export const OWNER_PMTILES_ACCESS_DENIED_EVENT = "owner-pmtiles-access-denied";
/** 每個帳號×檔只探一次；撤權事件清掉重探。 */
const probes = new Map<string, Promise<boolean>>();
const assetUrl = (asset: OwnerDataAssetName) => `${OWNER_DATA_ENDPOINT}/${asset}`;

export function probeOwnerPmtilesAccess(asset: OwnerDataAssetName, userId: string, token: string, fetchFn: typeof fetch = fetch): Promise<boolean> {
  const id = `${userId}:${asset}`;
  const hit = probes.get(id);
  if (hit) return hit;
  const run = (async () => {
    try {
      const response = await fetchFn(`${assetUrl(asset)}?access=1`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) {
        if (![401, 403, 404].includes(response.status)) console.warn(`[owner-pmtiles] ${asset} access probe HTTP ${response.status}`);
        return false;
      }
      return ((await response.json()) as { allowed?: unknown }).allowed === true;
    } catch (error) {
      console.warn(`[owner-pmtiles] ${asset} access probe failed`, error);
      return false;
    }
  })();
  probes.set(id, run);
  return run;
}
export function resetOwnerPmtilesAccessProbes() { probes.clear(); }

async function accessToken(expectedUserId: string): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== expectedUserId) throw new Error("Owner data access denied");
  return data.session.access_token;
}

/** 開著（`active`）才探；回傳可掛的私人 source，未驗證／非站主＝null。 */
export function useOwnerPmtilesSource(asset: OwnerDataAssetName, active: boolean): PrivatePmtilesSource | null {
  const { user, loading } = useUser();
  const [verified, setVerified] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const revoke = () => { resetOwnerPmtilesAccessProbes(); setVerified(null); setRevision((r) => r + 1); };
    window.addEventListener(OWNER_PMTILES_ACCESS_DENIED_EVENT, revoke);
    return () => window.removeEventListener(OWNER_PMTILES_ACCESS_DENIED_EVENT, revoke);
  }, []);
  useEffect(() => {
    setVerified(null);
    if (!user || !active) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await accessToken(user.id);
        const ok = await probeOwnerPmtilesAccess(asset, user.id, token);
        if (!cancelled && ok) setVerified(user.id);
      } catch { /* 未登入或 session 對不上：維持未開放 */ }
    })();
    return () => { cancelled = true; };
  }, [asset, user?.id, active, revision]);
  const userId = !loading && user && verified === user.id ? user.id : null;
  const [source, setSource] = useState<PrivatePmtilesSource | null>(null);
  useEffect(() => {
    if (!userId) { setSource(null); return; }
    const deny = () => window.dispatchEvent(new Event(OWNER_PMTILES_ACCESS_DENIED_EVENT));
    setSource({
      url: assetUrl(asset),
      getToken: async () => {
        try { return await accessToken(userId); } catch (error) { deny(); throw error; }
      },
      onAccessDenied: deny,
    });
  }, [asset, userId]);
  return source;
}

/** 撤權（或換帳號）時移除本層 layer 與 source，不留已載入的圖磚。 */
export function useOwnerRevokeCleanup(mapRef: React.RefObject<MapboxMap | null>, allowed: boolean, layerIds: readonly string[], sourceIds: readonly string[]) {
  const layerSig = layerIds.join("|");
  const sourceSig = sourceIds.join("|");
  useEffect(() => {
    if (allowed) return;
    const map = mapRef.current;
    if (!map) return;
    try {
      for (const id of layerSig.split("|")) if (id && map.getLayer(id)) map.removeLayer(id);
      for (const id of sourceSig.split("|")) if (id && map.getSource(id)) map.removeSource(id);
    } catch { /* style 已換掉 */ }
  }, [allowed, mapRef, layerSig, sourceSig]);
}
