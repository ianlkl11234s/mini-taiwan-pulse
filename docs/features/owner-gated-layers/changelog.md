# Changelog — <feature-name>

> 逐 PR 變更紀錄。最新在上。

格式：
```
## YYYY-MM-DD — PR #NN <squash commit hash>
- <what changed>
- <why (optional)>
- <breaking? migration needed?>
```

---

## YYYY-MM-DD — PR #NN `xxxxxxx`

- 新增 xxx 圖層
- 資料源：<摘要>
- Breaking：無

## 2026-09-07 前端 fail-closed 收整

- RPC 成功但漏列靜態敏感 key（目前 35 個靜態 key 與 34 個回傳細項有差）時維持 owner 限制；不再把缺席當成公開。
- disabled full／未知 tier／非法 lock metadata 保守處理；有效既有設定及公開層不變。未知 user tier 不從 Object prototype 取得 rank。
- 此為前端判定修正，不是 DB policy 部署或所有受保護 API 的穿透驗收。
