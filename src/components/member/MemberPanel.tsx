import { useEffect, useRef, useState } from "react";
import { Bookmark, Layers, MapPin, RefreshCw, UserRound, X } from "lucide-react";
import { signInWithGoogle, signOut } from "../../lib/auth";
import { memberLibraryStore, useMemberLibrary } from "../../state/memberLibraryStore";
import type { SavedScene, SavedPlace, PlaceInput, MemberLibrary } from "../../data/memberLibraryLoader";
import type { MemberSceneSnapshot } from "../../lib/memberSchema";
import { validatePlace } from "../../lib/memberSchema";
import "./memberPanel.css";

interface Props {
  open: boolean; onClose: () => void; isDarkTheme: boolean; isMobile: boolean;
  userId: string | null; displayName: string; authLoading: boolean;
  labels: Readonly<Record<string, string>>; visibleKeys: string[]; lockedKeys: ReadonlySet<string>;
  onToggleLayer: (key: string) => void;
  captureScene: () => MemberSceneSnapshot;
  restoreScene: (scene: MemberSceneSnapshot) => string[];
  capturePlace: (kind: "center" | "selection" | "bounds") => PlaceInput["geometry"];
  restorePlace: (place: SavedPlace) => void;
}
const TABS = ["收藏", "已開啟", "場景", "地點"] as const;
type Tab = typeof TABS[number];

