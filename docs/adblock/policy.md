# youterm 広告対策 方針 & 現状

最終更新: 2026-04-20(v0.15.19 時点)

## 基本方針

**「ユーザが手動でできる操作の自動化」に徹する**。広告配信の遮断や DOM の大幅改変は行わない。

理由:
- 個人利用 + GitHub 公開がスコープであり、**広告を止める**ことより**視聴体験の邪魔を減らす**ことが目的
- ネットワーク層ブロック(`adblocker-electron` 系)は過去 v0.15.6〜8 でアプリ全体の freeze を誘発した実績あり、**再導入しない**
- DOM 大改変は YouTube 側の UI 変更ごとに破綻リスク → **メンテ負債を抱えたくない**
- YouTube ToS のグレーゾーンで、**薄いグレー**に留めることで GitHub 公開時の DMCA リスクを最小化

---

## 現状の施策(v0.15.19)

全て DOM 層。実装は `src/main/ipc.ts` の `AD_STRIP_SCRIPT`。

| 機能 | 実装 | 頻度 |
|---|---|---|
| スキップボタン自動クリック | `#movie_player` が `ad-showing` 状態なら `.ytp-ad-skip-button` 系を 1 回だけ `click()` | 3 秒間隔 |
| 広告ブロッカー警告ポップアップ自動閉じ | `ytd-enforcement-message-view-model` 基点で親 `tp-yt-paper-dialog` + `tp-yt-iron-overlay-backdrop` を削除、body スクロールロック解除、停止中なら `video.play()` 再開 | 3 秒間隔 |
| 起動時の自動再生抑止 | iframe 生成後、最初の play イベントで 1 回だけ `pause()` | 初回のみ |

### やらないこと
- 広告リクエストの URL ブロック
- フィルタリスト適用
- 偽の広告 response を返す
- MutationObserver を使った DOM 監視(過負荷対策)
- 広告のプリエンプティブな除去(視界に入る前の削除)

---

## YouTube ToS 的スタンス

結論: **グレーだが極めて浅いグレー**。

- **黒寄り**: ネットワーク層の広告ブロック(従来型 adblocker)
- **濃いグレー**: DOM を大幅改変して広告を消す、フィルタリスト適用
- ➜ **薄いグレー(今の youterm)**: skip ボタンを自動クリック、警告ポップアップを閉じる
- **白**: 何もしない

「スキップボタン押す」は **ユーザが手動でやれる行為** の自動化。YouTube Premium 以外のユーザは 5 秒後に誰でもスキップできる操作。これをプログラムに代行させている、という立て付け。

### 実際のリスク評価

| リスク | 程度 | 備考 |
|---|---|---|
| アカウント凍結 | ほぼゼロ | 過去事例なし。YouTube は凍結より Premium 誘導を優先 |
| 個人使用での法的問題 | ほぼゼロ | — |
| **GitHub 公開時の DMCA 取り下げ** | **唯一の現実的リスク** | youtube-dl 事件(2020)の前例あり、SponsorBlock は生存 |
| App Store 審査 | 通らない可能性高 | ただし配布しないので無関係 |

---

## GitHub 公開時の運用ルール

DMCA リスクを下げる書き方:

- ✘ リポジトリ名・description に **「adblock」「ad blocker」「YouTube ad blocker」を含めない**
  - これらは Google / RIAA / YouTube のサーベイで定期的に拾われるキーワード
- ○ 前面の説明は **「Terminal + YouTube combined workspace」** とプロダクトのコンセプトで押す
- ○ adblock 的機能は README の機能一覧で **"auto-skip ads when possible"** 程度の控えめな書き方に留める
- ✘ 「YouTube のリバースエンジニアリング」「ToS 違反」を**連想させる単語は避ける**

---

## 今後の選択肢(グレーを濃くしたくなった場合)

| 選択肢 | 効果 | リスク/コスト |
|---|---|---|
| 現状維持 + セレクタメンテ | 広告は流れるがポップアップは消える | 低(推奨) |
| フィルタリスト復活(v0.15.6 相当) | 広告リクエスト自体を遮断 | 過去に freeze 誘発、再発リスクあり |
| scriptlet 注入(uBO 的) | ad verification スクリプトを騙す | 実装・メンテ重い、ToS 黒寄り |
| 埋め込みプレイヤーへの切替 | 広告検知ゆるい | UI が大幅変化、youterm の体験が崩れる |

**推奨: 現状維持 + セレクタのメンテだけ継続**。YouTube 側の UI 変更ごとに `ytd-enforcement-message-view-model` 等のセレクタが変わる可能性だけ監視。

---

## 関連コミット / 履歴

- `v0.15.6` (c708422) — `adblocker-electron` 再導入 → 以降 freeze 問題
- `v0.15.7` (6de0053) — `adsAndTrackingLists` → `adsLists` に切替、homepage reset 追加
- `v0.15.8` (d9a6579) — network-layer adblock 完全撤去
- `v0.15.9` (abdae28) — DOM ad-skip も一度撤去(診断目的)
- `v0.15.10` (19a7154) — DOM ad-skip を 3 秒間隔の minimal 版で再導入
- `v0.15.19` (本リリース) — enforcement popup の自動解除を追加
