/**
 * City Sound Atlas 接收點面板（計畫書 §6.2、§8 B）：任一聲景圖層開著時由 App 掛在右下停靠欄。
 * - 固定聲明：相對聲源活動推估，非實測噪音（非 dB）。
 * - 場景選單（原生 select）、放置／清除接收點（戶外 1.5 m 假設）。
 * - 此刻前 5 個來源：類別、距離、證據、空間／時間精度、資料來源與最後更新。
 * - 各家族來源健康（白話）；落雷兩源皆非 ok → 「無法判斷是否有雷」，不說安靜。
 * - 24 小時構成（SoundDayProfile）。
 * 「此刻」由 Host 節流算好寫進 soundAtlasStore；本元件只訂閱 store，不碰 currentTime。
 */
import { useSyncExternalStore, type CSSProperties } from "react";
import { BORDER, COLORS, CONTROL, ELEVATION, FONT_CJK, FONT_DATA, FONT_SIZE, LIGHT, RADIUS, SURFACE } from "../../styles/designTokens";
import { PanelHeader } from "../sidebar/PanelHeader";
import { useLocale } from "../../state/localeStore";
import { layerVisibilityStore, useLayerVisible } from "../../state/layerVisibilityStore";
import { soundAtlasStore } from "../../sound/soundAtlasStore";
import { SOUND_SCENES, snapshotApplies, type SoundSceneId } from "../../sound/scenes";
import { clearReceiver, clearRoute, finishRoute, playSoundScene, selectSoundScene, setRouteMode, startPlacingReceiver, startRouteDrawing } from "../../sound/soundAtlasActions";
import { dominantFamilies, SoundRouteProfile } from "./SoundRouteProfile";
import { topContributionsForDisplay, type SetOrigin } from "../../sound/soundAtlasData";
import { AVIATION } from "../../sound/model/soundProfiles";
import { SOUND_FAMILY_COLORS } from "../../sound/soundAtlasColors";
import type { SoundSourceFamily, SourceContribution, SourceCoverage } from "../../sound/types";
import { SoundDayProfile } from "./SoundDayProfile";
import {
  EVIDENCE_KEYS, FAMILY_KEYS, HEALTH_KEYS, SCENE_KEYS, STATUS_KEYS, STRUCTURE_KEYS,
  formatDistanceM, formatPotential, formatTaipeiTime, originKey, providerKey, reasonKey, spatialPrecisionKey, temporalPrecisionKey,
} from "./soundAtlasText";

const FAMILY_LAYER_KEYS = {
  aviation: "soundAviation",
  rain: "soundRain",
  thunder: "soundThunder",
  waste_collection: "soundWaste",
  rail: "soundRail",
  road_traffic: "soundRoadTraffic",
  roadwork: "soundRoadwork",
  wind_vegetation: "soundWindFoliage",
  coastal_wave: "soundCoastalWave",
  river_water: "soundRiverWater",
} as const satisfies Record<SoundSourceFamily, string>;

const TOP_N = 5;

function useSoundAtlasState() {
  return useSyncExternalStore(soundAtlasStore.subscribe, soundAtlasStore.get);
}

/** 家族最後更新：該家族 records 的最新觀測／表定時間（不是牆鐘） */
function latestSourceTime(contribs: readonly SourceContribution[]): string | null {
  let best: string | null = null;
  for (const c of contribs) if (!best || c.sourceTime > best) best = c.sourceTime;
  return best;
}

