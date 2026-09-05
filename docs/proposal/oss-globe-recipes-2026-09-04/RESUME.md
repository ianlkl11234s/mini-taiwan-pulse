# 續作點 — globe-custom-layers

> 2026-09-05 收尾。**repo 已完整上線且自洽**，以下是狀態與未做的部分。
> GitHub: **https://github.com/ianlk11234s/globe-custom-layers**（public）
> 本機: `../../../../globe-custom-layers`

## 現況：9 commits，全部已 push，工作區乾淨

| 層 | 內容 |
|---|---|
| 入口 | `README.md`（hero 圖）· **`AGENTS.md`**（範圍邊界 + 不涵蓋清單 + 任務路由 + 可信度標記）· `llms.txt` · `CONTRIBUTING.md` |
| 決策 | `docs/00-start-here/decision-tree.md` —— 五題循序，每個分支都有終點 |
| Recipe | 14 篇：`01-hugging-the-globe`(3) · `02-effects`(1) · `03-scaling-up`(4) · `04-discipline`(4) + 決策樹 + 移植表 |
| 範例 | **9 個**，`examples/manifest.json` 為機器可讀索引 |
| 測試 | **274 個**，全部跑得過（不需 GPU / token） |
| 驗證 | 9 個範例都用真 token 開過瀏覽器、都有截圖，狀態標記才升級 |

已量測並寫進文件的數字（不是宣稱，是讀出來的）：

- 投影混合三態：z1.30 transition 0.00 / z5.32 transition 0.24 / z7.33 mercator 1.00
- 批次化：5,000 物件 / 4,096 slots → **draw calls = 1**；min-heap **6.31ms** vs linear scan **22.24ms**
- 背面剔除對 picking 的影響：候選點 **734 / 1,174**（開）vs **1,174 / 1,174**（關）
- 流場成本曲線：4,000 → 14,000 粒子 / 153k 段 / 39ms（SwiftShader 軟體渲染，是上界）

## 未做的（依價值排序）

### 1. P4 eval —— 最該做的下一件事
給一個**乾淨的 agent**：這個 repo + 一個具體任務（例：「做一個球體地圖，5,000 條航線動畫，可以點選」），看它能不能只靠這個 repo 產出可跑的 app。

**每個失敗點就是一個該補的東西；沒有被失敗指出來的內容就是投機性的，不要寫。** 這是把「完整還是剛好」從品味變成實驗的唯一辦法，也是這個 repo 唯一還沒被檢驗過的假設 —— 目前所有內容都是「我們覺得 agent 需要」，不是「agent 實測缺這個」。

### 2. `docs/01-hugging-the-globe/maplibre.md` 還是 ⚠️ Unverified
那篇寫好了假設與推翻方法：**`mainMatrix` 投影單位球，所以把預存的 ECEF 正規化成單位長度再乘 `mainMatrix` 應該就成立，不需要 `projectTile()` prelude**（那會跟 Three 自己的 prelude 打架）。

做法：拿 `examples/01-points-on-globe` 複製一份改 MapLibre，畫一條已知 great-circle 弧，跟 `map.project()` 逐點比對。成立就升級標記，這個 repo 就不再只綁 Mapbox 的專有授權。**注意 transition 係數兩邊方向相反**（見 `porting.md`）。

### 3. `docs/03-scaling-up/instanced-tracks.md`（3.2）沒有範例
唯一還是 📋 的 scaling-up 篇。來源在 `mini-taiwan-pulse/src/three/GfwV4TrackScene.ts` + 現成的 10 個測試。

### 4. 畫廊 0/68 貼球
`examples/08-effects-gallery` 的 68 個效果全部是 mercator。可以挑 2–3 個示範「照 recipe 1.1 改造成貼球」，那會是文件與畫廊之間最有說服力的橋。

### 5. 一個懸而未決的小矛盾
`renderingMode`：`01-points-on-globe` 的註解說貼球需要 `"3d"`，`06-particle-field` 沿用來源用 `"2d"` —— **兩個都實測正常**。所以答案可能是「看圖層堆疊而定」，但目前沒人查清楚。文件還沒寫這條。

