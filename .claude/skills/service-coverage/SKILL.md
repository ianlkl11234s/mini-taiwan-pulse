---
name: service-coverage
description: 服務覆蓋分析（service coverage / 商業策略視角）— 「我的店要開哪」「誰被服務不到」「跟競爭者疊圖」這類問題的視覺化。技術實作完整內容在 [[accessibility-analysis]] skill。本 alias 為了商業 / 策略口吻觸發更順 — 當用戶說「服務覆蓋」「服務沙漠」「市場版圖」「競爭者疊圖」「品牌勢力範圍」「服務缺口」「補點策略」「擴點選址」「未來開店」時用這個。實作 SOP 完全相同 → 請直接讀 accessibility-analysis/SKILL.md。
user_invocable: true
---

# 服務覆蓋分析 — Service Coverage

> 技術 SOP 完整內容在 [[accessibility-analysis]]。本 SKILL 是商業視角的 alias。

## 觸發場景對應

| 商業語意 | 對應 accessibility 模式 |
|---|---|
| 服務沙漠（哪裡沒人服務） | Mode C hex（沙漠視覺）|
| 品牌勢力範圍 | Mode B polygon union |
| 競爭者疊圖 | Mode B 多 layer 半透明疊 |
| 服務缺口 | Mode A 距離染色 + 紅色區段標示 |
| 擴點選址 | Mode C + 跨服務疊圖 |
| 補點策略 | Mode A 找「30km+ 紅色區段」 |

## 動工指引

實際做事**直接讀** [[accessibility-analysis]] SKILL：

1. §1 三種視覺模式對照
2. §2-3 兩個 repo 三個 SOP + 三套 reference pipeline
3. §4-5 常見坑 + Mirror 救援路徑
4. §6 Pipeline 範本（可 clone）
5. §7 PMTiles 命名契約
6. §8 Frontend 11 處 SOP
7. §9 新 POI checklist

## 關聯 SKILL

- [[accessibility-analysis]] — 技術完整版（本 alias 的本體）
- `/new-layer` — 純 POI 點層
- `/check-rpc` — RPC 效能
- `/supabase-optimize` — pre-aggregate
- `gis-data-onboard` — 資料生命週期
