# Debian ベース (glibc) フルイメージを使用 - Temporal の Rust バイナリと互換性あり
FROM node:22

WORKDIR /app

COPY backend/package*.json ./
RUN npm install --production

# tsx 実行環境をグローバルインストール
RUN npm install -g tsx

COPY backend/ ./

EXPOSE 3000

ENV NODE_ENV=production

# CMD は docker-compose で上書き（trpc/worker どちらにも使える汎用イメージ）
CMD ["node"]
