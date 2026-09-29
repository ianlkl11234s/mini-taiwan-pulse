# CCTV × YOLO 信義路車流重建：成果、限制與跨 Session 接手報告

更新：2026-09-29。本文是目前信義路 POC 的接手入口；9/24 報告保留早期實驗歷史，不能當作本輪樣本結果。

## 1. 接手摘要

目標：從 T000354、T000330、T000283 的公開道路影像，形成可回看、可核對的車種、移動與路口示意，後續才驗證通過量、實際位置與速度。

已完成：獨立擷取程式、三鏡頭3D回放、同幀偵測／追蹤對照、短缺口推估、候選跨線計數、人工覆核與地面控制點工具。39項測試與兩頁瀏覽器驗證通過。仍非即時服務，沒有完整人工真值或實測地面校正。

工作樹：`/Users/migu/.codex/worktrees/cctv-recovery/mini-taiwan-pulse`。分支：`codex/cctv-recovery-20260929`。程式在 `scripts/research/xinyi-cctv-poc/`。本輪授權本地提交；沒有 push、PR、merge、部署或定時執行授權。其他 checkout 的未提交內容不屬本次。

**下一個動作：固定使用9/29新批次，選一段30–60秒、含移動／停等／遮擋的片段，人工逐車標註，再比較追蹤設定。不要先重抓直播或擴大到全市。** 地面校正可同步找可靠對應點，但不可用假設道路尺寸計算 km/h。

## 2. 使用者已確認的道路語意

| 鏡頭 | 路段位置 | 光軸與畫面方向 | 道路辨識 |
|---|---|---|---|
| T000354 | 西段 | 朝北，畫面右東 | 縱向敦化南路、橫向信義路 |
| T000330 | 中段 | 朝北，畫面右東 | 南北交叉道路名稱待確認 |
| T000283 | 東段 | 朝北，畫面右東 | 南北交叉道路名稱待確認 |

信義路一般車東行、公車可反向是本POC採用的使用者提供條件，尚非道路管制現勘成果。交叉道路可以有南北交通；不得把所有車硬拉成東向。來源資料的 `roadDirection` 不是相機光軸；顯示以 `camera-configs.js` 的視向為準。

相機點位不等於車輛位置。3D目前以人工透視四邊形及假設道路寬長投影，車頭取投影後二維位移。車體大小用類別示意，不能由大小反推車種真值；辨識框的透視大小也不能直接當實車尺寸。

## 3. 實作與檔案責任

資料流：官方播放器來源檢查 → FFmpeg有界解碼 → 未模糊影格上的YOLO獨立偵測與ByteTrack → 保存JSON和全畫面模糊JPEG → 回放／核對 → 候選分析。沒有持續串流至前端的即時管線。

| 檔案 | 責任與邊界 |
|---|---|
| `capture.py` | 三鏡官方HLS來源檢查、逐幀推論、模糊儲存、原子寫入完整批次；失敗批次寫evidence，不覆寫既有成功資料 |
| `traffic.js` | 鏡頭內匿名ID、軌跡分段、原始／平滑對照、前景遮罩、短缺口推估與走廊假設 |
| `analytics.js` | ROI占用、有限計數線跨越、抖動與重複影格保護；不是轉向矩陣 |
| `projection.js`、`camera-configs.js` | 人工透視示意、道路光軸與ROI；尺度未驗證 |
| `calibration.js` | 多控制點homography擬合、fit/check誤差、退化與控制點重用拒絕 |
| `main.js`、`index.html`、`style.css` | Three.js局部道路示意、選鏡、分類、播放與同幀原始框 |
| `validation.*` | 單鏡同幀NMS候選與追蹤對照、人工事件、控制點、JSON匯出 |
| `compare_stages.py` | 不同內容影格的兩階段框配對，產生人工檢查候選；不是recall |
| `track_ablation.py` | 相同保存候選上的離線ByteTrack設定比較，不改正式設定 |
| `verify_capture.py` | 幀數、時間順序、JPEG完整性與尺寸、兩階段框格式、資料SHA驗證 |
| `*.test.js` | 39項行為與數學邊界測試，不代表模型準確度驗收 |

YOLO26n、Ultralytics 8.4.160、ByteTrack；COCO car/motorcycle/bus/truck，confidence 0.2。模型SHA-256：`9b09cc8bf347f0fc8a5f7657480587f25db09b34bf33b0652110fb03a8ad4fef`。

新環境為Python3.13；所有實際套件版本在 `requirements-lock.txt`，前端three 0.172.0與vite 6.4.1在package-lock.json。環境是重建版本，不宣稱與已失去的Python3.11環境完全相同。三鏡成功批次未記錄cpuThreads，後續單354批次記錄1，不可回填為全部批次皆為1。capture目前會限制PyTorch與Ultralytics CPU threads為1；僅設PyTorch會被首次模型setup重設，這是重建時修正的效能問題。

