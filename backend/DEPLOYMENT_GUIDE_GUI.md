# 🖱️ Cloud Run GUI デプロイメントガイド（GitHub連携）

## 📋 概要

Google Cloud コンソール（Webブラウザ）のGUIを使って、GitHubリポジトリから自動デプロイする方法を説明します。

**メリット:**
- ✅ gcloud CLIのインストール不要
- ✅ Git push するだけで自動デプロイ
- ✅ 視覚的に設定できるので初心者にも簡単
- ✅ Cloud Buildの無料枠内で利用可能

---

## 🚀 デプロイ手順（完全版）

### **Step 1: Google Cloud コンソールにアクセス**

```
1. ブラウザで https://console.cloud.google.com/ を開く
2. Googleアカウントでログイン
3. 左上のプロジェクト選択 → 「g-poker-backend」を選択
```

---

### **Step 2: Cloud Run サービスを作成**

#### **2-1. Cloud Run ページへ移動**

```
1. 左側のナビゲーションメニュー（☰）をクリック
2. 「Cloud Run」を選択
   （見つからない場合: 検索ボックスに「Cloud Run」と入力）
```

#### **2-2. サービス作成開始**

```
1. 「サービスを作成」ボタンをクリック
2. 「ソースリポジトリから新しいサービスを継続的にデプロイする」を選択
3. 「Cloud Buildでセットアップ」ボタンをクリック
```

---

### **Step 3: GitHub リポジトリと連携**

#### **3-1. リポジトリ接続**

```
1. 「リポジトリプロバイダ」: GitHub を選択
2. 「リポジトリを管理」をクリック

【初回のみ】GitHub認証画面が表示される
3. 「Authenticate」をクリック
4. GitHubアカウントでログイン
5. 「Authorize Google Cloud Build」をクリック
6. リポジトリアクセス権限を付与:
   - 「All repositories」または
   - 「Only select repositories」→ g-poker-backend を選択
7. 「Install」をクリック
```

#### **3-2. リポジトリ選択**

```
1. リポジトリプロバイダ: GitHub
2. リポジトリ: massu-159/g-poker-backend を選択
   （検索ボックスで絞り込み可能）
3. ブランチ: ^main$ （正規表現でmainブランチのみ）
4. 「次へ」をクリック
```

---

### **Step 4: ビルド構成**

#### **4-1. ビルドタイプ選択**

```
ビルドタイプ: Dockerfile

【重要】以下を設定:
- Dockerfile: Dockerfile
- コンテキストディレクトリ: /
  （リポジトリルートを指定）

「次へ」をクリック
```

---

### **Step 5: サービス設定**

#### **5-1. 基本設定**

```
サービス名: g-poker-backend
リージョン: asia-northeast1 (東京)

【認証設定】
認証: 未認証の呼び出しを許可
（後で必要に応じて変更可能）
```

#### **5-2. コンテナ設定（重要）**

```
「コンテナ、ネットワーキング、セキュリティ」を展開

【コンテナタブ】
コンテナポート: 8080
  ↑ これが重要！Dockerfileの EXPOSE 8080 と一致

リソース:
- CPU割り当て: 1
- メモリ: 512 MiB
- リクエストタイムアウト: 300秒
- 最大同時リクエスト数: 80（デフォルト）
```

#### **5-3. オートスケーリング設定（重要）**

**💡 スケーリング設定とは**

Cloud Run は以下の要素で自動スケーリングを制御します：

- **最小インスタンス数（min-instances）**: 常に起動しておくコンテナの数
- **最大インスタンス数（max-instances）**: 同時起動できるコンテナの上限
- **CPU割り当て**: リクエスト処理中のみ or 常に割り当て
- **同時実行数（max-concurrent-requests）**: 1つのコンテナが同時処理できるリクエスト数

---

**📊 推奨設定パターン**

| 設定項目 | 開発/テスト環境 | 本番環境（小規模） | 本番環境（高負荷） |
|---------|---------------|-----------------|-----------------|
| **最小インスタンス** | 0 | 1 | 2 |
| **最大インスタンス** | 3 | 10 | 20 |
| **CPU割り当て** | リクエスト処理中のみ | リクエスト処理中のみ | 常に割り当て※ |
| **同時実行数** | 80 | 80 | 80 |
| **月額コスト** | **$0-2** | **$7-15** | **$20-50** |
| **コールドスタート** | あり（1-3秒） | なし | なし |

