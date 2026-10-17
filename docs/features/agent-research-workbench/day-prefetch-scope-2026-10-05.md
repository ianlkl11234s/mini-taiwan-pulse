# AU-3：逐日預抓範圍契約

## 結論

保留兩套實作，因為它們服務的 payload 與排程上限不同；不可在未量測 CWA payload／pooler 壓力前互相取代。

| 實作 | 使用者 | 日期範圍 | 排程 | 前景與背景 | 例外理由 |
| --- | --- | --- | --- | --- | --- |
| `src/lib/dayPrefetch.ts` | `useHazardLayer` 的 lightning、nuclear | `timeStore.getWindowDateKeys()`，略過 `timeStore.getDateKey()` | 全域 queue，最多 2 個並行，500ms debounce | 呼叫端只可傳 silent prefetch loader；失敗只記錄 warning | 小型日資料可由不同 layer 共用節流，避免同時打 Supabase pooler。 |
| `src/hooks/useCwaImageryLayer.ts` | CWA cloud、radar imagery | 同一 window；foreground 日期即使不在 window 仍加入保護集，背景略過它 | hook-local 串行，一個 dataset/day RPC 完成才進下一個，600ms debounce | foreground 非 silent；background `silent: true`；LRU 保護 window 加 foreground | 一日影像約 30MB，且需要 object URL 回收與每 dataset LRU；併入全域 queue 會失去 CWA 的記憶體與逐一載入保證。 |

## 共通不變量

1. 日期來源只能是 `timeStore`：window 用 `getWindowDateKeys()`，foreground 用 `getDateKey()`；不從 React `currentTime` dependency 推導。
2. 背景預抓不得顯示 loading UI，且預抓失敗不得覆寫前景資料或宣稱已取得資料。
3. 日期或 window 改變以 `timeStore.subscribeDate`／`subscribeWindowDateKeys` 觸發；任何 timer 都必須在 hook cleanup 清除。
4. 預抓只填 cache，不改 source/geometry。此契約不把空 payload 解讀為完整覆蓋：CWA 會警告無 frame 並隱藏 handle；其餘 loader 的空值語意仍以各自來源契約為準。

## 變更門檻

若新逐日資料不是 CWA imagery 級的大型 object-URL payload，先採用 `dayPrefetch.ts`；若要讓 CWA 改用共享 queue，必須先以量測證明仍保留：逐一 RPC、foreground 優先、window + foreground LRU 保護，以及 object URL 的釋放。這是跨模組決策，不能只在 hook 內替換呼叫。

`src/lib/__tests__/dayPrefetchScope.test.ts` 守住以上分界與 timeStore 訂閱，避免文件與實作再漂移。它是結構契約，不是網路、Supabase 或瀏覽器驗收。
