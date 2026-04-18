# Changelog

youterm の変更履歴。[Keep a Changelog](https://keepachangelog.com/) 準拠、[Semantic Versioning](https://semver.org/lang/ja/) 準拠。

## [0.7.0] — 2026-04-19

### Added
- **広告ブロック(Ad Block)機能** — `@ghostery/adblocker-electron` を `persist:terminal` session に適用
  - `Settings.adBlockEnabled: boolean`、デフォルト `true`、永続化
  - オプションパネルに Ad Block チェックボックスを追加(緑のアクセントカラー)
  - トグル時は iframe をリロードして反映
  - フィルタは起動時に EasyList / EasyPrivacy を取得(失敗時は無効化で continue、アプリ自体はクラッシュしない)

### Notes / Known Limitations
- **Network layer blocking のみ**: cosmetic filter(DOM 要素非表示)は `@ghostery/adblocker-electron` v2 が `session.registerPreloadScript` を要求する仕様(Electron 35+)で、本プロジェクトは Electron 32 のため workaround として無効化している。実用上は pre-roll 動画広告のブロックは可能だが、サイドバーや動画内バナーなど DOM 系は残る可能性あり
- **SSAI(Server-Side Ad Insertion)不可**: YouTube が動画ストリームに直接広告を差し込む場合、network 層では分離できない
- **adblock 検知警告**: YouTube が「広告ブロッカーは許可されていません」警告を出すことがある(一時的なもの/数回のリロードで解消することが多い)

### 将来改善
- Electron 35+ へアップグレードすれば cosmetic filter も有効化可能

---

## [0.6.4] — 2026-04-19

### Removed
- **モードインジケータ UI 削除** — タブバー右端に表示していた "OVERLAY · terminal" 等のラベルは不要になったので撤去
  - `src/renderer/terminal/modeIndicator.ts` 削除
  - 関連 import / 呼び出し / CSS を一括削除

---

## [0.6.3] — 2026-04-19

### Fixed
- **Video-Fill が mode 切替で勝手に OFF になる問題を修正**
  - 以前の挙動: video-fill ON 中に Cmd+2(overlay)を押すと、YouTube が通常 UI(header / sidebar / comments 表示)に戻っていた
  - 原因: v0.6.1 で「youtube-only モードから離れたら video-fill 自動 OFF」のロジックを追加していたが、ユーザー期待と逆だった
  - 修正: mode 切替では video-fill を変えない。video-fill 状態は `Cmd+Shift+F`(youtube-only モード時のみ可)でのみトグル
  - 結果: overlay モード + video-fill ON の場合、chrome-less な YouTube の上に terminal overlay が載る体験になる
- 併せて `body.video-fill` CSS ルール(terminal overlay を強制非表示)を削除 — mode 固有の CSS が担うべき

---

## [0.6.2] — 2026-04-19

### Fixed
- **Video-Fill モードで動画が白画面になる問題を修正**
  - 原因: CSS の computed styles は正しかったが、`getBoundingClientRect` が 0×0 だった(動画の祖先要素のどこかに `display: none` / `contain` が効いていて box が生成されない状態)
  - 対応:
    - 祖先チェーン(ytd-app → ytd-page-manager → ytd-watch-flexy → #columns → #primary → #primary-inner → #player-container-* → #player)に強制的に `display: block; visibility: visible; contain: none; transform: none; filter: none` を適用
    - 広すぎた `ytd-app > *:not(ytd-page-manager) { display: none }` ルールを、明示的な chrome 要素リストに narrow 化
    - `#movie_player` 内部の `.html5-video-container` にも `position: absolute; inset: 0` を明示
    - `body` の背景色も黒に統一

---

## [0.6.1] — 2026-04-19

### Changed
- **Video-Fill モードを YouTube モード(`youtube-only`)限定に**
  - `Cmd+Shift+F` は `youtube-only` モード時のみトグル可能(他モードでは no-op)
  - モードが `youtube-only` から離れた時は `videoFillMode` を自動 OFF
  - Video-Fill ON 中でも Cmd+1/2/3 によるモード切替は普通に動作
- **理由**: overlay / terminal-only モード中に Video-Fill を有効にすると、YouTube が非 watch ページにいる場合に画面が白くなる現象が発生するため(動画がないページで CSS 注入がミスマッチを起こす)

---

## [0.6.0] — 2026-04-19

### Added
- **Video-Fill モード** — YouTube の動画を youterm ウィンドウ全体に最大化表示
  - `Cmd+Shift+F` でトグル
  - `Settings.videoFillMode: boolean` 追加、永続化(起動時復元)
  - YouTube iframe 内に `<style id="youterm-video-fill-style">` を注入(`webFrameMain.executeJavaScript` 経由)
  - ON 時: ヘッダ / サイドバー / コメント等を `display:none`、`#movie_player` を `position:fixed; inset:0; width:100vw; height:100vh` で最大化
  - ON 時: Terminal overlay(タブバー含む)と Options panel も `body.video-fill` クラスで非表示
  - CSS 注入は `did-frame-finish-load` と settings 変更時に idempotent に実行
  - 他モード(`youtube-only` / `overlay` / `terminal-only`)とは**直交**、OFF で元モードに復帰
- Application Menu の View サブメニューに "Video Fill" 項目追加

### Notes
- OS レベルのフルスクリーンではなく「youterm ウィンドウ内部」での最大化なので、ウィンドウリサイズすれば動画サイズも追従
- ダークモード / シアターモード問題の代替体験として導入(Chromium のストレージパーティショニング起因で標準機能の UI 永続化は不可能だった)

---

## [0.5.1] — 2026-04-18

### Added
- **再生位置の永続化** — 動画の再生中の現在位置(秒)を10秒ごとにポーリングして保存
  - `webFrameMain.executeJavaScript` で cross-origin iframe 内の `document.querySelector('video').currentTime` を取得
  - URL の `?t=<秒>` パラメータとして保存、起動時にその秒数から再生再開
  - `app.on('before-quit')` で終了直前に最終ポーリング実行
  - `time_continue=` など既存の時刻パラメータは正規化

### Fixed
- **YouTube のダークモード / シアターモード設定が動作・永続化しない問題**
  - 原因: Chromium のサードパーティストレージパーティショニングにより、iframe 内の YouTube が `PREF` cookie(ダーク/シアターモード設定を保存)をパーティション化されたストレージ jar に書き込み、session cookie jar には届かなかった
  - 診断: session には 24 cookie あるのに iframe からは 1 つしか見えず、`PREF` cookie は両方の jar に不在だった
  - 対応: Chromium flag `--disable-features=ThirdPartyStoragePartitioning,PartitionedCookies` を追加。iframe が session jar と共有アクセスできるようになり、`PREF` cookie が永続化される

---

## [0.5.0] — 2026-04-18

### Added
- **YouTube の最後に開いていた URL を起動間で復元**
  - `Settings.youtubeLastUrl` を追加(初期 null = homepage)
  - `did-frame-navigate` で iframe のナビゲーションを監視し、YouTube 系 URL 変更時に `set-youtube-url` アクションを発火
  - 200ms debounce で settings.json に保存(既存の debounced-save パターン再利用)
  - 起動時: iframe の初期 src は persisted URL、無ければ `https://www.youtube.com/`
  - URL バリデーション: `youtube.com` / `youtu.be` ドメインのみ accept、不正値は null フォールバック
- **YouTube ログインフロー修正** — 「Sign in」押下時にフレームバスタ JS でエラーになる問題に対処
  - `will-frame-navigate` で `accounts.google.com` / `myaccount.google.com` への遷移を検知して `preventDefault`
  - 同じ Terminal session(`persist:terminal`)を使う新規 `BrowserWindow`(480×640、枠あり)でログインページを開く
  - Cookie が session 共有なので、ログイン成功時にメイン iframe にも認証が反映される
  - ログインウィンドウが `youtube.com/*` にナビゲートしたら自動クローズ、Terminal 側の iframe を reload して認証状態反映

### Changed
- `src/renderer/terminal/index.html` の iframe 初期 src を `about:blank` に(起動後 main.ts が正しい URL を設定)
- `INITIAL_SETTINGS` に `youtubeLastUrl: null` フィールド追加、field-by-field validation で後方互換維持

### Notes
- ダークモード / シアターモード / ログイン状態は既存の session 永続化で自動的に保たれる(v0.2 以降の挙動を継承)

---

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
