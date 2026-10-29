# データと素材の出典

## レース情報

JRAが公表する過去2レースについて、馬名・馬番・枠・騎手・斤量・レーティング・着順・払戻など必要な事実項目を手作業で整理した。元ページの本文、写真、映像、公式ロゴ、ページのHTML/CSSは転載していない。

確認日：2026-10-28。

| 収録箇所 | 出典 |
| --- | --- |
| JCの出走情報・着順・払戻 | https://www.jra.go.jp/datafile/seiseki/g1/jc/result/jc2024.html |
| JCの日本馬の事前評価 | https://www.jra.go.jp/datafile/ranking/g1/2024/jc.html |
| JCの外国馬を含む事前評価 | https://japanracing.jp/en/japancup/news_results/news2024/241118-02.html |
| 宝塚の出走情報・着順・払戻 | https://www.jra.go.jp/datafile/seiseki/g1/takara/result/takara2024.html |
| 宝塚の事前評価・前年評価 | https://jra.jp/datafile/ranking/g1/2024/takara.html |

JCのカラテ・スターズオンアースは掲載された当年値が空欄のためnull。実際に出走しなかった登録馬は収録しない。宝塚記念のレーティングには対象レースの前に掲載された2023年度値を含む。

レース後評価・最終オッズ・通過順は予想入力に使用していない。脚質は暫定的なモデル仮説で、適性補正は全頭0から始める。

## 素材

トラック、馬番マーカー、文字装飾は独自のHTML/CSS/Canvas描画。外部画像、動画、音楽、フォント、CDNは使用しない。

## 利用条件の区別

このリポジトリのMITライセンスは作成したプログラムコードに適用する。第三者の名称や参照元の資料について、ライセンスや公認を主張するものではない。出典を残し、データの追加時にも根拠を記録する。本アプリはJRAの公式・公認サービスではない。

## 2026年の開催前GⅠ

確認：2026-10-29 11:35 JST。天皇賞（秋）の登録17頭とプレレーティングを手作業で転記した。

| 収録箇所 | 出典 |
| --- | --- |
| 天皇賞（秋）の登録馬、当年評価、性齢と定量条件 | https://www.jra.go.jp/datafile/ranking/g1/2026/akiten.html |
| 開催日・東京芝2000m | https://www.jra.go.jp/keiba/g1/akiten.html |
| 出馬表の公開状態 | https://www.jra.go.jp/keiba/g1/akiten/syutsuba.html |
| 11月のGⅠ日程4件 | https://www.jra.go.jp/keiba/tokubetsu/ |

確認時の出馬表ページは2026年10月29日公開予定と表示。馬番、枠、騎手は転記せず、五十音順の仮ID、frame:null、jockey:未確認とした。出走が確定した17頭という意味ではない。

レーティングは当年値のみ。ネブラディスクは掲載値がないためnull。斤量は3歳牡馬56kg、4歳以上牡馬58kg、牝馬2kg減の規定から入力。事前評価の距離区分は現モデルに取り込んでいない。脚質も全頭neutral、適性・騎手の補正は0。架空の枠順、騎手、オッズ、レース結果は作成していない。
