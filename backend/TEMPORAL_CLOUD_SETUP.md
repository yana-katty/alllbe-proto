# Temporal Cloud セットアップガイド

このドキュメントでは、Temporal Cloudへの移行手順と環境変数の設定方法を説明します。

## 環境変数の設定

### 1. backend/.env ファイルの編集

以下の環境変数を設定してください：

```bash
# Temporal Cloud Settings
TEMPORAL_ADDRESS=ap-northeast-1.aws.api.temporal.io:7233
TEMPORAL_NAMESPACE=quickstart-alllbe-proto.f1qvm
TEMPORAL_API_KEY=your_temporal_api_key_here
TEMPORAL_TASK_QUEUE=main
```

### 2. シェルから環境変数をエクスポート（オプション）

Docker Composeを使わずに直接実行する場合は、以下のコマンドで環境変数を設定できます：

```bash
export TEMPORAL_API_KEY='your_api_key_here'
export TEMPORAL_NAMESPACE='quickstart-alllbe-proto.f1qvm'
export TEMPORAL_ADDRESS='ap-northeast-1.aws.api.temporal.io:7233'
```

## Docker Composeでの起動

Docker Composeを使用する場合、`backend/.env`ファイルの設定が自動的に読み込まれます：

```bash
# プロジェクトルートで実行
cd /Users/yanaka/Development/experimental/alllbe/alllbe-proto

# Docker Composeで起動
docker compose up -d

# ログを確認
docker compose logs --tail=50 --follow
```

### 環境変数の優先順位

Docker Composeでは以下の優先順位で環境変数が適用されます：

1. `docker-compose.yml`の`environment`セクションで直接指定した値
2. シェルの環境変数（`export`コマンドで設定）
3. `backend/.env`ファイルの値
4. デフォルト値（`${TEMPORAL_ADDRESS:-ap-northeast-1.aws.api.temporal.io:7233}`の`:-`以降）

## ローカル開発環境への切り戻し

ローカルのTemporal Serverに戻す場合は、`backend/.env`を以下のように変更します：

```bash
# Temporal Local Settings
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
# TEMPORAL_API_KEY=（コメントアウトまたは削除）
TEMPORAL_TASK_QUEUE=main
```

Docker環境の場合：

```bash
# Temporal Local Settings（Docker内）
TEMPORAL_ADDRESS=temporal:7233
TEMPORAL_NAMESPACE=default
# TEMPORAL_API_KEY=（コメントアウトまたは削除）
TEMPORAL_TASK_QUEUE=main
```

## 接続の確認

### 1. Worker起動時のログ確認

Workerが正常に起動すると、以下のようなログが出力されます：

```
Temporal Worker started successfully
  Task Queue: main
  Temporal Address: ap-northeast-1.aws.api.temporal.io:7233
  Temporal Namespace: quickstart-alllbe-proto.f1qvm
  Temporal Cloud: Enabled (API Key)
  Database: Connected
  Auth0: Configured
  WorkOS: Configured
```

### 2. tRPCサーバー起動時のログ確認

tRPCサーバーが正常に起動すると、以下のようなログが出力されます：

```json
{
  "level": "info",
  "message": "tRPC Server started",
  "port": 4000,
  "url": "http://localhost:4000",
  "trpcEndpoint": "http://localhost:4000/trpc",
  "healthEndpoint": "http://localhost:4000/health",
  "temporalAddress": "ap-northeast-1.aws.api.temporal.io:7233",
  "temporalNamespace": "quickstart-alllbe-proto.f1qvm",
  "temporalCloud": "Enabled",
  "temporalTaskQueue": "main"
}
```

## トラブルシューティング

### エラー: "Invalid API Key"

**原因**: `TEMPORAL_API_KEY`が正しく設定されていない

**解決策**:
1. Temporal Cloudダッシュボードで正しいAPI Keyを確認
2. `backend/.env`の`TEMPORAL_API_KEY`を更新
3. Docker Composeを再起動: `docker compose restart`

### エラー: "Connection refused"

**原因**: `TEMPORAL_ADDRESS`が正しく設定されていない、またはネットワークの問題

**解決策**:
1. `TEMPORAL_ADDRESS`が正しいエンドポイントを指しているか確認
2. ファイアウォールやネットワーク設定を確認
3. Temporal Cloudのステータスページを確認

### エラー: "Namespace not found"

**原因**: `TEMPORAL_NAMESPACE`が存在しないか、権限がない

**解決策**:
1. Temporal Cloudダッシュボードで正しいNamespace名を確認
2. `backend/.env`の`TEMPORAL_NAMESPACE`を更新
3. Docker Composeを再起動: `docker compose restart`

## セキュリティのベストプラクティス

### 1. API Keyの管理

- **`.env`ファイルをGitにコミットしない**（`.gitignore`に含まれています）
- **本番環境では環境変数として設定**し、ファイルに保存しない
- **定期的にAPI Keyをローテーション**する

### 2. 本番環境の設定

本番環境では、環境変数を直接コンテナに渡すか、Secretsマネージャーを使用してください：

```bash
# 環境変数として直接設定（例: Kubernetes）
kubectl create secret generic temporal-credentials \
  --from-literal=api-key='your_api_key_here' \
  --from-literal=namespace='quickstart-alllbe-proto.f1qvm' \
  --from-literal=address='ap-northeast-1.aws.api.temporal.io:7233'
```

## 参考資料

- [Temporal Cloud Documentation](https://docs.temporal.io/cloud)
- [Temporal TypeScript SDK](https://docs.temporal.io/develop/typescript)
- [Architecture Instructions](./.github/instructions/architecture.instructions.md)
