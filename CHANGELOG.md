# Changelog

youterm の変更履歴。[Keep a Changelog](https://keepachangelog.com/) 準拠、[Semantic Versioning](https://semver.org/lang/ja/) 準拠。

## [0.4.1] — 2026-04-18

### Added
- **タブ構成の永続化** — 開いているタブ(id + カスタム名)とアクティブタブが起動間で復元される
  - 保存先: `~/Library/Application Support/youterm/settings.json` と並びで `tabs.json`
  - 200ms debounce で state 変更時に保存
  - 破損 / 欠落 / 型不正 → `INITIAL_TABS_STATE` にフォールバック
  - 復元後の新規タブ ID は最大既存 ID + 1 から採番(衝突回避)

### Notes
- pty プロセスとスクロールバックは揮発のまま(毎起動新しい zsh を spawn)

---

## [0.4.0] — 2026-04-18

### Added
- **ターミナルタブ機能**
  - `Cmd+T` 新規タブ(各タブに独立した zsh + xterm インスタンス)
  - `Cmd+W` アクティブタブを閉じる(最後の1枚ならウィンドウ終了)
  - `Ctrl+Tab` / `Ctrl+Shift+Tab` でタブ循環切替
  - `Cmd+Shift+]` / `Cmd+Shift+[` でもタブ切替(Chrome 風)
  - タブクリックで切替、× ボタンで閉じる(hover/active 時表示)
  - タブ上で右クリック → ネイティブコンテキストメニュー(「Close tab」「Rename tab」)
  - ダブルクリックでインプレースリネーム(Enter 確定 / Esc キャンセル / blur 確定 / 空でデフォルトに戻す)
  - 閉じる前に `pgrep -P` で子プロセス検知 → 子ありならネイティブ確認ダイアログ
- **xterm のテキスト色**
  - デフォルト: `rgb(40, 254, 20)` (緑)
  - ボールド: `rgb(0, 221, 255)` (シアン、`drawBoldTextInBrightColors: true` 経由)
- タブバー(高さ 28px)を `#terminal-root` 最上段に追加
- モードインジケータをタブバー右端に移設

### Changed
- `attachPty(terminalView)` を `attachTabs(win, terminalView)` にリファクタ
- 既存 IPC チャネル `pty:data` / `pty:write` / `pty:resize` の payload に `tabId` を追加(破壊的)
- renderer main.ts を per-tab xterm 管理モデルに全面書き換え
- `modeController` から依存していた `youtubeView` 参照を廃止

### Removed
- `src/renderer/terminal/terminal.ts`(旧 `mountTerminal` ヘルパ、インライン化)

---

## [0.3.1] — 2026-04-18

### Fixed
- **Blur が効いていなかった問題を修正**(v0.3.0 の重要な欠陥)
  - 原因: YouTube が別 `WebContentsView` だったため、Terminal の `backdrop-filter` が YouTube ピクセルを認識できなかった(Chromium は同一ドキュメント内のみ対象)
  - 対応: YouTube を Terminal renderer 内の `<iframe>` に移行

### Changed
- **アーキテクチャ変更**
  - YouTube WebContentsView 撤去、単一 Terminal view 構成へ
  - YouTube ドメイン限定の session header stripper(`X-Frame-Options`, `Content-Security-Policy: frame-ancestors`)を追加
  - モード切替: main の view bounds 操作 → renderer の CSS クラス駆動(`body.mode-*`)
  - `Cmd+R`(YouTube リロード)が `youtube:reload` IPC 経由で iframe.src を再設定する方式に

---

## [0.3.0] — 2026-04-18

### Added
- **Blur 設定**
  - `Settings.blur` フィールド(0.0〜1.0、初期値 0.1)
  - オプションパネルに Blur スライダー(0〜100%、step 5%)
  - `backdrop-filter: blur(var(--term-blur))` を `#terminal-root` に適用
- `validateAndNormalize` を field-by-field 方式にリファクタ(欠落/不正フィールドのみデフォルト補完、他は保持 — v0.2→v0.3 の後方互換)

### Known Issues
- **Blur が実際には機能しない**(v0.3.1 で修正)。WebContentsView アーキテクチャの制約により `backdrop-filter` が YouTube ピクセルを対象にできなかった

---

## [0.2.0] — 2026-04-18

### Added
- **設定永続化**(electron-store)
  - `~/Library/Application Support/youterm/settings.json`
  - 保存対象: `transparency`, `bgColor`, `lastMode`
  - 200ms debounce で自動保存、起動時復元
- **オプションパネル** — `Cmd+,` でフローティングポップオーバー開閉
  - 右上のモードインジケータ下に配置、フェードアニメーション付き
  - Esc / パネル外クリック / 再度 `Cmd+,` で閉じる
  - `youtube-only` モード時は自動的に `overlay` へ遷移してからパネル表示
- **ランタイム透過度/背景色変更**
  - 透過度スライダー(0.0〜0.9、step 0.05)、リアルタイム反映
  - 背景色スウォッチ: 黒 / ダークグレー / ダークブルー / ダークグリーン
  - Reset ボタンで初期値復帰
- ショートカット追加
  - `Cmd+]` / `Cmd+[` で透過度 ±0.05
  - `Cmd+,` でオプションパネルトグル
- CSS を変数ベース化(`--term-bg-r/g/b`, `--term-alpha`)

---

## [0.1.0] — 2026-04-17

### Added
- **MVP リリース** — youterm 初版
- Electron ウィンドウ(1280×800、mac 標準枠、リサイズ可)
- 背景レイヤー: YouTube を `WebContentsView` で表示、独立 session(`persist:youtube`)
- 前面レイヤー: 半透明ターミナル(xterm.js + `@xterm/addon-fit` + `@xterm/addon-web-links`)
- pty: `node-pty` で `/bin/zsh -l` を spawn
- **3 モード切替**
  - `Cmd+1` YouTube 専用(terminal 非表示)
  - `Cmd+2` 重ね表示(default)
  - `Cmd+3` ターミナル専用(YouTube 映像非表示、音声継続)
- `Cmd+\` で入力先切替(overlay モード時のみ、terminal ↔ YouTube)
- `Cmd+R` で YouTube リロード、`Cmd+Shift+R` でハードリロード
- モードインジケータ(右上の小さな半透明ラベル)
- ターミナル背景: `rgba(0, 0, 0, 0.75)` 固定
- TDD 適用: `state.ts`(mode 遷移、9 テスト)、`pty.ts`(DI spawn、8 テスト)
- Playwright-electron スモーク E2E(起動・3 秒生存・クリーン終了)

---

## 参照

- 設計書: `docs/superpowers/specs/`
- 実装計画: `docs/superpowers/plans/`
- コミット履歴: `git log v0.X.Y..v0.X.Z --oneline`
