# App Store Connect セットアップガイド

## P4-015: App Store Connect setup and app registration

### 前提条件
- [ ] Apple Developer Account (年間$99)
- [ ] Xcode 15.0以上がインストール済み
- [ ] App Store Connect へのアクセス権限

### 1. App Store Connect でのアプリ登録

#### アプリの基本情報
- **App Name**: ごきぶりポーカー
- **Bundle ID**: `com.gpoker.app`
- **SKU**: `G-POKER-001`
- **Primary Language**: Japanese (ja)
- **Category**: Games > Card Games

#### アプリの詳細情報
```
Name: ごきぶりポーカー
Subtitle: 心理戦カードゲーム
Keywords: ブラフ,カードゲーム,対戦,心理戦,ごきぶり,ポーカー
Description (4000文字以内):
ごきぶりポーカーは、相手の嘘を見抜く心理戦カードゲームです。

【ゲームの特徴】
・2人で対戦するリアルタイムオンラインゲーム
・シンプルなルールで誰でもすぐに楽しめる
・ブラフと推理が鍵となる戦略的なゲーム
・美しいアニメーションと直感的な操作

【遊び方】
4種類の生き物カード（ゴキブリ、ネズミ、コウモリ、カエル）を使い、相手に嘘か真実を宣言してカードを渡します。相手は「信じる」「疑う」「パスバック」を選択し、同じ生き物を3匹集めてしまった方が負けです。

【機能】
・オンライン対戦マッチング
・チュートリアルとルール説明
・美しいアニメーション効果
・日本語完全対応
・Apple Sign-In対応

心理戦好きな方、カードゲーム好きな方におすすめです！
```

#### レーティング情報
- **Age Rating**: 4+ (誰でも楽しめる内容)
- **Content**: なし（暴力、アダルトコンテンツなし）

### 2. 必要な画像アセット

#### App Icons (必須)
- [x] 1024x1024px (App Store用)
- [ ] 180x180px (iPhone)
- [ ] 120x120px (iPhone)
- [ ] 167x167px (iPad Pro)
- [ ] 152x152px (iPad)
- [ ] 76x76px (iPad)

#### Screenshots (必須)
##### iPhone (6.7インチディスプレイ - iPhone 15 Pro Max)
- [ ] 1290x2796px × 3枚以上（最大10枚）

##### iPhone (6.5インチディスプレイ - iPhone 14 Plus)  
- [ ] 1284x2778px × 3枚以上（最大10枚）

##### iPad Pro (12.9インチ)
- [ ] 2048x2732px × 2枚以上（最大10枚）

#### Launch Screen
- [x] `./assets/splash.png` (既存)
- ストーリーボードベースのランチスクリーンに更新推奨

### 3. 価格設定
- **Price**: 無料（Free）
- **Availability**: 全世界（日本語対応のためアジア地域優先）

### 4. App Store Connect 設定手順

1. **新規アプリ作成**
   ```bash
   # EAS CLIでアプリ作成
   npx eas build:configure
   npx create-expo-app --template
   ```

2. **Bundle Identifierの設定確認**
   - `app.json`の`ios.bundleIdentifier`が`com.gpoker.app`であることを確認
   - Apple Developer Portalで同じBundle IDを登録

3. **App Store Connect でアプリ登録**
   - 「マイApp」→「+」→「新規App」
   - プラットフォーム: iOS
   - 名前: ごきぶりポーカー
   - 主言語: 日本語
   - Bundle ID: com.gpoker.app
   - SKU: G-POKER-001

4. **アプリ情報入力**
   - カテゴリ: ゲーム > カード
   - 年齢制限レーティング
   - アプリの説明とキーワード

5. **価格とアベイラビリティ**
   - 無料アプリに設定
   - 利用可能な国・地域を選択

### 5. テスト配信設定 (TestFlight)

```bash
# TestFlight用ビルド作成
npx eas build --platform ios --profile preview

# 本番用ビルド作成
npx eas build --platform ios --profile production
```

### 6. 審査提出前チェックリスト

#### 技術要件
- [ ] iOS 13.0以上サポート
- [ ] iPhone、iPad対応
- [ ] 64bit対応
- [ ] ダークモード対応（オプション）
- [ ] Safe Areaレイアウト対応

#### コンプライアンス
- [ ] プライバシーポリシー作成・リンク設定
- [ ] 利用規約作成・リンク設定
- [ ] データ収集に関する開示
- [ ] Export Compliance (暗号化使用の有無)

#### アプリレビューガイドライン準拠
- [ ] クラッシュやバグの修正
- [ ] アプリ機能の完全動作確認
- [ ] メタデータとスクリーンショットの正確性
- [ ] 不適切なコンテンツなし

### 7. 提出コマンド

```bash
# 最終本番ビルドとApp Store提出
npx eas build --platform ios --profile production --auto-submit
```

## 完了基準
- [x] Apple Developer Account取得
- [ ] App Store Connect でアプリ登録完了
- [ ] 必要な画像アセット準備完了
- [ ] プライバシーポリシー・利用規約作成
- [ ] TestFlight配信可能状態
- [ ] App Store審査提出可能状態

## 次のステップ
P4-016: Google Play Console セットアップに進む