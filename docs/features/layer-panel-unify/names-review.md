# 圖層名稱結構化：人工檢查清單（B 段 P2）

> 2026-10-03。依據 [AUDIT.md](./AUDIT.md) P2 A。manifest 名稱改成 `name: { zh, alt?, qualifier? }`，`label` 由 `composeLayerLabel(name)` 組出：`中文 外文（限定詞）`。

## 規則

- **自動**：兩支舊拆字函式（`splitThemeTitle` 第一個空白切；`DataSourcePanel` `splitLabel` 尾段純 ASCII 才切）結果一致、名稱裡沒有括號，且組回去等於原字串。共 **352 筆**，`label` 一字不變。
- **人工**：其餘 **173 筆**逐筆判斷（下表）。其中 **52 筆組出的 `label` 與原字串不同**（多半是括號內的來源／版本改成限定詞，或拿掉 emoji、寫死的筆數）；121 筆沿用 `splitLabel` 的切法，`label` 不變。
- 程式產生的名稱（統計 recipe、日本醫療三組常數）另處理：統計 recipe 名稱整串當中文主名；日本醫療在 `jpMedicalTypes.ts` 常數加 `zh`／`ja` 欄位，醫療圈的「2020」改成限定詞。
- 判斷原則：`qualifier` 只放來源、版本年份、狀態、深度／分鐘這類限定詞；中文口徑（「（每萬人口）」「（縣市）」「（雙北）」）是名稱的一部分，留在中文主名。日文照原字（国土地理院 不改成 國土地理院）。
- 轉換腳本一次性使用，未進 repo（`codemod.py`＋`overrides.py`，人工判斷都在 overrides）。

## 待使用者確認

1. **国土数値情報代碼**：A10／A11／A28／W09 現在放在限定詞（例 國立公園＋国立公園＋標籤「A10 2010」）。算不算 spec §6.3 的內部代碼？若算，改成只留年份。
2. **偵察衛星九個國家**：原名是「🇺🇸 USA · KH / BlackSky / Planet」，改成中文國名為主名（美國）＋衛星系列小字，國旗拿掉。
3. **「水質測定地点」**：原中文主名是日文寫法，改成「水質測定點」。
4. **未拆限定詞的自動項**：例「風場 Wind Field 10m」「淹水潛勢 Flood 650mm/24h」「農田範圍 FTW Fields 2025」的尾段數字仍在外文小字裡（組回字串不變，沒有動）。若要也改成限定詞再補。

## label 有變的 52 筆

