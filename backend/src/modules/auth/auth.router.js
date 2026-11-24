const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../../database/db');
const { generateTokens, verifyRefreshToken, revokeToken, authenticate } = require('../../middleware/auth');
const { validateRequest } = require('../../middleware/validate');

const router = express.Router();

const registerSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    fullName: z.string().min(2),
    role: z.enum(['customer', 'seller', 'warehouse', 'support', 'admin']).default('customer')
  })
};

const loginSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string()
  })
};

router.post('/register', validateRequest(registerSchema), async (req, res, next) => {
  try {
    const { email, password, fullName, role } = req.body;
    const existing = db.memoryDb.findOne('users', u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'USER_EXISTS', message: 'A user with this email already exists' }
      });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const newUser = db.memoryDb.insert('users', {
      email: email.toLowerCase(),
      password_hash: passwordHash,
      full_name: fullName,
      role: role || 'customer',
      is_active: true
    });

    const tokens = generateTokens({ id: newUser.id, email: newUser.email, role: newUser.role });

    res.status(201).json({
      success: true,
      data: {
        user: { id: newUser.id, email: newUser.email, fullName: newUser.full_name, role: newUser.role },
        ...tokens
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', validateRequest(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = db.memoryDb.findOne('users', u => u.email.toLowerCase() === email.toLowerCase());

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_SUSPENDED', message: 'Your account is suspended. Contact support.' }
      });
    }

    const tokens = generateTokens({ id: user.id, email: user.email, role: user.role });

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
        ...tokens
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_REFRESH_TOKEN', message: 'Refresh token is required' }
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = db.memoryDb.findById('users', decoded.id);
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_USER', message: 'User does not exist or is inactive' }
      });
    }

    revokeToken(refreshToken);
    const newTokens = generateTokens({ id: user.id, email: user.email, role: user.role });

    res.json({
      success: true,
      data: newTokens
    });
  } catch (err) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_REFRESH_TOKEN', message: err.message || 'Refresh token expired' }
    });
  }
});

router.post('/logout', authenticate, (req, res) => {
  if (req.token) {
    revokeToken(req.token);
  }
  if (req.body.refreshToken) {
    revokeToken(req.body.refreshToken);
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

router.get('/me', authenticate, (req, res) => {
  const user = db.memoryDb.findById('users', req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
  }

  let sellerProfile = null;
  if (user.role === 'seller') {
    sellerProfile = db.memoryDb.findOne('sellers', s => s.user_id === user.id);
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at
      },
      seller: sellerProfile
    }
  });
});

module.exports = router;
