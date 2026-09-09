# Local draft closeout — 2026-09-09

Base is `origin/master` at `426dfc0d`. The preserved source snapshot is `/Users/migu/Desktop/GIS-local-drafts-20260909/mini-taiwan-pulse`, captured from original HEAD `484f97a7`. This log classifies all 99 snapshot paths; it does not claim deployment or production acceptance.

## Same as current mainline — no transfer needed

These 58 paths match current `origin/master` byte-for-byte. They are already represented by merged work and remain unchanged here.

- `.agents/skills/accessibility-analysis`
- `.agents/skills/layer-onboarding`
- `.agents/skills/service-coverage`
- `.agents/skills/three-3d-component`
- `.agents/skills/weekly-audit`
- `.codex/agents/layer-creator.toml`
- `AGENTS.md`
- `docs/audit/infrastructure-2026-09-07-batch1/README.md`
- `docs/audit/infrastructure-2026-09-07-batch1/build.log`
- `docs/audit/infrastructure-2026-09-07-batch1/h3-benchmark.json`
- `docs/audit/infrastructure-2026-09-07-batch1/h3-benchmark.ts`
- `docs/audit/infrastructure-2026-09-07-batch1/react-acceptance.html`
- `docs/audit/infrastructure-2026-09-07-batch1/react-acceptance.json`
- `docs/audit/infrastructure-2026-09-07-batch1/react-acceptance.tsx`
- `docs/audit/infrastructure-2026-09-07-batch1/security-inventory.md`
- `docs/audit/infrastructure-2026-09-07-batch1/tests.log`
- `docs/audit/infrastructure-2026-09-07-batch1/tsc.log`
- `docs/audit/infrastructure-2026-09-07-monitor-unification/README.md`
- `docs/audit/infrastructure-2026-09-07-monitor-unification/build.log`
- `docs/audit/infrastructure-2026-09-07-monitor-unification/gate-metadata.json`
- `docs/audit/infrastructure-2026-09-07-monitor-unification/tests.log`
- `docs/audit/infrastructure-2026-09-07-monitor-unification/typecheck.log`
- `docs/audit/infrastructure-2026-09-07-render/README.md`
- `docs/audit/infrastructure-2026-09-07-render/browser-results.json`
- `docs/audit/infrastructure-2026-09-07-render/build.log`
- `docs/audit/infrastructure-2026-09-07-render/camera-react-acceptance.html`
- `docs/audit/infrastructure-2026-09-07-render/camera-react-acceptance.tsx`
- `docs/audit/infrastructure-2026-09-07-render/gfw-before.log`
- `docs/audit/infrastructure-2026-09-07-render/tests.log`
- `docs/audit/infrastructure-2026-09-07-render/tsc.log`
- `docs/features/coral-reef-layers/backlog.md`
- `docs/features/coral-reef-layers/evidence/.gitignore`
- `docs/features/embeddable-map/README.md`
- `docs/features/global-events/audit-2026-09-04.md`
- `docs/features/global-events/repair-2026-09-05.md`
- `docs/features/jp-police-facilities/backlog.md`
- `docs/proposal/oss-globe-recipes-2026-09-04/README.md`
- `docs/proposal/oss-globe-recipes-2026-09-04/RESUME.md`
- `docs/research/loc-growth-2026-09-03-snapshot.py`
- `docs/research/loc-growth-2026-09-03.csv`
- `docs/research/loc-growth-2026-09-03.md`
- `docs/research/mobile-app-assessment-2026-09-05.md`
- `public/world/jp_police_facilities.pmtiles`
- `src/components/featureInfo/CoralReefPanel.tsx`
- `src/components/featureInfo/__tests__/CoralReefPanel.test.ts`
- `src/components/featureInfo/__tests__/JpPoliceFacilitiesPanel.test.ts`
- `src/components/featureInfo/japanPanels.tsx`
- `src/data/jpPoliceFacilityTypes.ts`
- `src/embed/EmbedApp.tsx`
- `src/embed/__tests__/cameraBridge.test.ts`
- `src/embed/__tests__/embedWhitelist.test.ts`
- `src/embed/cameraBridge.ts`
- `src/embed/embedWhitelist.ts`
- `src/embed/factoryOverlayConfigs.ts`
- `src/hooks/useJpPoliceFacilitiesLayer.test.ts`
- `src/hooks/useJpPoliceFacilitiesLayer.ts`
- `src/layers/hosts/japanHosts.tsx`
- `src/layers/layerHookRegistry.tsx`

