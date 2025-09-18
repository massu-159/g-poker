# App Store提出準備チェックリスト

## P4-020: App Store submission preparation

### 提出前最終確認事項

#### 1. アプリの品質確認

**機能テスト**
- [ ] アプリが正常に起動する
- [ ] Apple Sign-In が正常に動作する
- [ ] 匿名ログインが正常に動作する  
- [ ] オンライン対戦機能が正常に動作する
- [ ] チュートリアル機能が完全に動作する
- [ ] ゲームルール画面が正常に表示される
- [ ] アプリが予期せずクラッシュしない
- [ ] メモリリークやパフォーマンス問題がない

**デバイス互換性**
- [ ] iPhone (iOS 13.0以降) での動作確認
- [ ] iPad での動作確認
- [ ] 異なる画面サイズでの表示確認
- [ ] Dark Mode 対応（該当する場合）
- [ ] VoiceOver アクセシビリティ対応

**ネットワーク接続**
- [ ] オンライン状態での正常動作
- [ ] オフライン状態でのエラーハンドリング
- [ ] 接続不安定時の動作確認
- [ ] Supabase Cloud への接続確認

#### 2. App Store Connect 設定完了確認

**アプリ基本情報**
- [ ] App Name: ごきぶりポーカー
- [ ] Bundle ID: com.gpoker.app が一致
- [ ] Version: 1.0.0
- [ ] Build Number: 自動インクリメント設定済み
- [ ] Category: Games > Card 設定済み

**メタデータ完成**
- [ ] アプリ説明文（4000文字）完成・入力済み
- [ ] キーワード最適化完了
- [ ] サポートURL設定済み: https://gpoker.app/support
- [ ] プライバシーポリシーURL設定済み: https://gpoker.app/privacy-policy

**画像アセット**
- [ ] App Icon (1024×1024) アップロード完了
- [ ] iPhone スクリーンショット（1290×2796）5枚アップロード
- [ ] iPad スクリーンショット（2048×2732）3枚アップロード
- [ ] 全画像のクオリティ確認完了

**レーティング・コンプライアンス**
- [ ] Age Rating: 4+ 設定完了
- [ ] コンテンツ記述なし（暴力・アダルト・ギャンブル要素なし）
- [ ] Export Compliance: ITSAppUsesNonExemptEncryption = false

#### 3. プライバシー・法的要件

**データ収集開示**
- [ ] 収集するデータタイプの詳細記載
- [ ] データ使用目的の明確化
- [ ] 第三者共有の有無記載
- [ ] データ削除オプション提供

**プライバシーポリシー**
- [ ] 完全版作成済み（docs/legal/privacy-policy.md）
- [ ] Webサイトに公開済み（https://gpoker.app/privacy-policy）
- [ ] アプリ内からのアクセス可能性確認

**利用規約**
- [ ] 完全版作成済み（docs/legal/terms-of-service.md）
- [ ] Webサイトに公開済み（https://gpoker.app/terms）
- [ ] アプリ内での同意フロー実装

#### 4. 技術的要件

**ビルド設定**
- [ ] Production build 作成済み
- [ ] コード難読化有効
- [ ] デバッグシンボル除去済み
- [ ] 最適化コンパイル設定

**セキュリティ**
- [ ] API キー・シークレットの適切な管理
- [ ] HTTPS通信の完全実装
- [ ] 入力値検証の実装
- [ ] XSS/SQLインジェクション対策

**パフォーマンス**
- [ ] アプリ起動時間 < 3秒
- [ ] ゲーム応答時間 < 100ms
- [ ] メモリ使用量 < 50MB
- [ ] バッテリー消費量の最適化

#### 5. Apple Review Guidelines準拠確認

**安全性 (Safety)**
- [ ] 不適切なコンテンツなし
- [ ] ユーザー生成コンテンツの適切な管理
- [ ] 有害な行為の防止策実装

**パフォーマンス (Performance)**
- [ ] アプリの完全な機能実装
- [ ] 繰り返し発生するクラッシュなし
- [ ] プレースホルダーコンテンツなし

**ビジネス (Business)**
- [ ] 支払い機能なし（無料アプリ）
- [ ] Apple の知的財産権侵害なし
- [ ] スパム的でない

**デザイン (Design)**
- [ ] Human Interface Guidelines準拠
- [ ] 一貫性のあるユーザーインターフェース
- [ ] 適切なナビゲーション実装

#### 6. 最終提出手順

**EAS Build & Submit**
```bash
# 最終本番ビルド作成
npx eas build --platform ios --profile production --non-interactive

# App Store Connect への自動アップロード
npx eas submit --platform ios --profile production
```

**手動確認ステップ**
1. [ ] App Store Connect でビルドが正常にアップロードされている
2. [ ] TestFlight で内部テスト実施
3. [ ] 全機能の動作最終確認
4. [ ] メタデータとスクリーンショットの最終確認
5. [ ] 「審査に提出」ボタンをクリック

#### 7. 審査待機中の準備

**サポート体制**
- [ ] サポート窓口の監視体制確立
- [ ] よくある質問（FAQ）の準備
- [ ] ユーザーフィードバック収集体制

**アップデート準備**
- [ ] 次期バージョンの開発計画
- [ ] ユーザーフィードバック反映プロセス
- [ ] バグ修正の迅速対応体制

#### 8. 審査結果への対応

**承認時の対応**
- [ ] リリース告知の準備
- [ ] ユーザーサポート体制強化
- [ ] アプリ利用状況モニタリング開始

**拒否時の対応**
- [ ] 拒否理由の分析
- [ ] 修正計画の策定
- [ ] 修正版の迅速な再提出

### 提出コマンド実行

#### 前提確認
```bash
# EAS CLI インストール確認
npm install -g @expo/eas-cli

# EAS ログイン確認
eas login

# プロジェクト設定確認
eas build:configure
```

#### 本番ビルド作成
```bash
# iOS本番ビルド（自動提出付き）
eas build --platform ios --profile production --auto-submit

# ビルド状況確認
eas build:list --platform ios
```

#### 手動提出（必要に応じて）
```bash
# 手動でApp Store Connect に提出
eas submit --platform ios --profile production
```

### 完了基準

**技術的完了**
- [ ] Production build正常作成
- [ ] App Store Connect アップロード成功
- [ ] TestFlight での動作確認完了

**コンプライアンス完了**
- [ ] 全ての必要情報入力完了
- [ ] プライバシー・法的要件満足
- [ ] Apple Review Guidelines準拠確認

**品質保証完了**
- [ ] 全機能動作テスト完了
- [ ] パフォーマンス要件満足
- [ ] セキュリティ要件満足

**審査提出完了**
- [ ] 「審査に提出」実行完了
- [ ] 審査状況の監視開始
- [ ] サポート体制運用開始

## 推定タイムライン

- **準備期間**: 2-3日（チェックリスト実行）
- **ビルド・アップロード**: 2-4時間（EAS Build）
- **Apple審査期間**: 1-7日（平均2-3日）
- **承認後リリース**: 即時可能

## 緊急連絡先

- **EAS サポート**: https://expo.dev/support
- **Apple Developer サポート**: https://developer.apple.com/support/
- **プロジェクト管理**: development-team@gpoker.app

---

**次のステップ**: P4-021 Beta testing distribution setup (TestFlight)