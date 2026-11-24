---
title: Day 10 - 只靠提示詞做地圖：GIS 圖台 Claude Code Plugin
description: 30 天地圖挑戰 Day 10（Prompting only）：把做地圖的經驗整理成 Claude Code Plugin，內含 197 張知識卡、17 個主題與 5 個 Skill，給 AI 一份開放資料就能開始做互動地圖。
slug: mapchallenge-2026-day10-prompting-only
topic: making
series: 30 天地圖挑戰
challengeDay: 10
date: 2026-11-10
tags: [30DayMapChallenge, Claude Code, Plugin, 開放資料, 提示詞]
cover: github-readme.jpg
coverAlt: GitHub 上 tw-gis-map-kit 儲存庫首頁，上方是檔案列表，下方是 README 開頭，說明這是做網頁地圖用的 Claude Code plugin
threads:
  - https://www.threads.com/@ianlkl1314/post/DfkNb6TjYQU
---

這是一個給 Claude Code 用的 Plugin，叫 tw-gis-map-kit，把我這幾個月做 GIS 網頁地圖累積的做法與踩坑整理成知識卡和 Skill。裝好之後，你只用對話就能請 AI 幫你找資料、選技術、做圖、查問題。程式與卡片都放在 [GitHub](https://github.com/ianlkl11234s/tw-gis-map-kit)。

## 題目與發想

#30DayMapChallenge 是每年 11 月的製圖挑戰，Day 10 的題目是「Prompting only」，只用提示詞做地圖。

今年的地圖幾乎都是和 AI 協作完成的，前幾天也分享過讓 AI 直接操作 Pulse 做分析。所以這題我沒有再做單一張圖，而是把「怎麼跟 AI 一起做地圖」整理成可以帶走的東西：GIS 開發的各種做法、遇過的問題、踩過的坑，寫成一套 Plugin。專案本來就是開源的，這次只是把經驗變成別人也能直接用的形式。

## Plugin 裡有什麼

Plugin 由兩部分組成：知識卡和 Skill。

**知識卡**共 197 張，分成 17 個主題，放在 `knowledge/` 資料夾：

- 系統思考、第一次做網頁地圖該知道的事
- 台灣開放資料 API 怎麼接（TDX、氣象署、環境部、水利署、data.gov.tw 等）
- 底圖選擇、色票與色階、資料格式、繪製效能
- 動態資料與時間軸、動態效果與靜態表現形式、多圖層管理
- 設計系統、上線維運、發布與分享
- 領域踩坑（風場、海流、航班、船舶、衛星等）、尺度與密度、空間分析
- 作者品味（這是我的偏好，不是業界規範）

每張卡分成原則、症狀、原因、解法、怎麼偵測、出處，並標示證據等級，區分實測過的、實作過的，和只是一般業界建議的。

**5 個 Skill** 是寫好的工作步驟，你照平常講話就好，Claude 會依內容挑一個：

| Skill | 做什麼 |
|---|---|
| gis-system | 把議題或一份開放資料拆成系統，列出候選資料集與爬取計畫 |
| gis-start | 問幾個關鍵問題，建議底圖、SDK、資料格式的組合，列第一週清單 |
| gis-advisor | 圖層不顯示、顏色怎麼選這類問題，給原因與解法並附卡片編號 |
| gis-review | 檢查專案還缺什麼，分必修、建議、可加分三級，只讀不改 |
| gis-workshop | 限時做圖：驗證真實資料、做出本機地圖、加上可操作的動態切換 |

## 怎麼安裝使用

照 README，在 Claude Code 裡執行：

- `/plugin marketplace add ianlkl11234s/tw-gis-map-kit`
- `/plugin install gis-map-kit@gis-map-kit`

裝好後重新啟動 Claude Code，問「你有哪些 gis 開頭的 skill？」，看到五個就成功。也可以把資料夾放在本機，啟動時用 `claude --plugin-dir <資料夾路徑>` 指定，不過每次啟動都要帶參數。

## 示範：只給一份開放資料

示範的做法是：只把桃園市政府觀光旅遊局的景點開放資料交給 AI，接下來由它自己做事，最後得到一個可以互動的網頁地圖，上面有 307 個景點〔待確認：307 是示範當時的筆數，請作者確認〕。這份資料會不定期更新，2026 年 11 月 17 日重新下載時是 341 筆，每筆都有經緯度。

整個過程錄成示範影片，附在 Threads 貼文裡。〔待確認：示範中依序用到哪幾個 Skill、提示詞下了幾次，請作者補充〕

## 限制

- 需要會用 Claude Code，而且依用量計費。README 記錄 2026-10-30 的實測，單一階段約 8 到 11 分鐘、US$4.5 到 5.7，換較小的模型沒有實測品質。
- 知識卡來自我自己做地圖的經驗，標示為 General 的卡只是一般業界建議，不是我的實測。
- 授權是 CC BY-NC 4.0，可自由使用與改寫，但要標示出處且不可商用。
- 這篇沒有公開的示範網址，示範結果以影片呈現，所以讀者無法在這裡直接操作那張桃園地圖。
- AI 的產出仍要檢查。Skill 要求不假造資料、不把推測寫成事實，但最後資料對不對還是要人確認。

## 常見問題

### 沒有 GIS 背景也能用嗎？

可以。README 寫明不需要先懂 GIS，但要會用 Claude Code。名詞小辭典和第一次做網頁地圖的卡片，是給新手用的。

### 一定要用桃園的資料嗎？

不用。桃園景點只是示範，任何開放資料都可以交給 gis-system，它會讀資料、記下來源機關與授權，再列出還需要哪些資料。

### 可以拿去做商業用途嗎？

不行直接商用。授權是 CC BY-NC 4.0，商業用途請先聯絡作者，可到儲存庫開 issue。

## 資料來源

- **Plugin**：Migu Cheng，[tw-gis-map-kit](https://github.com/ianlkl11234s/tw-gis-map-kit)，開源版 v0.3.1，CC BY-NC 4.0。卡片、主題與 Skill 數量取自該版本。
- **示範資料**：桃園市政府觀光旅遊局〈[桃園市景點資料(中)](https://data.gov.tw/dataset/26352)〉，不定期更新，政府資料開放授權條款第 1 版。
- **Plugin 使用費用**：取自 Plugin README 的 2026-10-30 實測。
