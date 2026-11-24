# Global Events / 全球情勢

同一 `globalEvents` layer 同時呈現正式事件與清楚標示的AI初判候選。地圖預設最近 1 天、最低嚴重度「嚴重」，關聯線預設開啟（2026-11-23 起；實線＝同一則報導提到的不同國家，虛線＝48 小時內標題相近、可能同一件事的不同報導，門檻與實測依據見 `globalEventStoryLinks()` 註解）。點選事件會加亮可能相關的報導；不合併、不改座標。2026-11-23 第二段：同國另加「AI 摘要相近」與「同類 24 小時內共同專有名詞（切掉媒體尾綴）」兩個訊號、地震震級不同不連，7 天有連結事件 35%→46%（人工判讀量測見 PR 描述）；每件最多畫 3 條虛線，popup 列出前 6 則可能相關報導、可點選移過去。地圖預設不畫 `decision = drop_noise`（開關 `globalEventsShowNoise`），INTEL 不受影響；z4 起顯示短標題（碰撞隱藏）。上游 `entities`（GDELT 人物／組織，最多 5 筆）存在時才算「共同人物／組織」並在 popup 顯示，欄位未套用前前端不顯示也不假造。長期時間條尚未登記，原因與缺的期別檔見 `docs/features/longterm-time/STANDARD.md` §4。可選分類、一般／關注／重大／嚴重以上，以及過去 1／3／7 天；「跟隨時間軸」改以游標往回計算天數。篩選僅影響顯示，不刪除來源資料。

候選新聞年齡使用來源收集時間（observed_at → validFrom），正式事件使用 validFrom，缺少時才退回 publishedAt／displayFrom；可用時間另作上限，舊新聞重新判讀不會刷新年齡。時間未知不進有期限的地圖視窗；嚴重度未知僅在「一般」全級別時保留。群聚展開後保留中央數字，再點一次即可收合。

「僅顯示臺灣相關（直接／間接）」預設關閉；開啟僅接受結構化 taiwan_relationship 的 direct／indirect，與分類、嚴重度、時間條件取交集。none／unrelated／unknown／缺值均不入選，不以 taiwanImpactZhTw 自由文字猜測。正式事件若沒有提供此欄位也不入選；篩選代表來源研判的關聯，不保證實際影響。

INTEL 面板的「全球情勢」分頁自 2026-09-05 起與國內新聞同一套行為（面板自己載資料、不依賴圖層開關、共用新聞卡片、預設只顯示已研究＋keep_core），見 [changelog](./changelog.md)。

本次為實作中，尚未 production acceptance。完整計畫與契約見 [handoff](./handoff.md)，工作清單見 [backlog](../../archive/2026-11-09/features/global-events/backlog.md)。
