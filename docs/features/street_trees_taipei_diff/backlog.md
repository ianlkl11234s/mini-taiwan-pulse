# Backlog — 行道樹變化 Street Tree Diff

> 本檔只保留 current residual；完成的前端接線與 PR pending 狀態分開標為 verifying。

## Release / verifying

- [ ] **STD-0 · `verifying`**：確認 `streetTreesTaipeiDiff` 的 PR、merge 與 production PMTiles asset。
  - Outcome：台北行道樹 diff 在正式環境可載入，不把 changelog 的「PR pending」誤當完成 release。
  - Next action：核對 PR/CI、S3/HTTP Range 與 browser status 三色、renumber、filter；以無 404 與 popup/legend 可用為 acceptance。

## Conditional / data expansion

- [ ] **STD-1**：擴充到其他縣市。
  - Trigger：上游產出對應城市的 diff dataset。
  - Outcome：同一套 status 語意可跨縣市比較。
  - Acceptance：每縣市有來源、快照日期、coverage 與 checksum，且不把缺資料畫成「無變化」。
- [ ] **STD-2**：支援多個 Wayback 基準快照。
  - Trigger：第二個可信基準快照可取得。
  - Outcome：使用者能比較不同基準日期的樹木變化。
  - Next action：先定義基準日期選擇與資料量，再評估 timeline 控件。

## 已完成（歷史，不列入 active）

- [x] 前端 `streetTreesTaipeiDiff` PMTiles circle、status 三色、renumber 降透明與 status filter — 見 [changelog.md](./changelog.md)。
