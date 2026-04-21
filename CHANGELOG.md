# Changelog

youterm の変更履歴。[Keep a Changelog](https://keepachangelog.com/) 準拠、[Semantic Versioning](https://semver.org/lang/ja/) 準拠。

## [0.16.0] — 2026-04-21

### Added
- **画面 2 分割機能**(`Cmd+D` でトグル)
  - 縦分割、左右ペインにそれぞれ独立したタブ群
  - 1 → 2 分割時は右 pane に新タブを自動生成、右にフォーカス移動
  - タブを左右の pane 間でドラッグ&ドロップで移動(xterm ランタイムは破棄されず、DOM の container だけ付け替え)
  - splitter ドラッグで比率変更可(0.1〜0.9 clamp、最小 pane 幅 200px)
  - 分割状態 / 各 pane のタブ構成 / 比率 / フォーカス pane を永続化
  - 旧 shape の `tabs.json` は自動マイグレーション
  - pane の最後のタブを閉じる / 移動で pane が空になる → auto-unsplit

### Changed
- `TabsState` を `{ panes: Pane[], activePaneIndex, splitRatio }` に refactor
- 既存 reducer アクション(new-tab / close-tab / activate-tab / rename-tab / set-tab-cwds / move-tab)を pane-aware に書き換え
- `#tab-bar` / `#tab-list` / `#tab-new`(id)→ class 選択子にリネーム(pane ごとに複数存在するため)
- `#terminal-root` を `display: flex; flex-direction: row` のフレックスレイアウトに
- Finder ドラッグ&ドロップの着地先をフォーカス pane のアクティブタブに変更

### Tests
- 旧 shape → 新 shape の migration テスト 4 件追加(`tabsStore.test.ts`)
- 新規 reducer アクション 5 種すべてにテストケース(`split-panes`, `unsplit-panes`, `activate-pane`, `set-split-ratio`, `move-tab-to-pane`)
- auto-unsplit の振る舞い検証、最後のタブ保護テスト追加
- controller の `toggleSplit` / `moveTabToPane` のテスト追加
- 計 115 → 142 tests(+27)

---

## [0.15.30] — 2026-04-21

### Added
- **タブのドラッグ&ドロップによる並び替え**
  - タブを掴んで別タブの前後にドロップすると順序が入れ替わる(ブラウザタブと同じ操作感)
  - 掴んでいるタブは opacity 0.3 でフェード、ドロップ先のタブの左右いずれかに cyan の 2px ラインでドロップ位置を提示
  - 中央より左にドロップ → そのタブの**前**に挿入 / 右側 → 次のタブの前(= そのタブの直後、または末尾)に挿入
  - rename 中のタブ(インプットが出てる状態)はドラッグ対象から除外(テキスト選択を優先)
  - 状態は reducer の `move-tab` アクションで管理 → 既存の `tabsStore` の debounced save にそのまま相乗り、再起動後もタブ順序が復元される
  - テスト 7 件追加(before 挿入 / 末尾挿入 / no-op ケース / 存在しない id)

---

## [0.15.29] — 2026-04-21

### Added
- **README.md(英語メイン + 日本語セクション併記)を作成(#119)**
  - 先頭に英語のタグライン、機能、ビルド手順、ショートカット表
  - 末尾に日本語訳セクションを統合(別ファイル分割しない方針 — GitHub 初見で両方同時に届く)
  - demo gif プレースホルダを README 上部に配置(後で撮影・差し替え)
- **LICENSE(MIT、Copyright 2026 Hiroya Yamamoto)を追加**
- **`package.json` にメタ情報を追加**: `description` / `author` / `license` / `homepage` / `repository` / `bugs`
- **git remote を追加**: `origin = https://github.com/hiroyayamamo/youterm.git`
- **記録ドキュメント**: `docs/adblock/policy.md`(広告対策の方針)、`_claude/logs/release_checklist.md`(#117-120 のリリースチェックリスト)

### Changed

---

## [0.15.28] — 2026-04-21

### Fixed
- **Cmd+1 と Cmd+2 で Video Fill の動画中心位置が 14.5px ズレていた問題を根治**
  - 原因: mode-youtube-only は iframe を `top: 29px` に押し下げていたが、mode-overlay は iframe が `inset: 0` で全画面を占有していた(タブバーは z-index 5 で被せてるだけ)。YouTube の player は iframe 内の 100vh を基準に動画を中央配置するため、overlay では動画中心が 14.5px 上にズレていた
  - 対応: `#youtube-iframe` のデフォルトを `top: 29px / height: calc(100% - 29px)` に統一(全モード共通)。mode-specific の override を削除
  - 結果: Cmd+1 / Cmd+2 / Cmd+3 のどれでも iframe サイズが一定 → モード切替で iframe のリサイズが発生しない → YouTube の player script がインラインスタイルを書き戻す誘発もない → 動画が常にウインドウの視認可能領域(上端 29px のクロムを除く)の中央に配置される
  - v0.15.27 の resize ハンドラは保険として残置

---

## [0.15.27] — 2026-04-21

### Fixed
- **Cmd+1 ↔ Cmd+2 切替時の Video Fill 動画位置ズレを修正**
  - 原因: mode-youtube-only は iframe を 29px 押し下げ、overlay は inset: 0 なので、切替のたびに iframe 高さが 29px 変動 → iframe 内で resize 発火 → YouTube の player script が `#movie_player` / `<video>` / `.html5-video-container` にインラインで `transform` / `margin` / `width` などを書き戻す → CSS `!important` は勝つものの、インライン値がコンポジット 1 フレーム分残って視覚的にズレて見える
  - 対応: `AD_STRIP_SCRIPT` に `resize` ハンドラを追加。`html.youterm-video-fill` が付いている時だけ、`#movie_player` / `<video>` / `.html5-video-container` のインライン `transform / margin / left / top / right / bottom / width / height` を空文字で上書き(= CSS に委譲)
  - 三段発射(即時 + 次フレーム + 100ms 後)で YouTube の deferred write も拾う
  - video-fill が OFF のときは no-op なので通常の YouTube レイアウトには影響なし

---

## [0.15.26] — 2026-04-21

### Fixed
- **Video Fill(Cmd+Shift+F)中の動画位置が toggle off→on やウインドウ resize でズレることがあった件を修正**
  - 原因: YouTube の player script が resize / 再表示のタイミングで `#movie_player` や `<video>` にインラインの `transform` / `margin` / 部分 width を書き戻す。我々の CSS は `top/left` しか固定していなかったため、これらの残存が中央ズレの原因になっていた
  - 対応: `VIDEO_FILL_CSS` を補強 —
    - `#movie_player` に `right: 0 / bottom: 0 / transform: none` を追加(ビューポート全面を 4 辺で固定)
    - `.html5-video-container` に `transform: none / margin / padding: 0` を追加
    - `<video>` に `position: absolute / top/left/right/bottom: 0 / transform: none / object-position: center center` を明示(インライン値を全て無効化して常に中央寄せ)
  - 結果: toggle off→on、resize、別動画に遷移、どのタイミングでも動画が常にウインドウの上下左右中央に配置される

---

## [0.15.25] — 2026-04-21

### Added
- **App アイコンを設定(#118)**
  - ユーザ提供の 1024×1024 PNG(宇宙人 CRT ロゴ)を基に、`sips` で 16 / 32 / 64 / 128 / 256 / 512 / 1024 の 7 サイズを生成、`iconutil -c icns` で `build/icon.icns` に変換
  - `build/icon.png`(1024×1024 マスター)と `build/icon.icns` を配置 → electron-builder が自動検出して `.app/Contents/Resources/icon.icns` に埋め込み
  - Dock / Launchpad / Finder / Cmd+Tab の全てで新アイコンが表示される

---

## [0.15.24] — 2026-04-21

### Added
- **electron-builder を導入、`.app` として書き出せるように(#117)**
  - `npm run package` で `release/mac-arm64/youterm.app` を生成(約 1 分)
  - `npm run package:dmg` で DMG も出せる(配布用ではなく手元利用の選択肢として)
  - 設定は package.json の `build` フィールド、`appId = io.github.hiroyayamamo.youterm`、`productName = youterm`
  - **署名・notarization は明示的に skip**(`mac.identity: null`)。方針通り GitHub 公開のみ、配布はしない
  - `asarUnpack` で node-pty の native binary を非 asar 領域に配置(native モジュール必須)
  - アイコンは未設定(default Electron icon、#118 で対応予定)
  - description / author フィールドは未記入(#119 で対応予定)

### Changed
- `.gitignore` に `release/` を追加
- `build/` ディレクトリを新設(electron-builder の buildResources 置き場、#118 で .icns を入れる)

---

## [0.15.23] — 2026-04-20

### Fixed
- **nav bar の高さを 28 → 29px に微調整、tab-bar と 1px ズレていた件を修正**
  - 原因: `#tab-bar` は `height: 28px` + `border-bottom: 1px`(`box-sizing` デフォルト = content-box)なので実際の占有高は 29px。nav bar は `box-sizing: border-box` で height: 28px だったため、実占有は 28px となり 1px 浅かった
  - 対応: nav bar の `height: 28px` → `29px`、`body.mode-youtube-only #youtube-iframe` の押し下げ量も 28 → 29px に連動

---

## [0.15.22] — 2026-04-20

### Changed
- **nav bar の高さを `#tab-bar` と同じ 28px に統一**
  - v0.15.20〜21 では 32px だったが、mode-youtube-only ↔ overlay を行き来したときに上端の横線位置が 4px ずれて違和感があった
  - 対応: `#nav-bar { height: 28px }`、ボタンを width/height 28×22 / font-size 14px に縮小、iframe の押し下げ量も 32 → 28px に連動

---

## [0.15.21] — 2026-04-20

### Fixed
- **`mode-youtube-only` で nav bar が YouTube masthead を覆っていた件を修正**
  - v0.15.20 で nav bar を z-index 4 で iframe の上に重ねていたため、YouTube 側のヘッダー上端 32px が常に隠れていた
  - 対応: `body.mode-youtube-only #youtube-iframe` に `top: 32px; height: calc(100% - 32px);` を追加して iframe を nav bar の下に押し下げ
  - overlay / terminal-only モードでは nav bar が非表示なので iframe は従来通り全画面(`inset: 0`)のまま

---

## [0.15.20] — 2026-04-20

### Added
- **YouTube 用のブラウザ風ナビバー(戻る / 進む / リロード)を追加**
  - `mode-youtube-only` のときだけ画面最上部に 32px の nav bar を表示(← / → / ↻)
  - クリックで各 IPC (`youtube:nav:back` / `:forward` / `:reload`) を発射、main 側が `webFrameMain.executeJavaScript('history.back()')` 等で YouTube iframe の履歴を操作
  - iframe は cross-origin のため renderer から直接 `contentWindow.history` を叩けない → main 経由の経路を選択
  - `mode-overlay` / `mode-terminal-only` では表示しない(terminal-root レイアウトとの衝突を避けるため)
  - reload は既存の `reloadAdBlockAndIframe` パスに相乗り(about:blank → 再設定で SPA 状態を確実にリセット)

---

## [0.15.19] — 2026-04-20

### Fixed
- **YouTube の「広告ブロッカーは許可されていません」ポップアップを自動解除**
  - 症状: 視聴中に enforcement ポップアップが表示され、動画が停止。手動で閉じるか Cmd+Q で終了するしか無かった
  - 対応: `AD_STRIP_SCRIPT` に `dismissAntiAdblockPopup` を追加。`ytd-enforcement-message-view-model` を基点に含む `tp-yt-paper-dialog` + `tp-yt-iron-overlay-backdrop` を削除、body のスクロールロックを解除、広告中でなければ `video.play()` で再開
  - 誤検知対策: `ytd-enforcement-message-view-model` を必ず起点にして `.closest('tp-yt-paper-dialog')` で親に辿る設計。share / settings 等の別ダイアログは巻き込まない
  - ポーリングは既存の ad-skip と同じ 3 秒間隔に相乗り(追加の CPU コストなし)
  - YouTube がセレクタ名を変えたら効かなくなる構造なので、挙動がおかしくなったらこの commit を revert するだけで v0.15.18 相当に戻せる

---

## [0.15.18] — 2026-04-20

### Fixed
- **splash とプロンプトの間に残っていた空行を完全に消去**
  - v0.15.17 で `PROMPT_EOL_MARK=''` によりマーカーの `%` は消えたが、PROMPT_SP 自体は依然として「空行 + `\r`」を出していて、空白の 1 行がそのまま残っていた
  - 対応: zsh を **`+o PROMPT_SP` 付きで起動**(`spawn('/bin/zsh', ['-l', '+o', 'PROMPT_SP'], ...)`)。部分行保護機能自体がオフになり、positioning の空白行も出なくなる
  - `PROMPT_EOL_MARK=''` の env 設定は**defense-in-depth で残す**(ユーザ .zshrc が `setopt PROMPT_SP` で再有効化した場合も、最悪マーカーだけ非表示でよりマシな見た目に)

---

## [0.15.17] — 2026-04-20

### Fixed
- **起動時の splash と最初のプロンプトの間に「謎の 1 行空白(実体は `%` だけの行)」が出ていた件を修正**
  - 原因: zsh の `PROMPT_SP`(部分行保護機能)が初回プロンプト直前に reverse video の `%` を 1 文字だけ出力する。このマーカー文字が `PROMPT_EOL_MARK` パラメータで、**デフォルト値が `%`**。splash の末尾で完全に改行していても、zsh は初回起動時にこのマーカー行を必ず描画する
  - 対応: pty env に **`PROMPT_EOL_MARK=''`** を追加。マーカー文字が空になり、PROMPT_SP の機構自体は生きたまま行だけ見えなくなる(端末が partial line の扱いを誤って上書きするような事故も発生しない安全な抑止)
  - 併せて `splash.ts` 末尾の `\r\n\r\n` を `\r\n` に短縮。tagline 下の余計な空行を 1 行削減

---

## [0.15.16] — 2026-04-20

### Fixed
- **新規 shell 起動時に出ていた `Restored session: ...` + `rm: No such file or directory` を抑制**
  - 原因: macOS 付属の `/etc/zshrc_Apple_Terminal` に「Shell Session」機能が組み込まれていて、`TERM_SESSION_ID` が inherited されてると `~/.zsh_sessions/<id>.session` を source → rm しようとする。youterm はそのファイルを作っていないので rm が毎回失敗してエラー出力
  - 対応: pty spawn 時の env に Apple 自身が用意している **`SHELL_SESSIONS_DISABLE=1` を明示**。session 復元機能が丸ごとスキップされ、無駄な `Restored session:` の表示も無くなる
  - youterm は自前のシェルセッション管理(タブ数保存・cwd 保存)を v0.4 / v0.10 で持っているので、Apple のそれを使う必要なし

---

## [0.15.15] — 2026-04-20

### Changed
- **タブバーの境界線を見えやすく**
  - タブ間 separator と tab-bar 下端のライン、両方とも `rgba(255, 255, 255, 0.08)` → `rgba(255, 255, 255, 0.3)` に濃く
  - 以前はほぼ見えず、複数タブ開いた時の切れ目が判別しづらかった

---

## [0.15.14] — 2026-04-20

### Changed
- **ウィンドウタイトルの表示を `Uterm` → `youterm` に変更**
  - 初期タイトル: `Uterm` → `youterm`
  - 動的タイトル: `Uterm - <tab name>` → `youterm - <tab name>`
  - プロダクト名と揃える(`package.json`、スプラッシュ、CHANGELOG はすでに `youterm` 表記)

---

## [0.15.13] — 2026-04-20

### Changed
- **起動時スプラッシュに宇宙人マスコット + キラキラ装飾を追加**
  - 案 A(logo 右横に小さい宇宙人)採用、上下に星の飾り帯を追加
  - 宇宙人は `( •_• )` の顔 + 胸元の `♦`(CYAN 強調)+ 足元の `(_)   (_)` で 5 行分
  - 上下の飾り帯: `· . ✦ * ° ·` を並べた sparkle ライン、色は **dim cyan** で logo に視線を奪わない控えめな輝き
  - logo 行は `padEnd(47)` で固定幅化、宇宙人カラムが各行できれいに揃う
  - カラーマッピング:
    - logo: GREEN + BOLD(従来どおり)
    - 宇宙人本体: GREEN(bold なし、logo より軽い印象)
    - ♦: CYAN + BOLD(強調)
    - 星: CYAN + DIM(淡く)

---

## [0.15.12] — 2026-04-20

### Changed
- **`brightBlack` のコントラスト改善**: `rgb(80, 80, 80)` → `rgb(140, 140, 160)`
  - 旧値は `rgba(0,0,0,0.75)` + backdrop-filter の半透明黒背景にほぼ同化して、コメント行・dim 表示・`grep` context などが読みづらかった
  - 新値は少し青みがかった中間グレーで、Cyberpunk Neon パレットの他色とも馴染む

---

## [0.15.11] — 2026-04-20

### Fixed
- **Cmd+1 → Cmd+2 でモード切替した後、ターミナル表示が 1 行数文字の超細切れになっていた bug を修正**
  - 再現: Claude の出力など長文を表示 → `Cmd+1`(YouTube Only、`#terminal-root` に `display:none`)→ `Cmd+2`(Overlay、再表示)すると、xterm が cols=1〜数文字幅で動作、既存出力も narrow wrap で焼き付けされる
  - 原因: `display: none` の間でも `termArea` の `ResizeObserver` は発火し、0×0 の寸法で `FitAddon.fit()` が呼ばれ、ptyResize(cols=0) を送信。pty と shell(及び Claude)がこれを受けて極小幅で再描画・再 wrap
  - 対応: 3 箇所に **「コンテナが可視(`offsetWidth > 0 && offsetHeight > 0`)の時だけ fit + resize する」ガード**を追加
    - `ResizeObserver` コールバック
    - `applyActiveVisibility`(タブ切替時の fit)
    - `ensureRuntime` 内の初回 rAF fit(非アクティブタブや youtube-only モードで新規タブ生成時)
  - さらに `onStateChanged` で **youtube-only 以外**(Overlay / Terminal-Only)に切り替わった時、次フレームで明示的に refit → レイアウトが落ち着いてから正しい cols/rows を確定
  - 3 つのパスを共通化するため `refitActive()` ヘルパを導入
  - 結果: モード切替を何度繰り返してもターミナル幅は崩れない。既存 buffer に残った narrow wrap 済みの行は履歴のまま残るが、新しい出力は正常幅

---

## [0.15.10] — 2026-04-20

### Added
- **最小構成の DOM 広告スキップを復活**(v0.15.9 の撤去で凍結原因確定済のため、その上で安全版を作成)
  - スキップ方針:
    - `setInterval` は **3000ms**(旧 250ms から 12 倍遅く、プレイヤーがひと呼吸つける間隔に)
    - クリックは `el.click()` **1 回だけ**(旧 `aggressiveClick` の pointerdown / mousedown / pointerup / mouseup / click 連射は削除 — これが凍結の原因)
    - **`clickedThisAd` フラグ**で同じ広告中の連打を抑止。`ad-showing` クラスが外れた瞬間に flag リセットされ、次の広告はまた 1 回クリック
    - `MutationObserver` なし(pure interval で十分)
  - 効果: 5 秒後にスキップボタンが出る広告は**自動で 1 回クリック**して飛ぶ。skip 不可の短い広告はそのまま流れる
  - もし再び凍結が発生した場合は v0.15.9(初回 pause だけ)に戻すのが次の一手

---

## [0.15.9] — 2026-04-20 (diagnostic)

### Changed
- **DOM-level 広告スキップ(`setInterval` + `MutationObserver` + `aggressiveClick`)を一旦完全撤去**
  - 背景: v0.15.8 でネットワーク層 adblock を削除したにも関わらず、動画再生時に **main プロセスまで巻き込むフルフリーズ**(Cmd+Q も効かず OS レベル強制終了のみ)がユーザ側で再現確認
  - 残る唯一の ad-related コードパスは DOM スキップ(500ms ごとの `#movie_player.ad-showing` 監視 + 見つかると skip ボタンへの `aggressiveClick`)。`aggressiveClick` は pointerdown/mousedown/pointerup/mouseup/click を連射するため、YouTube 内部の state machine を激しく叩き、その応答が何らかの経路で main のイベントループに伝搬して詰まっている可能性が高い
  - この版では AD_STRIP_SCRIPT から skip 機能を丸ごと削除し、**初回 pause**(起動直後の `play` イベントで 1 回だけ `video.pause()`)のみ残す
  - トレードオフ: 広告は全長スキップされなくなる(プリロールを最後まで見る必要がある)。**フリーズが消えるかの切り分け用リリース**
- `pollPlayback` に re-entry ガードと 1 秒タイムアウトを追加(`Promise.race`)。executeJavaScript が resolve しないときでも main が詰まらない
- 設定変更時の `applyVideoFillToAllYoutubeFrames` 全フレーム再適用を、**`videoFillMode` が実際に変化した時のみ**に限定(v0.15.8 までは毎回走っていて、再生位置 URL 保存の度に執行されていた)

### Expected result
- ✅ フリーズが出なくなる → DOM スキップが真犯人確定 → v0.15.10 で**安全な最小実装の skip**(例: `click()` だけ、interval を 1000ms 以上、等)に置き換え
- ❌ まだ凍る → 別のコードパスが原因。attachYoutube から他のリスナ(did-frame-navigate 等)を順に外して再切り分け

---

## [0.15.8] — 2026-04-20

### Removed
- **ネットワーク層 adblock を完全撤去、DOM スキップ 1 本に統一**
  - v0.15.6 / v0.15.7 の再有効化試行で、`adsAndTrackingLists` → YouTube player 黒画面、`adsLists` → 広告再生時にアプリ全体フリーズが再現確認。Electron 32 + `@ghostery/adblocker-electron` + YouTube の組み合わせは webRequest 層の連携が根本的に安定せず、DevTools も開けない状態に入ることもあり配布形態として許容できない
  - 対応: `@ghostery/adblocker-electron` / `@ghostery/adblocker` 依存をアンインストール、`src/main/adBlock.ts` を削除、`Settings.adBlockEnabled` フィールド・`set-ad-block` action・IPC(`settings:set-ad-block`)・`settingsSetAdBlock` API・Options パネルの Ad Block チェックボックスも全削除
  - AD_STRIP_SCRIPT(DOM 監視 + 広告 skip)は `adBlockEnabled` のガードを外して **常に注入**。どの iframe 読み込みでも `#movie_player.ad-showing` を検知して即座にスキップボタンクリック or fast-forward
  - 既存 `settings.json` に `adBlockEnabled: true/false` が残っていても `validateAndNormalize` が未知フィールドとして落とすので互換性問題なし
  - テスト: 113 → 108(ad-block 関連 5 テスト削除)
  - main bundle 48.87 → 44.97 kB、renderer 422.26 → 421.58 kB(網羅的でもなくだいたい同等)

### Result
- 広告対策の最終形: **DOM 監視スキップのみ**。プリロール広告は一瞬(1 秒以下)映るがすぐ skip
- フリーズ/黒画面問題は根本解消(ネットワーク層の介入ゼロ)
- Options パネルがよりシンプルに(Transparency / Blur / Background color / Reset だけ)
- v1 に向けて adblock 機能は「後日 Electron 35+ にアップグレードしてから cosmetic filter 付きで再実装する」という位置付け

---

## [0.15.7] — 2026-04-20

### Fixed
- **Ad block を ON にすると YouTube が真っ黒になり、OFF にしても戻らない問題を修正**
  - 原因 1: v0.15.6 で使った `adsAndTrackingLists` が **ads + tracking/analytics** の両方を含む組み合わせで、YouTube player が初期化時に叩く analytics 系エンドポイント(stats.youtube.com 等)も遮断してしまい、player 初期化失敗 → 黒画面
  - 原因 2: トグル OFF した時の iframe reload が「同じ URL にもう一度アクセス」だけだったため、一度壊れた YouTube 状態(service worker cache 等)から復旧できず黒のまま
  - 対応 1: フィルタを `adsLists`(ads のみ)に変更。tracking / analytics 系はブロックしないので player 初期化は通常どおり完走
  - 対応 2: ad-block トグル時は iframe を**ホームページに強制遷移**(`https://www.youtube.com/`)。`youtube:reload` IPC に optional `url` 引数を追加、main 側で toggle 時は homepage URL を明示。通常の Cmd+R は引数なしで現在 URL のリロード維持
  - これで ON にしても player が動き続け、万が一再び黒画面が出ても OFF 切替で確実に復旧可能

---

## [0.15.6] — 2026-04-20

### Changed
- **`@ghostery/adblocker-electron` の network filter 層を再有効化**(v0.14.2 で bisect のため no-op 化していたもの)
  - 背景: v0.14.x のフリーズは最終的に CDP Fetch intercept が原因と確定し、それは v0.14.0 で削除済み。adblocker-electron の webRequest 連携自体は濡れ衣だった可能性が高いので復活させる
  - 実装: `src/main/adBlock.ts` を元の `ElectronBlocker.fromLists(fetch, adsAndTrackingLists, { loadCosmeticFilters: false, loadNetworkFilters: true })` に戻し、`setEnabled` で `enableBlockingInSession` / `disableBlockingInSession` をトグル
  - `INITIAL_SETTINGS.adBlockEnabled` を `true` に戻す(新規ユーザーは最初から有効)
  - cosmetic filter は Electron 35+ が必要(`session.registerPreloadScript`)なため引き続き無効、network 層のみ
  - Options パネルのトグルは今度こそ意味を持つ(ON / OFF で iframe reload + adblocker の enable/disable が走る、v0.7.0 の設計どおり)
  - 防御レイヤ構成(最終形):
    1. `adblocker-electron` network filter(googleads, doubleclick 等をネットワーク層で遮断)
    2. DOM スキップ(`#movie_player.ad-showing` → skip ボタンクリック or fast-forward)
  - v1 に向けての切り分け完了。使ってみて再びフリーズ/黒画面が出たら adblocker-electron が真犯人確定、その時は再無効化 + 代替手段を検討

### Fixed
- テスト: `adBlockEnabled` のデフォルト期待値を `false` → `true` に戻す(4 テスト修正、合計 113 のまま)

---

## [0.15.5] — 2026-04-20

### Changed
- **bold テキスト色を Cyberpunk cyan(`rgb(0, 221, 255)`)に固定**
  - 経緯: v0.13.0 で `brightWhite: rgb(0, 221, 255)` + `drawBoldTextInBrightColors: true` を組み合わせれば bold が cyan になると想定していたが、実際の xterm の挙動は **ANSI 色が付いた文字が bold の時に bright 変種に切り替える**だけで、**default foreground の bold(シェルプロンプトや見出し等)は通常 foreground の緑のまま**
  - 対応: `style.css` に `.xterm .xterm-bold { color: rgb(0, 221, 255) !important }` を追加。prompts など未着色な bold もすべてネオンシアンに
  - `brightWhite` のテーマ値(同色)はそのまま。ANSI bright-white が指定されたケースでも見た目が揃う

---

## [0.15.4] — 2026-04-20

### Removed
- **`inputTarget` 概念と `Cmd+\` (Toggle Input Target) ショートカットを削除**
  - 実運用でほぼ使われないことが判明。YouTube を操作したい時は `Cmd+1`(YouTube Only)で済む
  - `AppState.inputTarget` / `InputTarget` 型 / `toggle-input-target` action / 関連メニュー項目・テストを全削除
  - renderer の body class 処理(`input-terminal` / `input-youtube`)も削除
  - overlay モードの iframe inert は CSS `body.mode-overlay #youtube-iframe { pointer-events: none }` に簡略化。以前は `inputTarget === 'terminal'` でガードしていたが、現在 overlay なら常に inert
  - tests: 113(toggle-input-target の 4 テストを削除、ほかは合計維持)
  - 結果: アーキテクチャがシンプルに、overlay モードでの drag-drop は引き続き動作

---

## [0.15.3] — 2026-04-20

### Fixed
- **overlay モードでも drag-and-drop が効くように(`inputTarget` ベースの iframe inert 化)**
  - 真因: YouTube iframe は Chromium 上で **OOPIF(out-of-process iframe)**として動作しており、cursor が iframe 領域にある間の drag event は**親ドキュメントに届かず iframe のプロセスへ直接ルーティング**される。親側で `dragenter` を捕まえて `pointer-events: none` を後付けしようとする v0.15.1 の手口では、そもそも最初の event が来ないので発動せず
  - 対応: `body.mode-overlay.input-terminal #youtube-iframe { pointer-events: none }` を CSS に追加。overlay モード + `inputTarget === 'terminal'` の時点で iframe を完全に inert にしておき、drag event は必ず親の `#terminal-root` に届くようにする
  - renderer は `state.inputTarget` を見て body に `input-terminal` / `input-youtube` クラスを付与。既存の `toggle-input-target`(`Cmd+\`)で従来どおりトグル可能
  - 通常運用(overlay + terminal 入力)では drop OK / YouTube 直接クリックは不可 → YouTube 操作したい時は `Cmd+\` で inputTarget=youtube に切替、または `Cmd+K` で play/pause。どの道 play/pause は Cmd+K が一番速い
  - preload 側の drag-time pointer-events トグル(v0.15.1)は OOPIF ルーティングの都合で無効なので削除

---

## [0.15.2] — 2026-04-20

### Fixed
- **タイトルバー/信号機ボタンが消え、ウィンドウの移動・最大化ができなくなっていた regression を修正**
  - 原因: v0.15.0 で `BrowserWindow` に `transparent: true` を付けた。以前は子の `WebContentsView` 側に付いていたのでウィンドウ自体の chrome は無傷だったが、window そのものに付くと macOS がネイティブのタイトルバーを丸ごと外してしまう
  - 対応: `transparent: true` を削除。ターミナルの半透明は従来どおり CSS(`#terminal-root` の `rgba()` 背景 + `backdrop-filter`)で実現し、下には不透明な YouTube iframe があるため window 自体を透過させる必要はない
  - これでタイトルバー表示、ドラッグ移動、緑ボタン最大化、信号機ボタンすべて復活

---

## [0.15.1] — 2026-04-20

### Fixed
- **overlay モード(Cmd+2)でもドラッグ&ドロップが効くように**
  - 症状: terminal-only モード(Cmd+3)では drop 成功、overlay モードだと file が Finder に戻る
  - 原因: overlay モードでは YouTube iframe が `pointer-events: auto`(default)のまま。Chromium の drag hit-testing は「cross-origin iframe の領域内に cursor が入ると、上に重なっている div よりも iframe 自体を drop ターゲットに選ぶ」挙動があるため、terminal-root に向かうはずのドロップが iframe に奪われていた。iframe 側は file drop を受け付けないので OS が reject → バウンス
  - 対応: preload の drag 開始タイミング(`dragenter`)で iframe に `pointer-events: none` を一時付与、drop 時と cursor がウィンドウ外に出たとき(`dragleave` の `relatedTarget === null`)に解除。通常の再生/一時停止クリックには影響しない
  - 併せて診断ログ(`[youterm-dnd]`)は削除(実装が安定したため)

---

## [0.15.0] — 2026-04-20

### Changed (architecture flatten)
- **WebContentsView を廃止、terminal/index.html を BrowserWindow 直ロードに変更**
  - 背景: v0.14.6 以降 Finder からのドラッグ&ドロップを何度か実装試行したが、Electron 32 + macOS 上で `WebContentsView` の webContents に drag event が一切届かない挙動を確認(preload の初期化ログすら出ない)。v0.14.11 で root BrowserWindow にも preload を付けて両面対応したが依然として発火せず、routing が不確実
  - 対応: `WebContentsView` を完全に撤廃し、`BrowserWindow.webContents` に直接 `terminal/index.html` をロード。これで drag event の送信先が 1 つに固定され、preload も 1 つで完結
  - `WindowBundle` から `terminalView` を削除、全ての呼び出し元(`attachTabs` / `attachSettings` / `attachYoutube` / `modeController` / `shortcuts`)の引数を `WebContents` / `BrowserWindow.webContents` に変更
  - ルート `index.html`(空のシェル)と `src/preload/root.ts`(v0.14.11 で追加)は用途無しのため削除
  - `persist:terminal` セッション、`X-Frame-Options` / `frame-ancestors` 剥がし、`transparent: true`、preload(terminal.ts)、`contextIsolation` などの設定は BrowserWindow 側に移行

### Fixed
- **Finder からの drag-and-drop が動作するように**
  - flat architecture により drag event が確実に `win.webContents` に届く → terminal preload の `[youterm-dnd]` ログが DevTools Console(`Cmd+Alt+I`)で確認可能
  - drop payload は新 IPC `dnd:drop` で main へ、`tabsController.getState().activeId` の PTY へ書き込み
  - 複数ファイル同時ドロップはスペース区切りでシェルクォート、末尾空白付き

### Notes
- v0.14.x シリーズの DnD 試行錯誤(v0.14.6–v0.14.11)と DevTools ルーティング修正(v0.14.9)はこの flat 化で最終解消
- 診断ログ(`[youterm-dnd]`)はユーザー確認が取れ次第、次リリースで削除予定

---

## [0.14.11] — 2026-04-20

### Fixed
- **ドラッグ&ドロップが全く反応しない問題の根本解消 — root BrowserWindow にも preload を付与**
  - 原因の確定: 前バージョンまでは drag-and-drop の handler を WebContentsView(terminal)側の preload にしか付けていなかった。が、**Electron 32 + macOS では native の Finder drop が親 BrowserWindow の root webContents に飛ぶ**ので、子の WebContentsView では `dragenter` すら発火しない(ユーザーの v0.14.10 テストで Console に一切ログが出なかったことで確定)
  - 対応: 新規 preload `src/preload/root.ts` を追加し、**root BrowserWindow の `webPreferences.preload` に設定**。同じ capture-phase / preventDefault / `webUtils.getPathForFile` / shell quote ロジックを持つ
  - drop 後は新規 IPC `dnd:drop` でメインに payload(シェルエスケープ済み文字列)を送信。main 側は `tabsController.getState().activeId` のタブの PTY に `write` する
  - terminal 側 preload の drop handler は残しているが、送信先を `dnd:drop` に一本化(どちらの preload が drop を受けても同じ経路)
  - `electron.vite.config.ts` の preload エントリに `root` を追加、ビルドで `out/preload/root.js` が出力される
  - 診断ログ(`[youterm-dnd]` / `[youterm-dnd-root]`)は引き続き有効。root 側は **BrowserWindow root の DevTools**(`Cmd+Alt+Shift+I`)で観測、terminal 側は `Cmd+Alt+I` で観測

---

## [0.14.10] — 2026-04-20 (diagnostic)

### Added
- **preload に drag-and-drop の診断ログ**(`[youterm-dnd]`)
  - `preload loaded` — preload 自体が読み込まれたか
  - `first dragover, types: [...]` — drag 開始時に dataTransfer の type に `Files` が含まれるか
  - `drop fired, files: N, activeTabId: ID` — drop 時点でファイル数と active tab が取れているか
  - `resolved path: ...` — `webUtils.getPathForFile` の返り値
  - `sending pty:write ...` — IPC 送信時のログ
  - DevTools Console を **top フレーム**に切り替えて(右上の frame 切替 selector)観測。YouTube iframe 側のログ(`about:blank` 由来)とは別モノ
- 問題切り分けが済み次第、次リリースで削除する見込み

---

## [0.14.9] — 2026-04-20

### Changed
- **DevTools ショートカットを WebContentsView に正しく向ける**
  - 従来は `role: 'toggleDevTools'` を使っていたため、Cmd+Alt+I で開くのが BrowserWindow のルート webContents(空の index.html)で、肝心の terminal/YouTube 側が見えなかった
  - Menu を明示 handler に置き換え:
    - `Cmd+Alt+I` → terminalView.webContents の DevTools を開閉(主に使う方)
    - `Cmd+Alt+Shift+I` → 親 BrowserWindow のルート webContents 用(滅多に使わないが残す)
  - どちらも `mode: 'detach'` で別ウィンドウ化 — ターミナルを縮めずに読める
  - ドラッグ&ドロップなど renderer / preload 側のデバッグ時に必須

---

## [0.14.8] — 2026-04-20

### Fixed
- **ドラッグ&ドロップが依然として効かず、ファイルが元の位置に戻る問題を修正**
  - 症状: Finder からファイルをドラッグしてアプリ上でドロップしても、macOS が「受付先無し」と判定してアニメーションで元の位置に戻される(= dragover で `preventDefault` が一度も走っていない状態)
  - 原因: ハンドラを renderer の async な `init()` 内で登録していた。preload ではなく renderer main.ts に書いていたため、`settingsGetInitial` などの await チェーンの後で `document.addEventListener` が走る。DOM イベントを受ける前に init() が完了していれば大丈夫だが、init()の完了タイミングとユーザーの初回ドロップがぶつかるとハンドラが未登録の状態で Chromium のデフォルト(rejected)が勝ってしまう。加えて、WebContentsView を使っていると event routing によっては root BrowserWindow 側に drop が漏れる可能性もある
  - 対応1: drag-and-drop のハンドラ一式を **preload に移動**。preload は `document_start` 段階で走るので DOM への `addEventListener` が renderer の JS 実行より確実に早い
  - 対応2: preload 内で **`tabs:state` IPC を直接購読**して `activeTabId` を保持 → drop 時に contextBridge を経由せず直接 `ipcRenderer.send('pty:write', ...)` で書き込み。`File` オブジェクトも preload 内で `webUtils.getPathForFile` に渡すのでブリッジ跨ぎの懸念がゼロ
  - 対応3: 安全網として main 側で `win.webContents` と `terminalView.webContents` の両方に `will-navigate` リスナを追加し、`file://` への navigation を `preventDefault`。万一ドロップが preload の capture を抜けても、誤って page が差し替わることは無い

---

## [0.14.7] — 2026-04-20

### Fixed
- **v0.14.6 のドラッグ&ドロップが効かなかった bug を修正**
  - 原因: `#terminal-inner` に bubble phase で handler を付けていたため、Chromium が `file://` ナビゲーションの default action を実行する方が先に回ってしまい、drop event が届く前にレンダラが自己ナビゲートしてドロップが無効化されていた。さらに handler の冒頭で tabsState 等の validity check を return していたため、validity で弾かれた dragover では preventDefault すら呼ばれず、drop event そのものが発火しないケースもあった
  - 対応: `document` レベル(`dragenter` / `dragover` / `drop`)に **capture phase**(`{ useCapture: true }` 相当の第三引数 `true`)でリスナを付与。handler の最初に必ず `preventDefault()` を呼び、そのあとで「files が無い」「tabsState 未初期化」等のスキップ判定を行うように順序を変更
  - 結果: Finder からのドラッグはアプリ内のどこにドロップしてもアクティブタブの PTY に書き込まれる(overlay / terminal-only 時は視覚的に見える。youtube-only 時は見えないが書き込みはされるので、モード切替後に確認できる)

---

## [0.14.6] — 2026-04-20

### Added
- **Finder からのドラッグ&ドロップでパスを貼り付け**(macOS Terminal.app と同じ仕様)
  - Finder のファイル/フォルダをターミナル領域(`#terminal-inner`)にドロップすると、アクティブタブの PTY に**シェル安全にクォートしたフルパス**が書き込まれる
  - 複数アイテムを同時にドロップすると、スペース区切りで連結。末尾に空白を 1 つ付け、続けてフラグや別のパスを入力しやすく
  - クォート方式: シングルクォート囲み、埋め込みのシングルクォートは `'\''` で退避(POSIX 標準パターン)
  - dragover では `Files` タイプのドラッグだけ `preventDefault` + `dropEffect='copy'` にして、テキストや URL のドラッグは無害に無視
- `preload/terminal.ts` に `webUtils.getPathForFile(file)` を露出する `youtermAPI.getPathForFile()` を追加(Electron 32+ の公式 API。従来の `File.path` は contextIsolation 下では使えない)

---

## [0.14.5] — 2026-04-20

### Fixed
- **v0.14.4 で初回タブの splash + shell プロンプトが消えて入力不能になる regression を修正**
  - 原因: `webContents.on('did-start-loading', …)` で `readyTabs` と `pendingByTab` をクリアしていたが、この event は YouTube iframe が起動時に自前の URL へ遷移するタイミングでも発火する。結果として spawnFor で既に積まれていた **splash + 初期 zsh プロンプトが iframe navigation のたびに全消去** → runtime-ready 受信時の flush は空 → ターミナルに何も出ず、その状態だと xterm が正しく focus を受け取れず入力もできなく見える
  - 対応: `did-start-loading` リスナーを削除。Cmd+Shift+R の renderer reload ケースは、fresh renderer が `ensureRuntime` 後に改めて `terminal:runtime-ready` を送ってくる。`readyTabs` に既に同 ID があっても `add` は no-op で害なし、そのあとの pty 出力は新しい xterm に直送される

### Required behavior
- Cmd+T 新規タブ → 必ず splash が表示、splash の下でコマンド入力可能
- アプリ終了 → 再起動 → 残っていた全タブで splash が表示、コマンド入力可能

---

## [0.14.4] — 2026-04-20

### Fixed
- **Cmd+T 新規タブのスプラッシュ表示を、per-tab の runtime-ready シグナル方式に切り替え**(v0.14.3 の順序変更では直らなかった)
  - 原因: `apply` → `spawnFor` の順にしても、`tabs:state` と `pty:data` が別チャネルで送られるため renderer 側で `ensureRuntime` が完了する前に splash が到達するタイミングが残っていた
  - 対応: main 側に **per-tab の送信バッファ**(`pendingByTab` + `readyTabs`)を用意。splash と初期の shell 出力はすべて該当タブの buffer に積み、renderer が該当タブの xterm を作り終えた瞬間に送ってくる **`terminal:runtime-ready` シグナル**を受けて初めて flush → その後の pty 出力は直通
  - renderer `ensureRuntime` 内で `window.youtermAPI.terminalRuntimeReady(tabId)` を呼ぶよう変更。従来のグローバル `terminal:ready` invoke は廃止
  - Cmd+Shift+R(Hard Reload)での renderer 再読み込み時は `did-start-loading` で ready 集合とバッファを両方クリア → 再初期化後のタブがまた splash を受け取れる

---

## [0.14.3] — 2026-04-20

### Fixed
- **Cmd+T で開いた新規タブにもスプラッシュ(ロゴ/バージョン/名前)が出るように**
  - 原因: `tabsController.newTab()` が `spawnFor(id)` を先に呼んでいたため、onSpawn 経由の splash(`pty:data`)が renderer に届いた時点では `tabs:state` がまだ broadcast されておらず、対応する xterm runtime が存在せず → `runtimes.get(id)` が undefined を返して **データが丸ごと破棄**されていた
  - 対応: `newTab()` 内の順序を入れ替え、まず `apply({type: 'new-tab', id})` で state を更新・broadcast → renderer が `ensureRuntime(id)` で xterm を作成 → そのあとで `spawnFor(id)` が走り splash IPC が届く、という順序に修正
  - 初回起動時のスプラッシュ(`pendingSplashTabs` + `terminal:ready`)は従来どおり動作

---

## [0.14.2] — 2026-04-20

### Changed (bisect release)
- **フリーズ原因切り分けのため、広告ブロックを完全に無効化した状態で配布**
  - v0.14.1 で fetch/XHR 差し替え・CDP 利用を消しても **動画クリック → 広告ロード時に Cmd+Q / Cmd+2 まで効かなくなる**フリーズが継続。残る容疑者は `@ghostery/adblocker-electron`(main プロセスの `session.webRequest` に登録される network filter)のみ
  - 判定のため、この版では `createAdBlockController` を no-op 化(`enableBlockingInSession` を呼ばない)
  - **期待結果**: v0.14.2 でフリーズが消えるなら adblocker-electron の webRequest 連携が真犯人。フリーズが継続するなら別経路を追う
  - 広告は素通しになるが、DOM 監視スキップ(`#movie_player.ad-showing` を検知して skip ボタンクリック or 末尾シーク)は残しているため、広告に差し掛かっても即飛ばせる想定
- **`adBlockEnabled` のデフォルトを `false` に変更**
  - 新規ユーザー・設定リセット時のデフォルト。既存の `settings.json` で `true` だった場合もどの道 setEnabled が no-op なので挙動に差は無いが、UI 表示上は「OFF」で揃う

### Fixed
- **Cmd+Q が必ず効くようにタイムアウトガードを追加**(`before-quit` 内)
  - `tabsBridge.tabsController.captureCwds()` と `youtubeBridge.flushPlayback()` をそれぞれ **500ms タイムアウト**で Promise.race。iframe や lsof が詰まっても自動で打ち切り → `app.quit()` に進む
  - v0.13.x / v0.14.x で「iframe が広告ロードで詰まる → flushPlayback の `frame.executeJavaScript` が resolve せず before-quit が完走しない」経路で Cmd+Q が死ぬ現象を解消

---

## [0.14.1] — 2026-04-20

### Removed
- **fetch / XHR モンキーパッチと CDP debugger 利用を完全削除**(3 層防御 → 2 層防御)
  - 背景: v0.14.0 で CDP Fetch intercept を外した結果、YouTube `/youtubei/v1/player` 応答は生のまま in-page 側の `fetch` wrapper に到達するように。wrapper は `new Response(JSON.stringify(data), { headers: response.headers })` で再構築していたが、元の `Content-Encoding: gzip` ヘッダや不整合な `Content-Length` をそのまま引き継ぐため player が応答を正しく解釈できず**起動時に黒画面**になる regression
  - 方針転換: 「サーバ応答を client で捏造する」アプローチは fragile すぎるため放棄。`AD_STRIP_SCRIPT` から `window.fetch` / `XMLHttpRequest.prototype.open,send` の wrap を全削除
  - あわせて CDP `Page.addScriptToEvaluateOnNewDocument` による document-start 注入(`installAdStripViaCDP` / `uninstallAdStripViaCDP`)も削除 — 残された DOM スキップ/初回 pause 処理は `did-frame-finish-load` 経由の注入で十分足りる
  - `terminalView.webContents.debugger` の attach/detach も一切なくなり、CDP 依存ゼロに
  - Cmd+R(Reload YouTube)は iframe リロード送信のみに簡略化
- 現時点の広告ブロック構成(**2 層**):
  1. `@ghostery/adblocker-electron` による network filter(別プロセス、安全)
  2. DOM 監視 + `#movie_player.ad-showing` 検知 → skip ボタンクリック / 末尾シーク(既存)
- トレードオフ: response 書き換えがなくなったため「再生開始直後の 1〜数秒、広告ストリームが差し込まれる」可能性は残る。ただし DOM スキップで即座に飛ばせるので実運用では体感差は小さい。反面、CDP 由来のフリーズ・黒画面を完全に排除

---

## [0.14.0] — 2026-04-20

### Removed
- **CDP `Fetch.enable` レスポンスインターセプト層を削除**(4 層防御 → 3 層防御)
  - 背景: CDP Fetch intercept は network 層で YouTube の `/youtubei/v1/player*` レスポンスを介入する強力な層だったが、ハンドラが何らかの理由で continueResponse / fulfillRequest を呼び損ねると **request が network 層で paused 状態のまま停止** → YouTube が response 待ちでフリーズ → 連鎖で main プロセスの IPC も詰まり、Cmd+R も Cmd+Q も OS 強制終了しか手段がなくなる致命的状態に
  - さらに **saved URL が freeze トリガの動画だと、再起動 → URL 復元 → 即フリーズの無限ループ**になり、`settings.json` を手動削除するしか復旧できなかった
  - 対応: CDP Fetch intercept 層を完全削除(関連: `handleFetchRequestPaused` / `installFetchIntercept` / `uninstallFetchIntercept` / `stripAdsFromBody` 等)。残り 3 層で広告ブロック継続:
    1. `@ghostery/adblocker-electron` network filter(別プロセスで動作、安全)
    2. CDP `Page.addScriptToEvaluateOnNewDocument` による fetch/XHR monkey-patch(in-page script)
    3. `did-frame-finish-load` での同 script 注入(フォールバック)
    4. DOM 監視 + 広告スキップ(最終防衛)
  - トレードオフ: CDP Fetch が担っていた「初回ロード時の絶対確実な player API intercept」が script injection に依存する形になり、タイミングによっては最初の数秒ほど広告が見える可能性。ただしフリーズリスクが消えるほうがはるかに価値高い
  - Cmd+R での広告ブロック再セットアップは引き続き動作(`installAdStripViaCDP` のみ再実行)

### Recovery
- 以前 CDP Fetch intercept のバグで起動不能に陥った場合、以下のコマンドで `settings.json` を削除すると homepage からクリーン起動できます:
  ```
  rm "$HOME/Library/Application Support/youterm/settings.json"
  ```

---

## [0.13.2] — 2026-04-19

### Fixed
- **v0.13.1 で YouTube 画面が真っ暗になる regression を修正**
  - 原因: v0.13.1 の `handleFetchRequestPaused` に追加した `try/finally` safeguard が想定外の副作用を起こし、一部レスポンスが正常に完了しなくなっていた(fulfillRequest が進行中に finally が別の continueResponse を呼び得る等のレースの可能性)
  - 対応: v0.13.0 のシンプルな try/catch 構造に戻す。ただし v0.13.1 で追加した **3 秒タイムアウト**(`Promise.race` で `getResponseBody` をタイムアウトさせる)は**維持** — フリーズ防止の主要防衛線
  - v0.13.1 で追加した **Cmd+R による広告ブロック完全再セットアップ**(`YoutubeBridge.reloadAdBlockAndIframe()`)も**維持** — 万一の復旧手段として有効

---

## [0.13.1] — 2026-04-19

### Fixed
- **広告ブロックのエラーでアプリが完全フリーズする問題を修正**
  - 原因: CDP `Fetch.requestPaused` ハンドラが途中で失敗した際に `continueResponse` / `fulfillRequest` が呼ばれず、request が network 層で paused 状態のまま停止 → YouTube ページが response 待ちで固まり、連鎖で main プロセスの IPC も詰まって Cmd+R も Cmd+Q も効かない状態になっていた
  - 対応1: ハンドラを `try/finally` で完全防御 + `getResponseBody` に 3 秒タイムアウト。何があっても最終的に `continueResponse` を呼び request を解放
  - 対応2: `Cmd+R`(Reload YouTube)で**広告ブロック CDP を完全再セットアップ**するフローを追加。Fetch.enable uninstall → Script uninstall → Script install → Fetch.enable install → iframe reload。詰まった CDP 状態もクリーンにリカバー可能
  - 新規: `YoutubeBridge.reloadAdBlockAndIframe()` を露出、shortcuts.ts の Cmd+R がこれを使用

---

## [0.13.0] — 2026-04-19

### Added
- **Cyberpunk Neon カラーパレット** — xterm のテーマを 16 ANSI 色フルセット(+選択背景、カーソルアクセント)に拡張。黒背景に映える蛍光カラー
  - foreground: rgb(40, 254, 20)(緑)
  - red: rgb(255, 51, 102)(ネオンピンク)
  - green: rgb(40, 254, 20)
  - yellow: rgb(255, 215, 0)(ゴールド)
  - blue: rgb(0, 162, 255)(電光ブルー)
  - magenta: rgb(255, 0, 255)(ネオンマゼンタ)
  - cyan: rgb(0, 221, 255)
  - white: rgb(224, 224, 224)
  - bright 系は各色を更に明るく(+brightWhite のみ既存の cyan を維持、bold テキスト色として)
  - selection background: 緑の半透明
  - ls / git status / syntax highlighting / tmux / claude code の出力が色豊かに見える

---

## [0.12.4] — 2026-04-19

### Fixed
- **起動直後に `Cmd+1` を押しても YouTube モードに切り替わらない bug を修正**
  - 原因: `settings.lastMode === 'youtube-only'` のケースで modeController が youtube-only で初期化され、`setTimeout(broadcast, 0)` で `state:changed` 送信するが、renderer の init() async 完了前で `onStateChanged` ハンドラ未登録 → メッセージ喪失 → renderer の body クラス未設定 → CSS 未適用でビジュアル上 overlay のまま
  - ユーザーが Cmd+1 押しても reducer が「既に youtube-only」と判定して no-op → broadcast 無し → renderer 同じ状態
  - Cmd+2 押すと状態変化で broadcast 発火、その後は正常
  - 対応: `state:get-initial` invoke handler を追加し、renderer init() で `settings:get-initial` / `tabs:get-initial` と同じパターンで明示 pull。push 依存を解消

---

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
