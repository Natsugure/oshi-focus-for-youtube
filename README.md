# Oshi Focus For YouTube

特定のチャンネルに集中できるようにするChrome拡張機能

## 機能

- ✅ YouTubeのメニュー欄の「ホーム」・「ショート」・「探索」などを非表示
- ✅ 登録チャンネルに指定したチャンネルのみ表示
- ✅ 指定したチャンネル以外の動画をブロック
- ✅ 動画再生画面横のリコメンド欄を非表示
- ✅ ショート動画を一般動画として再生

## 使用技術

- TypeScript
- React.js
- CRXJS-Vite

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 開発モードで起動

```bash
npm run dev
```

### 3. Chromeに拡張機能を読み込む

1. Chromeで `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. プロジェクトの `dist` フォルダを選択

## ビルド

本番用にビルドする場合:

```bash
npm run build
```

## 使い方

### チャンネルの追加方法

1. 拡張機能のアイコンをクリックして設定画面を開く
2. 許可したいYouTubeチャンネルのURLをコピー
   - 例: `https://www.youtube.com/@channelname`
3. URLとチャンネル名を入力して「チャンネルを追加」をクリック

### チャンネルの削除方法

設定画面の許可リストから削除したいチャンネルの🗑️ボタンをクリック

## プロジェクト構造

```
oshi-focus-youtube/
├── manifest.json           # Chrome拡張機能のマニフェスト
├── src/
│   ├── content/           # コンテンツスクリプト
│   │   ├── index.tsx      # メインロジック
│   │   └── style.css      # YouTubeページのスタイル
│   ├── popup/             # 設定画面
│   │   ├── Popup.tsx      # Reactコンポーネント
│   │   ├── popup.css      # スタイル
│   │   └── index.tsx      # エントリーポイント
│   └── utils/             # ユーティリティ
│       ├── storage.ts     # Chrome Storage API
│       └── youtube.ts     # YouTube関連の処理
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 注意事項

- チャンネルIDの取得にはページの読み込みが必要なため、初回アクセス時に若干の遅延が発生する場合があります
- ショート動画は自動的に通常の動画として再生されます
- 許可していないチャンネルの動画にアクセスすると、ブロックメッセージが表示されます

## ライセンス

MIT
