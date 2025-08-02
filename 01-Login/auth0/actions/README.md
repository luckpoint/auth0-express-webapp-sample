# Auth0 Post-Login Actions

このディレクトリには、Auth0のPost-Loginフローで実行されるActionsが含まれています。これらのActionsは、ユーザーがログインした後に実行され、追加のプロファイル情報の収集やマーケティング同意の取得を行います。

## 概要

Post-Login Actionsは、ユーザーがアプリケーションにログインした後に実行されるカスタムコードです。これらのActionsを使用することで、以下のような機能を実装できます：

- ユーザープロファイルの追加情報収集
- マーケティング同意の取得
- 外部サービスとの連携
- カスタムクレームの追加
- セキュリティチェック

## Actions一覧

### 1. redirect-intro-profile-data.js

**目的**: ユーザーの基本プロファイル情報（名前、都市）の収集

**機能**:
- 初回ログイン時またはプロファイル情報が不完全なユーザーに対して外部フォームにリダイレクト
- 必要な情報：First Name、Last Name、City
- 情報が収集済みの場合はスキップ

**トリガー条件**:
- ログイン回数が1回より多い場合
- `user_info_missed`フラグが`true`の場合

**設定が必要なSecrets**:
- `SESSION_TOKEN_SECRET`: セッショントークンの署名に使用する秘密鍵
- `FORM_URL`: 外部フォームのURL

**実行フロー**:
1. **Initial Check**: 必要な設定とユーザー状態の確認
2. **Session Token Generation**: 安全なセッショントークンの生成
3. **External Redirect**: 外部フォームへのリダイレクト
4. **Return Validation**: フォーム送信後の検証とメタデータ更新

### 2. redirect-marketing-consent.js

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
- `FORM_URL`: 外部フォームのURL

**実行フロー**:
1. **Initial Check**: ログイン回数と完了状態の確認
2. **Form Configuration**: マーケティング同意フォームの設定
3. **Session Token Generation**: 安全なセッショントークンの生成
4. **External Redirect**: 外部フォームへのリダイレクト
5. **Return Processing**: 同意情報の処理と完了フラグの設定

## 共通アーキテクチャ

### セキュリティ

両方のActionsは以下のセキュリティメカニズムを使用します：

- **Session Token**: JWTベースの署名付きトークンで外部フォームとの安全な通信を実現
- **Audience Validation**: トークンの対象者検証
- **Expiration**: 5分間の有効期限
- **Secret Management**: Auth0 Secretsを使用した機密情報の管理

### データ管理

**User Metadata**: ユーザー固有の情報（名前、都市、マーケティング設定など）
**App Metadata**: アプリケーション管理用の情報（完了フラグ、質問セット完了状況など）

### エラーハンドリング

- 設定不備の場合は処理をスキップ
- トークン検証エラーの場合はアクセス拒否
- ログ出力による問題追跡

## セットアップ手順

### 1. Auth0 Dashboard設定

1. **Actions** → **Flows** → **Login**にアクセス
2. カスタムActionを作成
3. 対応するJavaScriptコードをコピー
4. 必要なSecretsを設定

### 2. 必要なSecrets設定

```
SESSION_TOKEN_SECRET: <32文字以上のランダム文字列>
FORM_URL: <外部フォームのURL>
```

### 3. フロー設定

Post-Login フローに以下の順序でActionsを追加：
1. `redirect-intro-profile-data` (プロファイル情報収集)
2. `redirect-marketing-consent` (マーケティング同意)

## カスタマイズ

### フォームテーマの変更

各Actionの`theme`オブジェクトでUIをカスタマイズできます：

```javascript
const theme = {
  "css_variables": {
    "primary-color-rgb": "40,40,100",
    "primary-color": "rgb(40, 40, 100)",
    "page-background-color": "#c9cace"
  },
  "logo_element": '<img src="..." alt="Logo">',
  "auto_generate": false
};
```

### 追加フィールドの設定

`inputs`配列に新しいフィールドを追加：

```javascript
{
  type: "text", 
  label: "フィールド名", 
  metadata_key: "metadata_key_name", 
  current: current_value
}
```

### トリガー条件の変更

ログイン回数やその他の条件を変更：

```javascript
if (event.stats.logins_count > CUSTOM_COUNT) {
  // カスタムロジック
}
```

## トラブルシューティング

### よくある問題

1. **Actionが実行されない**
   - フロー設定を確認
   - Secretsが正しく設定されているか確認

2. **外部フォームにリダイレクトされない**
   - `FORM_URL`の設定を確認
   - セッショントークンの生成をログで確認

3. **データが保存されない**
   - `onContinuePostLogin`の実装を確認
   - メタデータキーの一致を確認

### デバッグ方法

1. `console.log`を使用したログ出力
2. Auth0 Dashboard の Monitoring → Logs でエラー確認
3. Real-time Webtask Logsでリアルタイム監視

## 関連リソース

- [Auth0 Actions Documentation](https://auth0.com/docs/actions)
- [Post-Login Flow](https://auth0.com/docs/actions/flows-and-triggers/login-flow)
- [Redirect Actions](https://auth0.com/docs/actions/write-your-first-action#redirect-users-to-an-external-site)
- [Session Tokens](https://auth0.com/docs/actions/triggers/post-login/redirect-with-session-tokens)