※ Socket.io常時接続を使用する場合は「常に割り当て」を検討

---

**🎯 G-Poker Backend の推奨設定（現時点）**

```
【オートスケーリング】
最小インスタンス数: 0
  → 理由: 無料枠内で運用、開発中はコールドスタート許容

最大インスタンス数: 3
  → 理由: 予期せぬ課金を防止、同時ユーザー ~100名まで対応

【CPU割り当て】
CPU は、リクエストの処理中にのみ割り当てる
  → 理由: アイドル時のCPU課金を回避（推奨）
  → Socket.ioはHTTPポーリングフォールバックで動作可能

【同時実行数】
80（デフォルトのまま）
  → 理由: 変更不要、適切なバランス
```

---

**💰 コスト最適化のポイント**

| 設定 | コスト影響 | トレードオフ |
|------|----------|------------|
| **min-instances: 0** | 💰💰💰 **最安** | ⚠️ コールドスタート発生（1-3秒） |
| **min-instances: 1** | 💰 **+$7-10/月** | ✅ コールドスタートなし、常時即応 |
| **CPU: リクエスト時のみ** | 💰💰💰 **推奨** | ⚠️ WebSocket常時接続は要検討 |
| **CPU: 常に割り当て** | 💰 **コスト増** | ✅ バックグラウンド処理可能 |

**無料枠の範囲**:
- リクエスト: 200万回/月
- CPU時間: 360,000 vCPU秒/月
- メモリ: 180,000 GiB秒/月

**想定トラフィック（無料枠内）**:
- 1日あたり 60,000リクエスト（平均）
- 平均レスポンス時間 200ms
- ピーク時 10 req/sec 程度

---

**🔧 設定の決め方**

**最小インスタンス数の判断基準**:

```
質問: コールドスタート（初回1-3秒遅延）は許容できますか？

YES（開発環境、コスト優先）
  → 最小インスタンス数: 0
  → 月額コスト: $0（無料枠内）

NO（本番環境、UX重視）
  → 最小インスタンス数: 1
  → 月額コスト: $7-10
```

**CPU割り当ての判断基準**:

```
質問: WebSocketを常時接続で使用しますか？

NO（HTTP API、短時間処理のみ）
  → リクエスト処理中のみ割り当て（推奨）

YES（Socket.io常時接続、バックグラウンドジョブ）
  → 常に割り当て
  ※ ただし Socket.io は HTTPポーリングフォールバックがあるため
    「リクエスト処理中のみ」でも動作可能
```

**最大インスタンス数の計算式**:

```
必要インスタンス数 = 想定同時ユーザー数 ÷ 同時実行数

例:
- 同時ユーザー: 200名
- 同時実行数: 80
- 必要インスタンス: 200 ÷ 80 = 2.5 → 3インスタンス
- 推奨設定: max-instances = 5（余裕を持たせる）
```

---

**⚡ 本番環境へ移行時の設定変更**

ユーザーが増えてきたら、以下のように段階的に変更:

```
【フェーズ1: リリース直後】
min-instances: 0
max-instances: 5
  → 無料枠で様子見

【フェーズ2: ユーザー100名突破】
min-instances: 1
max-instances: 10
  → コールドスタート解消（月額 +$7-10）

【フェーズ3: ユーザー1000名突破】
min-instances: 2
max-instances: 20
CPU割り当て: 常に割り当て
  → Socket.io安定化、Redis Adapter導入検討
```

#### **5-4. 環境変数設定**

```
【変数タブ】
「変数とシークレットを追加」をクリック

1. 環境変数追加:
   名前: NODE_ENV
   値: production

⚠️ 重要: PORT は設定しない（Cloud Runが自動設定）
```

---

### **Step 6: Secret Manager 連携**

#### **6-1. Secret Manager で シークレット作成**

