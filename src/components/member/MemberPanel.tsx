import { useEffect, useRef, useState } from "react";
import { Bookmark, Layers, MapPin, RefreshCw, Star, X } from "lucide-react";
import { LayerNameLine, ListRow } from "../sidebar/LayerRow";
import { LAYER_ICONS } from "../sidebar/layerIcons";
import { LAYER_COLORS, layerDisplayName } from "../sidebar/layerCatalog";
import { railPalette, RailThemeContext } from "../sidebar/railTheme";
import { signInWithGoogle, signOut } from "../../lib/auth";
import { memberLibraryStore, useMemberLibrary } from "../../state/memberLibraryStore";
import type { SavedScene, SavedPlace, PlaceInput, MemberLibrary } from "../../data/memberLibraryLoader";
import type { MemberSceneSnapshot } from "../../lib/memberSchema";
import { validatePlace } from "../../lib/memberSchema";
import { MyAnalysisCards } from "./MyAnalysisCards";
import { useLocale } from "../../state/localeStore";
import "./memberPanel.css";

interface Props {
  open: boolean; onClose: () => void; isDarkTheme: boolean; isMobile: boolean;
  userId: string | null; displayName: string; authLoading: boolean;
  labels: Readonly<Record<string, string>>; visibleKeys: string[]; lockedKeys: ReadonlySet<string>;
  onToggleLayer: (key: string) => void;
  captureScene: () => MemberSceneSnapshot;
  /** 連動選單（統計期別等）要等選項載入才驗證，所以是非同步；resolve 的是略過項目 */
  restoreScene: (scene: MemberSceneSnapshot) => Promise<string[]>;
  capturePlace: (kind: "center" | "selection" | "bounds") => PlaceInput["geometry"];
  restorePlace: (place: SavedPlace) => void;
  /** 4b：owner 才看得到「卡片」分頁（自己發布的分析卡清單與撤銷）。 */
  isOwner?: boolean;
}
const TABS = [
  { id: "favorites", labelKey: "member.tab.favorites" },
  { id: "open", labelKey: "member.tab.open" },
  { id: "scenes", labelKey: "member.tab.scenes" },
  { id: "places", labelKey: "member.tab.places" },
  { id: "cards", labelKey: "member.tab.cards" },
] as const;
type Tab = typeof TABS[number]["id"];

