# ==================================================
# Stage 1: Dependencies (本番依存関係専用)
# ==================================================
FROM node:18-alpine AS deps
WORKDIR /app

# 本番依存関係のみインストール
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ==================================================
# Stage 2: Builder (TypeScriptビルド専用)
# ==================================================
FROM node:18-alpine AS builder
WORKDIR /app

# 開発依存関係を含む全依存関係をインストール
COPY package*.json tsconfig.json ./
RUN npm ci

# ソースコードのみコピー
COPY src ./src

# TypeScriptコンパイル
RUN npm run build

# ==================================================
# Stage 3: Production (本番実行環境)
# ==================================================
FROM node:18-alpine AS production
WORKDIR /app

# セキュリティ: 非rootユーザー作成
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# 本番依存関係とビルド成果物をコピー
COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/dist ./dist
COPY --chown=nodeuser:nodejs package*.json ./

# 非rootユーザーに切り替え
USER nodeuser

# Cloud Run対応: 動的ポート設定
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# ヘルスチェック（動的ポート対応）
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const port = process.env.PORT || 8080; require('http').get('http://localhost:' + port + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# アプリケーション起動
CMD ["node", "dist/index.js"]