## 4. 資料契約與時間語意

批次JSON包含 `captureRunId`、`capturedAt`、`captureRequestedSeconds`、`sampleFps`、`durationSeconds`、`captureSettings`、`model`、`hardware`、`cameras`。鏡頭保存來源、尺寸、status、frames及metrics。

每幀 `t` 是媒體相對秒；`receivedAt`／`arrivalElapsedSeconds` 是本機接收時間。`sourceTimeKnown=false`：無法由本機時間推定真實拍攝時間或三鏡頭同步。5fps是輸出取樣設定，來源可能重複畫面，也不保證每秒五次獨立交通觀測。

`detectorDetections` 是獨立 `YOLO.predict` 的NMS後候選；`detections` 是另一次 `model.track` 的輸出。不是同一個內部張量的前後快照。bbox為0–1歸一化座標；ID僅鏡頭與批次內有意義，不能跨鏡重識別。資料缺少detector階段時顯示unknown，不能補零。

影格保存前全畫面模糊；辨識使用未模糊輸入。不保存原始影片、車牌或外觀向量。人工事件及控制點以相機／批次分開存在瀏覽器localStorage，**不自動寫回檔案**；需要匯出JSON才可跨瀏覽器保存。新批次目前沒有人工真值標註。

## 5. 目前可重現的9/29新樣本

三鏡批次：`20260929T065452252322Z`，本機擷取啟動14:54:52台灣時間，640×360，各450幀、媒體0–89.8秒。

| 鏡頭 | 總幀數 | 不同內容幀 | 相鄰重複幀 |
|---|---:|---:|---:|
| T000354 | 450 | 315 | 135 |
| T000330 | 450 | 348 | 102 |
| T000283 | 450 | 229 | 221 |

單354批次：`20260929T065727852171Z`，本機擷取啟動14:57:27，960×540，1,500幀、媒體0–299.8秒；793張不同內容、707張相鄰重複。媒體五分鐘不代表端到端延遲小於五分鐘；處理落後時接收與媒體時間會拉開。

資料檔SHA：

- `observations.json`：`40cd46c478fe2b07c6984cbf421a4b008bc6ab4202de83504c3006908d340a4b`
- `validation-observations.json`：`dc33d6ef05f7df8977ddd6053f75f822da1f0a7f76338a3f077889ee6c348912`

最新兩階段比較使用793張不同內容影格，greedy一對一IoU≥0.5、不限制類別：偵測框次8,516，追蹤框次5,009，配對4,976；僅偵測3,540、僅追蹤33、配對後類別不一致22。這些是反覆影格中的框次數，**不是獨立車數、漏檢真值或準確率**。

可從驗證頁118.2秒開始，該新批次為11個候選／10個追蹤框；214.6秒為24／7，是較大的階段差異候選。兩者都需逐車覆核，不能挑單幀宣稱改善。三鏡頁可看T000330約37.6秒；自動顯示的局部ID與車種仍可能錯誤。

結構化摘要隨Git保存於 [cctv-xinyi-evidence-2026-09-29.json](cctv-xinyi-evidence-2026-09-29.json)，完整逐幀JSON/JPEG在本機備份。

## 6. 連續性、計數、走廊與故障處理的實際能力

- 原始框仍逐幀出現；3D在相鄰觀測間插值並濾波。相同ID的短缺口可以有界延續、淡出，顯示為推估；不同ID不任意硬接，避免車輛瞬移或永久幽靈車。
- 軌跡分段／新鮮度邊界為1.5秒，短缺口推估在目前計算核心最多0.8秒；重複影像不當新證據，不重複類別投票與跨線。超時為stale／unknown，不是零車流。
- 穩定車種需要三次不同內容影格確認，因此3D車種可能和當幀原始分類不同。
- ROI占用表示當幀可見候選占用；跨線是鏡頭內匿名軌跡穿越有限線段的候選事件。A/B是影像近遠兩側，不能直接稱信義路東西向流量，也不是完整路口流量。
- 「同向走廊」以入口觀測播種情境粒子，有方向和速度假設；沒有跨鏡同車關聯，不能說粒子就是下個路口的那台車。
- 「模擬單鏡斷訊」只驗證前端缺資料／推估邊界；沒有實作鄰站流量守恆重建、故障分類器、維修告警或市區普查。
- 回放末尾停止並標示非即時，避免固定最後一幀被誤認為路上沒有車。

