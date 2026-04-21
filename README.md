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

Electron 41 · TypeScript · Vite (`electron-vite`) · xterm.js · node-pty · electron-builder

## Known Limitations

### Resize-induced scrollback duplication in some TUIs

When you drag the splitter or resize the window, youterm sends a `SIGWINCH` to the shell's child processes so they reflow to the new size. TUIs that re-render their entire view on `SIGWINCH` — Claude Code is a notable example — write a copy of their current banner / prompt / last response into the scrollback on every redraw, so you may see a duplicated block above your active line after each resize.

youterm coalesces resize events so the child receives **at most one `SIGWINCH` per drag** (same-size no-ops are suppressed entirely), but the redraw itself is the TUI's behavior and can't be fully eliminated from the outside. Your active prompt and anything you type after the resize is unaffected.

### Some JS-driven YouTube settings don't persist

YouTube is embedded as an `<iframe>` whose top-level origin is youterm's local app page (`file://`). Chromium applies strict third-party storage / cookie rules to that configuration, and YouTube's account-menu save flows (theme, language, autoplay preference, comments, like / subscribe, etc.) expect a first-party top-level context for authentication. Cookie writes attempted from the iframe are silently dropped or YouTube's internal API rejects the request, so:

- **Working**: video playback, search, URL navigation (channel links, video clicks), the browser-style back / forward / reload toolbar
- **Not working**: changing display theme from the avatar menu, changing display language, posting comments, like / subscribe buttons, anything that needs a YouTube-side API write

Workarounds: use macOS's OS-level dark mode (YouTube follows the system appearance), or run YouTube's language URL parameter (`?hl=ja` etc.) via the address bar.

Lifting this would require re-architecting YouTube out of the iframe into a top-level `WebContentsView`. Not currently planned — the tradeoff against the simpler single-webContents layout isn't worth it for a personal tool.

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

### 既知の制限

#### リサイズ時に一部 TUI のスクロールバックが重複することがある

splitter や window をリサイズするとき、youterm はシェルの子プロセスに `SIGWINCH` を送って新しいサイズに追従させます。`SIGWINCH` を受けるたびに表示全体を再描画する TUI(Claude Code など)は、その時点の banner / prompt / 直前の応答を 1 コピー分スクロールバックに書き出すため、**リサイズのたびに見返し領域に重複ブロックが残る**ことがあります。

youterm はリサイズイベントを集約して **1 ドラッグあたり最大 1 回の `SIGWINCH`** に抑えています(同サイズの re-send は完全にスキップ)が、その 1 回の再描画は TUI 側の挙動なので外側から完全には消せません。アクティブなプロンプトやリサイズ後に入力する内容には影響しません。

#### YouTube のアカウントメニューの一部機能が保存されない

YouTube は `<iframe>` で埋め込んでおり、その top-level 原点は youterm のローカル HTML(`file://`)。Chromium がこの構成を strict な third-party storage / cookie として扱うため、YouTube のアカウントメニューからの保存系フロー(テーマ、言語、コメント投稿、like / 購読 等)は失敗します。

- **動くもの**: 動画再生、検索、URL 遷移(チャンネルリンク、動画クリック)、進む / 戻る / リロード
- **動かないもの**: アバターメニューからのテーマ切替、言語切替、コメント投稿、like / 購読、YouTube 側の API 書込が必要な操作

回避策:
- macOS の OS ダークモードを切替(YouTube は OS の appearance に追従する)
- 言語は URL パラメータ(`?hl=ja` 等)で指定

この制限を外すには YouTube を iframe から切り出して top-level の `WebContentsView` にする re-architecture が必要。個人ツールとしては軽量な単一 webContents 構造の利点のほうが大きいので、現状では実施しない方針。

### ライセンス

[MIT](./LICENSE)
