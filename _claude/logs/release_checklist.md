# youterm リリースチェックリスト

初版: 2026-04-20

## 方針

- **配布(他人に渡す)**: 今回は不要。**GitHub 公開のみ**。
  - electron-builder + Apple Developer 署名 + notarization + DMG 作成は **やらない**。
- **自分用 .app 作成**: やる。
  - electron-builder で `.app` を吐き、`/Applications` に配置 → Dock / Launchpad から起動。
  - **署名は skip**。初回のみ Gatekeeper 警告を right-click → Open でバイパス。
  - Dock に追加すれば普通のアプリ感覚で起動、閉じても dev サーバ不要。
- **公開リポジトリ**: README に「自分でビルドして .app にする方法」を書く。
  - 他人も `git clone && npm install && npm run package` で自分の `.app` を作れる。
  - README と LICENSE を用意。

## 実行順序(タスク #117–#120)

- [x] **#117** electron-builder 導入 → `.app` が吐けるようにする(2026-04-21, v0.15.24)
- [x] **#118** アイコン(`.icns`) を用意 → `.app` の Dock アイコン(2026-04-21, v0.15.25)
- [x] **#119** README + LICENSE + `package.json` メタ情報の整備(2026-04-21, v0.15.29)
- [ ] **#120** `.gitignore` 監査 + 不要ファイル削除

## 備考

- electron-builder は入れる(自分用)、署名は skip がベストバランス。
- このチェックリストの番号 (#117–#120) は過去セッションで言及されたもの。GitHub issue としては未登録(remote 未設定)。
