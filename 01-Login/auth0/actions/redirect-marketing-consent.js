/**
 * Handler that will be called during the execution of a PostLogin flow.
 *
 * @param {Event} event - Details about the user and the context in which they are logging in.
 * @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
 * Functionality: Check if the user has added the necessary details to their profile and prompt them for those values if they have not. 
 */

const QUESTION_SET_ID = "question_set_1";

exports.onExecutePostLogin = async (event, api) => {
  // INITIAL CHECK
  // Confirm secrets are set
  // Confirm the user is either logging in for the first time OR has not completed filling out their profile
  if (!event.secrets.SESSION_TOKEN_SECRET || !event.secrets.FORM_URL) {
    console.log('Missing required configuration. Skipping.');
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

  // SETUP SESSION TOKEN TO SEND OVER AND SIGN WITH SHARED SECRET
  const sessionToken = api.redirect.encodeToken({
    secret: event.secrets.SESSION_TOKEN_SECRET,
    payload: {
      iss: `https://${event.request.hostname}/`,
      subject: event.user.user_id,
      audience: event.secrets.FORM_URL,
      expiresIn: '5 minutes',
    },
  });
  // console.log(sessionToken);
  
  // PERFORM REDIRECT TO EXTERNAL PAGE WITH SESSION TOKEN
  api.redirect.sendUserTo(event.secrets.FORM_URL, {
    query: {
      session_token: sessionToken,
      redirect_uri: `https://${event.request.hostname}/continue`,
    },
  });
};

// FINAL VALIDATION ON RETURN
// OnContinuePostLogin runs when the external page passes back the response and matching state param.

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
    return api.access.deny('Error occurred during redirect.');
  }
  
  var customClaims = decodedToken.other;
  // console.log(customClaims);

  // Set response values into the user metadata or app metadata.
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
  
  // Add question set to list of sets already completed.
  var question_sets_completed = event.user.app_metadata["question_sets_completed"] ?? [];
  question_sets_completed.push(QUESTION_SET_ID);
  api.user.setAppMetadata("question_sets_completed", question_sets_completed);
};