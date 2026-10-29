# 実レースJSONの仕様

内蔵レースで「現在の入力をJSON出力」を押すと、実際に読み込めるテンプレートを取得できます。架空値で新レースを作るのではなく、主催者の出馬表・公表評価を確認して必要な項目を置き換えてください。

## レースの項目

| キー | 形式 |
| --- | --- |
| id / name / venue | 空でない文字列。100文字以内 |
| date / ratingAsOf | YYYY-MM-DD。評価日が開催日より後なら拒否 |
| distance | 1000〜3600メートル |
| direction | left / right |
| surface | 芝を想定。このモデルはダート用に較正していない |
| officialGoing | 公式の馬場表記。未確認ならnull |
| entryStatus | registered（登録） / declared（出走確認） |
| numberStatus | temporary（仮ID） / official（実馬番） |
| checkedAt | 出典を確認したISO 8601日時。タイムゾーンを含む |
| sources | label、url、kindを持つ配列。HTTP(S)の出典URLを1件以上 |
| horses | 2〜18頭の配列 |

## 出走馬の項目

| キー | 形式 |
| --- | --- |
| number | 重複しない1〜18の整数。temporary時は画面内の仮ID |
| frame | official時は1〜8の整数。temporary時はnull必須 |
| name | 1〜45文字 |
| jockey | 確認した騎手名。未確認なら「未確認」 |
| weight | 40〜70kg |
| rating | 対象レース前に公表された当年の評価。60〜150、なければnull |
| priorRating | 対象レース前に確認できた前年の評価。60〜150、なければnull |
| style | neutral（未設定） / leader / stalker / middle / closer。利用者の仮説 |
| courseFit | −5〜5。初期0を推奨 |
| wetFit / jockeyFit | −3〜3。初期0を推奨 |

全頭の評価がnullなら実行できません。ファイルはUTF-8、200KB以下。欠損は空文字でなく `null` とします。

読み込んだレースは常にユーザー取込・未検証になります。入力の `verified` は信用せず上書きします。内蔵レースと同じ `id` でも別IDを発行し、過去レースの正解データを混同しません。

最新出馬表の自動収集はありません。入力した出典が信頼できるか、取消・乗り替わりが反映されているか、開催前の情報かは利用者が確認してください。結果ページのレース後レーティングを予想値へ転記しないでください。

## 複数レースの配信データ

`dist/data/current.json` は `schemaVersion:1`、`checkedAt`、`races`、`schedule` を持つ。ブラウザの「実レースJSONを読込」は単一レース専用。配信ファイル全体を更新する場合は [UPDATING.md](UPDATING.md) を参照する。確認日時・一意ID・日程との整合・サイズ上限を検証する。
