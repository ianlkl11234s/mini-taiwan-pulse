# Changelog — 減害服務 Harm Reduction

> 逐 PR 變更紀錄。最新在上。

---

## 2026-10-06 — 第二批（`feat/harm-reduction-batch2`，PR 待開）

- 醫療 › 減害服務新增 8 層：酒癮治療與酒駕酒癮評估、戒菸服務機構、網路成癮治療資源、PrEP 服務醫院、保險套販售點、社區藥局反毒站、治療性社區與中途之家、更生保護會
- 執法治安 › 治安態勢新增酒駕肇事事故（107–114 年 36,814 點，PMTiles）
- 替代療法 popup 加維持治療服藥人數（2026-08）與期間平均
- 上游：taipei-gis-analytics `.worktrees/harm-reduction-20261006` points-batch2-a／b 報告
- Breaking：無（golden 只新增 9 key）

## 2026-10-06 — PR #548 `108b0f3d`

- 新增醫療主題「減害服務」五層：清潔針具據點、替代療法與藥癮戒治、愛滋自我篩檢通路、愛滋篩檢與指定醫療、毒品危害防制中心
- 資料源：疾管署清潔針具名冊（2026-07-14）、衛福部藥癮戒治／替代治療名單（2026-08-31）、疾管署自我篩檢通路（快照 2026-10-06）、疾管署匿名篩檢與指定醫事機構、法務部毒防中心（data.gov.tw 13717）
- 上游：taipei-gis-analytics PR #143；Supabase gis-platform PR #139（mig 427）
- Breaking：無
