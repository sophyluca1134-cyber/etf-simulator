# ETFシミュレーターをPCオフでも開く方法

PCの電源を落としてもスマホや別PCで使うには、アプリをクラウドに公開します。

## Vercelで公開する手順

1. https://vercel.com/ にログインします。
2. この `New project` フォルダをGitHubへアップロードします。
3. Vercelで `Add New...` -> `Project` を選びます。
4. GitHubのこのプロジェクトを選びます。
5. そのまま `Deploy` を押します。
6. 完了後に表示されるURLで `https://.../etf.html` を開きます。

## 公開後のURL

公開後は、以下のようなURLになります。

`https://your-project-name.vercel.app/etf.html`

このURLなら、PCの電源が切れていてもスマホや別PCから開けます。

## 注意

保有口数などの保存データは、今の作りでは端末ごとのブラウザ内に保存されます。
スマホとPCで同じデータを完全共有したい場合は、次にクラウド保存機能を追加する必要があります。
