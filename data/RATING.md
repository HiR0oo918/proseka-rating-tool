# レーティング規則（管理者用）

全員共通の計算規則です。ユーザー画面からは編集できません。変更したら JSON / CSV を直してデプロイしてください。

## 計算規則

ファイル: [`src/data/rating-config.json`](../src/data/rating-config.json)

| キー | 内容 |
| --- | --- |
| `updatedAt` | 最終更新日（表示用） |
| `otherBestCount` | MASTER以下のベスト枠数 |
| `appendBestCount` | APPEND のベスト枠数 |
| `judgementWeights` | 達成率の判定重み（perfect / great / good / bad / miss） |
| `ratingPoints` | 単曲レートの折れ線。`mode` は `offset`（定数+value）か `absolute`（固定値） |

## 譜面定数

[`data/charts.csv`](charts.csv) の `chart_constant` 列。空欄のときは公式レベル.5 を仮置きします。整数部は公式 `play_level` に揃え、小数第1位だけ入れます（例: 32.7）。

CSV を直したら、同じ定数を [`src/data/charts.json`](../src/data/charts.json) にも反映してからデプロイしてください。
