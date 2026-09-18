# 譜面カタログ CSV の列定義

ファイル: `data/charts.csv`

データ源はコミュニティ公開のゲームマスタ（Sekai-World `sekai-master-db-diff`）です。公式レーティングはありません。

## 列

| 列名 | 内容 |
| --- | --- |
| `chart_id` | 譜面レコード ID |
| `music_id` | 楽曲 ID |
| `title` | 曲名 |
| `pronunciation` | 読み（検索用） |
| `difficulty` | `hard` / `expert` / `master` / `append` など |
| `play_level` | 公式の整数レベル |
| `chart_constant` | 非公式定数。管理者がこの列で全員共通の値を入れる。空欄なら公式レベル.5 |
| `total_note_count` | 総ノーツ数。PERFECT の逆算と達成率の分母に使う |
| `published_at` | 公開日（UTC） |

ノーツ種別の内訳列はありません。判定はすべて均等です。

## 収録範囲

公式レベル 24 以上の 1432 譜面（HARD 4 / EXPERT 576 / MASTER 708 / APPEND 144）。MASTER 37 の 3 譜面は難易度表示は MASTER のまま、対象枠は APPEND枠です。
ゲームから削除された曲、期間終了のコラボ曲・ボスラッシュ用メドレー、期間限定の『初音ミクの激唱』APPEND（FULLver.）は含みません。常設の『スターダストメドレー』は残します。