| 原字串 | 中文 zh | 外文 alt | 限定詞 qualifier | 新 label | 理由 |
|---|---|---|---|---|---|
| OpenStreetMap 住宿涵蓋 OpenStreetMap 宿泊施設カバレッジ | 住宿涵蓋 | 宿泊施設カバレッジ | OpenStreetMap | 住宿涵蓋 宿泊施設カバレッジ（OpenStreetMap） | 來源 OpenStreetMap 改為來源標籤（同宗教設施三層） |
| 都計墓葬用地 Zoning（北北） | 都計墓葬用地（北北） | Zoning | — | 都計墓葬用地（北北） Zoning | 涵蓋範圍是中文口徑，併回主名；英文留外文小字 |
| 高松供排水相關設施 高松市 | 高松供排水相關設施 | — | 高松市 | 高松供排水相關設施（高松市） | 「高松市」是資料提供機關，不是外文名，改為來源標籤 |
| 水質測定地点 水質測定地点（2024） | 水質測定點 | 水質測定地点 | 2024 | 水質測定點 水質測定地点（2024） | ⚠️ 原中文主名是日文寫法「地点」，改為中文「水質測定點」；年份改為版本標籤 |
| 橫濱水位站 横浜市 | 橫濱水位站 | — | 横浜市 | 橫濱水位站（横浜市） | 「横浜市」是資料提供機關，改為來源標籤 |
| NILIM 水壩位置（46縣） | 水壩位置（46縣） | — | NILIM | 水壩位置（46縣）（NILIM） | NILIM（国土技術政策総合研究所）是來源，改為來源標籤；涵蓋範圍留在主名 |
| 派出所 5/10 min | 派出所 | — | 5/10 min | 派出所（5/10 min） | 等時圈分鐘數是限定詞，改為標籤（splitLabel 會把 min 誤切成英文名） |
| 分局 15/30 min | 分局 | — | 15/30 min | 分局（15/30 min） | 等時圈分鐘數是限定詞，改為標籤（splitLabel 會把 min 誤切成英文名） |
| 縣市警局 30/60 min | 縣市警局 | — | 30/60 min | 縣市警局（30/60 min） | 等時圈分鐘數是限定詞，改為標籤（splitLabel 會把 min 誤切成英文名） |
| 等高線 Contour 25k (10m) | 等高線 | Contour | 25k・10m | 等高線 Contour（25k・10m） | 比例尺與間距改為標籤，區分兩層 |
| 等高線 Contour DTM20 (20m) | 等高線 | Contour | DTM20・20m | 等高線 Contour（DTM20・20m） | 同上 |
| 坡度分級 Slope 6級 | 坡度分級 | Slope | 6 級 | 坡度分級 Slope（6 級） | 分級數改為標籤 |
| 坡向分級 Aspect 8向 | 坡向分級 | Aspect | 8 向 | 坡向分級 Aspect（8 向） | 分級數改為標籤 |
| 弱層黏土 0–5m | 弱層黏土 | — | 0–5m | 弱層黏土（0–5m） | 深度區間改為標籤 |
| 弱層砂土 0–5m | 弱層砂土 | — | 0–5m | 弱層砂土（0–5m） | 深度區間改為標籤 |
| 弱層黏土 5–10m | 弱層黏土 | — | 5–10m | 弱層黏土（5–10m） | 深度區間改為標籤 |
| 弱層砂土 5–10m | 弱層砂土 | — | 5–10m | 弱層砂土（5–10m） | 深度區間改為標籤 |
| 弱層黏土 10–20m | 弱層黏土 | — | 10–20m | 弱層黏土（10–20m） | 深度區間改為標籤 |
| 弱層砂土 10–20m | 弱層砂土 | — | 10–20m | 弱層砂土（10–20m） | 深度區間改為標籤 |
| Yaogan 遙感 | 遙感 | Yaogan | — | 遙感 Yaogan | 原本英文在前；改中文主名、拼音小字 |
| Jilin 吉林 | 吉林 | Jilin | — | 吉林 Jilin | 原本英文在前；改中文主名、拼音小字 |
| Gaofen 高分 | 高分 | Gaofen | — | 高分 Gaofen | 原本英文在前；改中文主名、拼音小字 |
| Shiyan / Shijian 試驗 | 試驗 | Shiyan / Shijian | — | 試驗 Shiyan / Shijian | 原本英文在前；改中文主名、拼音小字 |
| 🇺🇸 USA · KH / BlackSky / Planet | 美國 | KH / BlackSky / Planet | — | 美國 KH / BlackSky / Planet | ⚠️ 原本只有國旗＋英文國名；改中文國名為主名、衛星系列為外文小字，拿掉國旗 emoji |
| 🇯🇵 Japan · IGS / ALOS | 日本 | IGS / ALOS | — | 日本 IGS / ALOS | ⚠️ 原本只有國旗＋英文國名；改中文國名為主名、衛星系列為外文小字，拿掉國旗 emoji |
| 🇷🇺 Russia · PERSONA / RESURS / COSMOS | 俄羅斯 | PERSONA / RESURS / COSMOS | — | 俄羅斯 PERSONA / RESURS / COSMOS | ⚠️ 原本只有國旗＋英文國名；改中文國名為主名、衛星系列為外文小字，拿掉國旗 emoji |
| 🇮🇳 India · CARTOSAT / RISAT / EOS | 印度 | CARTOSAT / RISAT / EOS | — | 印度 CARTOSAT / RISAT / EOS | ⚠️ 原本只有國旗＋英文國名；改中文國名為主名、衛星系列為外文小字，拿掉國旗 emoji |
| 🇰🇷 Korea · KOMPSAT | 韓國 | KOMPSAT | — | 韓國 KOMPSAT | ⚠️ 原本只有國旗＋英文國名；改中文國名為主名、衛星系列為外文小字，拿掉國旗 emoji |
| 🇫🇷 France · CSO / PLEIADES / ELISA | 法國 | CSO / PLEIADES / ELISA | — | 法國 CSO / PLEIADES / ELISA | ⚠️ 原本只有國旗＋英文國名；改中文國名為主名、衛星系列為外文小字，拿掉國旗 emoji |
| 🇩🇪 Germany · SAR-Lupe / SARah | 德國 | SAR-Lupe / SARah | — | 德國 SAR-Lupe / SARah | ⚠️ 原本只有國旗＋英文國名；改中文國名為主名、衛星系列為外文小字，拿掉國旗 emoji |
| 🇮🇹 Italy · COSMO-SkyMed | 義大利 | COSMO-SkyMed | — | 義大利 COSMO-SkyMed | ⚠️ 原本只有國旗＋英文國名；改中文國名為主名、衛星系列為外文小字，拿掉國旗 emoji |
| 🇮🇱 Israel · Ofeq / EROS | 以色列 | Ofeq / EROS | — | 以色列 Ofeq / EROS | ⚠️ 原本只有國旗＋英文國名；改中文國名為主名、衛星系列為外文小字，拿掉國旗 emoji |
| NoiseCapture 公民格網 | 公民格網 | — | NoiseCapture | 公民格網（NoiseCapture） | NoiseCapture 是來源 App，改為來源標籤 |
| 飲用水水源保護區（環境部） Drinking Water | 飲用水水源保護區 | Drinking Water | 環境部 | 飲用水水源保護區 Drinking Water（環境部） | 來源改為來源標籤 |
| 環境輻射（核安會） Gamma | 環境輻射 | Gamma | 核安會 | 環境輻射 Gamma（核安會） | 來源改為來源標籤 |
| 淹水 3 分步行圈 Isochrone (雙北) | 淹水 3 分步行圈（雙北） | Isochrone | — | 淹水 3 分步行圈（雙北） Isochrone | 涵蓋範圍是中文口徑，併回主名 |
| 垃圾車 Truck (含音符) | 垃圾車（含音符） | Truck | — | 垃圾車（含音符） Truck | 中文說明併回主名 |
| 　└ 表定音符 Notes 🎵 | 表定音符 | Notes | — | 表定音符 Notes | ⚠️ 拿掉全形空白縮排、└ 與 emoji（原本用字元假裝子項） |
| 全台清運點位 Stops (靜態) | 全台清運點位（靜態） | Stops | — | 全台清運點位（靜態） Stops | 中文說明併回主名 |
| 魚塭·官方標籤版(2026-07) MOA Labeled | 魚塭·官方標籤版 | MOA Labeled | 2026-07 | 魚塭·官方標籤版 MOA Labeled（2026-07） | 版本日期改為標籤 |
| 魚塭·整合版 (官方∪衛星) Union | 魚塭·整合版（官方∪衛星） | Union | — | 魚塭·整合版（官方∪衛星） Union | 中文說明併回主名 |
| 土壤肥力 250m Soil Fertility | 土壤肥力 | Soil Fertility | 250m | 土壤肥力 Soil Fertility（250m） | 解析度改為標籤 |
| 飛航情報/終端管制 ✈️ FIR + TMA | 飛航情報/終端管制 | FIR + TMA | — | 飛航情報/終端管制 FIR + TMA | 拿掉 emoji |
| 機場管制/限航/危險 ⛔ CTR+RCR+DANGER | 機場管制/限航/危險 | CTR+RCR+DANGER | — | 機場管制/限航/危險 CTR+RCR+DANGER | 拿掉 emoji |
| 無人機紅區／未分類快照 🚫 Drone NFZ | 無人機紅區／未分類快照 | Drone NFZ | — | 無人機紅區／未分類快照 Drone NFZ | 拿掉 emoji |
| 無人機黃區快照 ⚠️ Drone Restricted | 無人機黃區快照 | Drone Restricted | — | 無人機黃區快照 Drone Restricted | 拿掉 emoji |
| 發電廠 Bloom 測試 ✨ | 發電廠 Bloom 測試 | — | — | 發電廠 Bloom 測試 | 拿掉 emoji；測試層名稱不另翻 |
| 機場管制/限航 Rim Glow 測試 ⛔✨ | 機場管制/限航 Rim Glow 測試 | — | — | 機場管制/限航 Rim Glow 測試 | 拿掉 emoji；測試層名稱不另翻 |
| 電桿 Power Poles (2.96M) | 電桿 | Power Poles | — | 電桿 Power Poles | ⚠️ 拿掉名稱裡寫死的筆數 2.96M |
| 高壓輸電線 Bloom 測試 ⚡✨ | 高壓輸電線 Bloom 測試 | — | — | 高壓輸電線 Bloom 測試 | 拿掉 emoji；測試層名稱不另翻 |
| 變電所 EHV Bloom 測試 ⚡✨ | 變電所 EHV Bloom 測試 | — | — | 變電所 EHV Bloom 測試 | 拿掉 emoji；測試層名稱不另翻 |
| 石化能源設施 Fossil Fuel (legacy) | 石化能源設施 | Fossil Fuel | 舊版 | 石化能源設施 Fossil Fuel（舊版） | legacy 改中文標籤 |