已知UI不一致：`index.html` 的缺口滑桿顯示上限1.5秒，但 `traffic.js` 實際將推估horizon截在0.8秒。這不會讓推估超出核心上限，卻會誤導操作；下一輪應先對齊UI與演算法契約，再量化平滑效果。

## 7. 地面校正進度

工具支援至少四個fit點、額外獨立check點、投影及分開誤差，拒絕退化幾何及將fit點重用為check。工作台來源勾選不會自動把校正變成驗收通過。

參考圖是國土測繪中心PHOTO2 WMTS，四個z19圖磚拼圖；metadata在 `data/ground-reference.json`，有來源、取得日期、圖磚索引與座標換算。約0.2705m/像素是當地圖磚尺度，**不是實測精度**；圖資拍攝日期和與CCTV設施是否同時期未知。

上一輪視覺核對無法可靠配對涵蓋近遠道路的四個fit與獨立check角點：東側參考圖裁切、遠端標線太小／遮擋、近場缺乏共同可識別點。因此未填入猜測控制點、未將實測homography套到3D、未輸出km/h。原人工透視投影仍為示意。下一步應取得完整路口正射圖或測量圖、辨識清楚的標線角點與已知距離，並留獨立點驗證。

## 8. 研究與重建歷史：哪些結論可保留

9/24舊報告記錄早期其他城市試驗，保留為背景。9/27至9/28逐步延長影像、增加同步框、修正光軸誤判、加入短缺口標示和校正工具。曾參考 [gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view) 作為產品探索對象；目前程式不依賴該repo，也不能把其展示視為本POC準確度證據。

9/28曾在同幀看到27候選／6追蹤，並比較high/new門檻0.25降至0.20，代理指標未改善，未改預設。**原該批影格與完整實驗產物已遺失**；這是對話中保留的歷史結論，不是9/29重跑結果。若要使用該結論作決策，應在固定新批次重新執行ablation並人工核對。

9/29原 `/private/tmp/xinyi-cctv-poc` 及舊 `cctv-traffic-poc` 工作樹缺失，原因未確認。重啟可能清理暫存，不能據此認定正常工作樹也被重啟刪除。從本對話完整檔案輸出及patch恢復程式；不是恢復原影像。`RECOVERY-MANIFEST.json` 記錄程式來源與雜湊。

本輪兩次併行擷取因CPU競爭落後而主動停止，failed JSON及已模糊影格保留作診斷，不當正式樣本。成功批次另存，未偽造完整性。後續將Ultralytics CPU設定限制在模型setup前，固定模型、硬體和取樣條件再比較效能。

## 9. 啟動、還原與重跑

### 現機啟動

```sh
cd /Users/migu/.codex/worktrees/cctv-recovery/mini-taiwan-pulse/scripts/research/xinyi-cctv-poc
./start.sh
```

回放：http://127.0.0.1:3747/index.html 。核對：http://127.0.0.1:3747/validation.html?t=118.2 。只監聽loopback，不是已部署網站。若3747被占用，先查該埠owner；不要廣泛pkill其他Vite。

### Git之外的資料備份

備份目錄：`/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/recovery/cctv-poc-20260929/`。

`xinyi-cctv-poc.tar.gz`（49,271,406 bytes）SHA-256：`9812980740b58bad553f9689a34e27a18a184b3acde04fb0546bddc04db84ece`。4,994檔已逐一解讀校驗，附 `files-sha256.json` 與 `SHA256SUMS`。它是**報告／提交整理前的重建快照**；程式及最新文件以Git提交為準。

包含程式、blurred影格、成功與失敗批次、模型、套件lock、截圖與診斷；不含node_modules、venv、dist。Git提交保存程式、測試、lock與精簡證據，不追蹤影格、模型或本機環境。另一台電腦只取得Git仍缺資料，不能保證直接看到同一回放；需搬移該備份，或重新擷取並標成新批次。

先在備份目錄執行 `shasum -a 256 -c SHA256SUMS`，再解壓到新的空目錄；從解壓內容只複製 `data/`、`models/`、`evidence/` 到Git中的POC，避免舊程式覆蓋新提交。人工localStorage紀錄需另行匯出，不在壓縮包內自動保存。

### 重建環境與新資料

在工作樹根用Python3.13建立 `.venv-cctv`，以其中pip3安裝 `scripts/research/xinyi-cctv-poc/requirements-lock.txt`。在POC執行 `npm ci`。FFmpeg需在PATH。若無模型，以Ultralytics官方下載流程取得yolo26n.pt置於models，核對前述SHA；不同SHA視為不同模型。

在POC目錄執行：

