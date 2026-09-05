# 程式碼規模成長曲線（2026-09-03 量測）

> 資料：[`loc-growth-2026-09-03.csv`](./loc-growth-2026-09-03.csv)（29 個取樣點）
> 腳本：[`loc-growth-2026-09-03-snapshot.py`](./loc-growth-2026-09-03-snapshot.py)
> 圖表：https://claude.ai/code/artifact/9eed197b-a62e-4088-b495-124bd8eb73cd

## 結論

| 指標 | 值 |
|---|---|
| 目前規模 | **137,670 行**（code 125,465 ＋ tests 12,205） |
| 起點 | 1,779 行 / 24 檔（2026-02-20，`4c99cfd`） |
| 跨度 | 194 天，成長 ×77 |
| 平均每週淨增 | +4,853 行 |
| 單週峰值 | +14,827（2026-06-19 能源 v2 Phase A+B，`424db4e`） |
| 上線當天規模 | 36,021 行（2026-06-03）＝ 今天的 26% |
| 文件 / Agent 記憶 | 28,190 行（304 檔）/ 10,160 行（40 檔） |

## 量測方法

**取樣**：自 2026-02-20 起每 7 天一點，取當日 master 主線最新 commit
`git rev-list -1 --first-parent --before="<date> 23:59:59" master`
共 29 點、23 個相異 commit（重複代表那幾週 master 沒前進）。

**不 checkout**：以 `git archive <sha> | tar -x` 匯出到暫存目錄再量，工作區完全不動
（本 repo 長期有多個 worktree 掛著分支，checkout 會踩到平行 session）。

**工具**：cloc 2.10，`--json --by-file --quiet`，再依副檔名／路徑分桶。

### 分桶規則

| 桶 | 內容 |
|---|---|
| code | `.ts .tsx .js .py .sql .css .sh .frag .vert .html` |
| tests | 上述副檔名中路徑含 `__tests__/`、`.test.`、`.spec.` 者 |
| docs | `docs/` 與根目錄的 `.md` |
| agent | `.claude/` 底下的 `.md` |

**排除**：`public/` 全部、`.json` / `.geojson` / `.pmtiles` / 圖檔 / lockfile；
`.agents/` 與 `.codex/` 兩個目錄未納入取樣。

## 三個踩雷點（下次重跑會用到）

1. **`wc -l` 在這個 repo 會產生垃圾數字**。21 個 `.pmtiles` 是二進位檔，
   `git ls-files | xargs wc -l` 會去數裡面的換行 byte——`jp_religion_gsi.pmtiles`
   被算成 75,853「行」，比任何原始碼檔都大。必須走 cloc ＋ 明確排除清單。

2. **5 月的水平段是真的，不是取樣誤差**。2026-04-27 → 06-01 之間 master 只前進
   1 個 commit，但全 repo 有 101 個——工作在 `feat/historical-mode` 與
   `feat/fire-rescue` 分支上，6/1 一次合併。用 `--first-parent` 取樣才是
   「master 當時長什麼樣」；若改抓所有分支會變平滑但語意不同。

3. **8/14 那週註解行 +12,597 是 `layerManifest.ts`**（AR-22 登記簿派生，+9,735 行），
   不是 `src/data/__tests__/__fixtures__/layer-golden.json`（56,773 行）漏進 code 桶
   ——那個檔在排除清單裡，已追過。

## 驗算

以 2026-08-27 快照交叉驗：cloc 分語言加總（TypeScript 113,488 ＋ Python 5,270 ＋
HTML 3,926 ＋ Shell 2,816 ＋ SQL 2,627 ＋ CSS 435 ＋ GLSL 26 = 128,588）
加上 `.claude/` 內的程式檔，對上腳本算出的 code + tests = 128,828，一致。
