# Frontend structure audit evidence — 2026-09-06

Scope: read-only source/config review at `44f85e6`; no build, test, browser, DB, env-value or large-asset reads. Counts are static evidence and do not assert runtime latency.

## Quantified shape

- `src/` contains 169,190 lines across TypeScript/TSX/CSS (the `wc -l` total included all source files scanned).
- The static relative-import closure from `src/App.tsx` is 521 files / 144,966 lines by a small Node DFS over `import`/`export ... from` edges. This is an approximation: package imports and dynamic runtime URLs are excluded.
- Largest source files: `src/data/layerManifest.ts` 10,901; `src/map/overlayRegistry.ts` 10,538; `src/components/LegendPanel.tsx` 6,293; `src/data/layerParamsSpec.ts` 3,234; `src/App.tsx` 2,688. These are source-size indicators, not proof of browser cost.
- `App.tsx` has 83 static import declarations, including 26 hooks and 28 components. `rg` found zero `React.lazy`/`lazy(` in `src`.
- `src/layers/layerHookRegistry.tsx` has 74 registry entries (the source comments and recent docs call the mounted set 67; the current registry has 74 entries, including infrastructure and multi-hook entries). `LayerHosts` maps every entry directly to `<Host deps={deps} />`.
- Timer/lifecycle inventory: 58 files contain `setInterval`, 58 contain `clearInterval`; 15 contain `requestAnimationFrame`, 15 contain `cancelAnimationFrame`; 47 contain `timeStore.subscribe`, and 30 contain `subscribeDate`. Matching file counts are a hygiene signal only; they do not prove one-to-one cleanup correctness.
- In the 14-day window, `git log` shows 73 commits touching `src` and 252 unique changed source paths. Daily source commit counts rose to 8 on Sep 3, 9 on Sep 4, and 11 on Sep 5. This indicates high integration churn, not a defect by itself.
- Tracked public assets include 46,783,425-byte `public/forestry/forest_reserve.geojson`, 23,024,097-byte `public/geo/ookla_fixed_global.geojson`, 22,445,099-byte `public/geo/waste_stops_static.geojson`, 20,659,963-byte `public/forestry/hiking_trails.geojson`, and 17,303,011-byte `public/world/jp_schools.pmtiles`. Asset presence alone does not establish initial download; source references and build/deploy rules must be checked separately.

## Findings

### P2 — Main App still owns a large static dependency surface and has no feature code splitting

Evidence: `src/App.tsx:1-95` statically imports the main UI, data hooks, map/Three helpers and panels; `src/main.tsx:1-15` statically imports `App`; no `React.lazy` occurrence was found. The App import closure is approximately 521 files / 145k LOC. `vite.config.ts:108-121` defines three HTML entries (`main`, `embed`, `bbox`), but entries are separate build roots, not route-level lazy boundaries inside the main app. An older architecture audit records a measured 1.44MB gzip first-load tax and explicitly records zero code splitting (`docs/research/architecture-audit-2026-08-10.md:79-81`); that measurement was not rerun here.

Impact: every main-app session has a fixed JS parse/download/evaluation surface independent of which optional panels/layers the user opens. The code proves the boundary is absent; it does not prove current devices miss a performance budget.

Smallest remediation: establish a current production build baseline, then lazy-load only user-opened heavyweight panels or isolated tools (Intel/Monitor, SatelliteConsole, Chat, bbox/embed remain separate entries). Re-measure before widening the split.

### P2 — LayerHost refactor preserves a whole-tree reconcile path

Evidence: `LayerHosts` iterates every registry entry and passes each host the same `deps` object (`src/layers/LayerHost.tsx:41-47`). `App` explicitly documents that “App 與所有 Host 是同步跳動” (`src/App.tsx:108-112`) and that Phase 4 is intended to break that baseline. `LayerHostDeps` is a broad cross-cutting bundle containing visibility, mode, historical cursor, panel state, and data maps (`src/layers/layerHostDeps.ts:41-115`). The current `App` also subscribes to `timeStore` at 60Hz into a ref (`src/App.tsx:438-439`), which is correctly outside React state, but other App state changes still recreate the tree and reconcile all hosts.

Impact: a slider, panel state change, timeline state change, or unrelated App update can invoke every host function and each host's `useLayerParams`/hook render. Effects may be dependency-stable, so this is a reconcile/CPU risk rather than evidence of repeated network fetches or map-layer duplication.

Smallest remediation: complete the already-described per-key subscription boundary in a focused follow-up: memoize stable host dependencies by slice, or split hosts by dependency domain and use external-store selectors. Keep registry ordering unchanged; validate with the existing `window.__layerRenderCounts` instrumentation before/after.

### P2 — Registry/manifest/presentation configuration remains a high-coupling change surface

Evidence: the static closure includes `layerManifest.ts` (10,901 LOC), `overlayRegistry.ts` (10,538 LOC), `LegendPanel.tsx` (6,293 LOC), and `layerParamsSpec.ts` (3,234 LOC). Source comments describe the intended SSOT and tests (`src/data/layerManifest.ts:27-33`, `src/components/sidebar/layerCatalog.ts:136-160`, `src/data/__tests__/layerManifest.test.ts`), so no concrete drift was asserted. Recent global-events, agriculture embed, transport-hub display, and Intel changes touched multiple UI/data/registry surfaces in the same 14-day window (see `git log --since='14 days ago' --stat`).

