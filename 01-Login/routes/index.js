var router = require('express').Router();
const { requiresAuth } = require('express-openid-connect');
const jwt = require('jsonwebtoken');

router.get('/', function (req, res, next) {
  res.render('index', {
    title: 'Auth0 Webapp sample Nodejs',
    isAuthenticated: req.oidc.isAuthenticated()
  });
});

router.get('/profile', requiresAuth(), function (req, res, next) {
  res.render('profile', {
    userProfile: JSON.stringify(req.oidc.user, null, 2),
    title: 'Profile page'
  });
});

router.get('/permission', function (req, res, next) {
  const sessionToken = req.query.session_token;
  const state = req.query.state;
  
  if (!sessionToken) {
    return res.status(400).render('error', {
      message: 'セッショントークンが必要です',
      error: { status: 400, stack: '' }
    });
  }

  if (!state) {
    return res.status(400).render('error', {
      message: 'Stateパラメータが必要です',
      error: { status: 400, stack: '' }
    });
  }

  try {
    // 署名検証のためのSESSION_TOKEN_SECRETが利用可能かチェック
    if (!process.env.SESSION_TOKEN_SECRET) {
      throw new Error('SESSION_TOKEN_SECRET環境変数が設定されていません');
    }

    // 共有シークレットを使用してHS256アルゴリズムでJWT署名を検証
    const payload = jwt.verify(sessionToken, process.env.SESSION_TOKEN_SECRET, { 
      algorithms: ['HS256'] 
    });
    
    console.log('JWT署名の検証が正常に完了しました');
    console.log('ペイロード:', payload);

    // 必須パラメータの検証
    if (!payload.iss) {
      throw new Error('必須パラメータが不足しています: iss (発行者)');
    }

    if (!payload.exp) {
      throw new Error('必須パラメータが不足しています: exp (有効期限)');
    }

    if (!payload.sub) {
      throw new Error('必須パラメータが不足しています: sub (対象)');
    }

    if (!payload.redirect_uri) {
      throw new Error('必須パラメータが不足しています: redirect_uri');
    }

    // 発行者の検証
    if (process.env.ISSUER_BASE_URL) {
      const expectedIssuer = process.env.ISSUER_BASE_URL.endsWith('/') 
        ? process.env.ISSUER_BASE_URL 
        : process.env.ISSUER_BASE_URL + '/';
      
      if (!payload.iss.startsWith(expectedIssuer)) {
        throw new Error('無効なトークン発行者です');
      }
    }
    
    // POSTリクエスト用のセッションデータを保存
    req.session.permissionData = {
      sessionToken: sessionToken,
      state: state,
      redirectUri: payload.redirect_uri
    };
    
    res.render('permission', {
    });
  } catch (error) {
    console.error('JWT検証エラー:', error.message);
    res.status(401).render('error', {
      message: '無効または期限切れのセッショントークンです',
      error: { status: 401, stack: error.message }
    });
  }
});

router.post('/permission', function (req, res, next) {
  console.log('POST /permission - 処理開始');
  console.log('リクエストボディ:', req.body);
  console.log('ボディからのCSRFトークン:', req.body._csrf);
  console.log('セッションID:', req.session.id);
  console.log('環境変数チェック:');
  console.log('SESSION_TOKEN_SECRET存在:', !!process.env.SESSION_TOKEN_SECRET);
  console.log('ISSUER_BASE_URL存在:', !!process.env.ISSUER_BASE_URL);
  const { permissions, newsletter } = req.body;
  
  // セッションデータが存在するかチェック
  if (!req.session.permissionData) {
    console.log('セッションデータが見つかりません');
    return res.status(400).render('error', {
      message: 'セッションが期限切れです。もう一度プロセスを開始してください。',
      error: { status: 400, stack: '' }
    });
  }
  
  const { sessionToken, state, redirectUri } = req.session.permissionData;
  console.log('セッションデータ:', { sessionToken: sessionToken ? '存在' : '不足', state, redirectUri });
  
  try {
    // 許可データを含む新しいJWTを作成
    console.log('許可データを作成中...');
    const permissionData = {
      permissions: Array.isArray(permissions) ? permissions : (permissions ? [permissions] : []),
      newsletter: newsletter === 'on',
      timestamp: Math.floor(Date.now() / 1000)
    };
    console.log('許可データ作成完了:', permissionData);
    
    // 元のセッショントークンをデコード
    console.log('元のセッショントークンをデコード中...');
    const decodedToken = jwt.decode(sessionToken, { complete: true });
    if (!decodedToken || !decodedToken.payload) {
      throw new Error('セッショントークンのデコードに失敗したか、ペイロードが不足しています');
    }
    const originalPayload = decodedToken.payload;
    console.log('元のペイロードのデコード完了');
    
    // 元のペイロードから特定のフィールドを削除
    const { ip, redirect_uri, iss, exp, ...cleanedPayload } = originalPayload;
    console.log('ペイロードのクリーニング完了');
    
    // 新しい発行者用に現在のURLを作成
    const currentIss = `${req.protocol}://${req.get('host')}/permission`;
    console.log('現在の発行者:', currentIss);
    
    // クリーニングされた元のトークンデータと許可データでJWTペイロードを作成
    const newPayload = {
      ...cleanedPayload,
      iss: currentIss,
      state: state,
      other: permissionData
    };
    console.log('新しいペイロード作成完了');
    
    // SESSION_TOKEN_SECRETが存在するかチェック
    if (!process.env.SESSION_TOKEN_SECRET) {
      throw new Error('SESSION_TOKEN_SECRET環境変数が設定されていません');
    }
    console.log('SESSION_TOKEN_SECRET存在確認完了');
    
    // 新しいJWTに署名（簡単のため対称鍵を使用 - プロダクションでは適切なキー管理を使用）
    console.log('新しいJWTに署名中...');
    const newSessionToken = jwt.sign(newPayload, process.env.SESSION_TOKEN_SECRET, {
      expiresIn: '1m'
    });
    console.log('新しいJWTの署名完了');
    
    // セッションデータをクリーンアップ
    delete req.session.permissionData;
    console.log('セッションデータのクリーンアップ完了');
    
    // stateと新しいsession_tokenで元のredirect_uriにリダイレクト
    console.log('redirectUriでリダイレクトURL作成中:', redirectUri);
    
    // リダイレクトURIの形式を検証
    if (!redirectUri || typeof redirectUri !== 'string') {
      throw new Error('無効なリダイレクトURI: ' + redirectUri);
    }
    
    const redirectUrl = new URL(redirectUri);
    console.log('リダイレクトURLの作成成功');
    
    redirectUrl.searchParams.set('state', state);
    redirectUrl.searchParams.set('session_token', newSessionToken);
    
    const finalRedirectUrl = redirectUrl.toString();
    console.log('最終リダイレクトURL:', finalRedirectUrl);
    
    res.redirect(finalRedirectUrl);
    
  } catch (error) {
    console.error('許可処理エラーの詳細:');
    console.error('エラーメッセージ:', error.message);
    console.error('エラースタック:', error.stack);
    console.error('エラー名:', error.name);
    
    res.status(500).render('error', {
      message: '許可の処理に失敗しました: ' + error.message,
      error: { status: 500, stack: error.stack }
    });
  }
});

module.exports = router;
