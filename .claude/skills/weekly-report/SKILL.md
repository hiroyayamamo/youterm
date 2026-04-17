---
name: weekly-report
description: logs/から直近1週間のエントリを集約して週次レポートを生成する
user_invocable: true
---

スキル名: /weekly-report
説明: logs/配下の全ファイルから直近1週間のエントリを集約し、週次レポートを生成する
前提: logs/に今週のエントリが存在すること

手順:
1. 今週の日付範囲を特定する（月曜〜日曜）
2. 以下のファイルから今週のエントリを抽出する:
   - logs/meeting_decisions.md
   - logs/scope_log.md
   - logs/budget_log.md
   - logs/tech_decisions_log.md
   - logs/stakeholders.md
   - logs/contract_log.md
3. reports/weekly-report-TEMPLATE.md を読み込む
4. テンプレートに従ってレポートを生成する:
   - サマリ: 最も重要な進捗・決定事項を3行以内で
   - 決定事項: meeting_decisions.mdから転記
   - スコープ変更: scope_log.mdから転記。変更なしの場合は「変更なし」と明記
   - 予算: budget_log.mdから転記
   - リスク・課題: 各ログから未解決の項目を抽出
   - 来週の予定: 決定事項から導出されるアクションアイテム
5. reports/ に `weekly_{YYYYMMDD}.md`（月曜の日付）として保存する
6. /update-index スキルでreports/README.mdを更新する
7. 生成結果を簡潔に報告する

## 内部向け/外部向けの切り替え
- デフォルトは内部向け（全情報を含む）
- 「外部向けで」と指示された場合、CLAUDE.mdの内部→外部変換ルールに従ってフィルタする
- 外部向けの場合、ファイル名を `weekly_{YYYYMMDD}_external.md` とする

## 今週のエントリがない場合
- 「今週の更新はありません」レポートを生成する（空欄にしない）
- 前週からの持ち越し事項があれば「継続」として記載する

## なぜこのスキルが必要か
週次レポート作成は毎週発生する定型業務だが、6つのログファイルを横断して集約する作業は手間がかかり、抽出漏れが起きやすい。スキル化することで5分以内に完了し、漏れを防ぐ。