export function MemberPanel(props: Props) {
  const library = useMemberLibrary();
  const [tab, setTab] = useState<Tab>("收藏");
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
  const status = props.authLoading || !currentAccount || library.status === "loading" ? "正在載入"
    : library.busy ? "正在同步" : library.status === "ready" ? "雲端保存" : props.userId ? "尚未同步" : "儲存於此瀏覽器";
  const attempt = (work: () => void | Promise<void>) => {
    setNotice("");
    void Promise.resolve().then(work).catch((error: unknown) => setNotice(error instanceof Error ? error.message : "操作未完成，請重試。"));
  };
  const openScene = (scene: SavedScene) => attempt(() => {
    const skipped = props.restoreScene(scene.snapshot);
    setNotice(skipped.length ? `已重開。略過項目：${skipped.join("；")}` : "已重開場景。即時模式會讀取新資料；回放保留所選時間。");
  });
  const chooseGeometry = (kind: "center" | "selection" | "bounds") => attempt(() => { setGeometry(JSON.stringify(props.capturePlace(kind))); setSourceKind("map"); });
  const rename = (row: SavedScene | SavedPlace) => attempt(async () => {
    if (!editing?.name.trim()) { setNotice("請輸入名稱。"); return; }
    if (editing.kind === "scene") await memberLibraryStore.saveScene(editing.name, (row as SavedScene).snapshot, row as SavedScene);
    else await memberLibraryStore.savePlace({ name: editing.name, geometry: (row as SavedPlace).geometry, source_kind: (row as SavedPlace).source_kind, precision: "user_selected" }, row as SavedPlace);
    if (memberLibraryStore.getSnapshot().status === "ready") setEditing(null);
  });
  const renderRename = (row: SavedScene | SavedPlace, kind: "scene" | "place") => editing?.id === row.id && editing.kind === kind ? (
    <form className="member-inline-form" onSubmit={(event) => { event.preventDefault(); rename(row); }}>
      <input aria-label="新名稱" maxLength={100} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
      <button disabled={!ready || !editing.name.trim()}>儲存名稱</button>
      <button type="button" onClick={() => setEditing(null)}>取消</button>
    </form>
  ) : <button disabled={!ready} onClick={() => setEditing({ id: row.id, name: row.name, kind })}>重新命名</button>;
  return (
    <section role="dialog" aria-modal={false} aria-label="會員專區" className={`member-panel ${props.isDarkTheme ? "" : "member-panel-light"} ${props.isMobile ? "member-panel-mobile" : ""}`} onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); props.onClose(); } }}>
      <header className="member-header"><div><span className="member-eyebrow">MY PULSE</span><h2><UserRound size={18} />會員專區</h2></div><button ref={closeRef} onClick={props.onClose} aria-label="關閉會員專區"><X size={18} /></button></header>
      <div className="member-account">
        <div><strong>{props.userId ? props.displayName || "我的帳號" : "你的地圖收藏"}</strong><small>{status}</small></div>
        {props.userId ? <button onClick={() => attempt(signOut)}>登出</button> : <button disabled={props.authLoading} onClick={() => attempt(async () => { try { await signInWithGoogle(); } catch { throw new Error("登入未完成，請重試。"); } })}>登入並同步</button>}
      </div>
      {!props.userId && <p className="member-hint">收藏圖層可先留在此瀏覽器。登入後可匯入收藏，並跨裝置保存場景與地點。</p>}
      {props.userId && <div className="member-actions"><button disabled={library.busy || props.authLoading} onClick={() => attempt(() => memberLibraryStore.refresh())}><RefreshCw size={13} />重新整理</button>{library.guestCount > 0 && <button disabled={!ready} onClick={() => attempt(() => memberLibraryStore.importGuest())}>匯入本機收藏（{library.guestCount}）</button>}</div>}
      <div role="status" aria-live="polite" className="member-notice">{notice || (currentAccount ? library.message : "")}</div>
      <nav aria-label="會員內容" className="member-tabs">{TABS.map((item) => <button key={item} aria-pressed={tab === item} onClick={() => { setTab(item); setNotice(""); }}>{item}<small>{item === "收藏" ? rows.favorites.length : item === "已開啟" ? props.visibleKeys.length : item === "場景" ? rows.scenes.length : rows.places.length}</small></button>)}</nav>
      <div className="member-body">
        {rows.unavailableItems.length > 0 && <div className="member-hint">有 {rows.unavailableItems.length} 筆保存內容的格式不相容，其他收藏仍可使用。{rows.unavailableItems.map((item) => <div className="member-actions" key={`${item.table}:${item.id}`}><span>{item.name}（無法重開）</span><button disabled={!ready} onClick={() => attempt(() => memberLibraryStore.removeUnavailable(item))}>刪除不相容項目</button></div>)}</div>}
        {(tab === "收藏" || tab === "已開啟") && <>
          <p className="member-hint">{tab === "收藏" ? "常用圖層放在這裡，下次不必重新找。" : "這份清單直接反映現在的地圖。"}</p>
          {(tab === "收藏" ? rows.favorites : props.visibleKeys).map((key) => <article className="member-item" key={key}><div className="member-item-title"><Layers size={14} /><strong>{props.labels[key] ?? `${key}（已下架）`}</strong></div><div className="member-actions"><button disabled={!props.labels[key] || (!props.visibleKeys.includes(key) && props.lockedKeys.has(key))} onClick={() => props.onToggleLayer(key)}>{props.visibleKeys.includes(key) ? "關閉圖層" : props.lockedKeys.has(key) ? "需授權" : "開啟圖層"}</button><button disabled={!canFavorite} aria-label={`${rows.favorites.includes(key) ? "取消收藏" : "收藏"} ${props.labels[key] ?? key}`} onClick={() => attempt(() => memberLibraryStore.toggleFavorite(key))}>{rows.favorites.includes(key) ? "取消收藏" : "收藏"}</button></div></article>)}
          {(tab === "收藏" ? rows.favorites : props.visibleKeys).length === 0 && <div className="member-empty"><Bookmark size={24} /><p>{tab === "收藏" ? "還沒有收藏。搜尋圖層後，按星號加入。" : "目前沒有開啟圖層。"}</p></div>}
        </>}
        {tab === "場景" && <>
          <p className="member-hint">保存視角、圖層、參數與時間。即時場景重開會讀取最新資料；不是保存當時的資料副本。</p>
          <form className="member-create" onSubmit={(event) => { event.preventDefault(); attempt(async () => { await memberLibraryStore.saveScene(name, props.captureScene()); if (memberLibraryStore.getSnapshot().status === "ready") setName(""); }); }}>
            <label>場景名稱<input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} placeholder="例如：台北通勤觀察" /></label><button className="member-primary" disabled={!ready || !name.trim()}>保存目前場景</button>
          </form>
          {!props.userId && <p className="member-hint">登入後即可保存私人場景。</p>}
          {rows.scenes.map((scene) => <article className="member-item" key={scene.id}><strong>{scene.name}</strong><small>{scene.snapshot.layers.length} 個圖層 · {new Date(scene.updated_at).toLocaleString("zh-TW")}</small><div className="member-actions"><button onClick={() => openScene(scene)}>重開場景</button>{renderRename(scene, "scene")}<button disabled={!ready} onClick={() => attempt(() => memberLibraryStore.saveScene(`${scene.name.slice(0, 94)} 副本`, scene.snapshot))}>另存副本</button><button disabled={!ready} onClick={() => attempt(() => memberLibraryStore.saveScene(scene.name, props.captureScene(), scene))}>更新為目前畫面</button><button disabled={!ready} onClick={() => attempt(() => memberLibraryStore.removeScene(scene))}>刪除</button></div></article>)}
        </>}
        {tab === "地點" && <>
          <p className="member-hint">保存自己選定的位置或範圍，不把圖層的代表點當成事件事發地。</p>
          <form className="member-create" onSubmit={(event) => { event.preventDefault(); attempt(async () => {
            let raw: unknown; try { raw = JSON.parse(geometry); } catch { throw new Error("請先選取位置，或輸入有效 GeoJSON geometry。"); }
            const parsed = validatePlace({ name, geometry: raw, source_kind: sourceKind, precision: "user_selected" });
            if (!parsed.ok) throw new Error(parsed.errors.join("；"));
            await memberLibraryStore.savePlace(parsed.value); if (memberLibraryStore.getSnapshot().status === "ready") { setName(""); setGeometry(""); }
          }); }}>
            <label>地點／範圍名稱<input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} placeholder="例如：車站周邊" /></label>
            <div className="member-actions"><button type="button" onClick={() => chooseGeometry("center")}>地圖中心</button><button type="button" onClick={() => chooseGeometry("selection")}>地圖點選位置</button><button type="button" onClick={() => chooseGeometry("bounds")}>目前視野外接矩形</button></div>
            <label>位置／範圍（WGS84 GeoJSON）<textarea rows={3} value={geometry} maxLength={16000} onChange={(event) => { setGeometry(event.target.value); setSourceKind("manual"); }} placeholder={'{"type":"Point","coordinates":[121.5,25.04]}'} /></label>
            <button className="member-primary" disabled={!ready || !name.trim() || !geometry.trim()}>保存私人地點</button>
          </form>
          {!props.userId && <p className="member-hint">登入後即可保存私人地點。</p>}
          {rows.places.map((place) => <article className="member-item" key={place.id}><div className="member-item-title"><MapPin size={14} /><strong>{place.name}</strong></div><small>{place.geometry.type === "Point" ? "自選位置" : "自選範圍"} · {new Date(place.updated_at).toLocaleString("zh-TW")}</small><div className="member-actions"><button onClick={() => attempt(() => props.restorePlace(place))}>在地圖查看</button>{renderRename(place, "place")}<button disabled={!ready} onClick={() => attempt(() => memberLibraryStore.removePlace(place))}>刪除</button></div></article>)}
        </>}
      </div>
      <footer>私人保存 · 圖層權限在每次開啟時重新檢查</footer>
    </section>
  );
}
