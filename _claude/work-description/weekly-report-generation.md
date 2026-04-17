# タスク定義書: 週次レポート生成

## 概要
logs/配下の各ファイルから直近1週間のエントリを集約し、週次レポートを生成する。

## トリガー
- 毎週金曜（または定例MTG前日）
- PMが「今週のレポートを作って」と指示した時

## 入力
- logs/meeting_decisions.md（今週の決定事項）
- logs/scope_log.md（今週のスコープ変更）
- logs/budget_log.md（今週の予算変動）
- logs/tech_decisions_log.md（今週の技術判断）
- logs/contract_log.md（今週の契約動向）

## 手順
1. 各ログファイルから今週のエントリ（日付がYYYY-MM-DD形式で今週の月曜〜日曜に該当）を抽出
2. reports/weekly-report-TEMPLATE.md に従ってレポートを作成
3. reports/ に `weekly_{YYYYMMDD}.md` として保存
4. /update-index スキルでreports/README.mdを更新

## 判断ポイント
- **内部向け/外部向けの判定**: デフォルトは内部向け。外部向けに変換する場合はCLAUDE.mdの変換ルールに従う
- **変更なしの週**: 「変更なし」と明記する。空欄にしない（「書き忘れ」と区別するため）
- **未解決事項の扱い**: 前週から持ち越しのリスク・課題は「継続」ステータスで再掲載

## 出力
- reports/weekly_{YYYYMMDD}.md
- reports/README.md の更新

## 対応スキル
- /weekly-report（レポート生成自動化）
- /update-index（インデックス更新）
