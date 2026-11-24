const express = require('express');
const { z } = require('zod');
const db = require('../../database/db');
const { authenticate } = require('../../middleware/auth');
const { requireSeller, requireAdmin } = require('../../middleware/rbac');
const { validateRequest } = require('../../middleware/validate');

const router = express.Router();

const onboardSchema = {
  body: z.object({
    storeName: z.string().min(3),
    businessNumber: z.string().min(5),
    supportEmail: z.string().email(),
    payoutBankAccount: z.string().min(6)
  })
};

// Seller onboarding
router.post('/onboard', authenticate, validateRequest(onboardSchema), async (req, res, next) => {
  try {
    const existing = db.memoryDb.findOne('sellers', s => s.user_id === req.user.id || s.store_name.toLowerCase() === req.body.storeName.toLowerCase());
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'SELLER_EXISTS', message: 'A seller profile already exists for this user or store name is taken' }
      });
    }

    // Update user role to seller if not admin
    if (req.user.role !== 'admin') {
      db.memoryDb.update('users', req.user.id, { role: 'seller' });
    }

    const seller = db.memoryDb.insert('sellers', {
      user_id: req.user.id,
      store_name: req.body.storeName,
      business_number: req.body.businessNumber,
      support_email: req.body.supportEmail,
      kyc_status: 'approved', // auto-approve for testing sandbox
      commission_rate: 10.00,
      payout_bank_account: req.body.payoutBankAccount,
      rating: 5.00
    });

    res.status(201).json({ success: true, data: seller });
  } catch (err) {
    next(err);
  }
});

// Get current seller profile
router.get('/profile', authenticate, requireSeller, (req, res) => {
  const seller = db.memoryDb.findOne('sellers', s => s.user_id === req.user.id);
  if (!seller && req.user.role !== 'admin') {
    return res.status(404).json({ success: false, error: { code: 'NOT_A_SELLER', message: 'Seller profile not found' } });
  }
  res.json({ success: true, data: seller });
});

// Admin: List all sellers
router.get('/', authenticate, requireAdmin, (req, res) => {
  const sellers = db.memoryDb.find('sellers');
  res.json({ success: true, data: sellers });
});

// Admin: Update seller KYC status or commission rate
router.patch('/:id/status', authenticate, requireAdmin, (req, res) => {
  const { kyc_status, commission_rate } = req.body;
  const updates = {};
  if (kyc_status) updates.kyc_status = kyc_status;
  if (commission_rate !== undefined) updates.commission_rate = commission_rate;

  const updated = db.memoryDb.update('sellers', req.params.id, updates);
  if (!updated) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Seller not found' } });
  }
  res.json({ success: true, data: updated });
});

module.exports = router;
