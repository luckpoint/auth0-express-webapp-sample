# Auth0 Post-Login Action

このディレクトリには、マーケティング同意を取得するためのAuth0 Post-Login Actionが含まれています。

## redirect-marketing-consent.js

**目的**: マーケティング同意の取得

**機能**:
- ログイン3回目以降のユーザーに対してマーケティング同意フォームを表示
- 同意項目：Email Contact、Custom Marketing Content、Newsletter Subscription
- 一度完了したユーザーには再表示しない

**トリガー条件**:
- ログイン回数が2回より多い場合
- `question_set_1`が未完了の場合

**設定が必要なSecrets**:
- `SESSION_TOKEN_SECRET`: セッショントークンの署名に使用する秘密鍵
- `FORM_URL`: アプリケーションのURL (例: http://localhost:3000/permission)

## セットアップ手順

### 1. Auth0 Dashboard設定

1. **Actions** → **Flows** → **Login**にアクセス
2. カスタムActionを作成
3. `redirect-marketing-consent.js`のコードをコピー
4. 必要なSecretsを設定

### 2. 必要なSecrets設定

```
SESSION_TOKEN_SECRET: <32文字以上のランダム文字列>
FORM_URL: http://localhost:3000/permission
```

### 3. フロー設定

Post-Login フローに`redirect-marketing-consent`Actionを追加
