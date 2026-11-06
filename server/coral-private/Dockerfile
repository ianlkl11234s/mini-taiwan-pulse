# 私有圖層 sidecar 獨立映像（Zeabur 搬家：新主機 docker compose 用，與主站 nginx 映像分開）
#
# build context 是本資料夾（server/coral-private），只帶 .dockerignore 放行的檔：
#   docker build -f server/coral-private/Dockerfile server/coral-private
# 發布：.github/workflows/publish-coral-private.yml → ghcr.io/ianlkl11234s/pulse-coral-private
#
# 只打包 sidecar 需要的東西：
#   coral-private-server.mjs —— 只 import node 內建模組、@aws-sdk/client-s3、@supabase/supabase-js、./bus-crowding-assets.mjs
#   bus-crowding-assets.mjs  —— 純常數
#   package.json／package-lock.json —— 只有上面兩個依賴
# 不含主站 dist、nginx、aws-cli、scripts/deploy 的 pull／refresh 腳本、test/。
#
# 執行期設定（S3 金鑰、Supabase、各 *_ORIGINS、STORAGE=s3、REVOKE／AUDIT 路徑）全由 compose 的 env 提供，
# 映像內不放任何祕密。缺設定時 sidecar 照樣聽 port、對請求回 503（fail closed）。
# 兩個 port（8789 珊瑚礁、8796 站主驗證）程式寫死只綁 127.0.0.1，compose 用 network_mode: service:caddy 共用網路。

FROM node:22-alpine
# 讓 GHCR package 連到本 repo（GITHUB_TOKEN 才有權限推後續版本）
LABEL org.opencontainers.image.source="https://github.com/ianlkl11234s/mini-taiwan-pulse"
ENV NODE_ENV=production
WORKDIR /opt/coral-server

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

COPY coral-private-server.mjs bus-crowding-assets.mjs ./

# 撤銷名單目錄（compose 以 bind mount 蓋上；主機端要 chown 1000:1000）
RUN mkdir -p /data/.private-allen && chown -R node:node /data
USER node

EXPOSE 8789 8796
# 用絕對路徑：程式以 argv[1] 判斷是否為主程式（coral-private-server.mjs 檔尾）
CMD ["node", "/opt/coral-server/coral-private-server.mjs"]
