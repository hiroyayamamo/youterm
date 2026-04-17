スキル名: /linear-setup
説明:   Linear APIの接続状態を確認し、未接続なら初回セットアップを案内する
前提:   なし（初回利用を想定）
手順:
  1. 環境変数 LINEAR_API_KEY の存在を確認（Bashで `echo $LINEAR_API_KEY` を実行）
  2. 値がある → Step: 接続テストへ進む
  3. 値がない → Step: APIキー取得案内を表示

## APIキー取得案内（未設定時に表示）

以下をそのままユーザーに表示する:

---

**Linear APIキーを設定します。以下の手順で進めてください。**

### 1. APIキーを発行
- ブラウザで Linear を開く
- 左下の自分のアイコン → **Settings**
- 左メニュー **My Account** セクションの **API** → **Personal API keys**
- 「Create key」でラベルを入力（例: `claude-code`）して発行
- 表示されたキーをコピー（この画面を閉じると二度と表示されない）

### 2. 環境変数に設定
シェルの設定ファイルに追記:
```bash
echo 'export LINEAR_API_KEY=lin_api_xxxxxxxxxx' >> ~/.zshrc
source ~/.zshrc
```
※ bashの場合は `~/.bashrc` に読み替え

### 3. Claude Codeを再起動
環境変数を読み込むためにClaude Codeを再起動し、もう一度 `/linear-setup` を実行してください。

---

（案内を表示したらここで終了。テストは再実行時に行う）

## 接続テスト（APIキーが設定済みの場合）

Bashで以下を実行:
```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{"query": "{ viewer { name email } teams { nodes { name key } } projects(first: 50) { nodes { name state teams { nodes { name key } } } } }"}'
```

レスポンスを解析:
- `data.viewer` が返る → 接続成功。以下のフォーマットで出力
- `errors` が返る → エラー内容に応じてトラブルシューティングを表示

## 接続成功時の出力フォーマット
```
Linear接続: OK
ユーザー: {name} ({email})
チーム:
  - {チーム名} ({キー})
  - ...
プロジェクト:
  - {プロジェクト名} [{状態}] — {チーム名}
  - ...
```

## トラブルシューティング（テスト失敗時に該当するものを表示）

| エラー | 原因 | 対処 |
|--------|------|------|
| `Authentication required` | APIキーが無効または期限切れ | Linear Settings > API で新しいキーを発行し直す |
| `Forbidden` | キーのスコープ不足 | Personal API keyはフルアクセス。Organization API keyの場合はスコープを確認 |
| `curl: command not found` | curlが未インストール | `brew install curl`（Mac）または `apt install curl`（Linux） |
| 環境変数が空 | シェル再起動していない | `source ~/.zshrc` を実行、またはターミナルを開き直す |

## なぜこのスキルが必要か
PMナレッジテンプレートを新しいプロジェクトに適用する際、進捗管理にLinearを使うケースがある。
テンプレートを渡された人が自力でLinear接続をセットアップできるよう、
接続チェック → 未接続時のガイド → 確認までを1コマンドで完結させる。

## 設計判断
- MCP（OAuth）ではなくAPIキー直接利用を採用。理由: OAuth認証フローがブラックボックスで「Needs authentication」から先に進めないケースがあり、テンプレート利用者が自力でデバッグできない。APIキーなら発行・設定・失効を自分で管理でき、手順が明確。
- 認証情報は環境変数で管理。.envファイルやコード内ハードコードは避ける。
