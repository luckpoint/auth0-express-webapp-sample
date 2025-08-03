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
      message: 'Session token is required',
      error: { status: 400, stack: '' }
    });
  }

  if (!state) {
    return res.status(400).render('error', {
      message: 'State parameter is required',
      error: { status: 400, stack: '' }
    });
  }

  try {
    // First decode the JWT to get basic structure and check format
    const decoded = jwt.decode(sessionToken, { complete: true });
    console.log(decoded)
    if (!decoded || !decoded.header || !decoded.payload) {
      throw new Error('Invalid JWT format');
    }

    const payload = decoded.payload;

    // Validate required parameters
    if (!payload.iss) {
      throw new Error('Missing required parameter: iss (issuer)');
    }

    if (!payload.exp) {
      throw new Error('Missing required parameter: exp (expiration time)');
    }

    if (!payload.sub) {
      throw new Error('Missing required parameter: sub (subject)');
    }

    if (!payload.redirect_uri) {
      throw new Error('Missing required parameter: redirect_uri');
    }

    // Validate expiration time
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token has expired');
    }

    // Validate issuer
    if (process.env.ISSUER_BASE_URL) {
      const expectedIssuer = process.env.ISSUER_BASE_URL.endsWith('/') 
        ? process.env.ISSUER_BASE_URL 
        : process.env.ISSUER_BASE_URL + '/';
      
      if (!payload.iss.startsWith(expectedIssuer)) {
        throw new Error('Invalid token issuer');
      }
    }

    // For production use, you should verify the signature:
    // const verified = jwt.verify(sessionToken, getPublicKey(), { algorithms: ['RS256'] });
    
    // Store session data for POST request
    req.session.permissionData = {
      sessionToken: sessionToken,
      state: state,
      redirectUri: payload.redirect_uri
    };
    
    res.render('permission', {
      title: 'Marketing Permissions',
      isAuthenticated: true,
      sessionToken: sessionToken,
      state: state,
      csrfToken: 'disabled-for-debug', // req.csrfToken(),
      tokenPayload: payload,
      userInfo: {
        sub: payload.sub,
        email: payload.email,
        name: payload.name || payload.nickname
      }
    });
  } catch (error) {
    console.error('JWT validation error:', error.message);
    res.status(401).render('error', {
      message: 'Invalid or expired session token',
      error: { status: 401, stack: error.message }
    });
  }
});

router.post('/permission', function (req, res, next) {
  console.log('POST /permission - Start processing');
  console.log('Request body:', req.body);
  console.log('CSRF Token from body:', req.body._csrf);
  console.log('Session ID:', req.session.id);
  console.log('Environment variables check:');
  console.log('SESSION_TOKEN_SECRET exists:', !!process.env.SESSION_TOKEN_SECRET);
  console.log('ISSUER_BASE_URL exists:', !!process.env.ISSUER_BASE_URL);
  const { permissions, newsletter } = req.body;
  
  // Check if session data exists
  if (!req.session.permissionData) {
    console.log('No session data found');
    return res.status(400).render('error', {
      message: 'Session expired. Please start the process again.',
      error: { status: 400, stack: '' }
    });
  }
  
  const { sessionToken, state, redirectUri } = req.session.permissionData;
  console.log('Session data:', { sessionToken: sessionToken ? 'exists' : 'missing', state, redirectUri });
  
  try {
    // Create new JWT with permission data
    console.log('Creating permission data...');
    const permissionData = {
      permissions: Array.isArray(permissions) ? permissions : (permissions ? [permissions] : []),
      newsletter: newsletter === 'on',
      timestamp: Math.floor(Date.now() / 1000)
    };
    console.log('Permission data created:', permissionData);
    
    // Decode original session token
    console.log('Decoding original session token...');
    const decodedToken = jwt.decode(sessionToken, { complete: true });
    if (!decodedToken || !decodedToken.payload) {
      throw new Error('Failed to decode session token or missing payload');
    }
    const originalPayload = decodedToken.payload;
    console.log('Original payload decoded');
    
    // Remove specific fields from original payload
    const { ip, redirect_uri, iss, exp, ...cleanedPayload } = originalPayload;
    console.log('Payload cleaned');
    
    // Create current URL for new issuer
    const currentIss = `${req.protocol}://${req.get('host')}/permission`;
    console.log('Current issuer:', currentIss);
    
    // Create JWT payload with cleaned original token data and permission data
    const newPayload = {
      ...cleanedPayload,
      iss: currentIss,
      state: state,
      other: permissionData
    };
    console.log('New payload created');
    
    // Check if SESSION_TOKEN_SECRET exists
    if (!process.env.SESSION_TOKEN_SECRET) {
      throw new Error('SESSION_TOKEN_SECRET environment variable is not set');
    }
    console.log('SESSION_TOKEN_SECRET exists');
    
    // Sign new JWT (using symmetric key for simplicity - in production use proper key management)
    console.log('Signing new JWT...');
    const newSessionToken = jwt.sign(newPayload, process.env.SESSION_TOKEN_SECRET, {
      expiresIn: '1m'
    });
    console.log('New JWT signed');
    
    // Clean up session data
    delete req.session.permissionData;
    console.log('Session data cleaned up');
    
    // Redirect to the original redirect_uri with state and new session_token
    console.log('Creating redirect URL with redirectUri:', redirectUri);
    
    // Validate redirect URI format
    if (!redirectUri || typeof redirectUri !== 'string') {
      throw new Error('Invalid redirect URI: ' + redirectUri);
    }
    
    const redirectUrl = new URL(redirectUri);
    console.log('Redirect URL created successfully');
    
    redirectUrl.searchParams.set('state', state);
    redirectUrl.searchParams.set('session_token', newSessionToken);
    
    const finalRedirectUrl = redirectUrl.toString();
    console.log('Final redirect URL:', finalRedirectUrl);
    
    res.redirect(finalRedirectUrl);
    
  } catch (error) {
    console.error('Permission processing error details:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    
    res.status(500).render('error', {
      message: 'Failed to process permissions: ' + error.message,
      error: { status: 500, stack: error.stack }
    });
  }
});

module.exports = router;
