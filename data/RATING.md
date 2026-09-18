# レーティング規則（管理者用）

全員共通の計算規則です。ユーザー画面からは編集できません。変更したら JSON / CSV を直してデプロイしてください。

## 計算規則

ファイル: [`src/data/rating-config.json`](../src/data/rating-config.json)

| キー | 内容 |
| --- | --- |
| `updatedAt` | 最終更新日（表示用） |
| `otherBestCount` | 通常枠（HARD・EXPERT・MASTER Lv.36以下）のベスト枠数 |
| `appendBestCount` | APPEND枠（APPEND と MASTER 37。表記は MASTER）のベスト枠数 |
| `overallOtherWeight` | 総合レートに混ぜる 通常枠の重み（既定 3） |
| `overallAppendWeight` | 総合レートに混ぜる APPEND枠の重み（既定 2） |
| `judgementWeights` | 達成率の判定重み（perfect / great / good / bad / miss） |
| `ratingPoints` | 単曲レートの折れ線。`mode` は `offset`（定数+value）か `absolute`（固定値） |

## 譜面定数

入力用リスト（レベル高い順）:

- [`data/constants-by-level.md`](constants-by-level.md) … 一覧
- [`data/constants-master-below.csv`](constants-master-below.csv) … 通常枠（MASTER 36以下）の入力用
- [`data/constants-append.csv`](constants-append.csv) … APPEND枠（MASTER 37 を含む。表記は MASTER）の入力用

`chart_constant` に公式レベル.小数1桁を入れてください（例: 32.7）。空欄のときは公式レベル.5を仮置きします。整数部分は公式 `play_level` に揃えます。

### MASTER 定数の合成

MASTER は次の2源を [`scripts/merge-mas-constants.py`](../scripts/merge-mas-constants.py) で合成しています。

- A: 非公式難易度表スプレッドシート「難易度表(MAS)」の定数欄（`data/sources/mas-sheet.csv`）
- B: [楽曲難易度表MASTER](https://pjsekai.com/?aa95a0f97c#mas30) の判定（`data/sources/mas-wiki.txt`）

B の判定は公式レベルに対する小数として次のレンジに載せます（境界は含む）。

| 判定 | 小数 |
| --- | --- |
| 最下位－ | .0 |
| 最下位 | .0〜.2 |
| 下位 | .2〜.4 |
| 適正 | .4〜.6 |
| 上位 | .6〜.8 |
| 最上位 | .8〜.9 |
| 最上位＋ | .9 |

A の小数が B のレンジに入っていれば A を採用。外れていれば A と B 代表値（レンジ中央。最上位は .85）の平均を小数1桁に丸めます。片方しか無いときはその値（B のみは代表値）を使い、両方無いとき（Wiki が判定困難・未判定でシートにも無い曲）は空欄のままです。シート側の `32.5+` のような記号は数値だけ読みます。削除済み曲はカタログに入れません。

```bash
python3 scripts/merge-mas-constants.py
npm run constants:apply
```

対照表は [`data/constants-mas-merge-report.csv`](constants-mas-merge-report.csv) です。

```bash
npm run constants:list    # カタログからリストを再発行
npm run constants:apply   # 入力用 CSV を charts.csv と charts.json に反映
```
