## 概要
`/permission` ルートは、クエリパラメータとして渡されるJWTセッショントークンを検証し、マーケティング許可設定を収集するフォームを表示します。このルートは Auth0 Redirect Action（ポストログイン）との統合を可能にします。

## 使用方法

### URL形式
```
GET /permission?session_token=<JWT_TOKEN>&state=<STATE_VALUE>
POST /permission (フォーム送信用)
```

### HS256署名検証の実装
現在の実装では、共有鍵（`SESSION_TOKEN_SECRET`）を使用したHS256アルゴリズムによる署名検証を行います：

```javascript
// HS256による署名検証（現在の実装）
const payload = jwt.verify(sessionToken, process.env.SESSION_TOKEN_SECRET, { 
  algorithms: ['HS256'] 
});
```

## フォーム機能
このルートは二段階のプロセスを実装しています：

### GET リクエスト
- JWTトークンを検証
- マーケティング許可設定フォームを表示
- セッションデータを保存

### POST リクエスト
- ユーザーの許可設定を受信
- 新しいJWTトークンを生成（許可データを含む）
- 元の`redirect_uri`にリダイレクト

### フォームデータ
フォームは以下のデータを収集します：
- `permissions[]`: マーケティング許可の配列
- `newsletter`: ニュースレター購読の同意（on/off）

## 環境変数
`.env`ファイルに以下を設定してください：
- `ISSUER_BASE_URL`: Auth0ドメインURL
- `CLIENT_ID`: Auth0アプリケーションのクライアントID
- `SECRET`: アプリケーションシークレット
- `SESSION_SECRET`: セッション管理用のシークレット
- `SESSION_TOKEN_SECRET`: 新しいJWTトークン署名用のシークレット

## テスト方法
このルートをテストするには：
1. 有効なJWTトークンを作成 (Actions側で作成し、リダイレクトを行う）
2. `/permission?session_token=<your-jwt>&state=<state>`にGETリクエストを送信
3. フォームが表示されることを確認
4. フォームを送信して適切にリダイレクトされることを確認

## エラーレスポンス
- **400**: `session_token`または`state`パラメータが不足
- **401**: 無効、期限切れ、または不正な形式のJWTトークン
- **500**: 権限処理中のサーバーエラー

## 実装の詳細

### JWTペイロード処理
アプリケーションは以下のJWTペイロードフィールドを処理します：
- `sub`: ユーザーID（必須）
- `email`: ユーザーのメールアドレス
- `name` / `nickname`: ユーザー名
- `iss`: 発行者（必須）
- `exp`: 有効期限（必須）
- `redirect_uri`: リダイレクト先URL（必須）

### セッション管理
- `express-session`を使用してセッション管理
