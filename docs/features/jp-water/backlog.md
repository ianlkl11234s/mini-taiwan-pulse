# Backlog — 日本水資源

| ID | Category | Priority | State | Outcome | Next action | Acceptance |
|---|---|---|---|---|---|---|
| JPW-1 | release | P1 | waiting_external | 逐層 artifact 可安全載入 | 上游提供 release.json 與 asset SHA/bytes | loader acceptance + local QA |
| JPW-2 | data-health | P1 | blocked | 半田管線保留正確 CRS | 確認 .prj/來源 CRS；排除疑背景圖 | 可重投影 QA，不以猜測 WGS84 取代 |
| JPW-3 | product | P2 | conditional | 橫濱水位站可連明確觀測序列 | 發布站表與觀測 release，保留日時/單位/缺值 | station vs observation UI 與 source QA |
| JPW-4 | release | P1 | waiting_external | 全國本機 PMTiles 可公開發布 | 逐資產補齊KSJ/GSJ/NILIM/MAFF授權、發布目的地與readback證據 | 明確allowlist、upload、Range/CORS、production browser驗收 |
| JPW-5 | private-release | P1 | verifying | 八個全國層僅固定 owner 可讀 | 驗私人 bucket policy，上傳 immutable keys，再做 owner 206／anon 401／other-user 403／revoke 與 production browser | 沒有公開 URL/CDN cache；每次 Range 驗證；logout 清 source/layer/selection；證據與授權解釋分離 |
