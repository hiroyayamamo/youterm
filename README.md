# youterm

> Terminal + YouTube in one window. Electron, macOS.

<!-- TODO: demo gif goes here. Record with Kap or LICEcap, ≤800 px wide, ≤5 MB. -->

## What is this?

A macOS terminal emulator that runs YouTube alongside it — so you can keep coding while music videos, lofi streams, or any YouTube content plays in the background. Three layout modes let you shift focus with a keystroke.

## Features

- **Terminal**: xterm.js + node-pty, Cyberpunk Neon 16-color palette, transparent + blur effects, multi-tab with persistent `cwd`
- **YouTube always on**: full YouTube embedded; `Cmd+Shift+F` fills the window with the video, letterboxed and always centered
- **Three modes**:
  - `Cmd+1` YouTube-only — browser-like chrome with back / forward / reload
  - `Cmd+2` Overlay — terminal floats on top of YouTube
  - `Cmd+3` Terminal-only — hide the video
- **Drag & drop**: drop a file onto the terminal and its path is pasted as a shell-quoted argument
- **Persistence**: last URL, last mode, tab layout and window size restored on launch
- **Auto-skip ads** when the Skip button becomes available

## Build

Requires macOS, Node 18+, Xcode Command Line Tools.

```bash
git clone https://github.com/hiroyayamamo/youterm.git
cd youterm
npm install
npm run package
open release/mac-arm64/youterm.app
```

Drag `youterm.app` to `/Applications` to use it from Dock / Launchpad. The build is unsigned, so the first launch needs **right-click → Open** (macOS Gatekeeper will then remember your choice).

## Development

```bash
npm run dev        # electron-vite dev server with hot reload
npm run build      # production build (compiled to out/)
npm run package    # full .app build into release/
npm run test       # vitest unit tests
npm run test:e2e   # playwright end-to-end
npm run typecheck  # tsc --noEmit
```

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+1` / `Cmd+2` / `Cmd+3` | Switch mode (YouTube-only / Overlay / Terminal-only) |
| `Cmd+Shift+F` | Toggle video fill (YouTube-only mode) |
| `Cmd+K` | Play / pause video |
| `Cmd+R` | Reload YouTube |
| `Cmd+Shift+R` | Hard reload (bypass cache) |
| `Cmd+T` / `Cmd+W` | New tab / close tab |
| `Cmd+Alt+I` | Toggle DevTools |

## Stack

Electron 32 · TypeScript · Vite (`electron-vite`) · xterm.js · node-pty · electron-builder

## License

[MIT](./LICENSE)

---

## 日本語

ターミナルの裏で YouTube を常時流しておける macOS 用 Electron アプリ。作業用 BGM として lofi radio や MV を流したい、でもウインドウを行き来するのが面倒、という人向け。

### 主な機能

- **ターミナル**: xterm.js + node-pty、Cyberpunk Neon 16 色、透過・ブラー対応、タブごとに `cwd` が再起動後も復元
- **常に YouTube**: 埋め込み再生。`Cmd+Shift+F` で動画を全画面にしてレターボックス中央配置
- **3 モード**:
  - `Cmd+1` YouTube のみ — 進む・戻る・リロード付きのブラウザ風ツールバー
  - `Cmd+2` オーバーレイ — ターミナルを YouTube の上に重ねる
  - `Cmd+3` ターミナルのみ — 動画を隠す
- **ドラッグ&ドロップ**: ファイルをターミナルにドロップするとパスが shell-quoted で貼り付けられる
- **状態復元**: URL・モード・タブ構成・ウインドウサイズを保存
- **広告自動スキップ**: Skip Ad ボタンが押せるようになったら自動でクリック

### ビルド

macOS、Node 18 以上、Xcode Command Line Tools が必要。

```bash
git clone https://github.com/hiroyayamamo/youterm.git
cd youterm
npm install
npm run package
open release/mac-arm64/youterm.app
```

`youterm.app` を `/Applications` に入れれば Dock / Launchpad から使えます。署名なしビルドなので**初回だけ右クリック → 開く**で Gatekeeper の警告を通してください。

### ライセンス

[MIT](./LICENSE)
