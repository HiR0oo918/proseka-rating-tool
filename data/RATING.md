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

入力用リスト（レベル高い順）:

- [`data/constants-by-level.md`](constants-by-level.md) … 一覧
- [`data/constants-master-below.csv`](constants-master-below.csv) … MASTER以下の入力用
- [`data/constants-append.csv`](constants-append.csv) … APPEND の入力用

`chart_constant` に公式レベル.小数1桁を入れてください（例: 32.7）。空欄のときは公式レベル.5 を仮置きします。

```bash
npm run constants:list    # カタログからリストを再発行
npm run constants:apply   # 入力用 CSV を charts.csv と charts.json に反映
```
