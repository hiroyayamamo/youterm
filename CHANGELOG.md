# Changelog

youterm の変更履歴。[Keep a Changelog](https://keepachangelog.com/) 準拠、[Semantic Versioning](https://semver.org/lang/ja/) 準拠。

## [0.12.3] — 2026-04-19

### Changed
- **起動時の「常に YouTube TOP」を revert、保存 URL 復元を再有効化**
  - v0.12.2 で一時的にコメントアウトしていた `initialSettings.youtubeLastUrl` 読み込みを復活
  - v0.12.2 の `/next` CDP Fetch intercept 削除により SPA ナビゲーション問題は根本解決したため、URL 復元は安全に動作する

---

## [0.12.2] — 2026-04-19

### Fixed
- **YouTube iframe 内の SPA ナビゲーションが動かない問題を修正**
  - 原因: v0.7.3 で `/youtubei/v1/next*` に対して CDP Fetch レスポンスインターセプションを追加していたが、`/next` は YouTube の SPA ナビゲーション(次動画データ、関連動画、ページ遷移)に使われる endpoint で、介入により navigation が壊れていた。さらに `/next` レスポンスに ad field は元々入っていないため intercept する意味もなかった
  - 対応: CDP Fetch pattern および JS 側 fetch patch の `isPlayerApi` から `/next` を削除、`/player` のみ intercept 対象に

### Changed
- **起動時に常に YouTube TOP を表示**(保存 URL 復元を一旦無効化)
  - `src/renderer/terminal/main.ts` の iframe 初期 src 設定を `'https://www.youtube.com/'` 固定にコメントアウト切替
  - 保存 URL 追跡 (`youtubeLastUrl` の設定、navigation tracking、再生位置永続化等)は引き続き動作 — 使用していないだけ
  - 保存 URL 復元を再有効化したい場合は renderer main.ts のコメント行を戻すだけ

---

## [0.12.1] — 2026-04-19

### Changed
- **タブバーの背景を不透明な純黒に変更**
  - 以前: `rgba(0, 0, 0, 0.3)` で半透明(後ろの YouTube が透けていた)
  - 現在: `#000` ソリッド、タブバーがはっきり独立した領域として見える

---

## [0.12.0] — 2026-04-19

### Added
- **ウィンドウタイトル動的変更** — `Uterm - {アクティブタブ名}` を表示
  - アクティブタブが変わるたび、または rename 時に自動更新
  - カスタム名未設定のタブは `zsh` を表示(例: `Uterm - zsh`)
  - カスタム名設定済み(例: "main")は `Uterm - main`
  - HTML `<title>` の自動同期を `page-title-updated` で preventDefault、main 側が完全に制御

---

## [0.11.1] — 2026-04-19

### Fixed
- **v0.11.0 のスプラッシュが表示されない問題を修正 + 新規タブでも表示されるように**
  - 原因1: main が splash を送るタイミングで renderer の `onPtyData` リスナーが未登録 → message が落ちていた
  - 対応1: `terminal:ready` IPC を追加。renderer が init() 完了時にこれを呼び、main 側で ready になるまで splash を buffer。renderer reload 時(did-start-loading)にも ready フラグをリセットして再送可能に
  - 原因2: v0.11.0 では初期タブのみ splash、`newTab()` は対象外だった
  - 対応2: `TabsControllerDeps.onSpawn` コールバックを追加し、tabsController が pty spawn のたびに呼ぶ。これで初期タブも Cmd+T 新規タブも同じ経路で splash 表示

---

## [0.11.0] — 2026-04-19

### Added
- **起動時のスプラッシュ画面** — アプリ起動時、各初期タブに ASCII アートで "youterm" + バージョン + "by Hiroya Yamamoto" を表示
  - 色付き(緑 rgb(40,254,20) + シアン rgb(0,221,255))、xterm の真カラー ANSI エスケープで描画
  - 新規タブ(Cmd+T)は対象外 — 純粋な zsh プロンプトのみ
  - バージョンは `app.getVersion()` で package.json から動的取得
  - `src/main/splash.ts` に `buildSplash(version)` として実装

### Changed
- `package.json` のバージョンを `0.10.0` から `0.11.0` に更新

---

## [0.10.1] — 2026-04-19

### Fixed
- **v0.10.0 で cwd が永続化されない bug を修正**
  - 原因: `captureCwds()` が reducer action を dispatch すると、subscribers が `scheduleSave()` で 200ms の debounce タイマーを設定。その直後に `app.quit()` が呼ばれるとプロセスが終了してタイマーが発火せず、`tabs.json` への書き込みが実行されずじまいだった
  - 対応: `TabsController.flushSave()` を追加、pending タイマーをキャンセルして同期的に `store.save(state)` を実行
  - `captureCwds()` の末尾で `flushSave()` を呼ぶ → app quit 前に必ずディスク書き込み完了
  - 通常の runtime での設定変更は従来通り 200ms debounce save(過剰書き込み防止)

---

## [0.10.0] — 2026-04-19

### Added
- **各タブの cwd(カレントディレクトリ)永続化**
  - `Tab.cwd: string | null` フィールド追加(tabs.json に保存)
  - **アプリ終了時(`before-quit`)**: 各タブの zsh プロセスの pid に対して `lsof -a -d cwd -p <pid> -Fn` を実行して現在のカレントディレクトリを取得 → state 更新 → tabs.json に保存(連続ポーリングではなく終了時 1 回のみ、パフォーマンス影響なし)
  - **アプリ起動時**: 各タブの保存された cwd を zsh spawn 時に使用。ディレクトリが存在しない場合はホームディレクトリにフォールバック
  - 新規タブは cwd=null で作成されるため、ホームディレクトリで起動(既存挙動維持)
  - `PtyHandle.getPid()` 追加、`spawnPty` シグネチャを `(tabId, cwd: string \| null)` に変更
  - `TabsController.captureCwds()` 追加、DI 可能な `getCwdForPid` で fake テスト対応
  - `set-tab-cwds` reducer action + 4 新規テスト

---

## [0.9.0] — 2026-04-19

### Added
- **動画の再生/一時停止トグル(Cmd+K)**
  - どのモード(youtube-only / overlay / terminal-only)・どの入力先でも動作
  - main プロセスから `webFrameMain.executeJavaScript` で YouTube iframe 内の `<video>` 要素に対して `paused ? play() : pause()` を実行
  - Application Menu の View サブメニュー先頭に "Play/Pause Video" 項目として追加

---

## [0.8.0] — 2026-04-19

### Added
- **起動時の自動再生抑制** — アプリ起動時、前回保存された URL の動画がロードされるが**最初の再生開始時点で自動的に一時停止**される
  - 初回ロード時だけ発動(`window.__youtermInitialPauseScheduled` フラグで制御)
  - ユーザーが明示的に再生ボタンを押すとそのまま再生
  - 次動画への SPA 遷移やプレイリスト auto-advance では普通に再生(初回 pause 済みフラグが維持されるため)
  - アプリ再起動すると iframe が作り直されるため、次回起動時もまた pause される
  - 動画要素が出現するまで最大 30 秒間ポーリング(300ms 間隔)

---

## [0.7.6] — 2026-04-19

### Fixed
- **v0.7.5 で動画再生不可・チラつき発生の regression を修正**
  - 原因:
    1. 広告検知条件を `.ytp-ad-player-overlay` / `.ytp-ad-module` まで拡張したが、これらの DOM 要素は広告中でなくても存在するため、常時 "広告中" 判定になり `video.currentTime = duration` が連続実行されてチラついた
    2. フォールバック button スキャンが無関係な UI にマッチしてクリックしてしまう誤爆があった
    3. interval を 100ms に短縮していたため上記誤爆が増幅
  - 対応:
    - 広告検知を `#movie_player.ad-showing` / `.ad-interrupting` クラスの厳密判定のみに戻す
    - broad な button スキャンのフォールバックを削除、explicit セレクタのみに(class 名マッチを拡張したバージョンは維持)
    - interval を 250ms に戻す
  - v0.7.5 で導入した有用な改善(trusted event 発火 `aggressiveClick`、可視性チェック、拡張 explicit セレクタ)は維持

---

## [0.7.5] — 2026-04-19

### Fixed
- **「広告をスキップ」ボタンが表示された時の自動クリックが効かない問題を修正**
  - 原因: セレクタ不足(YouTube UI のバージョン差で class 名が変化)+ `element.click()` が YouTube 側で trusted event と見なされず無視されるケースがあった
  - 対応:
    - セレクタを大幅拡張(modern/legacy/container 各種の button class + `aria-label` 一致)
    - フォールバック: 全 button + `div[role="button"]` をスキャンし、class / aria-label / textContent に "skip" + "ad" または "広告をスキップ" が含まれるものをクリック
    - クリック方式を `.click()` 単独から、`pointerdown → mousedown → pointerup → mouseup → click` の連続 dispatch に変更(trusted event の判定を通りやすくする)
    - クリック前に `offsetParent` / `visibility` / `display` / `opacity` で可視確認
    - 広告検知条件も拡張:`.ytp-ad-player-overlay` / `.ytp-ad-module` の存在も判定材料に
  - interval を 250ms → 100ms に短縮してレスポンス向上

---

## [0.7.4] — 2026-04-19

### Fixed
- **広告ブロックの安定性を向上(DOM-level 自動スキップ追加)**
  - network 層のブロックでは YouTube の初期 HTML 埋め込み `ytInitialPlayerResponse` や SSAI(動画ストリーム直接挿入)の広告を捕捉できず、広告が出る/出ないが不安定だった
  - 対応: 既存の AD_STRIP_SCRIPT に DOM 監視 + 自動スキップロジックを追加
    - `#movie_player` に `ad-showing` / `ad-interrupting` クラスが付いたら検知
    - 優先度1: 「スキップ」ボタン(`ytp-ad-skip-button-modern` 等のセレクタ)をクリック
    - 優先度2: `<video>` 要素の `currentTime = duration` で広告末尾まで瞬時ジャンプ + ミュート
  - 250ms ごとの interval + MutationObserver の両方で検知(再生開始直後の検知遅延を最小化)
  - 4 層防御(network filter / CDP Fetch intercept / CDP script inject / DOM skip)の最終レイヤーとして機能

---

## [0.7.3] — 2026-04-19

### Fixed
- **初回起動時の広告を network 層で確実に除去**
  - 従来の script injection(`did-frame-finish-load` および CDP `Page.addScriptToEvaluateOnNewDocument`)はタイミング的に iframe の初回 fetch に間に合わず、初回動画で広告が出ることがあった
  - 対応: CDP `Fetch.enable` でレスポンスインターセプションを追加。`/youtubei/v1/player*` と `/youtubei/v1/next*` のレスポンスボディを network 層で取得し、JSON から広告フィールド(`playerAds` / `adPlacements` / `adSlots` / `adBreakHeartbeatParams` / `adBreakParams`)を剥がして page に返す
  - 3 層防御:
    1. `@ghostery/adblocker-electron` network filter
    2. CDP Fetch response interception(本変更)
    3. CDP `Page.addScriptToEvaluateOnNewDocument` + `did-frame-finish-load` の script injection(defense in depth)

---

## [0.7.2] — 2026-04-19

### Fixed
- **アプリ初回起動時に広告が出る問題を修正**
  - 原因: v0.7.1 の ad-strip JS は `did-frame-finish-load` で注入していたため、タイミング上 YouTube の最初の `/youtubei/v1/player` 呼び出しには間に合わず、初回動画の広告メタデータが素通りしていた
  - 対応: Chrome DevTools Protocol の `Page.addScriptToEvaluateOnNewDocument` を使って、全ドキュメント(iframe 含む)の全 JS よりも先に ad-strip を実行させる
  - 既存の `did-frame-finish-load` 経由の注入も保持(`__youtermAdStripInstalled` ガードで二重注入回避)、CDP が失敗した時の fallback として機能
  - Ad Block トグル時は CDP スクリプト追加/削除 + iframe reload で反映

---

## [0.7.1] — 2026-04-19

### Fixed
- **プレイリスト連続再生で 2 曲目以降に広告が出る問題を修正**
  - 原因: network filter は初回 player ロードは止めるが、YouTube の SPA auto-advance 時に `/youtubei/v1/player` から返る ad metadata(`playerAds` / `adPlacements` / `adSlots`)を完全には止められなかった
  - 対応: YouTube iframe 内で `window.fetch` と `XMLHttpRequest.prototype.open/send` を monkey-patch。player API レスポンスから広告フィールドを動的に削除してプレイヤーに渡す
  - 注入は `did-frame-finish-load` タイミングで実行、`window.__youtermAdStripInstalled` で idempotent
  - ad block が OFF のときは注入しない

---

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
