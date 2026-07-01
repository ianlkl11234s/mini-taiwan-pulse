## Summary

<!-- 一句話 what + why -->

## Changes

<!-- 檔案或段落層級 -->
-
-

## Test

- [ ] `npx tsc -b` 通過
- [ ] `pnpm test` 通過（含 `layerConsistency`）
- [ ] Browser 驗收（若有 UI 變更）— All Off 單測過
- [ ] 若涉 Supabase RPC → `/check-rpc` 通過（響應 < 1s 或已套 pre-aggregate）

## Risk / Rollback

<!-- 影響範圍 + 回滾方式 -->
-

## Related

- Feature: `docs/features/<slug>/`
- Upstream handoff: `taipei-gis-analytics/docs/handoff/<slug>.md`
- ADR: <!-- 若動資料契約 -->
- Related PR / Issue:

## Checklist (依 CLAUDE.md §Git Workflow)

- [ ] Branch 名符合 `feat/fix/perf/docs/chore/hotfix/<slug>`
- [ ] Commit prefix 走 Conventional Commits
- [ ] 若動 layer → 已跑 `layer-onboarding` skill 7 步 SOP
- [ ] 若動資料契約 → upstream handoff 已更新 / ADR 已開
- [ ] `docs/features/<slug>/changelog.md` 已加本 PR 段落
