const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'marketsphere-default-development-secret-jwt-key-32chars!';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'marketsphere-refresh-development-secret-key-32chars!';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Token Revocation Blacklist
const revokedTokens = new Set();

function generateTokens(payload) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ id: payload.id, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
  return { accessToken, refreshToken };
}

function verifyToken(token) {
  if (revokedTokens.has(token)) {
    throw new Error('Token has been revoked');
  }
  return jwt.verify(token, JWT_SECRET);
}

function verifyRefreshToken(token) {
  if (revokedTokens.has(token)) {
    throw new Error('Refresh token has been revoked');
  }
  return jwt.verify(token, JWT_REFRESH_SECRET);
}

function revokeToken(token) {
  revokedTokens.add(token);
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing Bearer token.' }
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: err.message || 'Token is invalid or expired.' }
    });
  }
}

module.exports = {
  generateTokens,
  verifyToken,
  verifyRefreshToken,
  revokeToken,
  authenticate
};