export function MemberPanel(props: Props) {
  const library = useMemberLibrary();
  const i18n = useLocale();
  const { t } = i18n;
  const [tab, setTab] = useState<Tab>("favorites");
  const [name, setName] = useState("");
  const [geometry, setGeometry] = useState("");
  const [sourceKind, setSourceKind] = useState<"manual" | "map">("manual");
  const [editing, setEditing] = useState<{ kind: "scene" | "place"; id: string; name: string } | null>(null);
  const [notice, setNotice] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!props.open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => { previousFocus.current?.focus(); };
  }, [props.open]);
  useEffect(() => { setEditing(null); setName(""); setGeometry(""); setNotice(""); }, [props.userId]);
  if (!props.open) return null;
  const currentAccount = library.userId === props.userId;
  const rows: MemberLibrary = currentAccount ? library : { favorites: [], scenes: [], places: [], unavailableItems: [] };
  const ready = currentAccount && library.status === "ready" && !library.busy && !props.authLoading;
  const canFavorite = !props.authLoading && (props.userId ? ready : true);
  const status = props.authLoading || !currentAccount || library.status === "loading" ? t("member.status.loading")
    : library.busy ? t("member.status.syncing") : library.status === "ready" ? t("member.status.cloud") : props.userId ? t("member.status.unsynced") : t("member.status.local");
  // 原本是 toLocaleString("zh-TW")；改走 formatDateTime（固定台北時區），欄位相同
  const fmtDate = (iso: string) => i18n.formatDateTime(new Date(iso), { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
  const attempt = (work: () => void | Promise<void>) => {
    setNotice("");
    void Promise.resolve().then(work).catch((error: unknown) => setNotice(error instanceof Error ? error.message : t("member.opFailed")));
  };
  const openScene = (scene: SavedScene) => attempt(async () => {
    const restoring = props.restoreScene(scene.snapshot);
    setNotice(t("member.reopening"));
    const skipped = await restoring;
    setNotice(skipped.length ? t("member.reopenedSkipped", { items: skipped.join(t("member.itemSeparator")) }) : t("member.reopened"));
  });
  const chooseGeometry = (kind: "center" | "selection" | "bounds") => attempt(() => { setGeometry(JSON.stringify(props.capturePlace(kind))); setSourceKind("map"); });
  const rename = (row: SavedScene | SavedPlace) => attempt(async () => {
    if (!editing?.name.trim()) { setNotice(t("member.needName")); return; }
    if (editing.kind === "scene") await memberLibraryStore.saveScene(editing.name, (row as SavedScene).snapshot, row as SavedScene);
    else await memberLibraryStore.savePlace({ name: editing.name, geometry: (row as SavedPlace).geometry, source_kind: (row as SavedPlace).source_kind, precision: "user_selected" }, row as SavedPlace);
    if (memberLibraryStore.getSnapshot().status === "ready") setEditing(null);
  });
  const renderRename = (row: SavedScene | SavedPlace, kind: "scene" | "place") => editing?.id === row.id && editing.kind === kind ? (
    <form className="member-inline-form" onSubmit={(event) => { event.preventDefault(); rename(row); }}>
      <input aria-label={t("member.newName")} maxLength={100} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
      <button disabled={!ready || !editing.name.trim()}>{t("member.saveName")}</button>
      <button type="button" onClick={() => setEditing(null)}>{t("member.cancel")}</button>
    </form>
  ) : <button disabled={!ready} onClick={() => setEditing({ id: row.id, name: row.name, kind })}>{t("member.rename")}</button>;
  return (
    <section role="dialog" aria-modal={false} aria-label={t("member.title")} className={`member-panel ${props.isDarkTheme ? "" : "member-panel-light"} ${props.isMobile ? "member-panel-mobile" : ""}`} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); props.onClose(); } }}>
      <header className="member-header"><div><span className="member-eyebrow">{t("member.eyebrow")}</span><h2>{t("member.title")}</h2></div><button ref={closeRef} className="member-close" onClick={props.onClose} aria-label={t("member.close")}><X size={14} /></button></header>
      <div className="member-account">
        <div><strong>{props.userId ? props.displayName || t("member.myAccount") : t("member.yourFavorites")}</strong><small>{status}</small></div>
        {props.userId ? <button onClick={() => attempt(signOut)}>{t("member.signOut")}</button> : <button disabled={props.authLoading} onClick={() => attempt(async () => { try { await signInWithGoogle(); } catch { throw new Error(t("member.signInFailed")); } })}>{t("member.signInSync")}</button>}
      </div>
      {!props.userId && <p className="member-hint">{t("member.guestHint")}</p>}
      {props.userId && <div className="member-actions"><button disabled={library.busy || props.authLoading} onClick={() => attempt(() => memberLibraryStore.refresh())}><RefreshCw size={13} />{t("member.refresh")}</button>{library.guestCount > 0 && <button disabled={!ready} onClick={() => attempt(() => memberLibraryStore.importGuest())}>{t("member.importGuest", { count: library.guestCount })}</button>}</div>}
      <div role="status" aria-live="polite" className="member-notice">{notice || (currentAccount ? library.message : "")}</div>
      <nav aria-label={t("member.tabsAria")} className="member-tabs">{TABS.filter((item) => item.id !== "cards" || (props.isOwner && props.userId)).map((item) => <button key={item.id} aria-pressed={tab === item.id} onClick={() => { setTab(item.id); setNotice(""); }}>{t(item.labelKey)}<small>{item.id === "favorites" ? rows.favorites.length : item.id === "open" ? props.visibleKeys.length : item.id === "scenes" ? rows.scenes.length : item.id === "places" ? rows.places.length : ""}</small></button>)}</nav>
      <div className="member-body">
        {rows.unavailableItems.length > 0 && <div className="member-hint">{t("member.unavailable", { count: rows.unavailableItems.length })}{rows.unavailableItems.map((item) => <div className="member-actions" key={`${item.table}:${item.id}`}><span>{t("member.unavailableItem", { name: item.name })}</span><button disabled={!ready} onClick={() => attempt(() => memberLibraryStore.removeUnavailable(item))}>{t("member.removeUnavailable")}</button></div>)}</div>}
        {(tab === "favorites" || tab === "open") && <>
          <p className="member-hint">{tab === "favorites" ? t("member.favoritesHint") : t("member.openHint")}</p>
          {/* 收藏／已開啟：共用圖層列（layer-panel-unify P8）—— 列開關直接開關圖層，星號收藏 */}
          <RailThemeContext.Provider value={railPalette(props.isDarkTheme)}>
          {(tab === "favorites" ? rows.favorites : props.visibleKeys).map((key) => {
            const label = props.labels[key] ?? t("member.removedLayer", { key });
            const on = props.visibleKeys.includes(key);
            const favorite = rows.favorites.includes(key);
            const Icon = (LAYER_ICONS as Record<string, typeof Layers | undefined>)[key] ?? Layers;
            const color = (LAYER_COLORS as Record<string, string | undefined>)[key];
            return <ListRow
              key={key}
              ariaLabel={label}
              label={props.labels[key] ? <LayerNameLine name={layerDisplayName(key, label)} /> : label}
              icon={<Icon size={14} color={on && color ? color : "var(--text-dim)"} style={{ flexShrink: 0 }} />}
              accent={color}
              active={on}
              locked={!on && props.lockedKeys.has(key)}
              lockedTitle={t("member.needAuth")}
              onClick={props.labels[key] && (on || !props.lockedKeys.has(key)) ? () => props.onToggleLayer(key) : undefined}
              trailing={<button type="button" className="member-star" disabled={!canFavorite} aria-label={favorite ? t("member.unfavoriteLayer", { name: props.labels[key] ?? key }) : t("member.favoriteLayer", { name: props.labels[key] ?? key })} title={favorite ? t("member.unfavorite") : t("member.favorite")} aria-pressed={favorite} onClick={() => attempt(() => memberLibraryStore.toggleFavorite(key))}><Star size={14} fill={favorite ? "currentColor" : "none"} /></button>}
              toggle={props.labels[key] ? { on, onChange: () => props.onToggleLayer(key), label: t("member.showLayer", { label }) } : null}
            />;
          })}
          </RailThemeContext.Provider>
          {(tab === "favorites" ? rows.favorites : props.visibleKeys).length === 0 && <div className="member-empty"><Bookmark size={24} /><p>{tab === "favorites" ? t("member.noFavorites") : t("member.noOpen")}</p></div>}
        </>}
        {tab === "scenes" && <>
          <p className="member-hint">{t("member.sceneHint")}</p>
          <form className="member-create" onSubmit={(event) => { event.preventDefault(); attempt(async () => { await memberLibraryStore.saveScene(name, props.captureScene()); if (memberLibraryStore.getSnapshot().status === "ready") setName(""); }); }}>
            <label>{t("member.sceneName")}<input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} placeholder={t("member.sceneNamePlaceholder")} /></label><button className="member-primary" disabled={!ready || !name.trim()}>{t("member.saveScene")}</button>
          </form>
          {!props.userId && <p className="member-hint">{t("member.signInScene")}</p>}
          {rows.scenes.map((scene) => <article className="member-item" key={scene.id}><strong>{scene.name}</strong><small>{t("member.sceneMeta", { count: scene.snapshot.layers.length, date: fmtDate(scene.updated_at) })}</small><div className="member-actions"><button onClick={() => openScene(scene)}>{t("member.reopenScene")}</button>{renderRename(scene, "scene")}<button disabled={!ready} onClick={() => attempt(() => memberLibraryStore.saveScene(t("member.copyName", { name: scene.name.slice(0, 94) }), scene.snapshot))}>{t("member.saveCopy")}</button><button disabled={!ready} onClick={() => attempt(() => memberLibraryStore.saveScene(scene.name, props.captureScene(), scene))}>{t("member.updateToCurrent")}</button><button disabled={!ready} onClick={() => attempt(() => memberLibraryStore.removeScene(scene))}>{t("member.delete")}</button></div></article>)}
        </>}
        {tab === "places" && <>
          <p className="member-hint">{t("member.placeHint")}</p>
          <form className="member-create" onSubmit={(event) => { event.preventDefault(); attempt(async () => {
            let raw: unknown; try { raw = JSON.parse(geometry); } catch { throw new Error(t("member.needGeometry")); }
            const parsed = validatePlace({ name, geometry: raw, source_kind: sourceKind, precision: "user_selected" });
            if (!parsed.ok) throw new Error(parsed.errors.join(t("member.itemSeparator")));
            await memberLibraryStore.savePlace(parsed.value); if (memberLibraryStore.getSnapshot().status === "ready") { setName(""); setGeometry(""); }
          }); }}>
            <label>{t("member.placeName")}<input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} placeholder={t("member.placeNamePlaceholder")} /></label>
            <div className="member-actions"><button type="button" onClick={() => chooseGeometry("center")}>{t("member.mapCenter")}</button><button type="button" onClick={() => chooseGeometry("selection")}>{t("member.mapSelection")}</button><button type="button" onClick={() => chooseGeometry("bounds")}>{t("member.mapBounds")}</button></div>
            <label>{t("member.geometryLabel")}<textarea rows={3} value={geometry} maxLength={16000} onChange={(event) => { setGeometry(event.target.value); setSourceKind("manual"); }} placeholder={'{"type":"Point","coordinates":[121.5,25.04]}'} /></label>
            <button className="member-primary" disabled={!ready || !name.trim() || !geometry.trim()}>{t("member.savePlace")}</button>
          </form>
          {!props.userId && <p className="member-hint">{t("member.signInPlace")}</p>}
          {rows.places.map((place) => <article className="member-item" key={place.id}><div className="member-item-title"><MapPin size={14} /><strong>{place.name}</strong></div><small>{place.geometry.type === "Point" ? t("member.placePoint") : t("member.placeArea")} · {fmtDate(place.updated_at)}</small><div className="member-actions"><button onClick={() => attempt(() => props.restorePlace(place))}>{t("member.viewOnMap")}</button>{renderRename(place, "place")}<button disabled={!ready} onClick={() => attempt(() => memberLibraryStore.removePlace(place))}>{t("member.delete")}</button></div></article>)}
        </>}
        {tab === "cards" && props.isOwner && props.userId && <MyAnalysisCards />}
      </div>
      <footer>{t("member.footer")}</footer>
    </section>
  );
}
