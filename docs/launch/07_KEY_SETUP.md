# D1 — Key 設定指引（你的 console 動作）

> 為什麼要你做：建 IAM key、設 Mapbox 限制都需要登入你的 AWS / Mapbox 帳號 console，我沒有那個權限。
> 我把「要貼什麼、點哪裡」整理好，你照做即可。完成後把新值給我（或你自己貼進 Zeabur），我接著跑部署。

---

## 1. 唯讀 S3 小鑰匙（給 Zeabur runtime 拉 deploy-assets 用）

**目的**：容器只需要「讀」`deploy-assets/`。不要用本地 `.env` 那把能讀能寫能刪的 upload key。

### 步驟（AWS Console → IAM）
1. IAM → Policies → Create policy → JSON，貼下面這段（bucket = `migu-gis-data-collector`）：
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadDeployAssets",
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::migu-gis-data-collector/deploy-assets/*"
    },
    {
      "Sid": "ListDeployAssetsPrefix",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::migu-gis-data-collector",
      "Condition": { "StringLike": { "s3:prefix": ["deploy-assets/*"] } }
    }
  ]
}
```
   命名如 `pulse-deploy-assets-readonly`。
2. IAM → Users → Create user（如 `pulse-runtime`）→ 不需 console 登入 → 附上面那個 policy。
3. 該 user → Security credentials → Create access key（用途選 Application running outside AWS）→ 記下 **Access key ID / Secret**。
4. 這把就是要填進 Zeabur 的 `S3_ACCESS_KEY` / `S3_SECRET_KEY`。

> 若部署後 entrypoint 的 `aws s3 sync` 報 AccessDenied 列舉錯誤，把上面 ListBucket 的 `Condition` 整段拿掉（放寬成可列整個 bucket，仍只能讀 deploy-assets 物件）。

## 2. Mapbox token 設 URL 限制（防被盜刷）

**目的**：token 會被嵌進前端網頁（公開可見，這是 Mapbox 正常設計），加 URL 限制讓它只能在你的網域用。

### 步驟（Mapbox 官網 → Account → Tokens）
1. 找到你在用的 token（`.env` 的 `VITE_MAPBOX_TOKEN`，`pk.` 開頭）。
2. 編輯該 token → **URL restrictions** → 加上你的上線網域，例如：
   - `https://<你的 zeabur 網域>.zeabur.app`
   - 之後若綁自訂網域，再把自訂網域加進來。
3. 存檔。**注意**：本機開發（localhost:3721）也要加 `http://localhost:3721`，否則本地會畫不出地圖。
4. （選做）Mapbox 帳號設用量警報，超量寄信通知。

> Mapbox token 是 build-time 嵌入，所以「換不換 token」其次，**重點是加 URL 限制**——就算被人撈走也只能在你網域用。

## 3. 其他 key（低風險，可不急）
- `FR24_API_TOKEN` / `GEMINI_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_DB_URL`：**都不進前端 bundle**（只後端腳本用），未洩漏進 git。可暫不輪換，有空再循環。
- `VITE_SUPABASE_ANON_KEY`：本來就設計成公開，受 RLS / RPC 權限保護（已驗證 realtime 不曝光）。維持。

## 4. 要填進 Zeabur 的環境變數（彙整）
| 變數 | 值來源 | 類型 |
|---|---|---|
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | §1 新建的唯讀 key | runtime |
| `S3_REGION` | `ap-southeast-2` | runtime |
| `S3_BUCKET` | `migu-gis-data-collector` | runtime |
| `VITE_MAPBOX_TOKEN` | 你的 token（已加 URL 限制） | **build arg** |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | 同 `.env` | build/runtime |
| `VITE_DATA_SOURCE` | `supabase` | build/runtime |

完成 §1、§2 後，把 §1 的新 key 給我（或你自己貼進 Zeabur），我就接著跑 commit → merge → 部署。
