# パーミッション（権限）ルート with JWT セッショントークン検証

## 概要
`/permission` ルートは、クエリパラメータとして渡されるJWTセッショントークンを検証し、マーケティング許可設定を収集するフォームを表示します。このルートは Auth0 Redirect Action（ポストログイン）との統合を可能にします。

## 使用方法

### URL形式
```
GET /permission?session_token=<JWT_TOKEN>&state=<STATE_VALUE>
POST /permission (フォーム送信用)
```

### Auth0 Redirect Actionとの連携例
Auth0 Post-Login Actionでは、このエンドポイントにリダイレクトできます：

```javascript
// Auth0 Post-Login Action内
exports.onExecutePostLogin = async (event, api) => {
  const crypto = require('crypto');
  const jwt = require('jsonwebtoken');
  
  // セッショントークンを作成（HS256アルゴリズムを使用）
  const sessionToken = jwt.sign({
    sub: event.user.user_id,
    email: event.user.email,
    name: event.user.name,
    nickname: event.user.nickname,
    iss: event.request.hostname,
    redirect_uri: 'https://your-app.com/callback',
    exp: Math.floor(Date.now() / 1000) + (60 * 15) // 15分間有効
  }, event.secrets.SESSION_TOKEN_SECRET, { algorithm: 'HS256' });

  // stateパラメータを生成
  const state = crypto.randomBytes(16).toString('hex');

  // パーミッションページにリダイレクト
  api.redirect.sendUserTo(`${event.request.hostname}/permission?session_token=${sessionToken}&state=${state}`);
};
```

## セキュリティ機能

### 現在の検証項目
1. **署名検証**: HS256アルゴリズムによる共有鍵での署名検証
2. **トークン形式**: JWT構造の検証
3. **有効期限**: トークンの期限切れチェック（jwtライブラリが自動実行）
4. **発行者**: `ISSUER_BASE_URL`が設定されている場合の発行者検証
5. **必須パラメータ**: `iss`, `exp`, `sub`, `redirect_uri`の存在確認
6. **エラーハンドリング**: 無効なトークンに対する適切なエラーレスポンス

### プロダクション用の追加セキュリティ対策
以下の追加セキュリティ対策の実装を検討してください：

1. **Audience検証**: audience claimのチェック
2. **レート制限**: エンドポイントの悪用防止
3. **HTTPS必須**: トークンのHTTPS経由での送信のみ許可
4. **トークンローテーション**: 定期的な共有鍵の更新

### HS256署名検証の実装
現在の実装では、共有鍵（`SESSION_TOKEN_SECRET`）を使用したHS256アルゴリズムによる署名検証を行います：

```javascript
// HS256による署名検証（現在の実装）
const payload = jwt.verify(sessionToken, process.env.SESSION_TOKEN_SECRET, { 
  algorithms: ['HS256'] 
});
```

### RSAキー（RS256）を使用する場合の例
より高いセキュリティが必要な場合は、RS256アルゴリズムを検討してください：
```javascript
// RSAキー（RS256）を使用する場合:
const jwksClient = require('jwks-rsa');

const client = jwksClient({
  jwksUri: `${process.env.ISSUER_BASE_URL}/.well-known/jwks.json`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

// keyを使用してjwt.verifyを実行
jwt.verify(sessionToken, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
  // 検証済みトークンの処理
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
1. 有効なJWTトークンを作成
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
- CSRF保護（現在はデバッグ用に無効化）
- セッションデータはフォーム送信後に自動削除
