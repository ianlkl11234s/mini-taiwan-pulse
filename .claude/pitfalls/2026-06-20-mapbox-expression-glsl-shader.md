# 2026-06-20 — Mapbox expression / GLSL shader / image lifecycle 三連環踩坑

## TL;DR

Phase 8 SSOT 前端整理花了 30+ commit 來回，**多數來自 silent fail 沒先查文件**。
這個檔集中 4 類 silent fail，下次寫 visual layer 前先掃。

---

## 1. Mapbox expression：`match` 不接 boolean

### 症狀
```js
["match", ["get", "has_realtime"], true, 1, 0.3]
```
**整個 expression invalid → Mapbox fallback 把 radius/size 算成 0 → marker 全消失**。
但 console **沒有任何錯誤訊息**。

### 修法
Boolean 用 `case`：
```js
["case", ["==", ["get", "has_realtime"], true], 1, 0.3]
```

### 規則：Mapbox expression input type
| Expression | Input type 限制 |
|---|---|
| `match` | **只接 string / number**，不接 boolean |
| `case` | 條件接 boolean、值任意 |
| `step` | 只接 number |
| `interpolate` | 只接 number |

### 同類陷阱
- `circle-stroke-dasharray` → **不存在**。想做虛線邊框只能 line layer
- `icon-size` → 只能在 **layout**，paint 內塞無效
- `icon-color` → 只對 **sdf:true** 的 image 有效
- 變動 layout 屬性必須用 `setLayoutProperty` 或 removeLayer/addLayer，**不能** `setPaintProperty`

---

## 2. GLSL ES 1.0：`vec4 ? : ternary` silent fail

### 症狀
```glsl
vec4 clip = (along < 0.5) ? clipA : clipB;
```
**vertex shader compile fail 但 Three.js 不抓**（或 fallback 到亂值）→ 線完全沒位置 → 看不到任何輸出。

### 修法
GLSL ES 1.0 三元只對 scalar 安全。vec 用 `mix`：
```glsl
vec4 clip = mix(clipA, clipB, along);
```

### 規則
- 寫 GLSL 內 `? :` 前先確認 operand 是 scalar（float/int/bool），**不是 vec**
- 用 `mix(a, b, t)` 取代 vec 三元
- 用 `step()` / `smoothstep()` 做條件

---

## 3. fat-line vertex shader normal 必須對「整段」算一次

### 症狀
fat-line 變成「梳齒/羽毛」紋路（quad 變 X 形）—  以為 vertex shader 寫對了但實際 normal 方向兩端相反。

```glsl
// ❌ 錯：用 self→other 算 normal → A 端往 +x，B 端往 -x，quad 變 X 形
vec2 other = mix(instancePosB, instancePosA, along);
vec2 dir = ... (self - other);
```

### 修法
**對整段 segment** 算固定方向 `(B - A)`，A/B 兩端 vertex 都用同一個 perp normal：
```glsl
vec4 clipA = uMatrix * vec4(instancePosA, 0., 1.);
vec4 clipB = uMatrix * vec4(instancePosB, 0., 1.);
vec2 dirPx = (clipB.xy/clipB.w - clipA.xy/clipA.w) * uResolution * 0.5;
vec2 dn = length(dirPx) > 1e-6 ? normalize(dirPx) : vec2(1., 0.);
vec2 normalPx = vec2(-dn.y, dn.x) * across * uHalfWidthPx;
vec4 clip = mix(clipA, clipB, along);
clip.xy += (normalPx / uResolution) * 2. * clip.w;
gl_Position = clip;
```

### 規則
- fat-line quad expansion：方向**對整段算**、normal 對整段固定，per-vertex 只用 `across=±1` 控左右側
- 寫 vertex shader 前先**紙上推算** 4 個 vertex 的 final position 應該長怎樣
- 先用 fragment shader 純色（`gl_FragColor = vec4(1,0,0,1)`）測 vertex shader、再加 fragment 細節

---

## 4. mapboxgl image / Custom layer 三層保險

### 症狀
- 圖層 mount 時 image 還沒 ready → `Image "xxx" could not be loaded`
- 用 `if (isStyleLoaded()) addImage; else map.on('style.load', addImage)` → style.load 已 fire 過、不再 fire → image 永不註冊
- mapRef.current 在第一輪 useEffect 還 null → effect return → 之後永不重試（useRef 不 trigger React re-render）

### 修法
**三層保險**：
```ts
useEffect(() => {
  let stopped = false;
  let intervalId: number | null = null;

  const tryRegister = (): boolean => {
    const map = mapRef.current;
    if (stopped || !map) return false;
    if (!map.isStyleLoaded()) return false;
    if (!map.hasImage(IMG_ID)) {
      map.addImage(IMG_ID, buildIcon(), { sdf: true });
      // force source reload，補救 layer 比 image 早 mount
      const src = map.getSource(SRC_ID);
      if (src) (src as any).setData((src as any)._data);
    }
    map.on("style.load", () => { /* 重 register */ });
    map.on("styleimagemissing", (e) => {
      if (e.id === IMG_ID) addImage(...);
    });
    return true;
  };

  if (!tryRegister()) {
    intervalId = window.setInterval(() => {
      if (tryRegister()) clearInterval(intervalId!);
    }, 100);
  }
  return () => { stopped = true; if (intervalId) clearInterval(intervalId); };
}, [mapRef]);
```

### 規則
- `useRef` 賦值不 trigger re-render → effect deps `[mapRef]` 第一輪 null 就死
- 用 polling 等 map ready，或 deps 加 `visible` boolean 讓 toggle ON 時重試
- image / addLayer 都搭配 `try/catch + idle retry` 模式（見 `2026-04-22-mapbox-load-once-fired.md`）

---

## 5. Bonus：rebuildOnParamChange snapshot 只看 paint，layout 變化漏接

### 症狀
變電所 size slider 拉動沒反應 — 因為 size 在 layout，paint snapshot 不變 → overlayManager 認為「沒事」不 rebuild。

### 修法
callback layout 走 `setLayoutProperty` diff（跟 `applyPaintDiff` 同 pattern）：
- `src/map/overlayManager.ts` 新增 `applyLayoutDiff` + `layoutCacheByMap`
- 偵測 callback layout 變化就 setLayoutProperty，**不繞 rebuild**

### 規則
- spec.layout 是 callback → 一定要走 layout diff，不能等 paint snapshot trigger rebuild
- icon-size / icon-rotate / text-* 屬性是 layout，slider 控制必須 setLayoutProperty
