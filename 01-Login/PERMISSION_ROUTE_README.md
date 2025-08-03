# Permission Route with JWT Session Token Validation

## Overview
The `/permission` route has been modified to validate JWT session tokens passed as query parameters. This enables integration with Auth0 Redirect Actions (post-login).

## Usage

### URL Format
```
GET /permission?session_token=<JWT_TOKEN>
```

### Example with Auth0 Redirect Action
In your Auth0 Post-Login Action, you can redirect users to this endpoint:

```javascript
// In your Auth0 Post-Login Action
exports.onExecutePostLogin = async (event, api) => {
  // Create a session token (example)
  const sessionToken = jwt.sign({
    sub: event.user.user_id,
    email: event.user.email,
    name: event.user.name,
    iss: event.request.hostname,
    aud: 'your-app',
    exp: Math.floor(Date.now() / 1000) + (60 * 15) // 15 minutes
  }, 'your-secret');

  // Redirect to permission page
  api.redirect.sendUserTo(`${event.request.hostname}/permission?session_token=${sessionToken}`);
};
```

## Security Features

### Current Validations
1. **Token Format**: Validates JWT structure
2. **Expiration**: Checks if token has expired
3. **Issuer**: Validates issuer if `ISSUER_BASE_URL` is set
4. **Error Handling**: Proper error responses for invalid tokens

### For Production Use
Consider implementing these additional security measures:

1. **Signature Verification**: Verify JWT signature with public key
2. **Audience Validation**: Check the audience claim
3. **Rate Limiting**: Prevent abuse of the endpoint
4. **HTTPS Only**: Ensure tokens are only sent over HTTPS

### Example Production Verification
```javascript
// For production, add signature verification:
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

// Then use jwt.verify with the key
jwt.verify(sessionToken, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
  // Handle verified token
});
```

## Environment Variables
Make sure to set these in your `.env` file:
- `ISSUER_BASE_URL`: Your Auth0 domain URL
- `CLIENT_ID`: Your Auth0 application client ID
- `SECRET`: Your application secret

## Testing
You can test the route by:
1. Creating a valid JWT token
2. Making a GET request to `/permission?session_token=<your-jwt>`
3. Verifying the response renders the permission page or shows appropriate errors

## Error Responses
- **400**: Missing session_token parameter
- **401**: Invalid, expired, or malformed JWT token
