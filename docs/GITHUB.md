# GitHubへのアップロードとPages公開

この手順は利用者自身のアカウントで実施するためのものです。このプロジェクト作成時にはGitHubへのアップロードは実施していません。

## ブラウザからアップロード

1. 空の公開リポジトリ `racelens-replay` を作る。
2. ZIPを解凍する。
3. `racelens-replay` フォルダの中身をアップロードする。`package.json` と `src/` がリポジトリ直下に来る構成にする。
4. `.github/workflows/ci.yml` と `pages.yml` も含まれていることを確認する。隠しフォルダを選べない場合はGitHub上の「Create new file」で同じパスに作成し、内容を貼り付ける。
5. `.git`、認証情報、個人用ノート、`.env` は送らない。

## Gitからアップロード

GitHubで空のリポジトリを作成後、次の `YOUR_ACCOUNT` は自分のアカウント名へ置換します。ローカルでのGit設定・認証は利用者の既存設定を使ってください。

```sh
git init -b main
git add .
git commit -m "Add real-race prediction and replay prototype"
git remote add origin https://github.com/YOUR_ACCOUNT/racelens-replay.git
git push -u origin main
```

Gitのユーザー名・メールが未設定なら、GitHubの設定を確認し、必要に応じてnoreplyメールを使用します。すでにGit管理されている作業ディレクトリでは `git init` を繰り返す必要はありません。既存のoriginがある場合は別プロジェクトの接続を上書きしないでください。

## アプリの公開

1. リポジトリの `Settings → Pages → Build and deployment → Source` を `GitHub Actions` にする。
2. `Actions → Publish GitHub Pages → Run workflow` を選ぶ。
3. `main` を対象に実行する。
4. `build` はテスト成功後にHTMLを生成し、`deploy` が公開する。
5. 成功したActionsのdeployment出力、またはPages設定画面に表示されるURLを開く。

`pages.yml` は手動実行にしています。毎回のpushでは `ci.yml` によるテスト・ビルドだけを行います。公開する変更を確認したうえで、再度Pagesのワークフローを実行してください。

公式手順：<https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages>

## 公開前に確認すること

- `npm test`、`npm run build` が成功する。
- `dist/index.html` で発走、馬場変更、再計算、結果表示、ノート保存が動く。
- コードとデータの出典がREADMEに記載されている。
- 自分の改修内容を開発記録に記入した。
- 認証情報や私的なファイルが含まれていない。

ActionsはGitHub側ではまだ実行していないため、リポジトリ設定や利用環境による調整が必要になる場合があります。
