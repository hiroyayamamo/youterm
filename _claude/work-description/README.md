# work-description/ — タスク定義書

各業務タスクの手順と目的を明文化したもの。1タスク1ファイル。
Claude Codeがタスクの全体像を把握したり、後からどんな業務をやっていたか振り返るときに使う。

## 置くもの
- 各業務タスクの定義書（手順・目的・入出力・判断ポイント）

## 命名規則
```
{タスク名}.md

例:
external-meeting-prep.md              — 外部定例の議事録準備
data-classification.md                — データの整理・分類
weekly-report-generation.md           — 週次レポート生成
```

## テンプレート
```markdown
# {タスク名}

## 目的
{なぜこのタスクが必要か}

## 入力
- {どこから何を取得するか}

## 手順
1. {ステップ1}
2. {ステップ2}
3. ...

## 出力
- {どこに何を出すか}

## 判断ポイント
- {人間が判断すべきポイント}

## 使用スキル
- /skill-name
```

## Index
| ファイル | 概要 | 対応スキル |
|---|---|---|
| meeting-to-log.md | 議事録からのログ抽出 | /extract-decisions, /add-log |
| weekly-report-generation.md | 週次レポート生成 | /weekly-report, /update-index |
| ai-doc-review.md | AI生成ドキュメントのレビュー | /check-ai-doc, /add-log |

## 運用ルール
- スキルを作成したときに対応するタスク定義も作る
- 手順が変わったら更新する（古い定義を放置しない）
