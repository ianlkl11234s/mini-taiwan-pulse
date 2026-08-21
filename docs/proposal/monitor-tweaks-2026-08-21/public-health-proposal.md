# 公衛資料源盤點 + 候選提案（2026-08-21）

> 調查範圍：Monitor「公衛 · HEALTH BOARD」卡的上游資料源現況 + 可擴充候選。
> 所有 HTTP 狀態與「資料最新週/日」皆為 **2026-08-20~21 實測**（curl 實抓 CSV 後解析內容取 max(年,週)／max(date)），
> 不採用 CKAN `metadata_modified`（該欄停在 2025-05，是死的）。
>
> ⚠️ 併同發現（細節在對話回報，不在本檔）：`live.public_health_weekly` 有 **91.5% 重複列**（174,002 → 實際只有 14,730 個唯一 key），
> 現有卡片的數值／sparkline／YoY 全被灌水。實際 2026-W32 vs 2025-W32：類流感 **+17%**、腸病毒 **+18%**（卡上顯示 -91%）。
> 下面的候選清單若要接，**務必先修 unique key 與 upsert 策略**，否則新指標會複製同一個坑。

---

## 3. CDC 上游端點驗證結果

### 3.1 目前接進 `live.public_health_weekly` 的 3 個 dataset

| dataset | 端點 | HTTP | 資料最新 | 判定 |
|---|---|---|---|---|
| rods-influenza（類流感急診） | `https://od.cdc.gov.tw/eic/RODS_Influenza_like_illness.csv` | **200**（3.6 MB / 109,907 列） | **2026-W32** | 活著，格式未變（`年,週,年齡別,縣市,類流感急診就診人次,縣市別代碼`） |
| rods-enteroviral-infection（腸病毒急診） | `https://od.cdc.gov.tw/eic/RODS_EnteroviralInfection.csv` | **200**（1.9 MB / 61,283 列） | **2026-W32** | 活著，格式未變 |
| aagstable-weekly-dengue（登革熱週確診） | `https://od.cdc.gov.tw/eic/Weekly_Age_County_Gender_061.csv` | **404**（Apache 預設 404 頁） | DB 停在 2026-W32 / 最後成功收集 2026-08-13 | **上游已下架** |

### 3.2 登革熱 404 的延伸查證

