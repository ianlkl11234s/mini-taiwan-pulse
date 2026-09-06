import { supabase } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { validatePlace, validateScene, type MemberPlaceGeometry, type MemberSceneSnapshot } from "../lib/memberSchema";

export interface SavedScene {
  id: string; user_id: string; name: string; snapshot_version: number;
  snapshot: MemberSceneSnapshot; created_at: string; updated_at: string;
}
export interface SavedPlace {
  id: string; user_id: string; name: string; geometry: MemberPlaceGeometry;
  source_kind: "manual" | "map"; precision: "user_selected";
  created_at: string; updated_at: string;
}
export type UnavailableMemberItem = Pick<SavedScene, "id" | "user_id" | "name" | "updated_at"> & { table: "user_scenes" | "user_places" };
export interface MemberLibrary { favorites: string[]; scenes: SavedScene[]; places: SavedPlace[]; unavailableItems: UnavailableMemberItem[] }
export type PlaceInput = Pick<SavedPlace, "name" | "geometry" | "source_kind" | "precision">;

export class MemberLibraryError extends Error {
  constructor(public kind: "unavailable" | "conflict" | "request", message: string) { super(message); }
}
function check(error: { code?: string } | null): void {
  if (!error) return;
  if (["42P01", "PGRST205", "PGRST204"].includes(error.code ?? "")) {
    throw new MemberLibraryError("unavailable", "雲端保存尚未就緒；本機收藏仍保留，請稍後重新整理。");
  }
  throw new MemberLibraryError("request", "保存未完成。請確認登入與網路，或檢查名稱、內容大小及收藏配額後再試。");
}
function ensure<T>(value: T | null): T {
  if (!value) throw new MemberLibraryError("conflict", "內容已在其他裝置更新或刪除。請重新整理，或另存副本。");
  return value;
}
function sceneRow(raw: SavedScene): SavedScene {
  const result = validateScene(raw.snapshot);
  if (!result.ok || raw.snapshot_version !== 1) throw new MemberLibraryError("request", "場景格式不相容，無法載入。");
  return { ...raw, snapshot: result.value };
}
function placeRow(raw: SavedPlace): SavedPlace {
  const result = validatePlace({ name: raw.name, geometry: raw.geometry, source_kind: raw.source_kind, precision: raw.precision });
  if (!result.ok) throw new MemberLibraryError("request", "地點格式不相容，無法載入。");
  return { ...raw, ...result.value };
}
export const memberLibraryLoader = {
  async load(userId: string): Promise<MemberLibrary> {
    return withLoading("member-library", "載入我的收藏", (async () => {
      const [favorites, scenes, places] = await Promise.all([
        supabase.from("user_layer_favorites").select("layer_key").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
        supabase.from("user_scenes").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(50),
        supabase.from("user_places").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(100),
      ]);
      check(favorites.error); check(scenes.error); check(places.error);
      const unavailableItems: UnavailableMemberItem[] = [];
      const validScenes: SavedScene[] = [];
      const validPlaces: SavedPlace[] = [];
      for (const row of (scenes.data ?? []) as SavedScene[]) {
        try { validScenes.push(sceneRow(row)); }
        catch { unavailableItems.push({ id: row.id, user_id: row.user_id, name: row.name, updated_at: row.updated_at, table: "user_scenes" }); }
      }
      for (const row of (places.data ?? []) as SavedPlace[]) {
        try { validPlaces.push(placeRow(row)); }
        catch { unavailableItems.push({ id: row.id, user_id: row.user_id, name: row.name, updated_at: row.updated_at, table: "user_places" }); }
      }
      return {
        favorites: (favorites.data ?? []).map((r) => String(r.layer_key)),
        scenes: validScenes, places: validPlaces, unavailableItems,
      };
    })());
  },
  async favorite(userId: string, layerKey: string, add: boolean): Promise<void> {
    if (add) {
      const r = await supabase.from("user_layer_favorites").upsert({ user_id: userId, layer_key: layerKey }, { onConflict: "user_id,layer_key", ignoreDuplicates: true });
      check(r.error);
    } else {
      const r = await supabase.from("user_layer_favorites").delete().eq("user_id", userId).eq("layer_key", layerKey);
      check(r.error);
    }
  },
  async saveScene(userId: string, name: string, snapshot: MemberSceneSnapshot, previous?: SavedScene): Promise<SavedScene> {
    const parsed = validateScene(snapshot);
    if (!parsed.ok) throw new Error(parsed.errors.join("；"));
    const content = { name: name.trim(), snapshot: parsed.value, snapshot_version: 1 };
    const request = previous
      ? supabase.from("user_scenes").update(content).eq("user_id", userId).eq("id", previous.id).eq("updated_at", previous.updated_at)
      : supabase.from("user_scenes").insert({ ...content, user_id: userId });
    const r = await request.select("*").maybeSingle();
    check(r.error); return sceneRow(ensure(r.data as SavedScene | null));
  },
  async savePlace(userId: string, input: PlaceInput, previous?: SavedPlace): Promise<SavedPlace> {
    const parsed = validatePlace(input);
    if (!parsed.ok) throw new Error(parsed.errors.join("；"));
    const request = previous
      ? supabase.from("user_places").update(parsed.value).eq("user_id", userId).eq("id", previous.id).eq("updated_at", previous.updated_at)
      : supabase.from("user_places").insert({ ...parsed.value, user_id: userId });
    const r = await request.select("*").maybeSingle();
    check(r.error); return placeRow(ensure(r.data as SavedPlace | null));
  },
  async remove(userId: string, table: "user_scenes" | "user_places", row: Pick<SavedScene, "id" | "updated_at">): Promise<void> {
    const r = await supabase.from(table).delete().eq("id", row.id).eq("user_id", userId).eq("updated_at", row.updated_at).select("id").maybeSingle();
    check(r.error); ensure(r.data);
  },
};
