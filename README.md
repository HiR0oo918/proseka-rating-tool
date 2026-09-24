# セカイヘルパーβ

プロジェクトセカイのリザルトから、非公式レーティングを出す Web アプリです。公式のレートではありません。

## 計算

ノーツはすべて均等です。

- 達成率 = `(PERFECT重み×PERFECT + GREAT重み×GREAT + …) / (PERFECT重み×総ノーツ)`（上限 100%）
- 判定の重み: PERFECT 100 / GREAT 80 / GOOD 50 / BAD 10 / MISS 0（[`src/data/rating-config.json`](src/data/rating-config.json)）
- 単曲レートは達成率と定数の折れ線（境界の間は線形補間）:

| 達成率 | 単曲レート |
| --- | --- |
| 0% | 0 |
| 95% | 定数 − 3.5 |
| 97% | 定数 − 1.5 |
| 98.5% | 定数 |
| 99% | 定数 + 1 |
| 99.5% | 定数 + 2.5 |
| 100% | 定数 + 3 |

- **通常枠**（HARD・EXPERT・MASTER Lv.36以下）: 上位 20 譜面の合計 ÷ 20（未入力枠は 0）
- **APPEND枠**（APPEND と MASTER 37。MASTER 37 の表記は MASTER のまま）: 上位 10 譜面の合計 ÷ 10（未入力枠は 0）
- **総合レート**: `(通常枠×2 + APPEND枠×1) ÷ 3`

譜面定数・判定重み・単曲レートの境界・ベスト枠数・総合レートの混ぜ方は全員共通です。ユーザー画面からは変えられません。管理者がリポジトリを直してデプロイします。手順は [`data/RATING.md`](data/RATING.md) です。

未設定の定数は公式レベル.5（例: Lv.32 → 32.5）です。

対象譜面は公式レベル 24 以上で、現在ゲーム内でプレイできるもののみです。期間限定のメドレーや終了したコラボ曲は含みません。

## 起動

```bash
npm install
npm run dev
```

ブラウザで表示された URL を開きます。リザルトはブラウザの localStorage に保存されます。書き出し / 読み込みで JSON バックアップできます。ベスト内訳から、ジャケット付きのベスト枠画像を PNG で保存できます。画面の「フィードバック」から不具合や要望を送れます（リザルトは付きません）。

## フィードバック（Discord）

送信先は Discord の Incoming Webhook です。URL はリポジトリに書かず、環境変数 `DISCORD_WEBHOOK_URL` に置きます。

手元（`npm run dev`）:

1. Discord のチャンネル設定 → 連携サービス → ウェブフック で URL を作る
2. [`.dev.vars.example`](.dev.vars.example) を `.env.local` か `.dev.vars` にコピーして URL を入れる
3. 未設定のときは送信は成功扱いになり、サーバーのコンソールに内容だけ出ます

Cloudflare（Worker 名 `prod`）:

- ダッシュボードの変数 / シークレットに `DISCORD_WEBHOOK_URL` を入れる
- 未設定の公開サイトでは「今は受け付けていません」と出ます

同じ接続からは 10 分で 5 件までです。

## Cloudflare Workers

OpenNext（`@opennextjs/cloudflare`）でデプロイします。Worker 名は `prod` です。`wrangler.jsonc` の `name` と `WORKER_SELF_REFERENCE.service` は同じ値にしてください。

Git 連携する場合、Cloudflare ダッシュボードの **Worker 名も `prod`** に揃えます。違うと「name must match」や service binding 10143 で失敗します。ビルド設定は次です。

- ビルドコマンド: `npm run build`（`next build` 単体にしない。OpenNext の Worker 成果物まで作る）
- デプロイコマンド: `npm run deploy`（成果物が無いときはここで build する）

手元から出す場合:

```bash
npm run deploy
```

## データ

- [`data/charts.csv`](data/charts.csv) … 譜面カタログ（編集用。定数列は管理者用）
- [`data/constants-by-level.md`](data/constants-by-level.md) … 定数入力用のレベル順リスト
- [`data/constants-master-below.csv`](data/constants-master-below.csv) / [`data/constants-append.csv`](data/constants-append.csv) … 定数の入力用 CSV
- [`data/constants-mas-merge-report.csv`](data/constants-mas-merge-report.csv) … MASTER 定数のシート(A)×Wiki判定(B) 合成結果
- [`data/COLUMNS.md`](data/COLUMNS.md) … 列の説明
- [`data/RATING.md`](data/RATING.md) … レーティング規則の更新手順
- [`src/data/charts.json`](src/data/charts.json) … アプリが読む譜面コピー
- [`src/data/rating-config.json`](src/data/rating-config.json) … 判定重み・単曲レート境界・ベスト枠数

CSV や rating-config.json を直したら、charts.json も合わせて更新してからデプロイしてください。書き出し / 読み込みはリザルトのみです。