| 查證動作 | 結果 |
|---|---|
| CKAN `package_list`（data.cdc.gov.tw） | 全站 **73 個 dataset**，已無 `aagstable-weekly-dengue`（只剩 `dengue_ns1_clinics`）|
| `https://data.cdc.gov.tw/dataset/aagstable-weekly-dengue` | **404**（dataset 頁整個消失）|
| NIDSS 疾病頁 `https://nidss.cdc.gov.tw/nndss/disease?id=061` | **200**，但頁內下載連結仍指向已 404 的 `Weekly_Age_County_Gender_061.csv` → **官方自己的連結也壞了** |
| 同族其他疾病 `Weekly_Age_County_Gender_010.csv`（流感併發重症） | **404** → 整個 `Weekly_Age_County_Gender_*` 家族全滅，不是單一檔案問題 |
| 換路徑試 `/cdc/`、`/nidss/`、`/acute/`、`_1.csv`、`nidss.cdc.gov.tw/download/` | 全 **404**，未找到搬家後位址 |
| `Dengue_Daily.csv`（歷史上的登革熱每日確定病例） | **404** |
| 同主機其他檔（RODS_*、NHI_*、cdc/*、acute/*、quarantine/*） | **全部 200** → 主機沒掛，只有 NIDSS 法定傳染病週報檔被移除 |

**結論**：登革熱斷線是 **CDC 上游把 NIDSS 法定傳染病週報 CSV 整批下架**（發生在 2026-08-13～08-20 之間），
不是 collector 壞、不是 IP 被擋、不是格式改版。

**救援路線（擇一，都不是免費午餐）**
1. **NIDSS 網站查詢**（`https://nidss.cdc.gov.tw/nndss/Cdcwnh07?id=061`）— 站內明載「資料更新時間為每日上午 08:30，本週為 2026 年 33 週」，
   資料還在，只是要走 ASP.NET 表單 POST（`__VIEWSTATE`）或 agent-browser 自動化。**難度：中～高**，且是無合約的爬蟲，隨時可能再壞。
2. **等 CDC 復原 / 去信詢問新位址**。難度低但時程不可控。
3. **改用還活著的替代指標**：登革熱本土病例在非流行期本來就個位數（2026-W29~W32 = 12/8/7/1 例），
   war-room 價值有限；可考慮改掛下方候選清單裡「日粒度」的指標（熱傷害、ROD 急診）。

### 3.3 全站 CDC 開放資料端點健檢（30 個實測）

| 群組 | 端點數 | HTTP 200 | 資料最新 |
|---|---|---|---|
| ROD 即時疫情監視（急診就診人次，週×縣市×年齡） | 7 | 7 | 2026-W32 |
| NHI 健保門急診就診人次（週×就診類別×縣市×年齡，**含總人次分母**） | 11 | 11 | 2026-W32 |
| 旅遊／國際疫情 CAP 警示 | 3 | 3 | 2026-08-18 / 2026-08-19 08:37 |
| 院所名冊類（NS1 快篩、旅遊醫學門診） | 5 | 5 | 2026-07-28（處方表）|
| 年度統計（疫苗接種率／劑次、長照死亡） | 3 | 3 | 2025 年度 |
| NIDSS 法定傳染病週報 | 2 | **0** | — |

---

## 4. 公衛候選資料清單（給早上討論挑，未實作）

排序邏輯：**更新頻率密 → 有時間序列 → 跟「今天台灣發生什麼事」相關**。
「難度」= 接進現有 `live.public_health_weekly` / 新表 + collector + RPC + 前端卡的整體工。

### A 級：立刻能用，密度高、故事性強

| # | 資料名稱 | 來源機關 | 端點（實測可開） | 更新頻率 | 粒度 | 難度 | 為什麼值得看 |
|---|---|---|---|---|---|---|---|
| 1 | **熱傷害人次監測數據** | 國健署 HPA | `https://www.hpa.gov.tw/Pages/ashx/GetFile.ashx?lang=c&type=1&sid=be14a0df383c4213bcdf769dbcb6dd27`（[資料集頁](https://data.gov.tw/dataset/157637)）| 實測資料到 **2026-08-16**（掛牌寫「不定期」，實際近日更新）| **日** × 縣市 × 年齡 × 性別，2011-01-02 起 28,890 列 | **低**（單一 CSV，Big5 編碼要轉）| **唯一日粒度的公衛指標**，能和氣溫圖層直接疊：熱浪當天急診人次跳起來，是最好懂的「今天台灣」故事 |
| 2 | **ROD 急性腹瀉急診就診人次** | 疾管署 | `https://od.cdc.gov.tw/eic/RODS_AcuteDiarrhea.csv` | 週（每週四發布上週）| 週 × 22 縣市 × 5 年齡層，107,355 列 | **低**（與現有 flu/entero 同 parser，只加一筆 DATASETS）| 諾羅／食物中毒／水污染的早期訊號，夏天颱風後最有戲；比登革熱數量級大得多，圖表不會是一條零 |
| 3 | **ROD COVID-19 急診就診人次** | 疾管署 | `https://od.cdc.gov.tw/eic/RODS_COVID-19.csv` | 週 | 週 × 縣市 × 年齡，13,713 列 | **低**（同上）| COVID 已回歸常態監測，但仍是每年兩波；戰情板缺一個「呼吸道總體壓力」指標 |
| 4 | **NHI 類流感健保門急診人次（含總就診人次分母）** | 疾管署／健保署 | `https://od.cdc.gov.tw/eic/NHI_Influenza_like_illness.csv` | 週 | 週 × **就診類別（門診/急診）** × 縣市 × 年齡，187,908 列 | **中**（多一個「就診類別」維度，要決定是否拆卡）| **有分母 → 可以算「類流感就診佔比 %」**，這才是 CDC 官方看的指標；現在卡上的絕對人次會被總門診量季節性帶著跑 |
| 5 | **旅遊疫情建議（國際旅遊警示）** | 疾管署 | `https://od.cdc.gov.tw/cdc/TCDCTravelAlert.csv` | 事件驅動（最新 effective = **2026-08-18**）| 國別（含 ISO3166）× 疾病 × 三級警示，2,498 列 | **低**（有 ISO3166 → 可直接打世界地圖）| 現有全球圖層的完美補件：世界地圖上把「第二級警示：警戒」國家點亮，一眼看出今天全球哪裡在燒 |
| 6 | **國際疫情訊息（CAP 格式）** | 疾管署 | `https://od.cdc.gov.tw/cdc/TCDCIntlEpidAll.csv` | 近即時（最新 sent = **2026-08-19 08:37**）| 單則訊息 × 國別 × 疾病 × 嚴重度，2,450 列（2024-01 起）| **低** | 逐則「日本某監獄爆發細菌性腸胃炎 285 例」這種條目，天生就是 Monitor 的 ticker 內容 |

### B 級：一次接一組，補完「呼吸道／腸胃道」全景

| # | 資料名稱 | 來源機關 | 端點 | 更新頻率 | 粒度 | 難度 | 為什麼值得看 |
|---|---|---|---|---|---|---|---|
| 7 | ROD 手足口病 + 疱疹性咽峽炎 | 疾管署 | `.../eic/RODS_HandFootMouthDisease.csv`、`.../eic/RODS_Herpangina.csv` | 週 | 週 × 縣市 × 年齡 | 低 | 腸病毒卡目前只有「總腸病毒」，這兩支是它的兩張臉；幼兒族群訊號最靈敏 |
| 8 | ROD 急性出血性結膜炎（紅眼症） | 疾管署 | `.../eic/RODS_AcuteHemorrhagicConjunctivitis.csv` | 週 | 週 × 縣市 × 年齡，60,234 列 | 低 | 校園群聚的經典指標，開學季會跳；冷門但很有畫面 |
| 9 | NHI 其他肺炎門急診人次 | 疾管署／健保署 | `.../eic/NHI_OtherPneumonia.csv` | 週 | 週 × 就診類別 × 縣市 × 年齡 | 中 | **重症 proxy**：類流感看門診壓力，肺炎看實際被打趴的人數，兩條疊起來才看得出「這波嚴不嚴重」 |
| 10 | NHI 急性上呼吸道感染 | 疾管署／健保署 | `.../eic/NHI_AcuteUpperRespiratoryInfections.csv` | 週 | 同上 | 中 | 呼吸道就診的「總量母體」，可當其他呼吸道疾病的基線 |
| 11 | NHI 腹瀉 / 水痘 / 猩紅熱 / 手足口病 / COVID-19 | 疾管署／健保署 | `.../eic/NHI_Diarrhea.csv`、`NHI_Varicella.csv`、`NHI_ScarletFever.csv`、`NHI_HandFootMouthDisease.csv`、`NHI_COVID-19.csv` | 週 | 同上 | 中（同一 parser，一次全收）| 一支 parser 換 11 個指標，CP 值最高的批次擴充 |

### C 級：地圖點位／低頻，看板配角

| # | 資料名稱 | 來源機關 | 端點 | 更新頻率 | 粒度 | 難度 | 為什麼值得看 |
|---|---|---|---|---|---|---|---|
| 12 | 登革熱 NS1 快篩合約院所 | 疾管署 | `https://od.cdc.gov.tw/acute/ns1hosp.csv` | 不定期 | **2,555 家 × 經緯度** | 低（現成 lat/lon，可直接上點圖層）| 疫情起來時「我家附近哪裡能快篩」，是唯一能讓公衛資料落到「個人可行動」的一層 |
| 13 | 旅遊醫學門診合約院所 + 門診時刻 | 疾管署 | `.../quarantine/TMClinicsList.csv`（37 家含經緯度）、`.../quarantine/ClinicsTime.csv` | 不定期（名冊 2026-03-02）| 院所 × 經緯度 × 看診時段 | 低 | 與旅遊疫情建議成對：警示國家亮起來 → 旁邊就是能打疫苗的院所 |
| 14 | 旅醫處方（各國建議疫苗/藥品） | 疾管署 | `.../quarantine/TMPrescription.csv`（5,095 列，警示日期到 2026-07-28）| 不定期 | 國別 × 疾病 × 疫苗 | 低 | 點某國 → 直接顯示「去這裡要打什麼」，資訊密度高 |
| 15 | 幼兒疫苗接種率／接種劑次（年度） | 疾管署 | `.../acute/2025 Immunization Coverage Annual Data.csv`、`2025 Annual Vaccination Doses.csv` | 年 | 縣市 × 疫苗別 | 低 | 頻率太低不適合 ticker，但適合做「縣市公衛體質」靜態底圖，跟疫情熱區疊看很有話講 |
| 16 | CDC 新聞稿／致醫界通函 RSS | 疾管署 | `https://www.cdc.gov.tw/RSS/RssXml/Hh094B49-DRwe2RR4eFfrQ?type=1`（新聞稿）、`.../khD5i5xbqmYc8zCDhJimNg?type=1`（致醫界通函）、`.../VYgwM0EtOqAhCmd0iJrhfg?type=4`（闢謠）| 事件驅動（實測 10~20 則，內容為 2026-08 當期）| 單則新聞 | 低（標準 RSS）| 「疾管署自 8/24 起擴大公費藥劑使用對象」這種通函，是疫情轉折的第一手訊號，比數字早一週 |
| 17 | NIDSS 傳染病統計查詢系統 | 疾管署 | `https://nidss.cdc.gov.tw/nndss/disease?id=<病名代碼>`（頁面 200）| **每日 08:30** | 60+ 種法定傳染病 × 年週/年月 × 縣市 | **高**（CSV 已下架，只剩 ASP.NET 表單 POST 或 agent-browser 爬）| 唯一能救回登革熱、且一次涵蓋數十種法定傳染病的來源；但要自己扛爬蟲維護成本 |

### 已經在專案裡、不必重接（可與公衛卡互相參照）

- 空氣品質 AQI：`src/data/aqiStationsLoader.ts` / `aqiImageryLoader.ts` 已接，與呼吸道就診指標天生成對。

### 沒查到／需要額外門檻（誠實列出）

| 想要的東西 | 現況 |
|---|---|
| 全國急診壅塞即時訊息 | 未找到全國性開放端點（EMOC 不對外）；只有各縣市零星資料 |
| data.gov.tw API v2 批次查詢 | `POST https://data.gov.tw/api/v2/rest/dataset` 需 Authorization Key（回 `ER0001:API Key錯誤`），要先申請 |
| 食藥署開放資料（食品中毒／藥品短缺） | `data.fda.gov.tw/opendata/...` 會 302 到 Swagger UI，需先在 Swagger 找對 InfoId，未逐一驗證 |
| 健保署資料開放平台 | `data.nhi.gov.tw` / `quality.nhi.gov.tw` 從本機 curl 連不上（timeout），需改走 `info.nhi.gov.tw/IODE0000/IODE0000S01` 人工找檔 |

---

## 附：驗證方式備查

- CSV 實抓後以 `csv.DictReader` 解析，取 `max(年, 週)` 或 `max(admit_date/effective/sent)` 當「資料最新」。
- CDC 端點需 `verify=False`（CDC 憑證缺 SKI，與 NHI 同症狀），本次以 `curl -k` / `requests(verify=False)` 實測。
- 原始探測結果 JSON：同目錄 `probe/cdc_probe.json`（30 個端點的 HTTP code / 列數 / 欄位 / 最新週）。
