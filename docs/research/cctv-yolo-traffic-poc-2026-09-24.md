# CCTV × YOLO 車流 POC（2026-09-24）

## 判斷

固定鏡頭配合 YOLO26n、ByteTrack、車道範圍（ROI）與跨線規則，能在日間短片產生通過數，但目前**不能把輸出當成可靠車流量**。台南樣本的四輪車總數與逐幀目視相同，卻有車種錯誤；高雄樣本一段約 12 秒區間明顯漏計。這只是兩支鏡頭各約 45 秒、單次目視複核的 POC，未涵蓋夜間、雨天、隧道與長期穩定性。跨鏡頭指定車輛追蹤未做 POC，也沒有保存車牌、外觀特徵或持續車輛 ID。

## 圖層與連結盤點

- `public/geo/cctv.geojson` 為 2026-05-24 的 TDX 靜態快照，共 6,129 個 WGS84 點：國道 1,778、省道 2,428、市區 1,923。點位含 `CCTVID`、道路名、方向及影像 URL；不含歷史影像、視角多邊形、路段拓樸或跨鏡頭 ID。上游契約見 `taipei-gis-analytics/docs/data-catalog/transportation/cctv.md`。
- 新竹市 185 筆只提供 `VideoImageURL`；原 popup 因 `VideoStreamURL` 空白而顯示未提供。現已讓 popup 顯示快照與原始影像連結。代表網址經正常 TLS 驗證回 200 `image/jpeg`；尚無瀏覽器畫面驗收。
- 桃園 `T913240` 的串流 URL 有前置單引號，popup 已移除此格式錯誤；修正後 `https://cctvtraffic.tycg.gov.tw/camera230` 在 2026-09-24 實測 **HTTP 404**。未找到經官方驗證的替代串流，因此此鏡頭仍屬上游失效，不能稱為已修復。
- 快照另含 564 筆 HTTP URL、12 筆私網 IP、3 筆 WSS URL。HTTP 中 554 筆指向國道主機；代表 HTTPS 端點用本次 Python 3.11 POC 環境可正常驗證憑證並回 200 MJPEG。主機 Python 3.14 曾報 `Missing Subject Key Identifier`，是不同 TLS 驗證環境的結果；不可推成所有用戶瀏覽器均可播放。本次沒有盲目批次改寫 URL。CSP、XFO、停機與上游 404 仍需逐來源檢查。

## 方法與實測

使用 Python 3.11.11、`ultralytics==8.4.160`、`lap==0.5.13`、官方 `yolo26n.pt`（SHA-256 `9b09cc8bf347f0fc8a5f7657480587f25db09b34bf33b0652110fb03a8ad4fef`）。COCO 類別 car/motorcycle/bus/truck，confidence 0.2。短片取自公開 MJPEG，以來源取得時間記錄每幀；離線重播處理全部幀，避免推論速度改變抽樣，預設最多處理 600 幀。試跑腳本 `scripts/research/cctv_traffic_yolo_poc.py` 只輸出彙總、模型與片段雜湊，不輸出影格或車輛 ID。驗證片段與逐幀檢查圖只暫存本機 `/private/tmp`，完成後刪除。

| 鏡頭 | 來源時段（台灣時間）及計數設定 | YOLO 跨線輸出 | 逐幀目視複核 |
|---|---|---|---|
| 台南 `C010020` 安北路，704×480、174 幀 | 13:56:53–13:57:38；水平線 y=0.42，x ROI=0.05–0.55；只看往畫面下方 | car 10、truck 2、motorcycle 1 | 四輪車 12 輛（car 11、truck 1），總數相同；紅色轎車在約第 101 幀被算作 truck。目視另見機車漏計，機車總真值尚未雙人標註。 |
| 高雄 `64000C000014` 台1線，704×480、170 幀 | 13:57:39–13:58:24；水平線 y=0.60，左側來車 x ROI=0.03–0.45；只看往畫面下方 | 全片 car 10、bus 1；第 32–79 幀僅 car 1 | 第 32–79 幀（13:57:48–13:58:00）可分辨**至少 5 輛**不同四輪車跨線；明顯漏計。全片尚未建立完整真值，不把 11 次輸出當全片流量。 |

台南片段 SHA-256 `6d00a7a2cf70e4da3607cc208f261ec7be5888e9c5e9a53df2bcc0d20f911045`；高雄片段 SHA-256 `4339328b5fdcfc8cc025458f9b91e3fd3536dac689b5afdf190a52819822466b`。台南總數相同不代表逐車匹配正確，漏計與重複計數也可能互相抵銷。高雄第 32–79 幀目視下限保守採計白色轎車、深色轎車、黃色計程車、銀色 SUV 與另一深色轎車各一；不是完整真值或正式 recall。兩段均為單次目視，需第二標註者和明確車中心／遮擋判準才能形成正式誤差率。

先前午夜國道 `CCTV-N1-S-0.000-M` 的 352×240 畫面肉眼可見車，YOLO26n 沒偵測到；新竹市 8 張快照中 2 張各偵測 5、3 輛 car。快照車數只是當下可見數，不是通過量。先前台南 `C010020` 30 秒／54 幀、`C110006` 45 秒／57 幀的未校正計數線皆得到零跨線；本次固定 ROI 與逐幀重播證明「零」是方法設定與追蹤品質問題，不能解讀為零流量。舊試跑用了 `--insecure-tls`；本次兩支日間來源在 Python 3.11 下以正常 TLS 驗證取得。未取得瀏覽器播放驗收；內建瀏覽器測舊版國道串流時回 `ERR_BLOCKED_BY_CLIENT`。

## 可用產品路徑與門檻

1. 先選少量固定視角，逐鏡頭標道路方向、車道 ROI、跨線、來源授權與畫面時間。每支至少雙人標白天、夜間、雨天、遮擋片段；分車種報通過數、漏檢、誤計、方向誤判與在線比例。隧道入口／內部須另評估低光、反光與鏡頭視角；本次抽到的基平隧道口 320×180 快照沒有可數車輛，維持未驗證。
2. 時間桶只存 `camera_id, interval, class, direction, count, sample_seconds, source_time, quality, model_version` 與不含車輛 ID 的錯誤彙總。斷訊是缺值，不是零車流。固定畫面可更新「該鏡頭附近觀測到的流量」，不能將 6,129 個點直接連成實際車輛路徑。
3. 若要畫路段或建模，先人工核對攝影機視角、車道與道路 LinkID，再用既有 VD 流量及其他交通資料校準。僅靠點位或鏡頭數量無法推路網流量；隧道內外也要分開校正。
4. 跨鏡頭個車追蹤需要穩定外觀／車牌、時間同步、道路候選路徑與持續影像；這些條件目前未證實，且可識別車輛資料涉及個資與影像再利用權限。現階段只規劃匿名、聚合車流；若未來確有合法目的，先做來源授權與資料保護評估。

## 參考

- [TDX CCTV 資料集與授權資訊](https://data.gov.tw/dataset/37665)、[TDX API 說明](https://tdx.transportdata.tw/api-service/swagger)
- [Ultralytics 物件計數](https://docs.ultralytics.com/guides/object-counting)、[追蹤模式](https://docs.ultralytics.com/modes/track/)、[授權](https://docs.ultralytics.com/)
- [高公局車輛偵測器介紹](https://www.freeway.gov.tw/Publish.aspx?cnid=87&p=79)
- [交通部關於影像使用的公告](https://www.motc.gov.tw/ch/app/artwebsite/view?id=205&module=artwebsite&serno=null)、[個資會籌備處對車牌資料的說明](https://www.pdpc.gov.tw/News_Content/102/453/)
