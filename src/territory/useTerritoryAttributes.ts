import { useEffect, useState } from "react";
import { loadTerritoryAttributes, type TerritoryAttributesFile } from "./territoryAttributes";

export type TerritoryAttributesState =
  | { status: "idle" | "loading" }
  | { status: "ready"; data: TerritoryAttributesFile }
  | { status: "error"; message: string };

/** enabled 轉真才下載 attributes.json（模組層快取只抓一次；失敗時下次開啟重試） */
export function useTerritoryAttributes(enabled: boolean): TerritoryAttributesState {
  const [state, setState] = useState<TerritoryAttributesState>({ status: "idle" });
  const ready = state.status === "ready";
  useEffect(() => {
    if (!enabled || ready) return;
    let cancelled = false;
    setState({ status: "loading" });
    loadTerritoryAttributes().then(
      (data) => { if (!cancelled) setState({ status: "ready", data }); },
      (err: unknown) => { if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : String(err) }); },
    );
    return () => { cancelled = true; };
  }, [enabled, ready]);
  return state;
}
