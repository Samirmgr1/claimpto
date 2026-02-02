const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const { verifyTurnstile } = require('../middleware/turnstile');
const User = require('../models/User');
const Withdrawal = require('../models/Withdrawal');
const Settings = require('../models/Settings');
const WithdrawalMethod = require('../models/WithdrawalMethod');
const { getCurrencySettings, getPayoutAmount } = require('../utils/currency');

// ============================================
// LICENSE INTEGRATION (distributed enforcement)
// ============================================
const { getLicenseConstants, isLicenseValid } = require('../utils/licenseValidator');

// Verify license before processing withdrawals
// Returns false if license is invalid (blocks withdrawals silently)
function verifyWithdrawalLicense() {
  const constants = getLicenseConstants();
  if (!constants || !constants.features) {
    return false;
  }
  return constants.features.exportEnabled === true;
}

// Get withdrawal methods and settings
router.get('/methods', authenticateUser, async (req, res) => {
  try {
    // Check if withdrawals are enabled
    const withdrawalSetting = await Settings.findOne({ key: 'withdrawal_enabled' });
    const withdrawalEnabled = withdrawalSetting?.value !== false;

    if (!withdrawalEnabled) {
      return res.json({
        enabled: false,
        methods: [],
        message: 'Withdrawals are currently disabled'
      });
    }

    // Get enabled withdrawal methods
    const methods = await WithdrawalMethod.find({ isEnabled: true })
      .sort({ sortOrder: 1, name: 1 })
      .select('name slug description logo currency minAmount maxAmount processingTime fee feeType customFields');

    res.json({
      enabled: true,
      methods
    });
  } catch (error) {
    console.error('Get withdrawal methods error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Request withdrawal (enhanced, protected by Turnstile)
router.post('/request', authenticateUser, verifyTurnstile, async (req, res) => {
  try {
    const { amount, methodId, submittedFields } = req.body;

    // ============================================
    // LICENSE VERIFICATION (distributed check)
    // ============================================
    if (!verifyWithdrawalLicense()) {
      // Don't reveal license issue - appear as system error
      console.error('[WITHDRAWAL] License verification failed');
      return res.status(503).json({ 
        message: 'Withdrawal service temporarily unavailable. Please try again later.' 
      });
    }

    // Check if withdrawals are enabled
    const withdrawalSetting = await Settings.findOne({ key: 'withdrawal_enabled' });
    if (withdrawalSetting?.value === false) {
      return res.status(403).json({ message: 'Withdrawals are currently disabled' });
    }

    if (!amount || !methodId) {
      return res.status(400).json({ message: 'Amount and withdrawal method are required' });
    }

    const user = await User.findById(req.user._id);

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Account is suspended or banned' });
    }

    // Get the withdrawal method
    const method = await WithdrawalMethod.findById(methodId);
    if (!method || !method.isEnabled) {
      return res.status(400).json({ message: 'Invalid or disabled withdrawal method' });
    }

    const withdrawAmount = parseFloat(amount);

    // Validate amount against method limits
    if (withdrawAmount < method.minAmount) {
      return res.status(400).json({
        message: `Minimum withdrawal for ${method.name} is ${method.minAmount} ${method.currency}`
      });
    }

    if (withdrawAmount > method.maxAmount) {
      return res.status(400).json({
        message: `Maximum withdrawal for ${method.name} is ${method.maxAmount} ${method.currency}`
      });
    }

    if (user.balance < withdrawAmount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Validate required custom fields
    if (method.customFields && method.customFields.length > 0) {
      for (const field of method.customFields) {
        if (field.required && (!submittedFields || !submittedFields[field.name])) {
          return res.status(400).json({ message: `${field.label} is required` });
        }
      }
    }

    // Check if there's a pending withdrawal
    const pendingWithdrawal = await Withdrawal.findOne({
      user: user._id,
      status: 'pending'
    });

    if (pendingWithdrawal) {
      return res.status(400).json({ message: 'You already have a pending withdrawal request' });
    }

    // Calculate fee
    let fee = 0;
    if (method.fee > 0) {
      if (method.feeType === 'percentage') {
        fee = (withdrawAmount * method.fee) / 100;
      } else {
        fee = method.fee;
      }
    }

    const netAmount = withdrawAmount - fee;

    // Get currency settings for payout calculation
    const currencySettings = await getCurrencySettings();
    const payoutInfo = await getPayoutAmount(netAmount, currencySettings);

    // Create withdrawal request
    const withdrawal = new Withdrawal({
      user: user._id,
      amount: withdrawAmount,
      withdrawalMethod: method._id,
      method: method.name,
      submittedFields: new Map(Object.entries(submittedFields || {})),
      address: submittedFields?.wallet_address || submittedFields?.address || '',
      fee: fee,
      netAmount: netAmount,
      // Currency conversion fields
      currencyMode: currencySettings.mode,
      exchangeRate: currencySettings.exchangeRate,
      usdPayoutAmount: payoutInfo.payoutAmount,
      status: 'pending'
    });
    await withdrawal.save();

    // Deduct from balance (will be refunded if rejected)
    user.balance -= withdrawAmount;
    await user.save();

    res.json({
      message: 'Withdrawal request submitted successfully',
      withdrawal: {
        id: withdrawal._id,
        amount: withdrawal.amount,
        fee: withdrawal.fee,
        netAmount: withdrawal.netAmount,
        usdPayoutAmount: withdrawal.usdPayoutAmount,
        currencyMode: withdrawal.currencyMode,
        exchangeRate: withdrawal.exchangeRate,
        method: method.name,
        status: withdrawal.status,
        requestedAt: withdrawal.requestedAt
      }
    });
  } catch (error) {
    console.error('Withdrawal request error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's withdrawal history
router.get('/history', authenticateUser, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ user: req.user._id })
      .sort({ requestedAt: -1 })
      .populate('withdrawalMethod', 'name logo currency')
      .limit(50);

    res.json({ withdrawals });
  } catch (error) {
    console.error('Get withdrawal history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get withdrawal status
router.get('/status/:id', authenticateUser, async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('withdrawalMethod', 'name logo currency');

    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found' });
    }

    res.json({ withdrawal });
  } catch (error) {
    console.error('Get withdrawal status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Legacy info endpoint for backward compatibility
router.get('/info', authenticateUser, async (req, res) => {
  try {
    const withdrawalSetting = await Settings.findOne({ key: 'withdrawal_enabled' });
    const withdrawalEnabled = withdrawalSetting?.value !== false;

    const methods = await WithdrawalMethod.find({ isEnabled: true })
      .sort({ sortOrder: 1 })
      .select('name slug minAmount maxAmount');

    const minAmount = methods.length > 0 
      ? Math.min(...methods.map(m => m.minAmount))
      : 1;
    const maxAmount = methods.length > 0 
      ? Math.max(...methods.map(m => m.maxAmount))
      : 1000;

    res.json({
      enabled: withdrawalEnabled,
      minWithdrawal: minAmount,
      maxWithdrawal: maxAmount,
      methods: methods.map(m => m.name)
    });
  } catch (error) {
    console.error('Get withdrawal info error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
