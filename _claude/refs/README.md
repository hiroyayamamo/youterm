# refs/ — 参照資料

> ログエントリから参照される詳細資料・分析結果を格納する。
> ログ側に `→ refs/ファイル名` でリンクを張る。

## 運用ルール
- ログに書くには長すぎる詳細（比較表、分析、調査結果）をここに置く
- 必ずログ側からリンクする。孤立ファイルを作らない
- ファイル名: `YYYY-MM-DD_テーマ.md`

## Index
| ファイル | 概要 | リンク元 |
|---|---|---|
| pm_playbook.md | 合意管理、変更管理、スコープ変更判断、除外項目対処、AI生成ドキュメント対応（実例付きプロトコル・配置バグ検出・バージョン劣化パターン）、CTO着任前防衛、体制変更対処、書面回避対処、エビデンス管理、契約タイミング、**ガバナンス・ライフサイクル（緩→硬化→成熟）**、**準委任契約チェックリスト（10セクション・欠落時の結果付き）**、**3ラウンドゲートシステム（G0-G3+R1-R5自動ルール）**、4観点レビュー、プロトタイプ→本番ボトルネック、受入期間通知、ベンチャーリスク評価、Reverse Acqui-hireパターン | CLAUDE.md鉄則9,10,14,16 |
| pm-document-guideline.md | PMドキュメント運用ガイドライン。フェーズ別必須セット、オプション、納品物定義、機能一覧粒度ガイド、受入期間の運用ルール（リリース≠ローンチ） | CLAUDE.md鉄則15 |
| pm_risk_and_commercial.md | クライアントリスク評価、エスカレーション判断、撤退ライン、知見の開示判断、特急料金、R&D/PoC契約設計、パートナーマネジメント | CLAUDE.md Key Files |
| ai-pm-requirements-checklist-V3.md | AIプロジェクト管理・要件定義チェックリスト（v3.1）。11カテゴリ・約200項目。NIST AI RMF/EU AI Act/PMBOK等参照。契約防御・PM価値可視化・AIエージェント業務適用戦略含む | CLAUDE.md Key Files |
| ai-pm-requirements-checklist-v2.md | チェックリストv2（旧版バックアップ） | ai-pm-requirements-checklist-V3.md冒頭 |
| knowledge-assetization-guide.md | 案件知見の資産化ガイド。Phase1:1次情報保全→Phase2:パターン抽出(2件目)→Phase3:スキル化(3件目〜)。匿名化3層構造（プロジェクト→ケーススタディ→テンプレート） | CLAUDE.md Key Files, README.md |
| security-guide-for-deployment.md | 他社導入時のセキュリティガイド。情報分類と格納先の線引き、Private repoの安全性評価、Claude Code固有対策（auto memory・MCP）、複数人運用のアクセス制御、社外配布手順、導入時チェックリスト、pre-commit hook設定 | CLAUDE.md Key Files |
| claude-code-security-settings.md | Claude Code自体のセキュリティ設定。2層防御モデル（Permission Rules + Sandbox）、既知CVE一覧、攻撃ベクトル、コピペ可能な設定JSON、検証手順、スコープ別使い分け | CLAUDE.md Key Files |
