# docs/features/

**每個 feature 一個資料夾，作為該功能的文件歸屬地。**

## 為什麼要這樣分

過去 STATUS.md 是全站流水帳，難追某個 feature 的完整脈絡。這裡讓每個 feature：
- 有自己的 README（是什麼、誰做、怎麼跑）
- 有自己的 backlog（從全站 BACKLOG.md 抽出來的相關項）
- 有自己的 changelog（逐 PR 記錄）
- 有自己的 handoff（反向引用 taipei-gis-analytics 的上游 handoff）

## 結構

```
docs/features/
├── README.md              ← 這份
├── _TEMPLATE/             ← 開新 feature 就 cp -r 這個
│   ├── README.md
│   ├── backlog.md
│   ├── changelog.md
│   └── handoff.md
└── <feature-slug>/
    ├── README.md          ← 功能簡介 + owner + 資料源摘要
    ├── backlog.md         ← 該 feature 待辦（BACKLOG.md 的子集）
    ├── changelog.md       ← 逐 PR 變更（date + PR# + what）
    └── handoff.md         ← 資料契約 + 上游 handoff 反向引用
```

## Feature slug 命名

用 kebab-case，與 upstream 一致：
- `real-estate`（對應 `taipei-gis-analytics/docs/handoff/real-estate.md`）
- `fire-rescue`
- `waste-collection`

## 現有 features

| Feature | 狀態 | Owner | 上游 handoff |
|---|---|---|---|
| [real-estate](./real-estate/) | ✅ shipped | migu | [handoff](../../../taipei-gis-analytics/docs/handoff/real-estate.md) |

## 全站文件和這裡的分工

| 文件 | 職責 |
|---|---|
| `.claude/memory/STATUS.md` | 全站當週動態（只留最新段） |
| `.claude/memory/BACKLOG.md` | 全站 backlog 分類索引 |
| `.claude/memory/PRINCIPLES.md` | 全站 P0 規則、跨 feature |
| **`docs/features/<x>/`** | **單一 feature 的完整脈絡** |
| `docs/development-rules.md` | 開發通則（不分 feature） |
