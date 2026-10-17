# Three.js × Mapbox 視覺元件庫（68 個）

> 配合互動 demo：`http://localhost:5173/three-showcase.html`
>
> 用途：之後想做新圖層時，從這份目錄挑元件 → 把「下指令模板」帶位置/顏色/大小參數丟給 Claude → 直接蓋進 `src/three/` 或新 demo。

## 目錄

| # | 類別 | 元件數 | 元件 ID |
|---|---|---|---|
| 1 | [基礎幾何](#1-基礎幾何8) | 8 | orb · cylinder · cone · dome · heart · star · pin · crystal |
| 2 | [光效](#2-光效3) | 3 | beam · lightcone · neon |
| 3 | [動畫事件](#3-動畫事件9) | 9 | ripple · radar · ring · lightning · countdown · shockwave · contour · highlight · rainbow |
| 4 | [Shader 變形](#4-shader-變形4) | 4 | skirt · flow · aurora · flag |
| 5 | [粒子](#5-粒子12) | 12 | particles · firework · ballistic · tornado · meteor · galaxy · snow · confetti · vortex · firework2 · waterfall · starfield |
| 6 | [線條 / 路徑](#6-線條--路徑4) | 4 | flowline · arc · network · linechart |
| 7 | [數據視覺化](#7-數據視覺化5) | 5 | bars · heatmap · pie · polyextrude · waveform |
| 8 | [體積 / 大氣](#8-體積--大氣3) | 3 | smoke · noisecloud · fog |
| 9 | [場景 / 科幻](#9-場景--科幻8) | 8 | text · dna · scangrid · shield · hexgrid · glitch · checker · orbit |
| 10 | [系統關係 / 水資源](#10-系統關係--水資源12) | 12 | watershed · sankey · converge · tank · vessels · capacityarray · hydrocycle · flood · feedback · cascade · evap · drought |

**怎麼挑**
- 知道要表達什麼 → 看「適合表達」欄位
- 知道想要什麼形狀 → 看類別標題
- 想要混搭多個 → 從多個分類各挑 1，告訴 Claude「在 X 點疊 [元件 A] + [元件 B]」

**怎麼下指令**
1. 找到目標元件
2. 複製「下指令模板」
3. 把方括號裡的 `[位置] [顏色] [大小] [速度]` 換成自己的值
4. 加上脈絡：「在主專案幫我把 X 元件接到 Y 圖層的 Z 資料源」

---

## 1. 基礎幾何（8）

### 1.1 光球（orb）
- **適合表達**：船舶 / 航班 / 列車光點，任何「即時單一物件」
- **技術**：多層 IcosahedronGeometry + AdditiveBlending + 呼吸脈動
- **參數**：size(50~800m)、speed(0~5)
- **下指令模板**：
  > 在 `[位置]` 放一顆直徑 `[200m]` 的 `[#6cb8ff]` 光球，內白外色三層疊加，每 `[2 秒]` 呼吸脈動一次。

### 1.2 圓柱（cylinder）
- **適合表達**：信號塔、定位柱、半透明光罩
- **技術**：CylinderGeometry + 半透明 MeshBasicMaterial
- **參數**：height、radius、opacity
- **下指令模板**：
  > 在 `[位置]` 立一根高 `[400m]` 半徑 `[60m]` 的 `[淡綠色]` 圓柱，opacity `[0.5]`，靜止不動。

### 1.3 圓錐 / 信號塔（cone）
- **適合表達**：雷達覆蓋範圍、信號塔、漏斗
- **技術**：ConeGeometry，可正/倒立
- **參數**：height、radius、flip
- **下指令模板**：
  > 在 `[位置]` 放一個高 `[300m]` 底徑 `[400m]` 的 `[橘紅色]` 倒圓錐（尖朝下），表示雷達覆蓋範圍，opacity `[0.3]`。

### 1.4 半球巨蛋（dome）
- **適合表達**：建築巨蛋、保護罩、勢力範圍、影響力區域
- **技術**：SphereGeometry phiLength + 雙面渲染 + wireframe
- **參數**：radius、opacity、wire
- **下指令模板**：
  > 在 `[位置]` 蓋一個半徑 `[600m]` 的 `[紫色]` 半圓巨蛋，半透明 `[0.25]`，雙面渲染含 wireframe。

### 1.5 心形 Extrude（heart）
- **適合表達**：節慶、品牌標記、特殊地點、收藏
- **技術**：THREE.Shape + bezierCurveTo → ExtrudeGeometry
- **參數**：size、altitude、spin
- **下指令模板**：
  > 在 `[位置]` 飄 `[600m]` 高放一顆 `[紅色]` 心形（厚度 80m），緩慢繞 Z 軸旋轉 + 呼吸脈動。

### 1.6 五角星 Extrude（star）
- **適合表達**：評分、收藏、熱門 POI、推薦
- **技術**：10 個 Vector2 外/內交替點 Shape → Extrude
- **參數**：size、altitude、spin
- **下指令模板**：
  > 在 `[位置]` 飄一顆 `[黃色]` 五角星（外徑 `[700m]` 內徑 `[280m]`），慢轉 + 呼吸。

### 1.7 3D Pin Marker（pin）
- **適合表達**：地圖標記（Google Maps 風）、單一目標
- **技術**：倒立 Cone + Sphere + 中央白點，可彈跳
- **參數**：size、bounce
- **下指令模板**：
  > 在 `[位置]` 立一個 `[紅色]` Pin（高 `[300m]`），底尖朝下接地、頂端球 + 內白點，每秒上下彈一次。

### 1.8 晶體（crystal）
- **適合表達**：寶石、抽象 logo、特殊資產、稀有物件
- **技術**：Octahedron / Dodecahedron / Icosahedron / Tetrahedron + Wireframe
- **參數**：size、altitude、shape(0-3)、spinX、spinY
- **下指令模板**：
  > 在 `[位置]` 高 `[400m]` 飄一顆半徑 `[300m]` 的 `[淡藍]` 八面體，內透白線框，X/Y 雙軸慢轉。

---

## 2. 光效（3）

### 2.1 光柱 / 雷射（beam）
- **適合表達**：燈塔、警告、定位光、雷射
- **技術**：薄 Cylinder + 自製 fragment shader（垂直漸層 + 邊緣淡）+ 內核外暈雙層
- **參數**：height、radius、intensity
- **下指令模板**：
  > 在 `[位置]` 射出一根高 `[800m]` 半徑 `[15m]` 的 `[青色]` 光柱，由下而上濃變淡，加性混合，外圍再加一層更寬更淡的暈。

### 2.2 體積光柱 / God Rays（lightcone）
- **適合表達**：神之光、聚光燈、UFO 光束、舞台燈
- **技術**：頂點到底圓的 LineSegments 多條光線 + 半透明 Cone 殼
- **參數**：radius、height、spin
- **下指令模板**：
  > 在 `[位置]` 從高 `[1200m]` 一點射下 `[20 條]` `[淡黃色]` 光線到地面圓周 `[600m]` 半徑，整體緩慢旋轉。

### 2.3 霓虹線條（neon）
- **適合表達**：招牌、發光導線、光束軌跡、cyber 風路徑
- **技術**：TubeGeometry 沿 CatmullRom curve + 內細外粗雙層 AdditiveBlending
- **參數**：size、haloR
- **下指令模板**：
  > 在 `[位置]` 畫一條 `[粉色]` 霓虹彎管（範圍 `[1500m]`），內白核外粉暈，每 `[0.3 秒]` 脈動一次。

---

## 3. 動畫事件（9）

### 3.1 漣漪擴散（ripple）
- **適合表達**：事件發生、雷達脈衝、訊號發射
- **技術**：多層 RingGeometry，半徑隨時間擴散，opacity 遞減
- **參數**：maxR、period、rings
- **下指令模板**：
  > 在 `[位置]` 每 `[1.5 秒]` 發出一圈 `[黃色]` 漣漪，最大擴散半徑 `[800m]`，邊擴邊變淡。

### 3.2 雷達掃描（radar）
- **適合表達**：監視中、掃描中、探索進行中
- **技術**：扇形 BufferGeometry + vertex color alpha + 旋轉 + 三圈刻度
- **參數**：radius、speed、angle
- **下指令模板**：
  > 在 `[位置]` 放一個半徑 `[600m]` 的 `[綠色]` 雷達，掃描臂寬 `[30°]`，每 `[3 秒]` 掃一圈。

### 3.3 旋轉光環（ring）
- **適合表達**：行星環、能量場、土星環
- **技術**：3 個 TorusGeometry 不同軸向同時旋轉
- **參數**：radius、thickness、speed
- **下指令模板**：
  > 在 `[位置]` 放三個半徑 `[400m]` 的 `[金色]` 光環，三個不同軸向同時旋轉，加性混合。

### 3.4 閃電（lightning）
- **適合表達**：雷擊、突發事件、警告、攻擊
- **技術**：動態 zigzag Line + 隨機間隔重生 + 短暫 alpha 衰減
- **參數**：altitude、interval、jitter
- **下指令模板**：
  > 在 `[位置]` 從高空 `[1500m]` 到地面打 `[白色]` 閃電，平均每 `[1.5 秒]` 一次，鋸齒幅度 `[120m]`。

### 3.5 倒數計時環（countdown）
- **適合表達**：倒數、進度、剩餘容量、冷卻時間
- **技術**：TorusGeometry thetaLength 動態裁切 + HSL 綠→紅
- **參數**：radius、thickness、period
- **下指令模板**：
  > 在 `[位置]` 放一個半徑 `[500m]` 厚 `[60m]` 的倒數環，`[10 秒]` 一個循環從滿到空，顏色綠→黃→紅。

### 3.6 衝擊波（shockwave）
- **適合表達**：爆炸、警告、能量釋放、震源
- **技術**：中心垂直爆柱 + 地面擴散環，按週期同步重生
- **參數**：period、radius、height
- **下指令模板**：
  > 在 `[位置]` 每 `[3 秒]` 爆一次：中心 `[500m]` 高粉柱 + 同步擴散 `[1500m]` 半徑光環。

### 3.7 流動等高線（contour）
- **適合表達**：聲波擴散、無線電覆蓋、地形掃描
- **技術**：8 圈同心 Line + 半徑擴散 + Z 軸抬升 + HSL 隨高度
- **參數**：maxR、maxH、period
- **下指令模板**：
  > 在 `[位置]` 持續發出 `[8 圈]` 等高線，最大半徑 `[1500m]`，邊擴邊上升至 `[300m]`，顏色由黃漸綠。

### 3.8 選中 Highlight（highlight）
- **適合表達**：目標選中、警告、追蹤鎖定、重點高亮
- **技術**：中心呼吸球 + 3 圈缺口環反向旋轉
- **參數**：radius、targetSize
- **下指令模板**：
  > 在 `[位置]` 放一個 `[300m]` 半徑的選中標記：中心 `[白色]` 脈動球 + 三圈 `[粉色]` 缺口環反向旋轉。

### 3.9 彩虹拱橋（rainbow）
- **適合表達**：起飛軌跡、鵲橋、慶祝、氣象
- **技術**：6 層 TorusGeometry 半圓（thetaLength=π）不同顏色不同半徑疊加
- **參數**：radius、thickness
- **下指令模板**：
  > 在 `[位置]` 立一個半徑 `[1500m]` 的彩虹拱橋（紅橙黃綠藍紫六層），半圓朝上跨過地面。

---

## 4. Shader 變形（4）

### 4.1 裙擺搖擺（skirt）
- **適合表達**：水母、海葵、布幕、有機體擺動
- **技術**：Cylinder + vertex shader sin(z + time) 水平位移，頂端不動底端擺動最大
- **參數**：height、radius、amp
- **下指令模板**：
  > 在 `[位置]` 立一個 `[粉紅色]` 圓筒（高 `[400m]` 半徑 `[100m]`），頂端不動底端最大擺動 `[30m]`，像水母。

### 4.2 流動漸層（flow）
- **適合表達**：能量流動、資料傳輸、活力指標
- **技術**：Cylinder + fragment shader uv.y - time 做向上流動的色帶
- **參數**：height、radius、speed、bands
- **下指令模板**：
  > 在 `[位置]` 立一根高 `[600m]` 的圓柱，內部有 `[3 條]` 向上流動的 `[藍紫漸層]` 色帶，每秒移動一個身位。

### 4.3 極光飄帶（aurora）
- **適合表達**：大氣層、聲波、能量場、抽象布幕
- **技術**：高空 PlaneGeometry + vertex shader sin 波 + UV 滾動色帶
- **參數**：altitude、length、height、amp
- **下指令模板**：
  > 在 `[位置]` 高空 `[2200m]` 鋪一條長 `[3500m]` 高 `[700m]` 的 `[綠紫]` 飄帶，左右波動 + 顏色上下滾動。

### 4.4 旗幟飄揚（flag）
- **適合表達**：地標、節慶、所有權標記
- **技術**：Cylinder 旗桿 + Plane 旗布 + vertex shader 隨 uv.x 漸強位移
- **參數**：poleHeight、flagW、flagH、wind
- **下指令模板**：
  > 在 `[位置]` 立 `[400m]` 高旗桿 + `[300m×200m]` `[紅色]` 旗布，自由端隨風大幅擺動。

---

## 5. 粒子（12）

### 5.1 粒子噴泉（particles）
- **適合表達**：能量噴發、氣流、火、噴泉
- **技術**：InstancedMesh + 動態 matrix + 重生
- **參數**：count、height、size

### 5.2 煙火爆炸（firework）
- **適合表達**：慶祝、警報
- **技術**：球面隨機方向 + 重力 + 整批同步重生
- **參數**：count、speed、altitude、interval
- **下指令模板**：
  > 在 `[位置]` 高空 `[500m]` 每 `[2 秒]` 爆 `[150 顆]` 粒子，向四周噴 + 重力下落，1.5 秒淡出，每次顏色隨機。

### 5.3 拋物運動（ballistic）
- **適合表達**：噴泉水滴、彈道、投射、落葉
- **技術**：物理積分 v += g·dt + 落地重生
- **參數**：count、speed、size

### 5.4 龍捲風（tornado）
- **適合表達**：沙塵暴、颱風、能量旋轉
- **技術**：螺旋座標 + 半徑隨高度線性變
- **參數**：count、height、rBottom、rTop、spin

### 5.5 流星拖尾（meteor）
- **適合表達**：彗星、子彈、神蹟
- **技術**：頭部光球 + 後方歷史位置陣列拖尾 + 拋物軌跡
- **參數**：speed、trailCount、headSize

### 5.6 螺旋星系（galaxy）
- **適合表達**：銀河、漩渦、社群網絡聚集
- **技術**：粒子分佈在對數螺旋臂 + 內快外慢差速旋轉
- **參數**：count、radius、spin、dotSize

### 5.7 降雪 / 降雨（snow）
- **適合表達**：天氣（雪/雨）、灰塵、櫻花瓣
- **技術**：粒子持續下落 + 重生 + 風 sin 偏移
- **參數**：count、spread、altitude、speed、wind

### 5.8 彩紙飄落（confetti）
- **適合表達**：派對、慶祝、獎勵
- **技術**：多顆 PlaneGeometry 獨立顏色 + 自轉 + 飄落
- **參數**：count、spread、altitude

### 5.9 黑洞漩渦（vortex）
- **適合表達**：吸入感、排水、黑洞、終結
- **技術**：粒子螺旋向內被吸到中心 + 重生回外緣 + 中心暗核
- **參數**：count、radius、coreSize、speed

### 5.10 多階段煙火（firework2）
- **適合表達**：完整生命週期煙火秀
- **技術**：Stage 1 火箭升 + 拖尾；Stage 2 爆炸 + 重力下墜
- **參數**：count、speed、peak、period

### 5.11 瀑布粒子（waterfall）
- **適合表達**：瀑布、熔岩流、礦物流
- **技術**：粒子加速下落（life² 模擬重力）+ 越下越散
- **參數**：count、width、height

### 5.12 星空背景（starfield）
- **適合表達**：夜空、繁星、海底發光生物
- **技術**：上半球面隨機 + twinkle 閃爍 sin 大小
- **參數**：count、radius

---

## 6. 線條 / 路徑（4）

### 6.1 沿線流動光點（flowline）
- **適合表達**：物流、列車、交通流向
- **技術**：地理 Line + 多顆光球線性插值
- **參數**：count、speed、size
- **下指令模板**：
  > 從 `[A]` 到 `[B]` 畫一條 `[青色]` 線，`[5 顆]` 光球以每秒 `[1/8 全程]` 速度連續從起點流向終點。

### 6.2 OD 弧線（arc）
- **適合表達**：航班、金流、社群連結、O→D 矩陣
- **技術**：QuadraticBezierCurve3 + 沿線光球
- **參數**：arcHeight、speed、count、size
- **下指令模板**：
  > 從 `[A]` 到 `[B]` 畫一條 `[粉紅色]` 拋物線弧（弧高 = 距離 × 30%），`[4 顆]` 光球連續從 A 流向 B。

### 6.3 連線網絡（network）
- **適合表達**：社群、區域網路、區塊鏈、通訊
- **技術**：節點球 + 兩兩連線 + 沿邊傳播光點
- **參數**：radius、nodeSize、pulseCount、speed

### 6.4 3D 折線圖（linechart）
- **適合表達**：時序資料、時間軸數值
- **技術**：折線 + 各節點 marker，Z = 數值
- **參數**：length、maxH、markerSize

---

## 7. 數據視覺化（5）

### 7.1 3D 長條圖（bars）
- **適合表達**：分類比較、過去 N 期
- **技術**：BoxGeometry × N + scale.z 動態 + HSL 顏色梯變
- **參數**：count、width、spacing、maxH

### 7.2 熱力 3D 曲面（heatmap）
- **適合表達**：海拔、人口密度、訊號強度、熱力分布
- **技術**：PlaneGeometry 細分 + per-vertex z + vertex color HSL
- **參數**：size、maxH、speed

### 7.3 3D 圓餅圖（pie）
- **適合表達**：比例、市占、分類
- **技術**：CylinderGeometry thetaStart/thetaLength 切扇形 + 各扇不同高度
- **參數**：radius、maxH

### 7.4 區塊 Extrude 建築（polyextrude）
- **適合表達**：建築天際線、行政區、商圈分布
- **技術**：ExtrudeGeometry on Shape 多邊形（同 Mapbox fill-extrusion）
- **參數**：count、size、maxH

### 7.5 音波柱（waveform）
- **適合表達**：聲音、震動、節奏、頻譜
- **技術**：BoxGeometry × N + 多頻 sin 疊加（FFT 風）
- **參數**：count、width、maxH、speed

---

## 8. 體積 / 大氣（3）

### 8.1 體積煙霧（smoke）
- **適合表達**：火、煙、污染擴散
- **技術**：軟邊球 cluster + 隨機抖動 + 慢速向上飄 + 越高越大越淡
- **參數**：count、size、rise、spread

### 8.2 噪聲雲團（noisecloud）
- **適合表達**：星雲、霧氣、不規則雲體
- **技術**：球粒位置由 sin/cos noise 決定 + 慢速漂移
- **參數**：count、spread、altitude、drift

### 8.3 霧效 / 低層雲（fog）
- **適合表達**：晨霧、霾害低層、神秘氛圍
- **技術**：扁平軟邊球 cluster + 低空緩慢漂移
- **參數**：count、spread、altitude、size

---

## 9. 場景 / 科幻（8）

### 9.1 3D 文字標籤（text）
- **適合表達**：地名、提示、解說
- **技術**：Canvas 畫文字 → CanvasTexture → Plane
- **參數**：size、lift
- **下指令模板**：
  > 在 `[位置]` 鋪一塊長 `[800m]` 的標籤，內容 `[文字]`，`[白字深底]`，地面平行從上方可見。

### 9.2 DNA 雙螺旋（dna）
- **適合表達**：遺傳、纏繞、彈簧、樓梯結構
- **技術**：TubeGeometry 沿 CatmullRomCurve3 螺旋 + base pair 短線
- **參數**：height、radius、turns

### 9.3 地面掃描網格（scangrid）
- **適合表達**：賽博風基底、AI 掃描、區域監測、戰術圖層
- **技術**：Wireframe Plane LineSegments + 動態掃描 LineSegments
- **參數**：size、divisions、period

### 9.4 能量罩（shield）
- **適合表達**：護盾、衛星天線、抽象幾何雕塑
- **技術**：Icosahedron(detail=2) + 半透明 fill + Wireframe 疊加 + 線框脈動
- **參數**：radius、spin

### 9.5 蜂巢格地面（hexgrid）
- **適合表達**：感應網絡、區域分析、能量場
- **技術**：六邊形 LineLoop × N + 距離+時間決定 opacity 波
- **參數**：size、speed

### 9.6 Glitch 故障藝術（glitch）
- **適合表達**：故障、訊號干擾、賽博風、vaporwave
- **技術**：切片 BoxGeometry × N 堆疊 + 週期性隨機 XY 偏移
- **參數**：size、intensity

### 9.7 棋盤格漂浮（checker）
- **適合表達**：節拍視覺化、矩陣資料、同步律動
- **技術**：8×8 PlaneGeometry 黑白格 + Z 高度由 sin(r+c+t) 波動
- **參數**：size、maxLift

### 9.8 軌道衛星（orbit）
- **適合表達**：行星系、衛星群、原子模型、樞紐輻射網
- **技術**：中心球 + 5 顆衛星各自 tilted orbit + 軌道線
- **參數**：radius、coreSize、satSize

---

---

## 10. 系統關係 / 水資源（12）

> 為「描述系統互動」設計的元件，最早為水資源系統設計，但同樣適用於物流、金流、能源、訂閱等任何「節點 + 流動 + 容量 + 循環」的領域。

### 10.1 匯流樹（watershed）— line.js
- **適合表達**：流域集水、神經傳遞、訊號匯入、客戶漏斗
- **技術**：遞迴 4×3 樹狀結構 + 光點沿支幹流向中心 + 中心脈動
- **參數**：size、speed、coreSize、dotSize
- **下指令模板**：
  > 在 `[位置]` 鋪一個 `[1500m]` 範圍的匯流樹，4 方向各遞迴 3 層分支，光點從葉端流回中心。

### 10.2 Sankey 流量帶（sankey）— line.js
- **適合表達**：跨地調水、物流量級、金流規模、能源傳輸
- **技術**：QuadraticBezier + TubeGeometry（粗細 = 流量）+ 流動條紋 shader
- **參數**：width、speed
- **下指令模板**：
  > 從 `[A]` 到 `[B]` 拉一條粗 `[200m]` 的青色流量帶，表面條紋向終點滾動，弧高為距離 20%。

### 10.3 多源匯流（converge）— line.js
- **適合表達**：多支流→主流、多源頭→匯總、客戶聚合、災害集中
- **技術**：6 個外圍節點 + 中心核 + 沿線向心傳播光點
- **參數**：radius、coreSize、sourceSize、speed

### 10.4 儲水容器（tank）— viz.js
- **適合表達**：水庫蓄水量、油槽、電池容量、儲存進度
- **技術**：外圍 Wireframe Cylinder + 內部水位 Cylinder + HSL 顏色（低紅高綠）
- **參數**：radius、height、fillLevel、autoFill
- **下指令模板**：
  > 在 `[位置]` 立一個半徑 `[400m]` 高 `[600m]` 的儲水容器，水位自動由 0~100% 循環，低紅高綠。

### 10.5 連通管（vessels）— viz.js
- **適合表達**：跨區調水、能量重分配、系統平衡、達西定律
- **技術**：3 個 Cylinder Tank 並排 + 底部連接管 + 水位 sin 連動但收斂到平均
- **參數**：radius、height

### 10.6 容器陣列（capacityarray）— viz.js
- **適合表達**：多測站狀態（水庫群、油槽群、電池組、各營業據點 KPI）
- **技術**：N 個 Cylinder 並排 + 各自獨立水位 sin + HSL 顏色警示
- **參數**：count、radius、height

### 10.7 水循環閉環（hydrocycle）— animation.js
- **適合表達**：自然循環、生命週期、製程閉環、訂閱續約
- **技術**：4 個節點（雲/雨/湖/蒸發）+ 連線 + 光點繞行 loop
- **參數**：size、nodeSize、speed
- **下指令模板**：
  > 在 `[位置]` 鋪一個 `[1500m]` 範圍的水循環：雲（頂）→雨（右）→湖（底）→蒸發（左），8 顆光點繞行。

### 10.8 漫淹擴散（flood）— animation.js
- **適合表達**：淹水範圍、影響擴散、感染傳播、覆蓋率成長
- **技術**：Disc 半徑擴張 + Z 軸抬升 + 邊緣亮環，按週期重生
- **參數**：maxR、maxRise、period

### 10.9 回饋迴路（feedback）— animation.js
- **適合表達**：正/負回饋、依賴循環、訂閱續約、製程回流
- **技術**：5 節點圍成圓圈 + 微彎 TubeGeometry 連線 + 光點繞行 loop
- **參數**：radius、nodeSize、speed

### 10.10 階梯瀑布（cascade）— particles.js
- **適合表達**：串聯水庫、上下游關係、級聯處理、瀑布管線
- **技術**：3 階圓盤平台 + 3 段粒子流（每段微弧拋物）
- **參數**：radius、tierHeight

### 10.11 蒸發升騰（evap）— particles.js
- **適合表達**：蒸發、散熱、飄香、流出損失
- **技術**：粒子從寬底面緩慢上升 + 微側向漂移 + 越上越大越淡
- **參數**：count、baseRadius、maxHeight、rise

### 10.12 龜裂警示（drought）— scene.js
- **適合表達**：乾旱、龜裂、警告區域、影響惡化
- **技術**：從中心 random walk 放射裂痕線（含分支）+ 中心警示環脈動 + severity HSL
- **參數**：size、severity

### 水資源系統混搭範例

| 描述目標 | 元件組合 |
|---|---|
| **完整水庫狀態** | `tank`（蓄水量）+ `bars`（歷史水位）+ `pin`（標記）+ `text`（站名）|
| **流域集水** | `watershed`（樹狀）+ `flowline`（主河道）+ `converge`（匯流點）|
| **跨流域調水** | `sankey`（A→B 粗管）+ 兩端 `tank` + `vessels`（連通） |
| **完整水循環** | `hydrocycle`（核心）+ `evap`（蒸發）+ `cloud`/`smoke`（積雲）+ `snow`（降水） |
| **缺水警示連動** | `drought`（龜裂）+ `tank`（低水位紅）+ `lightning`（突發乾旱事件）+ `highlight`（警報目標） |
| **上下游串接** | `cascade`（多階釋放）+ `flowline`（往下游）+ `flood`（下游漫淹）|
| **水庫群狀態板** | `capacityarray`（N 個水庫並排）+ `feedback`（彼此調度迴路）+ `pin`（每個位置）|

> 同一個城市疊多個元件 = 完整故事。例如曾文水庫疊 `tank` + `evap` + `drought` + `pin` + `text` = 「正在乾旱中的水庫，水位偏低、持續蒸發、地面龜裂」。

---

## 怎麼接到主專案

如果想把某個元件接進 `mini-taiwan-pulse` 主程式（不只是 demo）：

1. 在 demo 中先確認效果 + 調好參數
2. 跟我說：
   > 把 demo 裡的 `[元件 ID]` 抽出來做成新 layer，資料源從 `[Supabase RPC / GeoJSON / 既有 layer]`，每個資料點顯示一個元件，按 `[欄位名]` 決定 `[size / color / height]`。
3. 我會依專案規則（CLAUDE.md 第 5 條「新增 Layer 強制順序」）建：
   - `src/data/xxxLoader.ts`（含 loadingRegistry）
   - `src/hooks/useXxxLayer.ts`
   - `src/three/XxxScene.ts`（基於 demo 的 build/update）
   - `src/map/xxxCustomLayer.ts`
   - `src/components/LayerSidebar.tsx` 加 toggle + LAYER_COLORS
   - 動態時間訂閱走 `timeStore`（不用 useEffect）

## 混搭範例

很多元件可以同位置疊加：

- **「監測站」** = `radar`（掃描範圍）+ `pin`（標記）+ `text`（站名）
- **「重大事件發生」** = `shockwave`（震源）+ `lightning`（一次性閃光）+ `highlight`（標出位置）
- **「物流節點」** = `network`（連線結構）+ `flowline`/`arc`（流向）+ `bars`（吞吐量）
- **「氣象現象」** = `aurora` 或 `fog` 或 `tornado`（主視覺）+ `lightning`（突發）+ `noisecloud`（背景）
- **「資料中心」** = `cylinder`/`pillar`（建築）+ `flow`（內部流動）+ `shield`（防護罩外殼）
- **「節慶 / 活動」** = `firework2`（煙火）+ `confetti`（彩紙）+ `text`（名稱）+ `rainbow`（拱橋）

## 參數速查

| 參數 | 通常意義 | 典型範圍 |
|---|---|---|
| `size` / `radius` | 主體大小（公尺） | 50~3000 |
| `height` | 高度（公尺） | 100~3000 |
| `altitude` | 漂浮高度（公尺） | 0~2500 |
| `count` | 元件數量 | 取決於類型，10~1500 |
| `speed` | 旋轉/移動速度 | 0~5 |
| `period` | 動畫週期（秒） | 0.5~10 |
| `opacity` | 透明度 | 0~1 |
| `spin` | 旋轉速度 | 0~3 |
| `wind` / `amp` | 變形幅度 | 0~0.5 |
| `interval` | 事件間隔（秒） | 0.3~8 |

## 顏色備忘

主專案常用配色（已用在多個 layer）：

| 用途 | 色值 |
|---|---|
| 主體強調 | `#6cb8ff`（青藍）|
| 次要強調 | `#ff7eb6`（粉）|
| 警告 | `#ff5b6e`（紅）|
| 成功 / 自然 | `#4cffa6`（綠）|
| 注意 / 標記 | `#ffd87a`（黃）|
| 神秘 / 高階 | `#a080ff`（紫）|
| 雷射 / 訊號 | `#6cf6ff`（青）|
| 暖色系（火、煙火內核） | `#ffa86c`（橙）|

