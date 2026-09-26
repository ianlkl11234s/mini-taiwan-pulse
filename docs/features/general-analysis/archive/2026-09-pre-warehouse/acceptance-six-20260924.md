> ⚠️ 歷史文件（已被 [PLAN-warehouse-20260926](../../PLAN-warehouse-20260926.md) 取代），只作查證，不作施工依據。

# 六片續作驗收｜2026-09-24

本輪六片完成有界本地交付；不代表任意資料可分析或正式服務 SLA。沿用 research-streamline 的 mini 隔離 worktree，原 checkout、既有配對、MCP/Gateway 均保留；沒有 push、PR、merge、部署、遠端 migration 或新增付費 provider 呼叫。

## 交付與證據

| 片 | 完成內容 | 驗收與界線 |
|---|---|---|
| 1 | 換底圖時有界等待 style readiness、淘汰過期 generation、清理事件 listener | 初版只等 style.load 仍會出現圖 ready 但狀態錯誤；補 render 檢查後，快速 Light→Dark 與窄寬切換恢復 ready，最新動作無操作未完成。保持 5 秒 timeout，沒有重播分析 |
| 2 | 8 候選資格盤點，共用 verified Point reader 支援受固定 SHA/筆數保護的完整來源 | 新接郵局 1,278 筆、文化設施 787 筆；其餘 6 類 HOLD。來源取得日不是觀測日、current unknown；文化來源 1,170 筆的 383 筆未定位是上游匯出排除，不偽裝成本次 runtime 排除。詳見 qualification-V02 |
| 3 | compare_regions Polygon/MultiPolygon 數值分級設色、同契約圖例與清單色票 | raw/normalized unit 分開；單值、缺值、抑制、零分母不造數。宜蘭/花蓮/臺東與彰化/南投/雲林正常 native 呈現；本輪 normalized paint 由 focused tests 覆蓋，未另做完整 normalized 視覺矩陣 |
| 4 | 既有 walking_isochrone 接 Point 空間篩選與同圖呈現，改善結果名稱 | 台中起點 [120.6815,24.1373]，10 分鐘 Valhalla 模型；郵局 bbox 候選 3、面內 2、面外 1（intersects，含邊界）。不是全市覆蓋率、人口覆蓋率或營運狀態 |
| 5 | 四工作流手冊與既有 skill 收斂 | 附近、區域比較、疊圖/環域、單起點步行；重用 resultId、pending 以 requestId 接續、已有 receipt 不重複 quality/readback、collection 同次 framing |
| 6 | cold/warm、來源 oracle、工具/結構整合審查 | 保留單一 registry、既有 reader/tool；無新增 MCP/Gateway 工具。來源 ID 明示 SHA＋列序，跨版本 join 必須另驗業務鍵；不為尚未發生的 cache 衝突新增抽象 |

## 原生鏈與獨立計算

所有 native 案例經 Codex → MCP → Gateway → paired browser，不用直接注入結果代替。最終 postal coverage 命令 `bc458465-d9a6-449c-9844-6904ae08289e` 在 revision 84 ready；resultPresentation 兩個 resultId、3 features、sourcesReady/layersReady/ready 均 true。瀏覽器可見灰色協作面板、青色步行面及兩個橘色郵局點，清單分別標 1 面與 2 點。截图工具右/下側裁切限制仍在，未宣稱完整像素驗收。

郵局附近變體：台中 1,350m 得 6 筆，1,200m 得 5 筆。文化設施：宜蘭 [121.747,24.755] 950m 得 5 筆，800m 得 4 筆；呈現後可開宜蘭設治紀念館 popup。獨立 raw CSV/JSON oracle 與 native 完整名單/數量一致，最大距離差各 0.00637m、0.00440m（容許 0.01m）。初次人工摘要誤把 nearest-3 當總數；已改以完整 hits 計數、腳本重算並自動比對，未把錯誤隱去。

步行使用既有公共 Valhalla demo，共 2 次請求（session 重載後重建一次），沒有付費擴張。engine 3.9.0-e8b4007、tileset 2026-09-24T03:57:28Z；graph checksum、snapDistance、disconnected 仍 unknown。首次圖書館範圍篩選 1 筆，獨立 Shapely 全來源比對一致。最終郵局命中臺中民權路郵局、臺中臺中路郵局，外框內臺中法院郵局不在模型面內；最終郵局亦以 raw CSV 全 1,278 筆及實際 contour 做獨立 Shapely intersects，完整名單 2 筆一致、geometry valid。

## 效能口徑

| 案例 | 工具鏈 wall ms | plan ms | 下載 bytes / requests | 命中 |
|---|---:|---:|---:|---:|
| 郵局 1,350m cold：query→spatial→bounds | 1,356 | 1,306 | 496,891 / 1 | 6 |
| 文化 950m cold：query→spatial→bounds | 1,328 | 1,287 | 204,963 / 1 | 5 |
| 郵局 1,200m warm：query→spatial | 843 | 799 | 0 / 0 | 5 |
| 文化 800m warm：query→spatial | 1,031 | 808 | 0 / 0 | 4 |

兩組步驟數不同，不能把 wall 差直接歸因 cache；只確認 warm receipt 無重複下載。這些不是自然語言整題延遲，也不是 20 輪真實使用者 SLA。前輪 20 題控制樣本與本輪工具鏈量測保持分開。

## 檢查與原子 commit

8 個 focused test files 共 70 tests 通過（numeric motion 21、scene readiness 9、StudyController 10、analysis session 10、network 7、verified/civic/registry 合計 13）；tsc -b 與 git diff --check 通過。這是變更範圍檢查，未宣稱全 repo suite 或 production build/deploy。

- `14814e58` 數值設色與核心測試。
- `2b818041` style 等待接線與數值圖例 UI。
- `a27bf964` 郵局/文化來源與 verified reader。
- `737d12b2` 空間篩選命名與 coverage 語意測試。
- `694de07e` style.load 後 render readiness 競態修復。
- `e4558373` 數值色票與圖面配色一致。
- 手冊/skill 與本驗收文件各自獨立 commit，可由檔案 git log 查得。

本機重現資料放相鄰 `../runtime/six-final-native.json`、`six-source-oracle.py`、`six-source-oracle.json`、`six-oracle-comparison.json`、`six-postal-walk-oracle.json`；包含來源 SHA 與 native receipts。runtime 證據是本機檔，未隨 Git 發布；session resultIds 會失效。

## 保留缺口與下一步

1. 使用者實際檢查 UI；真實 20 輪整題 SLA、完整 normalized/離島視覺矩陣仍開放。
2. 六類 HOLD 需各補來源/geometry/coverage 契約後才接線，不以大量 adapter 掩蓋資料問題。
3. 生產級路網、完整 graph checksum、吸附距離、未連通解釋、多起點/人口或容量加權 coverage 不在本片完成範圍。
4. 原 checkout 有平行 skill/local-stack 等修改，整合前需逐檔比對；本輪未合併。無需為本輪 frontend 變更重配對或重啟 MCP。
