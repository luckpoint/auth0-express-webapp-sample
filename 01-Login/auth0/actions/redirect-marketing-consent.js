/**
 * PostLoginフロー実行中に呼び出されるハンドラー
 *
 * @param {Event} event - ユーザーとログイン時のコンテキストに関する詳細情報
 * @param {PostLoginAPI} api - ログイン動作を変更するために使用できるメソッドのインターフェース
 * 機能: ユーザーがプロフィールに必要な詳細を追加したかをチェックし、未完了の場合はそれらの値の入力を促す
 */

const QUESTION_SET_ID = "question_set_1";

exports.onExecutePostLogin = async (event, api) => {
  // 初期チェック
  // シークレットが設定されているかを確認
  // ユーザーが初回ログインまたはプロフィール入力が未完了かを確認
  if (!event.secrets.SESSION_TOKEN_SECRET || !event.secrets.FORM_URL) {
    console.log('必要な設定が不足しています。スキップします。');
    return;
  }

  var question_sets_completed = event.user.app_metadata["question_sets_completed"] ?? [];

  console.log(event.stats.logins_count);
  if (event.stats.logins_count > 2) {
    if (question_sets_completed.includes(QUESTION_SET_ID)) {
      return;
    }
  } else {
    return;
  }

  // 共有シークレットで送信・署名するセッショントークンを設定
  const sessionToken = api.redirect.encodeToken({
    secret: event.secrets.SESSION_TOKEN_SECRET,
    expiresInSeconds: 60,
    payload: {
      iss: `https://${event.request.hostname}/`,
      redirect_uri: `https://${event.request.hostname}/continue`,
    },
  });
  // console.log(sessionToken);
  
  // セッショントークンと共に外部ページへリダイレクトを実行
  api.redirect.sendUserTo(event.secrets.FORM_URL, {
    query: {
      session_token: sessionToken,
    },
  });
};

// 戻り時の最終検証
// OnContinuePostLoginは外部ページがレスポンスと一致するstateパラメータを返すときに実行される

exports.onContinuePostLogin = async (event, api) => {
  const app_metadata_values = [];
  const skipped_claims = ["state", "action"];
  let decodedToken;
  
  try {
    decodedToken = api.redirect.validateToken({
      secret: event.secrets.SESSION_TOKEN_SECRET,
      tokenParameterName: 'session_token',
    });
  } catch (error) {
    // console.log(error.message);
    return api.access.deny('リダイレクト中にエラーが発生しました。');
  }
  
  let customClaims = decodedToken.other;
  console.log(customClaims);

  // レスポンス値をユーザーメタデータまたはアプリメタデータに設定
  for (const [key, value] of Object.entries(customClaims)) {
    console.log(key);
    if (!skipped_claims.includes(key)) {
      if (app_metadata_values.includes(key)) {
        api.user.setAppMetadata(key, value);
      } else {
        api.user.setUserMetadata(key, value);
      }
    }
  }
  
  // 完了済みセットのリストに質問セットを追加
  var question_sets_completed = event.user.app_metadata["question_sets_completed"] ?? [];
  question_sets_completed.push(QUESTION_SET_ID);
  api.user.setAppMetadata("question_sets_completed", question_sets_completed);
};