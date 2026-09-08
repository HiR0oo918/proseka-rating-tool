# プロセカレーティングツール

プロジェクトセカイのリザルトから、非公式レーティングを出す Web アプリです。公式のレートではありません。

## 計算

ランクマッチと同じ配点で、ノーツはすべて均等です。

- PERFECT = 3、GREAT = 2、GOOD = 1、BAD / MISS = 0
- 達成率 = `(3×PERFECT + 2×GREAT + GOOD) / (3×総ノーツ)`
- 単曲レート = 譜面定数 × 達成率
- **その他**（APPEND 以外）: 上位 30 譜面の平均（変更可）
- **APPEND**: 上位 20 譜面の平均（変更可）

譜面定数は CSV では空欄です。画面で入力するか、あとで `data/charts.csv` の `chart_constant` を埋めてください。未設定のときは公式レベルを仮の定数にします。

対象譜面は公式レベル 24 以上のみです。

## 起動

```bash
npm install
npm run dev
```

ブラウザで表示された URL を開きます。リザルトはブラウザの localStorage に保存されます。書き出し / 読み込みで JSON バックアップできます。

## データ

- [`data/charts.csv`](data/charts.csv) … 譜面カタログ（編集用）
- [`data/COLUMNS.md`](data/COLUMNS.md) … 列の説明
- [`src/data/charts.json`](src/data/charts.json) … アプリが読むコピー

CSV を直したら、同じ内容を JSON にも反映してから再起動してください。
