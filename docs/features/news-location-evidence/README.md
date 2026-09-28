# 新聞地點證據與事件關聯 POC

> **Slug**：`news-location-evidence`
> **狀態**：dev（shadow POC；尚未部署）
> **Owner**：Mini Taiwan Pulse
> **上線日期**：未定

## 一句話說明

把「新聞文章、事件、地點」拆成可稽核的資料層：只有具明確地點證據與合格精度的事件能畫成點，其餘保留在未定位、全國／多地或國外清單。

## 元件

| 名稱 | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| 新聞精確事件點 | point | 既有 clustered RPC；未來改 canonical event RPC | 既有 production，POC 不修改 |
| 新聞範圍清單 | list | `get_news_articles_poc` | POC |
| 地點證據卡 | UI | POC article/location contract | POC |
| 事件關聯 | relation | shadow event/article relation tables | POC |

## 關鍵檔案

- Collector：`data-collectors/collectors/news_events.py`
- Shadow migration：`gis-platform/migrations/414_news_location_evidence_poc.sql`
- Loader：`src/data/newsArticleListPoc.ts`
- UI：`src/components/intel/NewsScopeListPoc.tsx`
- 資料契約：[handoff.md](./handoff.md)
- 驗收與 gate：[backlog.md](./backlog.md)

## 原則

- `location_scope` 與「有沒有定位成功」是不同維度；國外新聞也可能已有合法地點。
- 行政區代表點不是事件發生點。`county`／`township` 只能呈現範圍，不得包裝成精確 Point。
- 相似文章只能產生候選關係，不得在進入 POC 前被靜默丟棄。
- `same_story`、`same_event`、`follow_up`、`nearby_possible` 不可混用。
- 沒有人工 gold label 前只報 consistency／manual review，不稱 accuracy。

## 發布邊界

目前已接入 production bundle 的 Monitor 插入點，但 default-off；仍不套 migration、不寫 live tables、不做歷史 backfill、不切換 production model。

## Frontend POC gate 與 rollback

- 預設不掛載 POC，亦不呼叫 `get_news_articles_poc`。只有 `VITE_NEWS_LOCATION_EVIDENCE_POC=true` 才在 Monitor 內顯示 shadow 清單。
- POC 的 request/loading/error 與既有 `fetchNewsEventsDayClusters`／`NewsFeedPanel` 分離；不改既有 map 點、layout registry 或 fly-to 行為。
- rollback：移除該環境變數或改為非 `true`，重新建置後 POC 不 mount；不需資料庫 migration、資料刪除或 legacy code rollback。