## label 不變的 121 筆（兩支函式判斷不一致，人工確認後沿用）

| 原字串 | 中文 zh | 外文 alt | 舊 splitThemeTitle 會拆成 | 理由 |
|---|---|---|---|---|
| 航港局獎補助金額（受補助對象所在地） | 航港局獎補助金額（受補助對象所在地） | — | 航港局獎補助金額（受補助對象所在地） ／ — | 無外文名；中文口徑／說明是名稱的一部分，留在中文主名 |
| 民航局獎補助費（受補助對象所在地） | 民航局獎補助費（受補助對象所在地） | — | 民航局獎補助費（受補助對象所在地） ／ — | 無外文名；中文口徑／說明是名稱的一部分，留在中文主名 |
| 臺北市交通違規舉發筆數（法條） | 臺北市交通違規舉發筆數（法條） | — | 臺北市交通違規舉發筆數（法條） ／ — | 無外文名；中文口徑／說明是名稱的一部分，留在中文主名 |
| A1 交通事故件數 | A1 交通事故件數 | — | A1 ／ 交通事故件數 | 無外文名，整串為中文主名 |
| A1 交通事故死亡人數 | A1 交通事故死亡人數 | — | A1 ／ 交通事故死亡人數 | 無外文名，整串為中文主名 |
| A1 交通事故受傷人數 | A1 交通事故受傷人數 | — | A1 ／ 交通事故受傷人數 | 無外文名，整串為中文主名 |
| 供水普及率（2015 年，7 縣市） | 供水普及率（2015 年，7 縣市） | — | 供水普及率（2015 ／ 年，7 縣市） | 無外文名；中文口徑／說明是名稱的一部分，留在中文主名 |
| 養豬用水量（歷史統計） | 養豬用水量（歷史統計） | — | 養豬用水量（歷史統計） ／ — | 無外文名；中文口徑／說明是名稱的一部分，留在中文主名 |
| 全年稻作收穫面積（複種計次） | 全年稻作收穫面積（複種計次） | — | 全年稻作收穫面積（複種計次） ／ — | 無外文名；中文口徑／說明是名稱的一部分，留在中文主名 |
| 每月出生數（歷史快照） | 每月出生數（歷史快照） | — | 每月出生數（歷史快照） ／ — | 無外文名；中文口徑／說明是名稱的一部分，留在中文主名 |
| 旅宿去重總覽 宿泊施設の統合一覧 | 旅宿去重總覽 | 宿泊施設の統合一覧 | 旅宿去重總覽 ／ 宿泊施設の統合一覧 | 中文＋日文（第一個空白切） |
| 旅宿密度網格 宿泊施設密度グリッド | 旅宿密度網格 | 宿泊施設密度グリッド | 旅宿密度網格 ／ 宿泊施設密度グリッド | 中文＋日文（第一個空白切） |
| 觀光廳登錄飯店／旅館 観光庁登録ホテル・旅館 | 觀光廳登錄飯店／旅館 | 観光庁登録ホテル・旅館 | 觀光廳登錄飯店／旅館 ／ 観光庁登録ホテル・旅館 | 中文＋日文（第一個空白切） |
| 地方旅館業許可 地方自治体の旅館業許可 | 地方旅館業許可 | 地方自治体の旅館業許可 | 地方旅館業許可 ／ 地方自治体の旅館業許可 | 中文＋日文（第一個空白切） |
| 國立公園 国立公園（A10 2010） | 國立公園 | 国立公園 | 國立公園 ／ 国立公園（A10 2010） | 国土数値情報 代碼＋年份改為版本標籤；⚠️ 代碼 A10／A11／A28／W09 是否算內部代碼外露待拍板 |
| 國定公園 国定公園（A10 2010） | 國定公園 | 国定公園 | 國定公園 ／ 国定公園（A10 2010） | 国土数値情報 代碼＋年份改為版本標籤；⚠️ 代碼 A10／A11／A28／W09 是否算內部代碼外露待拍板 |
| 都道府縣立自然公園 都道府県立自然公園（A10 2010） | 都道府縣立自然公園 | 都道府県立自然公園 | 都道府縣立自然公園 ／ 都道府県立自然公園（A10 2010） | 国土数値情報 代碼＋年份改為版本標籤；⚠️ 代碼 A10／A11／A28／W09 是否算內部代碼外露待拍板 |
| 自然保育地域 自然保全地域（A11 2015） | 自然保育地域 | 自然保全地域 | 自然保育地域 ／ 自然保全地域（A11 2015） | 国土数値情報 代碼＋年份改為版本標籤；⚠️ 代碼 A10／A11／A28／W09 是否算內部代碼外露待拍板 |
| 原生自然環境地域 原生自然環境保全地域（A11 2015） | 原生自然環境地域 | 原生自然環境保全地域 | 原生自然環境地域 ／ 原生自然環境保全地域（A11 2015） | 国土数値情報 代碼＋年份改為版本標籤；⚠️ 代碼 A10／A11／A28／W09 是否算內部代碼外露待拍板 |
| 自然保育特別地區 自然保全特別地区（A11 2015） | 自然保育特別地區 | 自然保全特別地区 | 自然保育特別地區 ／ 自然保全特別地区（A11 2015） | 国土数値情報 代碼＋年份改為版本標籤；⚠️ 代碼 A10／A11／A28／W09 是否算內部代碼外露待拍板 |
| 國家指定鳥獸保護區 国指定鳥獣保護区 | 國家指定鳥獸保護區 | 国指定鳥獣保護区 | 國家指定鳥獸保護區 ／ 国指定鳥獣保護区 | 中文＋日文（第一個空白切） |
| 鳥獸特別保護地區 鳥獣保護区特別保護地区 | 鳥獸特別保護地區 | 鳥獣保護区特別保護地区 | 鳥獸特別保護地區 ／ 鳥獣保護区特別保護地区 | 中文＋日文（第一個空白切） |
| 鳥獸特別保護指定區域 特別保護指定区域 | 鳥獸特別保護指定區域 | 特別保護指定区域 | 鳥獸特別保護指定區域 ／ 特別保護指定区域 | 中文＋日文（第一個空白切） |
| UNESCO 文化遺產代表點 UNESCO 文化遺産代表点 | UNESCO 文化遺產代表點 | UNESCO 文化遺産代表点 | UNESCO ／ 文化遺產代表點 UNESCO 文化遺産代表点 | UNESCO 是名稱主體，中日文各自保留 |
| UNESCO 自然遺產代表點 UNESCO 自然遺産代表点 | UNESCO 自然遺產代表點 | UNESCO 自然遺産代表点 | UNESCO ／ 自然遺產代表點 UNESCO 自然遺産代表点 | 同上 |
| 世界自然遺產歷史範圍 世界自然遺産の歴史的範囲（A28 2011） | 世界自然遺產歷史範圍 | 世界自然遺産の歴史的範囲 | 世界自然遺產歷史範圍 ／ 世界自然遺産の歴史的範囲（A28 2011） | 国土数値情報 代碼＋年份改為版本標籤；⚠️ 代碼 A10／A11／A28／W09 是否算內部代碼外露待拍板 |
| 拉姆薩濕地名冊衍生點 ラムサール条約湿地名簿の派生点 | 拉姆薩濕地名冊衍生點 | ラムサール条約湿地名簿の派生点 | 拉姆薩濕地名冊衍生點 ／ ラムサール条約湿地名簿の派生点 | 中文＋日文（第一個空白切） |
| 沿岸生態重要海域 沿岸EBSA（2015） | 沿岸生態重要海域 | 沿岸EBSA | 沿岸生態重要海域 ／ 沿岸EBSA（2015） | 年份改為版本標籤 |
| 珊瑚礁棲地分類 Allen Coral Atlas（私人研究） | 珊瑚礁棲地分類 | Allen Coral Atlas | 珊瑚礁棲地分類 ／ Allen Coral Atlas（私人研究） | 狀態改為標籤 |
| AISStream 船舶 AISStream Vessels | AISStream 船舶 | AISStream Vessels | AISStream ／ 船舶 AISStream Vessels | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| GFW 舊版每日船舶 Historical Presence | GFW 舊版每日船舶 | Historical Presence | GFW ／ 舊版每日船舶 Historical Presence | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| GFW 小時船舶網格 Hourly Grid | GFW 小時船舶網格 | Hourly Grid | GFW ／ 小時船舶網格 Hourly Grid | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| GFW 小時近似航跡 Hourly Tracks | GFW 小時近似航跡 | Hourly Tracks | GFW ／ 小時近似航跡 Hourly Tracks | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| GFW 每日捕撈活動 Fishing Effort | GFW 每日捕撈活動 | Fishing Effort | GFW ／ 每日捕撈活動 Fishing Effort | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| GFW SAR 未匹配 AIS Unmatched Detections | GFW SAR 未匹配 | AIS Unmatched Detections | GFW ／ SAR 未匹配 AIS Unmatched Detections | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 水壩 ダム（2014） | 水壩 | ダム | 水壩 ／ ダム（2014） | 年份改為版本標籤 |
| 湖沼 湖沼（W09・2005） | 湖沼 | 湖沼 | 湖沼 ／ 湖沼（W09・2005） | 国土数値情報 代碼＋年份改為版本標籤；⚠️ 代碼 A10／A11／A28／W09 是否算內部代碼外露待拍板 |
| 河川流路 河川（2006–2009） | 河川流路 | 河川 | 河川流路 ／ 河川（2006–2009） | 年份改為版本標籤 |
| 上水道相關設施（2010） | 上水道相關設施 | — | 上水道相關設施（2010） ／ — | 年份改為版本標籤 |
| 給水區域 給水区域（2010） | 給水區域 | 給水区域 | 給水區域 ／ 給水区域（2010） | 年份改為版本標籤 |
| 下水道設施（2012） | 下水道設施 | — | 下水道設施（2012） ／ — | 年份改為版本標籤 |
| 地下水等觀測點（24縣） | 地下水等觀測點（24縣） | — | 地下水等觀測點（24縣） ／ — | 無外文名；中文口徑／說明是名稱的一部分，留在中文主名 |
| 農業蓄水池（2026-03） | 農業蓄水池 | — | 農業蓄水池（2026-03） ／ — | 版本日期改為標籤 |
| 洪水浸水想定（最大規模） | 洪水浸水想定（最大規模） | — | 洪水浸水想定（最大規模） ／ — | 無外文名；中文口徑／說明是名稱的一部分，留在中文主名 |
| 宗教設施 宗教施設（国土地理院） | 宗教設施 | 宗教施設 | 宗教設施 ／ 宗教施設（国土地理院） | 來源改為來源標籤（P2 範例） |
| 宗教設施 宗教施設（OpenStreetMap） | 宗教設施 | 宗教施設 | 宗教設施 ／ 宗教施設（OpenStreetMap） | 來源改為來源標籤（P2 範例） |
| 宗教設施 宗教施設（Wikidata） | 宗教設施 | 宗教施設 | 宗教設施 ／ 宗教施設（Wikidata） | 來源改為來源標籤（P2 範例） |
| 都道府縣界 都道府県境 | 都道府縣界 | 都道府県境 | 都道府縣界 ／ 都道府県境 | 中文＋日文（第一個空白切） |
| 市區町村界 市区町村境 | 市區町村界 | 市区町村境 | 市區町村界 ／ 市区町村境 | 中文＋日文（第一個空白切） |
| 車站 駅 | 車站 | 駅 | 車站 ／ 駅 | 中文＋日文（第一個空白切） |
| 機場 空港 | 機場 | 空港 | 機場 ／ 空港 | 中文＋日文（第一個空白切） |
| 鐵道路線 鉄道路線 | 鐵道路線 | 鉄道路線 | 鐵道路線 ／ 鉄道路線 | 中文＋日文（第一個空白切） |
| OSM 橋梁承載線 | OSM 橋梁承載線 | — | OSM ／ 橋梁承載線 | 無外文名，整串為中文主名 |
| OSM 橋梁輪廓 | OSM 橋梁輪廓 | — | OSM ／ 橋梁輪廓 | 無外文名，整串為中文主名 |
| 新北橋梁 OSM 比對 | 新北橋梁 OSM 比對 | — | 新北橋梁 ／ OSM 比對 | 無外文名，整串為中文主名 |
| 全臺橋梁方向候選（進行中） | 全臺橋梁方向候選 | — | 全臺橋梁方向候選（進行中） ／ — | 狀態改為標籤 |
| 全臺橋梁清冊點位（進行中） | 全臺橋梁清冊點位 | — | 全臺橋梁清冊點位（進行中） ／ — | 狀態改為標籤 |
| 雙北跨河橋梁韌性（研究中） | 雙北跨河橋梁韌性 | — | 雙北跨河橋梁韌性（研究中） ／ — | 狀態改為標籤 |
| 警察設施 警察施設 | 警察設施 | 警察施設 | 警察設施 ／ 警察施設 | 中文＋日文（第一個空白切） |
| 學校 学校 | 學校 | 学校 | 學校 ／ 学校 | 中文＋日文（第一個空白切） |
| 人口網格 人口メッシュ | 人口網格 | 人口メッシュ | 人口網格 ／ 人口メッシュ | 中文＋日文（第一個空白切） |
| OSM 通訊海纜 Submarine Cable | OSM 通訊海纜 | Submarine Cable | OSM ／ 通訊海纜 Submarine Cable | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| OSM 海纜登陸站 Landing Station | OSM 海纜登陸站 | Landing Station | OSM ／ 海纜登陸站 Landing Station | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 法國 ANFR 5G 3500 無線站點概覽 France ANFR 5G 3500 Overview | 法國 ANFR 5G 3500 無線站點概覽 | France ANFR 5G 3500 Overview | 法國 ／ ANFR 5G 3500 無線站點概覽 France ANFR 5G 3500 Overview | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| OSM 通訊塔候選點概覽 OpenStreetMap Communication Candidates | OSM 通訊塔候選點概覽 | OpenStreetMap Communication Candidates | OSM ／ 通訊塔候選點概覽 OpenStreetMap Communication Candidates | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| RIPE Atlas 連線量測節點 Connected Probes | RIPE Atlas 連線量測節點 | Connected Probes | RIPE ／ Atlas 連線量測節點 Connected Probes | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| Ookla 行動網路效能格網 Mobile Performance Grid | Ookla 行動網路效能格網 | Mobile Performance Grid | Ookla ／ 行動網路效能格網 Mobile Performance Grid | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| Ookla 固定網路效能格網 Fixed Performance Grid | Ookla 固定網路效能格網 | Fixed Performance Grid | Ookla ／ 固定網路效能格網 Fixed Performance Grid | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| Ookla 台灣行動細格 Taiwan Mobile Fine Grid | Ookla 台灣行動細格 | Taiwan Mobile Fine Grid | Ookla ／ 台灣行動細格 Taiwan Mobile Fine Grid | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| Ookla 台灣固定網路細格 Taiwan Fixed Fine Grid | Ookla 台灣固定網路細格 | Taiwan Fixed Fine Grid | Ookla ／ 台灣固定網路細格 Taiwan Fixed Fine Grid | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 活動中心（部分縣市） Community Center | 活動中心（部分縣市） | Community Center | 活動中心（部分縣市） ／ Community Center | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 高中就學區（縣市級） Senior High District | 高中就學區（縣市級） | Senior High District | 高中就學區（縣市級） ／ Senior High District | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 診所 / 其他醫療 Clinic | 診所 / 其他醫療 | Clinic | 診所 ／ / 其他醫療 Clinic | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| AED 點位 AED | AED 點位 | AED | AED ／ 點位 AED | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| A1 死亡事故 Fatal Accident | A1 死亡事故 | Fatal Accident | A1 ／ 死亡事故 Fatal Accident | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| A1 即時事故 A1 Realtime | A1 即時事故 | A1 Realtime | A1 ／ 即時事故 A1 Realtime | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| YouBike 有車率 Fullness | YouBike 有車率 | Fullness | YouBike ／ 有車率 Fullness | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| OSM 道路 OSM Roads | OSM 道路 | OSM Roads | OSM ／ 道路 OSM Roads | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 落雷 Lightning 60min（台電） | 落雷 | Lightning 60min | 落雷 ／ Lightning 60min（台電） | 來源改為來源標籤 |
| 落雷 Lightning 60min（氣象署） | 落雷 | Lightning 60min | 落雷 ／ Lightning 60min（氣象署） | 來源改為來源標籤 |
| TJS / TJSW GEO 情報 | TJS / TJSW GEO 情報 | — | TJS ／ / TJSW GEO 情報 | 無外文名，整串為中文主名 |
| LASS 微型感測 Micro Sensor | LASS 微型感測 | Micro Sensor | LASS ／ 微型感測 Micro Sensor | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 河川污染指數河段（推估） River RPI Segments | 河川污染指數河段（推估） | River RPI Segments | 河川污染指數河段（推估） ／ River RPI Segments | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| PM2.5 手動採樣站 PM2.5 Manual | PM2.5 手動採樣站 | PM2.5 Manual | PM2.5 ／ 手動採樣站 PM2.5 Manual | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 煙道 CEMS 連線監測 CEMS | 煙道 CEMS 連線監測 | CEMS | 煙道 ／ CEMS 連線監測 CEMS | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 紫外線（前一天最大值） UV | 紫外線（前一天最大值） | UV | 紫外線（前一天最大值） ／ UV | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| CWA 海洋觀測站 CWA Marine | CWA 海洋觀測站 | CWA Marine | CWA ／ 海洋觀測站 CWA Marine | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| ISOHE 港區海氣象 ISOHE Port | ISOHE 港區海氣象 | ISOHE Port | ISOHE ／ 港區海氣象 ISOHE Port | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| IoT 河川 IoT River | IoT 河川 | IoT River | IoT ／ 河川 IoT River | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| IoT 水工結構 IoT Structure | IoT 水工結構 | IoT Structure | IoT ／ 水工結構 IoT Structure | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 北市下水道水位 Sewer (TP) | 北市下水道水位 | Sewer (TP) | 北市下水道水位 ／ Sewer (TP) | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 北市疏散門 Evacuate Gate (TP) | 北市疏散門 | Evacuate Gate (TP) | 北市疏散門 ／ Evacuate Gate (TP) | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 北市抽水站 Pump Station (TP) | 北市抽水站 | Pump Station (TP) | 北市抽水站 ／ Pump Station (TP) | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 湖泊 / 埤塘 Lakes & Ponds | 湖泊 / 埤塘 | Lakes & Ponds | 湖泊 ／ / 埤塘 Lakes & Ponds | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 垃圾車（表定） Schedule | 垃圾車（表定） | Schedule | 垃圾車（表定） ／ Schedule | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 廢車 / 廢金屬 Scrap | 廢車 / 廢金屬 | Scrap | 廢車 ／ / 廢金屬 Scrap | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 休農場 / 田媽媽 / 特色農旅 POI | 休農場 / 田媽媽 / 特色農旅 | POI | 休農場 ／ / 田媽媽 / 特色農旅 POI | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| ETC 收費門架 Gantry | ETC 收費門架 | Gantry | ETC ／ 收費門架 Gantry | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 發電廠 主要・運轉中 Primary | 發電廠 主要・運轉中 | Primary | 發電廠 ／ 主要・運轉中 Primary | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 發電廠 小型分散 Secondary | 發電廠 小型分散 | Secondary | 發電廠 ／ 小型分散 Secondary | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 發電廠 未來規劃 Planned | 發電廠 未來規劃 | Planned | 發電廠 ／ 未來規劃 Planned | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 發電廠 歷史・退役 Historical | 發電廠 歷史・退役 | Historical | 發電廠 ／ 歷史・退役 Historical | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 發電廠 OSM 補充 Supplement | 發電廠 OSM 補充 | Supplement | 發電廠 ／ OSM 補充 Supplement | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 變電所 區域 Substation | 變電所 區域 | Substation | 變電所 ／ 區域 Substation | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 變電所 超高壓 EHV | 變電所 超高壓 | EHV | 變電所 ／ 超高壓 EHV | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 加油站 中油 CPC | 加油站 中油 | CPC | 加油站 ／ 中油 CPC | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 加油站 台塑 FPCC | 加油站 台塑 | FPCC | 加油站 ／ 台塑 FPCC | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 加油站 台糖 Taisugar | 加油站 台糖 | Taisugar | 加油站 ／ 台糖 Taisugar | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 加油站 其他 / 私營 Other | 加油站 其他 / 私營 | Other | 加油站 ／ 其他 / 私營 Other | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 加油站 SSOT 合併 Canonical | 加油站 SSOT 合併 | Canonical | 加油站 ／ SSOT 合併 Canonical | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| LPG 分裝 / 儲存場 Subpackaging | LPG 分裝 / 儲存場 | Subpackaging | LPG ／ 分裝 / 儲存場 Subpackaging | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| LPG 加氣站 / 瓦斯行 Retailer | LPG 加氣站 / 瓦斯行 | Retailer | LPG ／ 加氣站 / 瓦斯行 Retailer | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| LNG 接收站 Terminal | LNG 接收站 | Terminal | LNG ／ 接收站 Terminal | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 煉油 / 化工廠 Refinery | 煉油 / 化工廠 | Refinery | 煉油 ／ / 化工廠 Refinery | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 加油站 最近距離 Coverage All | 加油站 最近距離 | Coverage All | 加油站 ／ 最近距離 Coverage All | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 中油 最近距離 Coverage CPC | 中油 最近距離 | Coverage CPC | 中油 ／ 最近距離 Coverage CPC | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 台塑 最近距離 Coverage FPCC | 台塑 最近距離 | Coverage FPCC | 台塑 ／ 最近距離 Coverage FPCC | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 台糖 最近距離 Coverage Taisugar | 台糖 最近距離 | Coverage Taisugar | 台糖 ／ 最近距離 Coverage Taisugar | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 充電站 最近距離 EV Island | 充電站 最近距離 | EV Island | 充電站 ／ 最近距離 EV Island | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 國家（自然）公園 National Parks | 國家（自然）公園 | National Parks | 國家（自然）公園 ／ National Parks | 採 splitLabel（尾段純 ASCII 才拆）；組回字串不變 |
| 公共生活 OSM 映射密度 | 公共生活 OSM 映射密度 | — | 公共生活 ／ OSM 映射密度 | 無外文名，整串為中文主名 |
