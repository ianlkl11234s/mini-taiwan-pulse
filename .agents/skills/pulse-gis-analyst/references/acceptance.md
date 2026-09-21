# 行為驗收

以真 stdio MCP 與配對 browser session 驗決策與 receipt；不要只比對回答措辭。

## 必測情境

1. **行政區統計**：「臺北市各區學校紀錄數」應走 dataset describe/query/aggregate/quality/result paging，不以 rendered points 或舊 layer summary 代替；清楚區分紀錄與獨立學校。
2. **附近設施**：「台北車站附近學校」只能對 actual、eligible Point 做 Haversine；步行或道路問題要說目前不能做。完成後應呈現 result overlay、以 result bounds 取景、分別等待 ready，並讀回 result IDs、feature count、source/layer IDs 與 viewport。
3. **跨資料比較**：缺共同 district key 時停止 join；不得用中文名稱或臨時 point-in-polygon 補洞。
4. **Jev fallback**：對開放式問題可呼叫一次 route；provider unavailable／review 時仍以 deterministic routing 完成可做部分，且不重複呼叫。
5. **權限與撤銷**：guest/private、owner 無實際 grant、revoked session 均 fail closed，且不洩漏未授權 metadata。
6. **分頁與 pending**：pending 用 receipt 接續；要求全部才讀完 next cursor/offset；超限案例被 schema/Gateway 拒絕。
7. **結果呈現**：`pulse_present_result` 僅接受 session result IDs，不接受任意 GeoJSON/style；ready 後 `map_context.resultPresentation` 必須讀回一致。空陣列清除、result 過期、移除、撤銷或超限都要 fail closed 並移除舊 overlay。
8. **時間與比率**：missing/suppressed/zero/stale 分開；零或 null 分母不產生一般比率；不同 frequency/version 不強比。

## 完成證據

- route receipt（若有使用 Jev）保持 `executed:false`。
- query/analysis receipt 保留 source、version/unknown、coverage、missingness、access、limits 與 truncation。
- tool catalog、Skill 路由與文件中的工具名稱一致；不把歷史 tool count 當固定契約。
- provider error、schema error、revocation 與 unsupported geometry 都有負向案例。
- 報告從問題到第一個有用結果的耗時；Skill 不應為例行分析讀取無關文件或產生多餘 artifact。
- 併行發出兩個 read-only query 時，MCP client 應本地排隊而不讓第二個撞成 `QUERY_PENDING`；回傳 timing 能區分 queued 與 gateway 時間。
- 地址不得送到 Jev 或外部 geocoder；L1 cache、OSM exact 與內插保留不同 source/precision，`no_match`、`unavailable`、地號 unsupported 不得混為一談。命中回傳需有 WGS84 數字座標，且不得洩漏本機路徑、cache key 或上游私有欄位。