export function SoundReceiverPanel({ isDark }: { isDark: boolean }) {
  const { t, active: activeLocale } = useLocale();
  const st = useSoundAtlasState();
  const c = isDark
    ? { bg: SURFACE.strong, border: BORDER.panel, text: COLORS.textStrong, muted: COLORS.textMuted, dim: COLORS.textDim, ctrlBg: CONTROL.bg, ctrlBorder: CONTROL.border, optionBg: CONTROL.optionBg, warn: COLORS.statusWarn, shadow: ELEVATION.lg }
    : { bg: LIGHT.surfaceStrong, border: LIGHT.border, text: LIGHT.textStrong, muted: LIGHT.textMuted, dim: LIGHT.textDim, ctrlBg: LIGHT.controlBg, ctrlBorder: LIGHT.controlBorder, optionBg: LIGHT.surfaceSolid, warn: LIGHT.statusWarn, shadow: LIGHT.elevationLg };

  const title = t("soundAtlas.title");
  const note: CSSProperties = { fontSize: FONT_SIZE.xs, color: c.dim, lineHeight: 1.5 };
  const sectionTitle: CSSProperties = { fontSize: FONT_SIZE.xs, color: c.muted, fontWeight: 600, marginTop: 4 };
  const btn: CSSProperties = {
    fontSize: FONT_SIZE.sm, fontFamily: FONT_CJK, color: c.text, background: c.ctrlBg, border: `1px solid ${c.ctrlBorder}`,
    borderRadius: RADIUS.md, padding: "3px 8px", cursor: "pointer",
  };

  const closeAll = () => layerVisibilityStore.setBulk({ soundAviation: false, soundRain: false, soundThunder: false, soundWaste: false, soundRail: false, soundRoadTraffic: false, soundRoadwork: false, soundWindFoliage: false, soundCoastalWave: false, soundRiverWater: false });
  const vis: Record<SoundSourceFamily, boolean> = {
    aviation: useLayerVisible(FAMILY_LAYER_KEYS.aviation),
    rain: useLayerVisible(FAMILY_LAYER_KEYS.rain),
    thunder: useLayerVisible(FAMILY_LAYER_KEYS.thunder),
    waste_collection: useLayerVisible(FAMILY_LAYER_KEYS.waste_collection),
    rail: useLayerVisible(FAMILY_LAYER_KEYS.rail),
    road_traffic: useLayerVisible(FAMILY_LAYER_KEYS.road_traffic),
    roadwork: useLayerVisible(FAMILY_LAYER_KEYS.roadwork),
    wind_vegetation: useLayerVisible(FAMILY_LAYER_KEYS.wind_vegetation),
    coastal_wave: useLayerVisible(FAMILY_LAYER_KEYS.coastal_wave),
    river_water: useLayerVisible(FAMILY_LAYER_KEYS.river_water),
  };
  const enabledFamilies = (Object.keys(FAMILY_LAYER_KEYS) as SoundSourceFamily[]).filter((f) => vis[f]);

  const receiver = st.receiver;
  const current = st.current;
  const { rows: top, farAviation, unknownAviation } = topContributionsForDisplay(current?.contributions ?? [], TOP_N);
  const sceneApplies = snapshotApplies(st.snapshot, st.dateKey ?? "", receiver);

  // 各家族的來源健康：直接列 coverage 的 provider × status
  const healthRows: { family: SoundSourceFamily; coverage: SourceCoverage[] }[] = enabledFamilies.map((f) => ({ family: f, coverage: st.sets[f]?.coverage ?? [] }));
  const thunderSet = st.sets.thunder;
  const thunderNoHealthy = !!thunderSet && thunderSet.coverage.length > 0 && thunderSet.coverage.every((cv) => cv.status !== "ok");

  return (
    <section
      aria-label={title}
      style={{
        width: "min(360px, calc(100vw - 32px))", maxHeight: "100%", overflowY: "auto", background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: RADIUS.xl, boxShadow: c.shadow, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", fontFamily: FONT_CJK,
      }}
    >
      <PanelHeader eyebrow={t("soundAtlas.eyebrow")} title={title} onClose={closeAll} borderColor={c.border} mutedColor={c.muted} textColor={c.text} />
      <div style={{ padding: "8px 12px 10px", display: "flex", flexDirection: "column", gap: 6, fontSize: FONT_SIZE.sm, color: c.text }}>
        <div role="note" style={{ ...note, color: c.warn }}>{t("soundAtlas.disclaimer")}</div>

        {/* 場景 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: c.muted }}>
          <label htmlFor="sound-atlas-scene" style={{ flexShrink: 0 }}>{t("soundAtlas.scene.label")}</label>
          <select
            id="sound-atlas-scene"
            value={st.sceneId ?? ""}
            onChange={(e) => selectSoundScene((e.target.value || null) as SoundSceneId | null)}
            style={{ flex: 1, minWidth: 0, fontSize: FONT_SIZE.sm, fontFamily: FONT_CJK, color: c.text, background: c.ctrlBg, border: `1px solid ${c.ctrlBorder}`, borderRadius: RADIUS.md, padding: "3px 4px" }}
          >
            <option value="" style={{ background: c.optionBg }}>{t("soundAtlas.scene.none")}</option>
            {SOUND_SCENES.map((s) => <option key={s.id} value={s.id} style={{ background: c.optionBg }}>{t(SCENE_KEYS[s.id].title)}</option>)}
          </select>
          {st.sceneId && (
            <button
              type="button"
              style={{ ...btn, flexShrink: 0 }}
              disabled={!st.snapshot?.focus_time}
              onClick={() => { playSoundScene(); }}
            >
              {t("soundAtlas.scene.play")}
            </button>
          )}
        </div>
        {st.sceneId && (
          <div style={note}>
            {/* 快照的選點理由只有中文；英日介面先不顯示（使用者 2026-11-11 同意） */}
            {activeLocale === "zh-TW" && st.snapshot?.receiver?.reason_zh && (
              <>
                {t("soundAtlas.scene.reason")}：{st.snapshot.receiver.reason_zh}
                <br />
              </>
            )}
            {st.snapshotStatus === "loading" && t("soundAtlas.scene.snapshotLoading")}
            {st.snapshotStatus === "missing" && t("soundAtlas.scene.snapshotMissing")}
            {st.snapshotStatus === "loaded" && (sceneApplies ? t("soundAtlas.scene.snapshotLoaded") : t("soundAtlas.scene.outside"))}
          </div>
        )}

        {/* 接收點 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button type="button" style={{ ...btn, borderColor: st.placing ? SOUND_FAMILY_COLORS.aviation : c.ctrlBorder }} aria-pressed={st.placing} onClick={startPlacingReceiver}>
            {st.placing ? t("soundAtlas.receiver.placing") : t("soundAtlas.receiver.place")}
          </button>
          {receiver && <button type="button" style={btn} onClick={clearReceiver}>{t("soundAtlas.receiver.clear")}</button>}
        </div>
        {receiver ? (
          <div style={note}>
            <span style={{ fontFamily: FONT_DATA }}>{receiver.latitude.toFixed(4)}, {receiver.longitude.toFixed(4)}</span>
            {" · "}{t("soundAtlas.receiver.assumption", { h: String(receiver.heightM ?? 1.5) })}
          </div>
        ) : (
          <div style={note}>{t("soundAtlas.receiver.none")}</div>
        )}

        {/* 此刻來源 */}
        {receiver && (
          <>
            <div style={sectionTitle}>
              {t("soundAtlas.current.title")}
              {current && <span style={{ fontFamily: FONT_DATA, fontWeight: 400, marginLeft: 6 }}>{formatTaipeiTime(current.unixSeconds, true)}</span>}
            </div>
            {st.loading.length > 0 && <div style={note}>{t("soundAtlas.current.loading")}</div>}
            {current && top.length === 0 && farAviation.count === 0 && unknownAviation.count === 0 && st.loading.length === 0 && <div style={note}>{t("soundAtlas.current.empty")}</div>}
            {top.map((cb) => <ContributionRow key={cb.sourceId} c={cb} origin={st.origins[cb.family] ?? "live"} colors={c} />)}
            {unknownAviation.count > 0 && <div style={note}>{t("soundAtlas.current.unknownAviation", { count: unknownAviation.count })}</div>}
            {/* 最高值無條件捨去：0.0999 不可顯示成與門檻相同的 0.10 */}
            {farAviation.count > 0 && (
              <div style={note}>
                {t("soundAtlas.current.farAviation", { count: farAviation.count, max: formatPotential(Math.floor(farAviation.maxPotential * 100) / 100), min: formatPotential(AVIATION.displayMinPotential.value) })}
              </div>
            )}
          </>
        )}

        {/* 來源健康 */}
        {healthRows.length > 0 && (
          <>
            <div style={sectionTitle}>{t("soundAtlas.health.title")}</div>
            {healthRows.map(({ family, coverage }) => {
              const fam = current?.families.find((f) => f.family === family);
              const updated = fam ? latestSourceTime(fam.contributions) : null;
              return (
                <div key={family} style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap", fontSize: FONT_SIZE.xs }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: SOUND_FAMILY_COLORS[family], flexShrink: 0, alignSelf: "center" }} />
                  <span style={{ color: c.text, minWidth: 40 }}>{t(FAMILY_KEYS[family])}</span>
                  {fam && <span style={{ color: c.muted }}>{t(STATUS_KEYS[fam.status])}</span>}
                  <span style={{ color: c.dim }}>
                    {coverage.length === 0
                      ? t("soundAtlas.health.unavailable")
                      : [...new Set(coverage.map((cv) => `${t(providerKey(cv.provider))} ${t(
                        // 施工：資料正常但本縣市沒有發布施工 → 寫明，不讓「正常」看起來像「確認沒施工」
                        cv.status === "ok" && family === "roadwork" && fam?.contributions.some((x) => x.unknownReason === "roadwork_city_not_covered")
                          ? "soundAtlas.health.okNotPublished"
                          // 風、浪即時沒有讀取路徑：寫「僅場景快照提供」，不寫「未載入」
                          : cv.status === "unavailable" && cv.reason?.endsWith("(snapshot_only)")
                            ? "soundAtlas.reason.snapshotOnly"
                            : HEALTH_KEYS[cv.status],
                      )}`))].join("、")}
                    {" · "}{t(originKey(st.origins[family]))}
                    {updated && <> · {t("soundAtlas.row.updated")} <span style={{ fontFamily: FONT_DATA }}>{formatTaipeiTime(updated, true)}</span></>}
                  </span>
                </div>
              );
            })}
            {thunderNoHealthy && <div role="note" style={{ ...note, color: c.warn }}>{t("soundAtlas.health.thunderUnknown")}</div>}
          </>
        )}

        {/* 路線剖面：沿途主要聲源（不是噪音暴露量） */}
        <div style={sectionTitle}>{t("soundAtlas.route.title")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <button type="button" style={{ ...btn, borderColor: st.route.drawing ? SOUND_FAMILY_COLORS.aviation : c.ctrlBorder }} aria-pressed={st.route.drawing} onClick={startRouteDrawing}>
            {st.route.drawing ? t("soundAtlas.route.drawing", { n: st.route.points.length }) : t("soundAtlas.route.draw")}
          </button>
          {st.route.drawing && <button type="button" style={btn} disabled={st.route.points.length < 2} onClick={finishRoute}>{t("soundAtlas.route.finish")}</button>}
          {(st.route.points.length > 0 || st.route.result) && !st.route.drawing && <button type="button" style={btn} onClick={clearRoute}>{t("soundAtlas.route.clear")}</button>}
          <div role="group" aria-label={t("soundAtlas.route.modeLabel")} style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
            {(["walk", "bike"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={st.route.mode === m} onClick={() => setRouteMode(m)}
                style={{ ...btn, padding: "2px 6px", borderColor: st.route.mode === m ? c.text : c.ctrlBorder, color: st.route.mode === m ? c.text : c.muted }}>
                {t(m === "walk" ? "soundAtlas.route.walk" : "soundAtlas.route.bike")}
              </button>
            ))}
          </div>
        </div>
        {st.route.result ? (
          <>
            <div style={note}>
              <span style={{ fontFamily: FONT_DATA }}>
                {formatTaipeiTime(st.route.result.departUnix, true)}–{formatTaipeiTime(st.route.result.arriveUnix)}
              </span>
              {" · "}{formatDistanceM(st.route.result.totalDistanceM)}
              {" · "}{t("soundAtlas.route.main")}{dominantFamilies(st.route.result).length === 0
                ? t("soundAtlas.route.noneActive")
                : dominantFamilies(st.route.result).map((d) => `${t(FAMILY_KEYS[d.family])} ${Math.round(d.share * 100)}%`).join("、")}
            </div>
            <SoundRouteProfile profile={st.route.result} mutedColor={c.muted} dimColor={c.dim} axisColor={c.ctrlBorder} />
            <div style={note}>{t("soundAtlas.route.notExposure")}</div>
            <div style={note}>{t("soundAtlas.route.limits")}</div>
          </>
        ) : (
          <div style={note}>{t("soundAtlas.route.hint")}</div>
        )}

        {/* 24 小時 */}
        <div style={sectionTitle}>{t("soundAtlas.profile.title")}</div>
        {st.profile ? (
          <>
            <SoundDayProfile profile={st.profile} mutedColor={c.muted} dimColor={c.dim} axisColor={c.ctrlBorder} />
            <div style={note}>{t("soundAtlas.profile.gapNote")}</div>
          </>
        ) : (
          <div style={note}>{receiver ? t("soundAtlas.current.loading") : t("soundAtlas.profile.none")}</div>
        )}
      </div>
    </section>
  );
}