```
【別タブで Secret Manager を開く】
1. ナビゲーションメニュー → 「Security」→ 「Secret Manager」
2. 「シークレットを作成」をクリック

【シークレット1: Supabase URL】
- 名前: supabase-url
- シークレット値: https://your-project.supabase.co
- 「シークレットを作成」

【シークレット2: Supabase Service Role Key】
- 名前: supabase-service-role-key
- シークレット値: ...
- 「シークレットを作成」

【シークレット3: JWT Secret】
- 名前: jwt-secret
- シークレット値: your-random-secret-key-min-32-chars
- 「シークレットを作成」

【シークレット4: Redis URL（オプション）】
- 名前: redis-url
- シークレット値: redis://your-redis-host:6379
- 「シークレットを作成」
```

#### **6-2. Cloud Run サービスに シークレット 追加**

```
【Cloud Run サービス作成画面に戻る】

「変数とシークレット」タブ
「シークレットを参照」をクリック

【シークレット1追加】
1. シークレット: supabase-url を選択
2. 参照方法: 環境変数として公開
3. 名前: SUPABASE_URL
4. バージョン: latest

【シークレット2追加】
1. 「シークレットを参照」をクリック
2. シークレット: supabase-service-role-key
3. 参照方法: 環境変数として公開
4. 名前: SUPABASE_SERVICE_ROLE_KEY
5. バージョン: latest

【シークレット3追加】
1. 「シークレットを参照」をクリック
2. シークレット: jwt-secret
3. 参照方法: 環境変数として公開
4. 名前: JWT_SECRET
5. バージョン: latest

【シークレット4追加（オプション）】
1. 「シークレットを参照」をクリック
2. シークレット: redis-url
3. 参照方法: 環境変数として公開
4. 名前: REDIS_URL
5. バージョン: latest
```

---

### **Step 7: サービスアカウント設定**

```
「セキュリティ」タブ

サービスアカウント:
- デフォルト Compute Engine サービスアカウント
  （自動選択されている）

⚠️ 重要: Secret Managerへのアクセス権限が必要
```

#### **サービスアカウントに権限付与**

```
【別タブで IAM ページを開く】
1. ナビゲーションメニュー → 「IAM と管理」→ 「IAM」
2. 「アクセスを許可」をクリック

新しいプリンシパル:
  PROJECT_NUMBER-compute@developer.gserviceaccount.com
  （例: 123456789012-compute@developer.gserviceaccount.com）

役割:
  - Secret Manager のシークレット アクセサー

「保存」をクリック
```

---

### **Step 8: デプロイ実行**

```
1. すべての設定を確認
2. 「作成」ボタンをクリック

【初回ビルド開始】
- ビルド時間: 約3-5分
- 進行状況がリアルタイムで表示される
```

---

### **Step 9: デプロイ確認**

#### **9-1. サービスURL取得**

```
デプロイ完了後:
1. サービス詳細ページが表示される
2. 上部に表示されるURL（例）:
   https://g-poker-backend-XXXXX-an.a.run.app

このURLをコピー
```

#### **9-2. 動作確認**

```bash
# 1. ヘルスチェック（基本動作確認）
curl https://g-poker-backend-XXXXX-an.a.run.app/health

# 期待されるレスポンス:
{
  "status": "ok",
  "timestamp": "2025-11-16T14:30:00.000Z"
}

# 2. APIステータス確認
curl https://g-poker-backend-XXXXX-an.a.run.app/api/v1/status

# 期待されるレスポンス:
{
  "message": "G-Poker Backend API",
  "version": "1.0.0",
  "environment": "production"
}

# 3. Supabase データベース接続確認（重要）
curl https://g-poker-backend-XXXXX-an.a.run.app/api/v1/health/db

# 期待されるレスポンス（成功時）:
{
  "status": "ok",
  "database": "connected",
  "supabase_url": "✓ configured",
  "service_key": "✓ configured",
  "timestamp": "2025-11-16T14:30:00.000Z"
}

# エラー例（Secret Manager の設定ミス）:
{
  "status": "error",
  "database": "disconnected",
  "error": "SUPABASE_URL environment variable is required",
  "supabase_url": "✗ missing",
  "service_key": "✗ missing",
  "timestamp": "2025-11-16T14:30:00.000Z"
}
```

**⚠️ トラブルシューティング**:

```
問題: database: "disconnected" が返される

原因1: Secret Manager のシークレットが正しく設定されていない
→ Step 6 の Secret Manager 設定を再確認

原因2: サービスアカウントに権限がない
→ Step 7 の IAM 権限付与を再確認

原因3: Supabase プロジェクトのファイアウォール設定
→ Supabase ダッシュボード → Settings → API
→ 「Allow connections from Cloud Run」を確認
```

