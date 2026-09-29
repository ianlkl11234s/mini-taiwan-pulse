# 信義路 CCTV 車流 POC（2026-09-29 重建）

從本對話的程式建立／修補紀錄恢復。原 `/private/tmp/xinyi-cctv-poc` 與舊工作樹已不存在；原因未確認。重啟可能清除暫存，不代表一般 Git 工作樹也會因此消失。

完整成果、限制、批次證據、備份還原與下一步計畫：[`完整報告`](../../../docs/research/cctv-xinyi-recovery-2026-09-29.md)。

## 啟動

在此目錄執行 `./start.sh`，開啟 http://127.0.0.1:3747/index.html 。重啟後需重新啟動伺服器；程式與資料應仍存在持久目錄。

- `index.html`：三鏡頭回放、局部 3D 示意、平滑與短缺口推估。
- `validation.html`：T000354 同影格 NMS 偵測／ByteTrack 比較、人工核對與控制點工具。
- 必要前端相依套件見 package.json；乾淨環境執行 `npm ci`。
- Python 環境位於工作樹根 `.venv-cctv`，版本鎖定見 `requirements-lock.txt`。權重在 `models/yolo26n.pt`。

```sh
../../../.venv-cctv/bin/python3 capture.py --seconds 90 --fps 5 --model models/yolo26n.pt
../../../.venv-cctv/bin/python3 capture.py --camera T000354 --output data/validation-observations.json --seconds 300 --fps 5 --width 960 --height 540 --imgsz 960 --model models/yolo26n.pt
npm test
npm run build
```

## 資料邊界

舊影格、昨日的逐幀觀測和完整核對紀錄未找回；新擷取批次不能當成原樣本，也不能用新舊框數比較辨識準確率。影像保存前全畫面模糊，模型使用未模糊影格；不保留原始影片。來源拍攝時戳未知，擷取時間不等於實際拍攝時間。

三鏡頭朝北、畫面右東；354縱向敦化南路，橫向信義路。其他交叉道路名稱待確認。相機點位置、視向、道路量測校正是不同資訊。ROI、透視四邊形及道路尺寸延用人工示意，不能當測量結果；鏡頭若轉動需重新設定。

平滑、短缺口延續及走廊粒子不是新觀測，不增加真實車數。ID僅鏡頭內有效；不宣稱跨鏡同車追蹤。道路地面控制點與獨立檢查仍未完成，速度 km/h 保持待校正。

`data/ground-reference.json` 保留 NLSC PHOTO2 圖磚來源及重新取得日期；圖資拍攝日期、精度未知，不等於實測控制點。沒有填入猜測的地面校正點。

資料、模型與證據僅本機保存並忽略Git；本次另建含資料備份包，不依賴/tmp。測試與擷取驗收結果見 `evidence/recovery-validation.json`。

## 本次驗收結果

- 2026-09-29 新三鏡頭批次 `20260929T065452252322Z`：各450幀、89.8秒，共1,350幀。
- 新354驗證批次 `20260929T065727852171Z`：1,500幀、299.8秒，其中793張不同內容，707張相鄰重複；重複不代表新增車輛。
- JPEG完整性、尺寸、時間順序、兩階段框格式通過；39/39 JS測試與Vite雙入口build通過。
- Browser確認三鏡選取、播放時間前進、同幀對照、片段結束標示；驗證頁逐格與JSON預覽匯出正常。尚無新人工真值或地面校正點。
- 首兩次多模型併行擷取落後，已主動停止並保留failed證據；後續成功批次獨立保存。
- 新環境Python3.13，Ultralytics8.4.160；新版capture固定CPU執行緒，避免首次setup_model重設造成競爭。推論效能與交通準確率分開看待。
- Vite保留大bundle警告；目前只監聽127.0.0.1。程式與報告於本輪整理成本地提交；未push或部署。

## 接手提醒

5fps是FFmpeg輸出節奏，不代表來源原生幀率。上方擷取命令成功時會覆蓋預設JSON，固定驗證集請先備份或用新的 `--output`。三鏡批次未記錄cpuThreads，單354驗證批次記錄1。

已知UI限制：缺口滑桿顯示1.5秒，但核心最多推估0.8秒（1.5秒為軌跡／stale邊界），下一輪需對齊。39項單元測試通過不涵蓋此UI契約不一致。
