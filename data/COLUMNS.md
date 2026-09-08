# 譜面カタログ CSV の列定義

ファイル: `data/charts.csv`

データ源はコミュニティ公開のゲームマスタ（Sekai-World `sekai-master-db-diff` の `musics.json` / `musicDifficulties.json`）です。公式の「レーティング」数値はありません。

## 今回埋めた列（判断不要）

| 列名 | 内容 |
| --- | --- |
| `chart_id` | 譜面レコード ID |
| `music_id` | 楽曲 ID |
| `title` | 曲名 |
| `pronunciation` | 読み（検索用。計算には使わない） |
| `difficulty` | `easy` / `normal` / `hard` / `expert` / `master` / `append` |
| `play_level` | 公式の整数レベル |
| `total_note_count` | 総ノーツ数（コンボ数）。達成率では PERFECT 数の算出に使う |
| `published_at` | ゲーム内公開日（UTC）。計算には使わない |

## 空欄のまま止めた列（判断が必要）

| 列名 | なぜ空欄か |
| --- | --- |
| `chart_constant` | 非公式の譜面定数。出典が複数あり、こちらで決められない |
| `tap_count` ほかノーツ種別 | 判定均等の達成率なら不要。スコア重み方式なら必要 |
| `weighted_note_count` | スコア計算用。コミュニティレーティングでは通常使わない |

## プレイヤー入力（カタログ CSV には含めない）

レーティング本体の計算には、譜面データに加えてリザルトが要る。

- GREAT / GOOD / BAD / MISS（PERFECT は `total_note_count` から逆算可能）
- または達成率そのもの
- （任意）AP / FC フラグ

## 収録範囲

全 717 曲・3716 譜面（EASY〜APPEND すべて）。対象難易度を絞るかは未確定のため、削っていない。