---

## 🔄 継続的デプロイ（自動化）

### **設定完了後の運用**

```
✅ 自動デプロイが有効化されている状態:

1. コードを修正
   git add .
   git commit -m "Update feature"
   git push origin main

2. Cloud Build が自動実行
   - GitHub webhook が Cloud Build をトリガー
   - 自動的に Dockerfile をビルド
   - Cloud Run に自動デプロイ

3. デプロイ完了
   - 約3-5分で新バージョンが公開
   - ゼロダウンタイムでロールアウト
```

### **ビルド履歴確認**

```
1. ナビゲーションメニュー → 「Cloud Build」→ 「履歴」
2. 各ビルドの詳細を確認可能:
   - ビルド時間
   - ログ
   - 成功/失敗ステータス
```

---

## 📊 モニタリング

### **ログ確認（GUI）**

```
1. Cloud Run サービス詳細ページ
2. 「ログ」タブをクリック
3. リアルタイムログがストリーミング表示
4. フィルタ機能:
   - 重大度: ERROR, WARNING, INFO
   - 時間範囲
   - テキスト検索
```

### **メトリクス確認**

```
1. Cloud Run サービス詳細ページ
2. 「指標」タブをクリック
3. 表示される情報:
   - リクエスト数
   - レスポンス時間
   - エラー率
   - インスタンス数
   - CPU/メモリ使用率
```

---

## ⚙️ 設定変更

### **環境変数の更新**

```
1. Cloud Run サービス詳細ページ
2. 「編集してデプロイ」をクリック
3. 「変数とシークレット」タブ
4. 環境変数を追加/変更
5. 「デプロイ」をクリック
```

### **リソース変更**

```
1. 「編集してデプロイ」
2. 「コンテナ」タブ
3. CPU/メモリを変更
4. 「デプロイ」
```

---

## 💰 コスト管理

### **無料枠の確認**

```
1. ナビゲーションメニュー → 「お支払い」
2. 「レポート」
3. サービス: Cloud Run でフィルタ
4. 無料枠の使用状況を確認
```

### **アラート設定**

```
1. 「お支払い」→ 「予算とアラート」
2. 「予算を作成」
3. 月次予算を設定（例: $10）
4. アラート閾値: 50%, 90%, 100%
5. 通知先メールアドレスを設定
```

---

## ⚠️ トラブルシューティング

### **問題1: ビルドが失敗する**

```
原因1: Dockerfileのエラー
→ Cloud Build ログで詳細確認

原因2: 依存関係のインストール失敗
→ package-lock.json が最新か確認

解決策:
1. ローカルで docker build -t test . を実行
2. エラーを修正
3. git push で再デプロイ
```

### **問題2: サービスが起動しない**

```
原因: 環境変数の設定ミス
→ Secret Manager の値を確認

解決策:
1. Cloud Run サービス詳細 → 「ログ」
2. エラーメッセージを確認
3. 環境変数を修正して再デプロイ
```

### **問題3: SECRET_MANAGER エラー**

```
エラーメッセージ:
"Permission denied to access secret"

解決策:
1. IAM ページでサービスアカウントを確認
2. 「Secret Manager のシークレット アクセサー」役割を付与
3. サービスを再デプロイ
```

---

## 🎉 完了チェックリスト

- [ ] Google Cloud プロジェクト作成済み
- [ ] Cloud Run API 有効化済み
- [ ] Cloud Build API 有効化済み
- [ ] Secret Manager API 有効化済み
- [ ] GitHub リポジトリ接続完了
- [ ] Secret Manager にシークレット作成
- [ ] Cloud Run サービス作成完了
- [ ] デプロイ成功（ヘルスチェック OK）
- [ ] 継続的デプロイ動作確認（git push → 自動デプロイ）

---

## 📚 参考リンク

- [Cloud Run クイックスタート](https://cloud.google.com/run/docs/quickstarts)
- [GitHub からのデプロイ](https://cloud.google.com/run/docs/deploying-source-code)
- [Secret Manager 使用方法](https://cloud.google.com/run/docs/configuring/secrets)
- [料金計算ツール](https://cloud.google.com/products/calculator)