## Reviewed changes already superseded — retain mainline

These 23 runtime/contract paths have newer Coral private-access or agriculture-statistics work on mainline. Importing the older draft would regress that work, so no content is transferred.

- `src/components/LegendPanel.tsx`
- `src/components/featureInfo/registry.tsx`
- `src/components/sidebar/layerCatalog.ts`
- `src/data/__tests__/__fixtures__/layer-golden.json`
- `src/data/__tests__/layerGoldenSnapshot.test.ts`
- `src/data/coralReefTypes.ts`
- `src/data/layerManifest.ts`
- `src/data/layerParamsSpec.ts`
- `src/hooks/useCoralReefDistributionLayer.test.ts`
- `src/hooks/useCoralReefDistributionLayer.ts`
- `src/layers/hosts/coralReefHost.tsx`
- `src/lib/__tests__/coralLocalUrl.test.ts`
- `src/lib/urlState.ts`
- `src/map/gisClickRegistry.ts`
- `src/types/index.ts`
- `vite.config.ts`

These 7 history/proposal paths have newer merge, access, or delivery context on mainline. The current versions retain the needed historical record and avoid restoring stale status statements.

- `docs/features/coral-reef-layers/browser-acceptance.md`
- `docs/features/coral-reef-layers/changelog.md`
- `docs/features/coral-reef-layers/handoff.md`
- `docs/features/jp-police-facilities/changelog.md`
- `docs/features/jp-police-facilities/handoff.md`
- `docs/proposal/infrastructure-renewal-2026-09-07.md`
- `docs/proposal/main-site-ai-gis-roadmap-2026-09-05.md`

## Intentional local improvements transferred

These three paths are the only modified existing files transferred from the snapshot. They shorten SessionStart routing and make the accessibility guidance reference-based while retaining current manifest/spec contracts.

- `.claude/memory/load-session.sh`
- `.claude/skills/accessibility-analysis/SKILL.md`
- `CLAUDE.md`

The two new references supporting that skill are transferred because they carry the detailed data-state and PMTiles integration rules:

- `.claude/skills/accessibility-analysis/references/data-semantics.md`
- `.claude/skills/accessibility-analysis/references/integration-contract.md`

## Historical evidence transferred

These 13 paths were absent from mainline. They are dated historical audit evidence only; no claim in them overrides the current release state.

- `docs/audit/infrastructure-2026-09-06/README.md`
- `docs/audit/infrastructure-2026-09-06/evidence/build-summary.json`
- `docs/audit/infrastructure-2026-09-06/evidence/build.log`
- `docs/audit/infrastructure-2026-09-06/evidence/checks.json`
- `docs/audit/infrastructure-2026-09-06/evidence/gfw-v4-headers.txt`
- `docs/audit/infrastructure-2026-09-06/evidence/homepage-headers.txt`
- `docs/audit/infrastructure-2026-09-06/evidence/pmtiles-range-headers.txt`
- `docs/audit/infrastructure-2026-09-06/evidence/production-entry-assets.txt`
- `docs/audit/infrastructure-2026-09-06/evidence/tests.log`
- `docs/audit/infrastructure-2026-09-06/evidence/tsc.log`
- `docs/audit/infrastructure-2026-09-07-batch1/implementation-manifest.json`
- `docs/audit/infrastructure-2026-09-07-batch1/implementation.patch`
- `docs/audit/release-inventory-2026-09-06.md`

## Decision record

The snapshot also contains already-merged source, tests, assets, agents, skills, and feature documents. No old local commit was cherry-picked: the comparison confirmed that those paths either exactly match mainline or were superseded by later merged work. No ignored assets or environment files are included.