/** notes 裡 `key:value` 的值（例：flow_days:8）；沒有回 null */
function noteValue(notes: readonly string[], key: string): string | null {
  const n = notes.find((x) => x.startsWith(`${key}:`));
  return n ? n.slice(key.length + 1) : null;
}

function ContributionRow({ c: cb, origin, colors }: {
  c: SourceContribution;
  origin: SetOrigin;
  colors: { text: string; muted: string; dim: string; ctrlBorder: string };
}) {
  const { t } = useLocale();
  const status = cb.status === "active" ? "active" : "unknown";
  return (
    <div style={{ borderLeft: `3px solid ${SOUND_FAMILY_COLORS[cb.family]}`, paddingLeft: 6, fontSize: FONT_SIZE.xs, lineHeight: 1.5 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "baseline", color: colors.text }}>
        <strong>{t(FAMILY_KEYS[cb.family])}</strong>
        <span style={{ color: colors.muted }}>{t(STATUS_KEYS[status])}</span>
        {cb.family === "thunder" && cb.status === "active" && cb.thunderTiming && (
          <span style={{ color: SOUND_FAMILY_COLORS.thunder, fontWeight: 600 }}>
            {t("soundAtlas.row.thunderArrived", { delay: cb.thunderTiming.delayS.toFixed(1) })}
          </span>
        )}
        <span style={{ marginLeft: "auto", fontFamily: FONT_DATA }}>
          {formatDistanceM(cb.spatialDistanceM)} · {formatPotential(cb.relativePotential)}
        </span>
      </div>
      <div style={{ color: colors.dim }}>
        {t("soundAtlas.row.evidence")} {t(EVIDENCE_KEYS[cb.evidence])}
        {" · "}{t("soundAtlas.row.spatial")} {t(spatialPrecisionKey(cb.spatialPrecision))}
        {" · "}{t("soundAtlas.row.temporal")} {t(temporalPrecisionKey(cb.temporalPrecision))}
        {cb.family === "rail" && cb.railStructure && <> · {t("soundAtlas.row.railStructure")} {t(STRUCTURE_KEYS[cb.railStructure])}</>}
        {cb.thunderTiming && <> · {t("soundAtlas.row.delay")} <span style={{ fontFamily: FONT_DATA }}>{cb.thunderTiming.delayS.toFixed(1)} s</span></>}
        {cb.status === "unknown" && <> · {t("soundAtlas.row.reason")} {t(reasonKey(cb.unknownReason))}</>}
        {" · "}{t("soundAtlas.row.source")} {t(originKey(origin))}
        {" · "}<span style={{ fontFamily: FONT_DATA }}>{formatTaipeiTime(cb.sourceTime, true)}</span>
      </div>
      {/* 道路依證據等級標明（國道實測／臺北典型／新北等級推估）、施工只有許可期間（不是機具運轉）：固定標明 */}
      {cb.family === "road_traffic" && cb.proxyKind === "typical_weekday_volume" && (
        <div style={{ color: colors.muted }}>{t("soundAtlas.row.typicalNote", { days: noteValue(cb.notes, "flow_days") ?? "—" })}</div>
      )}
      {cb.family === "road_traffic" && cb.proxyKind === "observed_volume" && <div style={{ color: colors.muted }}>{t("soundAtlas.row.freewayObservedNote")}</div>}
      {cb.family === "road_traffic" && cb.proxyKind === "road_type_no_volume" && <div style={{ color: colors.muted }}>{t("soundAtlas.row.roadProxyNote")}</div>}
      {cb.family === "roadwork" && <div style={{ color: colors.muted }}>{t("soundAtlas.row.permitNote")}</div>}
    </div>
  );
}
