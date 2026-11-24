import { globalEventsToGeoJSON, type GlobalEventPoint, type GlobalEventRecord } from "./globalEventsLoader";
import { GLOBAL_EVENT_SEVERITIES } from "./globalEventsTypes";

export type GlobalEventsView = "recent7d" | "timeline";
export const GLOBAL_EVENT_ICON_RADIUS = 8;

/**
 * Rolling selected days, never the timeline's forward-looking seven-day window.
 * Floors to the minute so repeated calls that land in the same minute (periodic
 * refresh callers comparing bounds to detect a genuinely new window) produce an
 * identical, comparable key instead of always missing on raw millisecond `Date.now()`.
 */
export function recentGlobalEventWindow(nowMs = Date.now(), days = 7): { start: string; end: string } {
  const alignedNow = Math.floor(nowMs / 60_000) * 60_000;
  return { start: new Date(alignedNow - days * 86_400_000).toISOString(), end: new Date(alignedNow).toISOString() };
}

/** One latest version per event within the requested overview, not a fabricated end-time. */
export function selectGlobalEventsOverview<T extends GlobalEventRecord>(rows: readonly T[]): T[] {
  const winners = new Map<string, T>();
  for (const row of rows) {
    const old = winners.get(row.eventId);
    if (!old || (row.publicationNo ?? 0) > (old.publicationNo ?? 0)
      || ((row.publicationNo ?? 0) === (old.publicationNo ?? 0)
        && (Date.parse(row.displayFrom ?? "") || 0) > (Date.parse(old.displayFrom ?? "") || 0))) {
      winners.set(row.eventId, row);
    }
  }
  return dedupeGlobalEventPlaces(rows.filter((row) => {
    const winner = winners.get(row.eventId);
    return winner?.versionId === row.versionId
      && winner.lifecycleState !== "retracted" && winner.lifecycleState !== "superseded";
  }));
}

