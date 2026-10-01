# Backlog — 新聞地點證據與事件關聯 POC

## Active work

| ID | Category | Priority | State | Outcome | Next action | Acceptance |
|---|---|---|---|---|---|---|
| NLE-1 | data-health | P1 | in_progress | 相似文章不再只有丟棄統計，能輸出 article relation candidate | 完成 collector pure contract 與 fixtures | 鹿草錯 hint、同稿、全國、多地、國外、unknown 單測通過 |
| NLE-2 | data-health | P1 | in_progress | Shadow tables 保存文章版本、地點證據、canonical event 與 relations | 完成 migration 414 與 psql contract test | migration idempotent、無 backfill／delete、constraints 與 ACL 測試通過 |
| NLE-3 | product | P1 | in_progress | 未定位／全國多地／國外可由 bounded RPC 載入及呈現 | 完成 loader、純 UI component 與 default-off frontend gate | shape/null/bucket/copy、flag no-mount/no-request 與 TypeScript 通過 |
| NLE-4 | validation | P1 | in_progress | 建立事件隔離的固定評估集 | 既有 45 列只含 35 個 unique URL；補齊為 200 篇／150 pairs 標註表 | 樣本無重複 identity、strata／來源日期／review 狀態／train-test event split 可稽核 |
| NLE-5 | validation | P1 | ready | 定位與關聯達到上線 gate | shadow replay 並產 consistency、coverage、error、cost report | point precision >=95%、same-event precision >=95%、2x 月成本 < US$20 |

## Decision needed

| ID | Decision | Options / trade-off | Decision owner | Next action after decision |
|---|---|---|---|---|
| NLE-D1 | 是否合法暫讀文章正文 | A. 只用 RSS title/summary，最保守但精確地址 coverage 較低；B. 依來源條款暫讀正文，只保存 hash 與短 evidence，不保存全文（建議） | Owner | 逐來源確認條款後才開 body fetcher |
| NLE-D2 | Gold label 人工裁決方式 | A. Owner review 高風險 30–50 件；B. 兩位 reviewer 標完整 200 件 | Owner | 沒人工裁決前只報 consistency/manual review |

## Conditional / triggered later

| ID | Category | Priority | State | Trigger | Next action | Acceptance |
|---|---|---|---|---|---|---|
| NLE-6 | release | P1 | conditional | Shadow gate 全綠且 owner 授權 | 依 gis-platform -> data-collectors -> mini 順序開 PR／部署 | DB、collector、RPC、browser、production evidence 分開記錄 |
| NLE-7 | data-health | P2 | conditional | Canonical event precision gate 通過 | 評估 bounded historical replay | 明確範圍、成本與 rollback；禁止未授權 bulk backfill |

## Explicitly not planned

- POC 期間不自動切換 production model。
- 不用 county／township 代表點冒充事件實際發生點。
- 不因標題相似或同鄉鎮就自動合併事件。