```sh
../../../.venv-cctv/bin/python3 capture.py --seconds 90 --fps 5 --model models/yolo26n.pt
../../../.venv-cctv/bin/python3 capture.py --camera T000354 --output data/validation-observations.json --seconds 300 --fps 5 --width 960 --height 540 --imgsz 960 --model models/yolo26n.pt
../../../.venv-cctv/bin/python3 verify_capture.py
../../../.venv-cctv/bin/python3 compare_stages.py data/validation-observations.json evidence/validation-stage-comparison.json
../../../.venv-cctv/bin/python3 track_ablation.py --input data/validation-observations.json --output evidence/track-ablation-new.json
npm test
npm run build
```

兩個擷取指令依序跑。開始新擷取前先保存固定驗證集；成功批次會取代指定JSON指標。capture的最大時窗600秒、fps上限5；預設三鏡主回放不接受超過180秒或單鏡覆寫。失敗只寫 `evidence/capture-failed-*.json`；目前程序退出碼不保證反映失敗，因此自動化須讀取status／輸出目的地，再跑完整性檢查，不只看exit 0。

## 10. 驗收證據與未完成事項

| 層次 | 結果 |
|---|---|
| 本地單元／數學 | 39/39；跨線、重複、stale、outage、短缺口、朝北投影、homography等 |
| 本地build | 雙入口成功；Three.js bundle超500kB警告保留 |
| 樣本完整性 | 2,850張成功批次JPEG與對應JSON檢查通過；模型精準度未驗證 |
| Browser | 三鏡選取／播放／框與相對時間／末尾標示；驗證頁新批次、逐格、JSON預覽；首頁錯誤log為0 |
| 地面／人工真值 | 尚未完成，km/h、recall、IDF1/HOTA均未驗收 |
| 專案TypeScript | 2026-09-29提交前 `tsc -b` 通過；使用主checkout既有node_modules，只在隔離樹做檢查 |
| Git／部署 | 本輪整理為本地提交；沒有push、PR、merge或部署 |

截圖與完整診斷位於本機 `evidence/`；精簡JSON摘要隨Git保存。本POC未接成正式Pulse layer或時序資料庫，沒有持續健康監測。公開來源可讀不代表所有影像再利用／模型商業授權已完成，正式對外服務前需另核對適用條件。

## 11. 下一輪驗收計畫

1. **固定真值片段**：挑30–60秒，標可見車、分類、每幀位置、跨線時間、方向與不確定遮擋；第二次獨立覆核。模糊圖不足以辨識的部分保持unknown；若需新清楚片段，先定義用途、保留時間與本機保存邊界。成果為帶batch/hash與覆核範圍的標註，不只是備註筆數。
2. **追蹤品質比較**：固定同一影格集與模型候選，比對原設定、門檻／buffer設定及必要的追蹤器替代方案。分車種報漏檢、誤檢、ID切換、碎裂與重複計數；有逐幀真值後才算recall等。不得以框變多、動畫變順或總數剛好相同判為成功。
3. **路面定位與速度**：收集涵蓋近遠區域的至少4個fit與額外獨立check點，先報公尺殘差與外插區域；確認時間基準後用已知距離／外部觀測核對速度。驗收前保留示意。
4. **小規模近即時**：單鏡持續運轉、量測來源更新頻率與端到端延遲、推論P50/P95、重複與失敗比例；控制queue，落後時可見標示stale，不能無限制積壓。
5. **路口走廊與缺口**：地圖建立實際入口／出口與車道方向，先估區間流量、轉向比例與不確定範圍；故障補全顯示估計與信賴區間，不捏造未看見的個車軌跡。完成單鏡驗收後再擴鏡頭。

建議先定可接受誤差再選模型／硬體；本報告不預設已達到任何量測精度門檻。

## 12. 給下一個 Session 的任務文字

```text
請接續 CCTV × YOLO 信義路 POC。
工作樹：/Users/migu/.codex/worktrees/cctv-recovery/mini-taiwan-pulse
分支：codex/cctv-recovery-20260929
先讀 AGENTS.md/CLAUDE.md，再讀 docs/research/cctv-xinyi-recovery-2026-09-29.md 與 scripts/research/xinyi-cctv-poc/README.md。
先確認 git log -1 與 status，不覆蓋其他session改動。
目前程式、39 tests、三鏡90秒與354五分鐘新資料可用；完整影格只在本機/備份，不在Git。
優先修正UI 1.5秒與核心0.8秒的缺口上限不一致，再用固定9/29新批次建立30–60秒人工逐車基準，量化追蹤中斷/重複；不要先重抓覆蓋樣本。
三鏡朝北，354縱向敦化南路、橫向信義路。保留觀測/推估、source time unknown、未地面校正的邊界，不宣稱km/h或跨鏡同車。
本次只授權本地探索與驗證；push、merge、部署或新增排程需另行授權。
```