export function dedupeGlobalEventPlaces<T extends GlobalEventRecord>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    // Qwen explicitly linked these candidates to the same batch-scoped event. Source-derived
    // place IDs may differ while the real point/semantics are identical; only the display dedupes.
    const placeIdentity = row.aiGroupId && row.coordinates !== null
      ? `${coordinateKey(row.coordinates)}/${row.locationKind}/${row.countryCodeScheme ?? ""}:${row.countryCode ?? ""}`
      : row.placeKey ?? row.displayPlaceId ?? row.eventPlaceId;
    const key = `${row.eventId}/${placeIdentity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function coordinateKey(coordinates: readonly number[]): string {
  return coordinates.map((value) => value.toFixed(6)).join(",");
}

/** Camera-independent layout. Native symbol offsets move pixels, never geographic anchors. */
export function layoutGlobalEventPoints(
  rows: readonly GlobalEventPoint[],
  expandedGroups: ReadonlySet<string> = new Set(),
): {
  points: GeoJSON.FeatureCollection<GeoJSON.Point>;
  anchors: GeoJSON.FeatureCollection<GeoJSON.Point>;
  clusters: GeoJSON.FeatureCollection<GeoJSON.Point>;
} {
  const groups = new Map<string, GlobalEventPoint[]>();
  for (const row of dedupeGlobalEventPlaces(rows)) {
    const key = coordinateKey(row.coordinates);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  const points: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: "FeatureCollection", features: [] };
  const anchors: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: "FeatureCollection", features: [] };
  const clusters: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: "FeatureCollection", features: [] };
  for (const [groupKey, group] of groups) {
    group.sort((a, b) => a.eventId.localeCompare(b.eventId));
    if (group.length > 6) {
      clusters.features.push({ type: "Feature", geometry: { type: "Point", coordinates: group[0]!.coordinates },
        properties: { group_key: groupKey, point_count: group.length, expanded: expandedGroups.has(groupKey) } });
      if (!expandedGroups.has(groupKey)) continue;
    }
    if (group.length > 1) anchors.features.push({ type: "Feature", geometry: { type: "Point", coordinates: group[0]!.coordinates },
      properties: { group_key: groupKey, display_only: true } });
    for (const [index, row] of group.entries()) {
      const feature = globalEventsToGeoJSON([row]).features[0]!;
      const iconScale = (GLOBAL_EVENT_SEVERITIES.find((item) => item.value === row.severity)?.radius ?? 4.5) / GLOBAL_EVENT_ICON_RADIUS;
      let offsetX = 0;
      let offsetY = 0;
      if (group.length > 1) {
        const ring = Math.floor(index / 12);
        const count = Math.min(12, group.length - ring * 12);
        const angle = (index % 12) * 2 * Math.PI / count - Math.PI / 2;
        const radius = group.length === 2 ? 13 : Math.max(22, Math.min(12, group.length) * 4) + ring * 30;
        offsetX = Math.cos(angle) * radius;
        offsetY = Math.sin(angle) * radius;
      }
      feature.properties = { ...feature.properties, original_lng: row.coordinates[0], original_lat: row.coordinates[1],
        display_offset: group.length > 1, colocated_count: group.length,
        display_offset_x: offsetX, display_offset_y: offsetY, icon_scale: iconScale,
        // Mapbox multiplies icon-offset by icon-size; normalize so severity never changes spacing.
        icon_offset: [offsetX / iconScale, offsetY / iconScale] };
      points.features.push(feature);
    }
  }
  return { points, anchors, clusters };
}

/** Static quadratic association arc. Unwrapped longitude takes the short dateline crossing. */
export function globalEventAssociationArc(from: [number, number], to: [number, number]): number[][] {
  const toLng = to[0] + 360 * Math.round((from[0] - to[0]) / 360);
  const dx = toLng - from[0];
  const dy = to[1] - from[1];
  const bend = 0.18;
  const control = [(from[0] + toLng) / 2 - dy * bend, Math.max(-80, Math.min(80, (from[1] + to[1]) / 2 + dx * bend))];
  return Array.from({ length: 33 }, (_, i) => {
    const t = i / 32;
    return [(1 - t) ** 2 * from[0] + 2 * (1 - t) * t * control[0]! + t ** 2 * toLng,
      (1 - t) ** 2 * from[1] + 2 * (1 - t) * t * control[1]! + t ** 2 * to[1]];
  });
}

/** Minimum spanning association tree: connected but no invented origin/direction or all-pairs hairball. */
export function globalEventRelations(rows: readonly GlobalEventPoint[]): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const countryIdentity = (row: GlobalEventPoint): string | null => {
    if (row.countryCode) return `${row.countryCodeScheme ?? "published"}:${row.countryCode}`;
    // Published representative points already carry verified country-level semantics even
    // when legacy event_places omitted country_code. Use the named country, never infer ISO.
    return row.locationKind === "country_center" && row.placeName?.trim()
      ? `country-name:${row.placeName.normalize("NFKC").trim()}` : null;
  };
  const events = new Map<string, GlobalEventPoint[]>();
  for (const row of dedupeGlobalEventPlaces(rows)) {
    const country = countryIdentity(row);
    if (!country) continue;
    const places = events.get(row.eventId) ?? [];
    if (!places.some((p) => countryIdentity(p) === country)) places.push(row);
    events.set(row.eventId, places);
  }
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (const [eventId, unsorted] of events) {
    const places = [...unsorted].sort((a, b) => countryIdentity(a)!.localeCompare(countryIdentity(b)!));
    if (places.length < 2) continue;
    const connected = [places.shift()!];
    while (places.length) {
      let best = { distance: Infinity, from: connected[0]!, index: 0 };
      for (const from of connected) for (const [index, to] of places.entries()) {
        const deltaLng = to.coordinates[0] - from.coordinates[0];
        const dx = deltaLng - 360 * Math.round(deltaLng / 360);
        const distance = dx ** 2 + (to.coordinates[1] - from.coordinates[1]) ** 2;
        if (distance < best.distance) best = { distance, from, index };
      }
      const to = places.splice(best.index, 1)[0]!;
      if (best.distance > 0) features.push({ type: "Feature", geometry: { type: "LineString", coordinates: globalEventAssociationArc(best.from.coordinates, to.coordinates) },
        properties: { ...globalEventsToGeoJSON([to]).features[0]!.properties, event_id: eventId, relation_kind: "association" } });
      connected.push(to);
    }
  }
  return { type: "FeatureCollection", features };
}

/**
 * 「可能同一件事」門檻：2026-11-16～23 的 3,050 個有座標、非雜訊事件實測（站主 11-23：大多是同一件事換個寫法）。
 * 只靠標題字面相似（舊規則）約 34% 事件有連結；加上「摘要相近」與「同國同類 24 小時內共同專有名詞」後約 46%，
 * 隨機抽 40 對非氣旋新增連結人工判讀，套用本門檻後保留的 32 對全部是同一件事（量測表在國際新聞脈動報告第二段）。
 * 誤連比漏連糟：跨國只認標題很像；兩邊都是地震但震級不同一律不連。
 */
export const GLOBAL_EVENT_STORY_LINK = {
  maxHours: 48,
  sameCountryMin: 0.5,
  crossCountryMin: 0.6,
  /** 摘要（AI 中文摘要）雙字詞相似度：換句話說的標題常有相近摘要 */
  summaryMin: 0.35,
  /** 同國、同分類、24 小時內：共同專有名詞 ≥3，或 ≥2 且標題相似度 ≥0.2 */
  nameHours: 24,
  nameStrong: 3,
  nameWeak: 2,
  nameWeakTitleMin: 0.2,
  /** Bigrams shared by more events than this carry no story identity (常見詞、套版字). */
  maxBigramEvents: 60,
  /** 每件最多畫幾條虛線（大型事件會有上百則報導，全部畫會糊成一片；清單與加亮仍包含全部） */
  maxLinesPerEvent: 3,
  /** 共同人物／組織：同一個名字出現在超過這麼多件就不算（大人物會黏住幾百件） */
  maxEntityEvents: 20,
} as const;

/** popup「可能相關報導」清單最多列幾則。 */
export const GLOBAL_EVENT_STORY_LIST_MAX = 6;
/** 地圖短標題從這個縮放開始出現（全球縮放不顯示）。 */
export const GLOBAL_EVENT_LABEL_MIN_ZOOM = 4;

/** 地圖短標題：中文標題取前 14 字，超過加「…」。 */
export function globalEventShortLabel(title: string): string {
  const chars = [...title.trim()];
  return chars.length > 14 ? `${chars.slice(0, 14).join("")}…` : chars.join("");
}

function hanBigrams(text: string): Set<string> {
  const han = text.replace(/[^㐀-鿿]/g, "");
  const grams = new Set<string>();
  for (let i = 0; i < han.length - 1; i++) grams.add(han.slice(i, i + 2));
  return grams;
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared++;
  return shared / (a.size + b.size - shared);
}

/** 英文標題裡大寫開頭、但不是專有名詞的常見字（含 Title Case 造成的假名詞與媒體尾綴字）。 */
const NAME_STOPWORDS = new Set(`the and for with from after over amid into says said new news live update updates latest report reports breaking
government minister president official officials police court state national people least killed dead death deaths attack
weather forecast alert alerts warning warns rain heavy storm cyclone earthquake magnitude fire wildfire flood bird flu outbreak cases case
world day week year years first second third two three four five six seven eight nine ten hundred thousand million billion
north south east west central eastern western northern southern city county district districts region province international global
cyber cyberattack data breach hit hits strikes strike during before against about today tomorrow yesterday
november october december monday tuesday wednesday thursday friday saturday sunday more than this that what why how who
radio reported english major dozens severe potential emergency declared tracks category analysis opinion explained watch video photos read
nov oct dec say could would should calls call urges under near off out onto upon some many most all any other another one its their his her`.split(/\s+/));

/** 標題在「 | 」「 - 」之後多半是媒體名，先切掉再取專有名詞。 */
function headlineNames(headline: string | null | undefined, placeWords: ReadonlySet<string>): Set<string> {
  const head = (headline ?? "").split(/\s[|\-–—]\s/)[0] ?? "";
  const names = new Set<string>();
  for (const match of head.matchAll(/\b[A-Z][A-Za-z-]{2,}\b/g)) {
    const word = match[0].toLowerCase();
    if (!NAME_STOPWORDS.has(word) && !placeWords.has(word)) names.add(word);
  }
  return names;
}

// 小數規模（5.7）與有「規模／震級／M」前綴或「級」後綴的整數規模（規模5、6級）；數值正規化，5 與 5.0 視為相同。
const MAGNITUDE = /(?<![\d.])\d{1,2}\.\d+|(?<=(?:規模|震級|magnitude|\bM)\s*)\d{1,2}(?![\d.])|(?<![\d.])\d{1,2}(?![\d.])(?=\s*級)/gi;
const magnitudesOf = (text: string) => new Set((text.match(MAGNITUDE) ?? []).map((m) => String(Number(m))));
const QUAKE = /地震|強震|earthquake|quake/i;

export interface GlobalEventRelatedReport { eventId: string; title: string; score: number }

export interface GlobalEventStoryLinks {
  /** eventId → 所有相關 eventId（可能同一件事＋共同人物／組織，對稱），點選加亮用。 */
  neighbours: Map<string, Set<string>>;
  /** eventId → 可能同一件事的其他報導（依相似度排序），popup 清單用。 */
  related: Map<string, GlobalEventRelatedReport[]>;
  /** eventId → 其他 eventId → 共同的人物／組織名稱；欄位存在才有（上游 collector 套用後）。 */
  entityLinks: Map<string, Map<string, string[]>>;
  lines: GeoJSON.FeatureCollection<GeoJSON.LineString>;
}

/**
 * "Possibly the same story" between different displayed events (48 hours of source observation):
 * same country → similar zh title, similar zh summary, or (same category within 24 h) shared proper
 * names from the source headline; cross-country → very similar title only. Never merges events,
 * never moves points; a link only says two reports may describe one happening (not movement,
 * cause or order). Computed on the currently visible rows only, so filters bound it. Each event
 * draws at most `maxLinesPerEvent` dashed lines to its closest matches; events at one shared
 * coordinate get no line (zero length) but still count as related for highlight and the list.
 */
export function globalEventStoryLinks(rows: readonly GlobalEventPoint[]): GlobalEventStoryLinks {
  /** 比對用小寫，顯示用第一次看到的原名。 */
  const entityDisplay = new Map<string, string>();
  const L = GLOBAL_EVENT_STORY_LINK;
  interface Story {
    eventId: string; title: string; grams: Set<string>; summary: Set<string>; names: Set<string>;
    category: string | null; time: number; countries: Set<string>; points: GlobalEventPoint[];
    quake: boolean; magnitudes: Set<string>; entities: Set<string>;
  }
  const placeWords = new Set<string>();
  for (const row of rows) for (const part of [row.placeName, row.admin1, row.admin2]) {
    for (const word of (part ?? "").match(/[A-Za-z]{3,}/g) ?? []) placeWords.add(word.toLowerCase());
  }
  const stories = new Map<string, Story>();
  for (const row of rows) {
    const time = Date.parse(row.validFrom ?? "");
    let story = stories.get(row.eventId);
    if (!story) {
      story = { eventId: row.eventId, title: row.titleZhTw, grams: hanBigrams(row.titleZhTw), summary: hanBigrams(row.summaryZhTw ?? ""),
        names: headlineNames(row.sourceHeadline, placeWords), category: row.category, time, countries: new Set(), points: [],
        quake: QUAKE.test(`${row.titleZhTw} ${row.sourceHeadline ?? ""}`), magnitudes: magnitudesOf(`${row.titleZhTw} ${row.sourceHeadline ?? ""}`),
        entities: new Set((row.entities ?? []).filter((entity) => entity.name.trim().length >= 2).map((entity) => {
          const key = `${entity.kind}:${entity.name.trim().toLowerCase()}`;
          if (!entityDisplay.has(key)) entityDisplay.set(key, entity.name.trim());
          return key;
        })) };
      stories.set(row.eventId, story);
    }
    if (row.countryCode) story.countries.add(`${row.countryCodeScheme ?? "published"}:${row.countryCode}`);
    story.points.push(row);
  }
  const list = [...stories.values()].filter((story) => Number.isFinite(story.time));
  // 數字鍵（i * n + j）比字串鍵快很多；7 天約 3,000 件時同國視窗會產生數十萬對。
  const n = list.length;
  const pairs = new Set<number>();
  const addPair = (x: number, y: number) => { if (x !== y) pairs.add(x < y ? x * n + y : y * n + x); };
  // 跨國：標題雙字詞倒排索引（略過太常見的字）。
  const index = new Map<string, number[]>();
  list.forEach((story, i) => { for (const gram of story.grams) { const ids = index.get(gram) ?? []; ids.push(i); index.set(gram, ids); } });
  for (const ids of index.values()) {
    if (ids.length < 2 || ids.length > L.maxBigramEvents) continue;
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) addPair(ids[x]!, ids[y]!);
  }
  // 同國：依時間排序的 48 小時滑動視窗。
  const byCountry = new Map<string, number[]>();
  list.forEach((story, i) => { for (const country of story.countries) { const ids = byCountry.get(country) ?? []; ids.push(i); byCountry.set(country, ids); } });
  for (const ids of byCountry.values()) {
    ids.sort((x, y) => list[x]!.time - list[y]!.time);
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) {
      if (list[ids[y]!]!.time - list[ids[x]!]!.time > L.maxHours * 3_600_000) break;
      addPair(ids[x]!, ids[y]!);
    }
  }
  // 共同人物／組織：名字出現在 2～maxEntityEvents 件之間才算。
  const entityIndex = new Map<string, number[]>();
  list.forEach((story, i) => { for (const key of story.entities) { const ids = entityIndex.get(key) ?? []; ids.push(i); entityIndex.set(key, ids); } });
  for (const ids of entityIndex.values()) {
    if (ids.length < 2 || ids.length > L.maxEntityEvents) continue;
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) addPair(ids[x]!, ids[y]!);
  }

  const neighbours = new Map<string, Set<string>>();
  const related = new Map<string, GlobalEventRelatedReport[]>();
  const entityLinks = new Map<string, Map<string, string[]>>();
  const link = (from: Story, to: Story) => {
    const set = neighbours.get(from.eventId) ?? new Set<string>();
    set.add(to.eventId); neighbours.set(from.eventId, set);
  };
  const scored: { a: Story; b: Story; score: number }[] = [];
  for (const pair of pairs) {
    const a = list[Math.floor(pair / n)]!;
    const b = list[pair % n]!;
    const hours = Math.abs(a.time - b.time) / 3_600_000;
    if (hours > L.maxHours) continue;
    const sharedEntities = a.entities.size === 0 || b.entities.size === 0 ? [] : [...a.entities].filter((key) => b.entities.has(key) && (entityIndex.get(key)?.length ?? 0) <= L.maxEntityEvents);
    if (sharedEntities.length > 0) {
      for (const [from, to] of [[a, b], [b, a]] as const) {
        const map = entityLinks.get(from.eventId) ?? new Map<string, string[]>();
        map.set(to.eventId, sharedEntities.map((key) => entityDisplay.get(key) ?? key.slice(key.indexOf(":") + 1))); entityLinks.set(from.eventId, map);
        link(from, to);
      }
    }
    const sharesCountry = [...a.countries].some((country) => b.countries.has(country));
    const title = jaccard(a.grams, b.grams);
    // Templated quake headlines ("XX 附近發生規模 N 地震") look alike across unrelated places and magnitudes.
    if (a.quake && b.quake && (!sharesCountry || (a.magnitudes.size > 0 && b.magnitudes.size > 0 && ![...a.magnitudes].some((m) => b.magnitudes.has(m))))) continue;
    let score = 0;
    if (!sharesCountry) {
      if (title >= L.crossCountryMin) score = title;
    } else {
      const summary = title >= L.sameCountryMin ? 0 : jaccard(a.summary, b.summary);
      let names = 0;
      const sameKind = a.category !== null && a.category === b.category && hours <= L.nameHours;
      if (sameKind && title < L.sameCountryMin && summary < L.summaryMin) for (const name of a.names) if (b.names.has(name)) names++;
      const nameMatch = sameKind && (names >= L.nameStrong || (names >= L.nameWeak && title >= L.nameWeakTitleMin));
      if (title >= L.sameCountryMin || summary >= L.summaryMin || nameMatch) score = Math.max(title, summary, nameMatch ? Math.min(1, names / 5) : 0);
    }
    if (score <= 0) continue;
    link(a, b); link(b, a);
    for (const [from, to] of [[a, b], [b, a]] as const) {
      const list2 = related.get(from.eventId) ?? [];
      list2.push({ eventId: to.eventId, title: to.title, score }); related.set(from.eventId, list2);
    }
    scored.push({ a, b, score });
  }
  for (const items of related.values()) items.sort((x, y) => y.score - x.score || x.eventId.localeCompare(y.eventId));

  // 每件只畫最像的幾條；一條線只要其中一端把它排進前幾名就畫。
  const topOf = (eventId: string) => new Set((related.get(eventId) ?? []).slice(0, L.maxLinesPerEvent).map((item) => item.eventId));
  const tops = new Map<string, Set<string>>();
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (const { a, b, score } of scored) {
    const ta = tops.get(a.eventId) ?? topOf(a.eventId); tops.set(a.eventId, ta);
    const tb = tops.get(b.eventId) ?? topOf(b.eventId); tops.set(b.eventId, tb);
    if (!ta.has(b.eventId) && !tb.has(a.eventId)) continue;
    let best: { distance: number; from: GlobalEventPoint; to: GlobalEventPoint } | null = null;
    for (const from of a.points) for (const to of b.points) {
      const deltaLng = to.coordinates[0] - from.coordinates[0];
      const dx = deltaLng - 360 * Math.round(deltaLng / 360);
      const distance = dx ** 2 + (to.coordinates[1] - from.coordinates[1]) ** 2;
      if (!best || distance < best.distance) best = { distance, from, to };
    }
    if (best && best.distance > 0) features.push({ type: "Feature",
      geometry: { type: "LineString", coordinates: globalEventAssociationArc(best.from.coordinates, best.to.coordinates) },
      properties: { event_id: a.eventId, related_event_id: b.eventId, relation_kind: "same_story", similarity: Math.round(score * 100) / 100 } });
  }
  return { neighbours, related, entityLinks, lines: { type: "FeatureCollection", features } };
}

/** Age uses source observation for candidates and event validFrom for published
 * records. Availability is a separate upper bound; reassessment never renews age.
 * Missing dates and severity remain unknown, never silently become zero. */
export function filterGlobalEvents<T extends GlobalEventRecord>(
  rows: readonly T[], asOfSeconds: number, days: number, category = "all", minSeverity = 0, taiwanOnly = false,
): T[] {
  const end = asOfSeconds * 1000;
  const start = end - days * 86_400_000;
  return rows.filter((row) => {
    const timestamp = Date.parse(row.validFrom ?? (row.candidateId ? "" : row.publishedAt ?? row.displayFrom ?? ""));
    const available = Date.parse(row.displayFrom ?? row.availableAt ?? row.publishedAt ?? "");
    return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end
      && Number.isFinite(available) && available <= end
      && (category === "all" || row.category === category)
      // Structured assessment only: prose and missing values cannot establish a relationship.
      && (!taiwanOnly || row.taiwanRelationship === "direct" || row.taiwanRelationship === "indirect")
      && (minSeverity === 0 || (row.severity !== null && row.severity >= minSeverity));
  });
}

/** 圖例狀態列的件數與最新收到時間。
 * 「未定位」只指沒有座標（coordinates === null）；生命週期已撤回／取代而藏起的事件（mapSuppressed）
 * 有座標，不算缺資料，兩邊都不計。藏起來的雜訊只從地圖件數扣掉（與 hook 的 noiseHidden 同口徑：有座標且未藏起者）。 */
export function summarizeGlobalEventCounts(
  entries: readonly GlobalEventRecord[], noiseHidden: number,
): { mapped: number; unlocated: number; latest: number } {
  const mapped = new Set<string>();
  const unlocated = new Set<string>();
  let latest = -Infinity;
  for (const entry of entries) {
    if (!entry.coordinates) unlocated.add(entry.eventId);
    else if (!entry.mapSuppressed && !(noiseHidden > 0 && entry.decision === "drop_noise")) mapped.add(entry.eventId);
    const available = Date.parse(entry.availableAt ?? entry.publishedAt ?? "");
    if (Number.isFinite(available) && available > latest) latest = available;
  }
  for (const id of mapped) unlocated.delete(id);
  return { mapped: mapped.size, unlocated: unlocated.size, latest };
}

/** 事件有多個地點時，導覽（飛過去、展開群組）與 popup／選取標記必須解析到同一個地點：
 * 一律取第一個 Point feature，不讓後面的覆蓋。 */
export function firstPointFeatureByEvent<P extends { event_id?: unknown }>(
  features: readonly GeoJSON.Feature<GeoJSON.Geometry, P | null>[],
): Map<string, { properties: P; coords: [number, number] }> {
  const out = new Map<string, { properties: P; coords: [number, number] }>();
  for (const feature of features) {
    if (!feature.properties || feature.geometry.type !== "Point") continue;
    const eventId = String(feature.properties.event_id);
    if (!out.has(eventId)) out.set(eventId, { properties: feature.properties, coords: feature.geometry.coordinates as [number, number] });
  }
  return out;
}