## 環境備忘（續作用得到）

**token 已放好**：`globe-custom-layers/.env`，並複製到每個 `examples/*/`。全部被 `.gitignore` 擋住、從未被追蹤。

⚠️ **`npm run build` 會把 token 烘進 `dist/assets/*.js`**。`dist/` 有被擋，但每次驗證完仍建議 `find examples -maxdepth 2 -name dist -type d -exec rm -rf {} +`。

**視覺驗證流程（已跑通多次）**
```bash
cd examples/<name> && npx vite --port 53XX --strictPort &
agent-browser --session vX --args "--enable-unsafe-swiftshader,--use-gl=angle,--use-angle=swiftshader,--ignore-gpu-blocklist,--enable-webgl" open http://localhost:53XX/
# ⚠️ 第一次開常拿到空白頁（vite 在 re-optimize deps）→ 再 open 一次就好
agent-browser --session vX eval "document.body.innerText.replace(/\n/g,' | ').slice(0,300)"
agent-browser --session vX screenshot /tmp/x.png
```
- **重場景會凍住 SwiftShader 的 compositor，screenshot 直接掛住** → 先用滑桿把量降到最低再截圖
- 拉 zoom：對 `.mapboxgl-canvas` dispatch `WheelEvent{deltaY:-400}`，每次約 +0.5，要分批加 sleep。`window.map` **不是** mapbox 實例，別用
- 改 range input：`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v)` + dispatch `input` **和** `change`（有些範例只聽 change）
- 收工只 kill 該 port 的 pid，**絕不 `pkill -f vite`**

**連結檢查 + JSON 驗證**（每次 commit 前跑）
```bash
cd <repo> && python3 -c "
import os,re,json
root=os.getcwd(); bad=[]
for dp,dirs,fns in os.walk(root):
    dirs[:]=[d for d in dirs if d not in ('.git','node_modules','dist')]
    for fn in fns:
        if not fn.endswith(('.md','.txt')): continue
        p=os.path.join(dp,fn); txt=open(p,encoding='utf-8').read()
        for m in re.finditer(r'\]\(([^)]+)\)',txt):
            t=m.group(1).split('#')[0]
            if t.startswith(('http','#','mailto')) or not t: continue
            if not os.path.exists(os.path.normpath(os.path.join(dp,t))): bad.append((os.path.relpath(p,root),t))
print('broken links:',len(bad)); [print(' ',b) for b in bad]
json.load(open('examples/manifest.json')); print('manifest ok')"
```

**派工慣例（效果很好，沿用）**
每個 agent 只准寫自己的 `examples/<name>/`；prompt 裡明列禁改清單（根目錄檔、`examples/README.md`、**`examples/manifest.json`**、`docs/**`、其他範例）；禁跑 git；必讀 `examples/01-points-on-globe/` 當範本、`docs/01-hugging-the-globe/mapbox.md` 當規格；四步驗收要回報實際輸出；沒 token 不得聲稱視覺驗證。**共用登記檔（manifest / README index / 文件編號）一律由主 agent 最後統一接線。**

## 這一輪最有價值的機制（值得延續）

**範例是文件的驗證器。** 五個 agent 照著 recipe 實作時，反過來抓出文件的實際錯誤：GLSL snippet 用了 `PI` 卻沒宣告（照抄編譯不過）、「four transcendentals」實際 6 次、「ring buffer」其實是 O(n) shift、`['zoom']` 不能巢狀（`tsc` 抓不到）、以及「線壞掉」的第三種成因（`(180+lng)/360` 不是週期函數）。**沒有可跑的範例，這些錯會一直留在看起來很權威的文件裡。**

## 已拍板不用再問

IP 非雇主所有 · Mapbox-first（MapLibre 為 1.2/1.3，標記誠實）· cookbook 不發 npm · 不送上游 PR · 英文為主 · repo 名 `globe-custom-layers` · public · 可信度四級階梯（✅ Verified / 🔬 Reproduced / 📋 Reported / ⚠️ Unverified），**寧低不高**
