const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const User = require('../models/User');
const Earning = require('../models/Earning');

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'miniFaucet_bot';
const MINI_APP_NAME = process.env.MINI_APP_NAME || 'miniFaucet';

// Get referral stats
router.get('/stats', authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Count referrals
    const referralCount = await User.countDocuments({ referredBy: user._id });
    
    // Get referral earnings
    const referralEarnings = await Earning.find({
      user: user._id,
      type: 'referral'
    }).sort({ createdAt: -1 });

    // Get referred users
    const referredUsers = await User.find({ referredBy: user._id })
      .select('username firstName lastName createdAt totalEarnings')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      referralCode: user.referralCode,
      referralCount,
      referralEarnings: user.referralEarnings,
      referralLink: `https://t.me/${BOT_USERNAME}/${MINI_APP_NAME}?startapp=${user.referralCode}`,
      earnings: referralEarnings,
      referredUsers
    });
  } catch (error) {
    console.error('Referral stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Register with referral code (called during initial registration)
router.post('/register', async (req, res) => {
  try {
    const { telegramId, referralCode } = req.body;

    if (!telegramId || !referralCode) {
      return res.status(400).json({ message: 'Telegram ID and referral code are required' });
    }

    const referrer = await User.findOne({ referralCode });
    if (!referrer) {
      return res.status(404).json({ message: 'Invalid referral code' });
    }

    const user = await User.findOne({ telegramId: telegramId.toString() });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already referred
    if (user.referredBy) {
      return res.status(400).json({ message: 'User already has a referrer' });
    }

    // Set referrer
    user.referredBy = referrer._id;
    await user.save();

    // Get referral commission setting
    const Settings = require('../models/Settings');
    const commissionSetting = await Settings.findOne({ key: 'referral_commission' });
    const commission = commissionSetting?.value || parseFloat(process.env.DEFAULT_REFERRAL_COMMISSION || 10);

    res.json({
      message: 'Referral registered successfully',
      referrer: {
        username: referrer.username,
        referralCode: referrer.referralCode
      },
      commission
    });
  } catch (error) {
    console.error('Referral registration error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