Impact: feature additions have a broad static import and review blast radius; missing one presentation/registry edge can be a compile-clean, UI-only omission. Existing consistency tests reduce this risk, but the file layout still makes review and incremental loading expensive.

Smallest remediation: keep manifest-derived fields authoritative, and add a generated/checked dependency map or per-feature change checklist only where current tests do not cover the edge. Avoid moving files as a performance fix without a measured target.

### P3 — Known eager asset costs remain explicitly conditional, requiring runtime baseline before action

Evidence: `docs/features/agriculture/backlog.md:9-12` records three agriculture GeoJSON files at about 34MB loaded eagerly and keeps the item conditional pending first-load/memory measurement. `docs/features/bus/backlog.md:9-14` records route JSON growth estimated at 60–100MB and a pending city-level lazy-load evaluation. These are actionable risk leads, not verified current first-load requests.

Recommendation: include both in the main agent's build/browser measurement matrix; do not infer a production regression from tracked asset size alone.

## Lifecycle notes

The inspected high-risk timer patterns have explicit cleanup in the sampled aviation, drone, global-events, and timeline paths (`src/hooks/useAviationAirspaceLayer.ts:217-250`, `src/hooks/useDroneRestrictedZonesLayer.ts:161-201`, `src/hooks/useGlobalEventsLayer.ts:448-474`, `src/hooks/useTimeline.ts:251-292`). No new definite leak was established in this bounded audit. `MapView` intentionally rebuilds overlays on `style.load` (`src/map/MapView.tsx:222-228`); runtime cost and browser readiness require the main agent's requested build/browser evidence.

## Not run / not claimed

No `npm run build`, `npx tsc -b`, tests, dev server, browser, DB/RPC, env-value inspection, or large-asset download was performed. No production performance budget, bundle size, or missing-file claim is made from this evidence alone.

## Follow-up: embed build-profile import chains

The supplied production `build-profile.json` (`collectedAt: 2026-09-05T18:10:48Z`) records the embed entry as 1,111,996 bytes raw / 298,473 gzip bytes, with static imports `crosshair-DJuz6vyp.js` and `LegendPanel-BDjRacfl.js`; the profile's transitive static sum is 4,960,278 raw / 1,317,166 gzip bytes. The embed entry itself is MapLibre (`node_modules/maplibre-gl`, rendered length 1,060,907), but the shared `crosshair` chunk contains `node_modules/mapbox-gl` (rendered length 1,680,296).

Source import chain for the unexpected shared chunks:

```
src/embed/main.tsx
  -> src/embed/EmbedApp.tsx
     -> src/components/LegendPanel.tsx
        -> src/three/TemperatureWaveScene.ts        (runtime import of DIVERGING_STOPS; pulls three + mapbox-gl)
        -> src/hooks/useGfwHourlyGridLayer.ts
           -> src/map/pmtilesSourceType.ts           (runtime mapbox-gl + mapbox-pmtiles)
           -> src/map/gfwPmtilesSourceType.ts        (runtime mapbox-gl + mapbox-pmtiles)
```

`EmbedApp` also imports `overlayManager` and `embedWhitelist`; those reach `overlayRegistry` and the manifest, but the concrete Three/Mapbox pulls above are the direct causes visible in the profile. `src/embed/mercatorEngineMaplibre.ts` correctly imports only MapLibre and `src/utils/coordinates.ts`; its comments explicitly state that it should not pull Mapbox (`src/embed/mercatorEngineMaplibre.ts:7-9`). The profile therefore identifies a real source-boundary regression in the shared LegendPanel dependency, while not proving network requests or Mapbox initialization at runtime.

Smallest embed fix: move `DIVERGING_STOPS` (a data-only palette) from `src/three/TemperatureWaveScene.ts` to a Three-free data module and import it from `LegendPanel`; then give embed a MapLibre-specific PMTiles adapter path, or make the PMTiles source-type imports engine-injected so embed never statically reaches `pmtilesSourceType.ts` / `gfwPmtilesSourceType.ts`. Preserve the main Mapbox path. Re-run the existing profile and assert embed's static graph has no `mapbox-gl`, `mapbox-pmtiles`, or `three` before changing broader shared code.

## Follow-up: ChatPanel lazy-load minimum

Current `src/App.tsx:86-87` statically imports both `ChatPanel` and `{ runChatTurn, testKey }` from `src/chat/agent.ts`; the profile places `ai`, all three provider SDKs, `chat/tools/*`, and `ChatPanel` in the main entry. `ChatPanel` is rendered at `src/App.tsx:2664-2672` even when `chatOpen` is false, so merely wrapping it in `React.lazy` while always rendering it would still fetch the lazy chunk during initial render.

Minimum safe boundary: use `lazy(() => import("./components/chat/ChatPanel"))` plus `Suspense`, render it only when `chatOpen` is true, and replace static agent imports with stable wrapper callbacks that `import("./chat/agent")` on invocation (or move those imports behind the panel boundary). Keep `bridge`, `onClose`, `compact`, and theme props unchanged; preserve the existing closed state and provide a small loading fallback. Because `agent.ts` imports the AI SDK/provider/tool registry, lazy-loading only the visual panel leaves most of the current main-entry cost in place. This is a source/build recommendation; no implementation or build rerun was performed.
