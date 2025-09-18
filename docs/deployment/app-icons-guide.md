# アプリアイコン & ランチスクリーン作成ガイド

## P4-017: App icons and launch screens for all devices

### アイコンデザインコンセプト
**テーマ**: ごきぶりポーカーらしい心理戦とブラフの要素を表現
**カラーパレット**: 
- Primary: #1E3A5F (ダークブルー)
- Secondary: #007AFF (ブライトブルー)
- Accent: #FF6B35 (オレンジ)
- Background: #FFFFFF (ホワイト)

**デザイン要素**:
- 🪳🐭🦇🐸 の4つの生き物アイコン
- カードのモチーフ
- 円形またはラウンド四角形のベース

### 必要なアイコンサイズ

#### iOS App Icons
```
Icon-1024.png        1024×1024px  App Store用
Icon-180.png         180×180px    iPhone 6 Plus以降
Icon-167.png         167×167px    iPad Pro
Icon-152.png         152×152px    iPad, iPad mini
Icon-120.png         120×120px    iPhone, iPhone 4s以降
Icon-87.png          87×87px      iPhone 6s, 6, SE用設定アプリ
Icon-80.png          80×80px      iPhone 4s用設定アプリ，iPad用Spotlight
Icon-76.png          76×76px      iPad
Icon-58.png          58×58px      iPhone 4s以降Spotlight, 設定アプリ
Icon-40.png          40×40px      iPhone, iPad用Spotlight
Icon-29.png          29×29px      iPhone, iPad用設定アプリ
Icon-20.png          20×20px      iPhone, iPad用通知
```

#### Android App Icons
```
ic_launcher_512.png     512×512px   Google Play Store用
ic_launcher_192.png     192×192px   XXXHDPI
ic_launcher_144.png     144×144px   XXHDPI
ic_launcher_96.png      96×96px     XHDPI
ic_launcher_72.png      72×72px     HDPI
ic_launcher_48.png      48×48px     MDPI
ic_launcher_36.png      36×36px     LDPI

# Adaptive Icons (Android 8.0+)
ic_launcher_foreground_432.png  432×432px  フォアグラウンド
ic_launcher_background_432.png  432×432px  バックグラウンド
```

### アイコン作成手順

#### 1. マスターアイコン作成
```bash
# 1024×1024のマスターアイコンを作成
# 推奨ツール: Adobe Illustrator, Figma, Sketch
# フォーマット: PNG (透明背景不可), 角丸なし
```

**デザインガイドライン**:
- 中央に4匹の生き物キャラクターを配置
- 背景は単色またはグラデーション
- 細い線は避ける（小さいサイズで見えなくなるため）
- テキストは最小限に
- Apple/Googleのヒューマンインターフェースガイドラインに準拠

#### 2. 各サイズ生成
```bash
# ImageMagickを使用した自動リサイズスクリプト
# create_app_icons.sh

#!/bin/bash

# マスターアイコンから各サイズを生成
MASTER="icon_master_1024.png"

# iOS Icons
convert $MASTER -resize 1024x1024 assets/icon.png
convert $MASTER -resize 180x180 assets/ios/Icon-180.png  
convert $MASTER -resize 167x167 assets/ios/Icon-167.png
convert $MASTER -resize 152x152 assets/ios/Icon-152.png
convert $MASTER -resize 120x120 assets/ios/Icon-120.png
convert $MASTER -resize 87x87 assets/ios/Icon-87.png
convert $MASTER -resize 80x80 assets/ios/Icon-80.png
convert $MASTER -resize 76x76 assets/ios/Icon-76.png
convert $MASTER -resize 58x58 assets/ios/Icon-58.png
convert $MASTER -resize 40x40 assets/ios/Icon-40.png
convert $MASTER -resize 29x29 assets/ios/Icon-29.png
convert $MASTER -resize 20x20 assets/ios/Icon-20.png

# Android Icons
convert $MASTER -resize 512x512 assets/android/ic_launcher_512.png
convert $MASTER -resize 192x192 assets/android/ic_launcher_192.png
convert $MASTER -resize 144x144 assets/android/ic_launcher_144.png
convert $MASTER -resize 96x96 assets/android/ic_launcher_96.png
convert $MASTER -resize 72x72 assets/android/ic_launcher_72.png
convert $MASTER -resize 48x48 assets/android/ic_launcher_48.png
convert $MASTER -resize 36x36 assets/android/ic_launcher_36.png

echo "All app icons generated!"
```

### スプラッシュスクリーン設計

#### デザインコンセプト
- アプリアイコンと一貫性のあるデザイン
- ロード中であることを示すアニメーション
- シンプルで高速ロード

#### 必要なスプラッシュ画像
```
splash.png           1284×2778px  iPhone 14 Pro Max用
splash-tablet.png    2048×2732px  iPad Pro 12.9インチ用
```

#### スプラッシュスクリーン仕様
```javascript
// app.json設定
{
  "splash": {
    "image": "./assets/splash.png",
    "resizeMode": "contain",
    "backgroundColor": "#1E3A5F"
  }
}
```

### フォルダ構造
```
assets/
├── icon.png                    # 1024×1024 メインアイコン
├── splash.png                  # スプラッシュスクリーン
├── adaptive-icon.png           # Android Adaptive Icon
├── favicon.png                 # Web用ファビコン
├── ios/
│   ├── Icon-1024.png
│   ├── Icon-180.png
│   ├── Icon-167.png
│   └── ... (その他iOSサイズ)
└── android/
    ├── ic_launcher_512.png
    ├── ic_launcher_192.png
    └── ... (その他Androidサイズ)
```

### 品質チェックリスト

#### iOS
- [ ] 角丸処理なし（iOSが自動処理）
- [ ] 透明背景なし
- [ ] 1024×1024がApp Store Connect要件満たす
- [ ] 全サイズでテキストが読める
- [ ] ヒューマンインターフェースガイドライン準拠

#### Android
- [ ] Adaptive Icon対応
- [ ] Material Design準拠
- [ ] XXXHDPI解像度対応
- [ ] 各密度で適切な表示

### 作成ツール推奨

#### デザインツール
- **Adobe Illustrator** (ベクター、プロ向け)
- **Figma** (無料、Web ベース、コラボ対応)
- **Sketch** (Mac専用、UI特化)
- **Canva** (簡単、テンプレート豊富)

#### 自動生成ツール
- **App Icon Generator** (appicon.co)
- **Icon Kitchen** (Androidアイコン生成)
- **Make App Icon** (makeappicon.com)

### app.json更新
```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain", 
      "backgroundColor": "#1E3A5F"
    },
    "ios": {
      "icon": "./assets/icon.png"
    },
    "android": {
      "icon": "./assets/icon.png",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#1E3A5F"
      }
    },
    "web": {
      "favicon": "./assets/favicon.png"
    }
  }
}
```

## 完了基準
- [ ] 1024×1024マスターアイコン作成
- [ ] iOS用全サイズアイコン生成
- [ ] Android用全サイズアイコン生成
- [ ] スプラッシュスクリーン作成
- [ ] Adaptive Icon作成 (Android)
- [ ] app.json設定更新
- [ ] 実機での表示確認

## 次のステップ
P4-018: App Store screenshots and metadata (Japanese) に進む