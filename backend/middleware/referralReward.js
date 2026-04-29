const User = require('../models/User');
const Earning = require('../models/Earning');
const Settings = require('../models/Settings');

// ============================================
// LICENSE INTEGRATION (distributed enforcement)
// ============================================
const { getLicenseConstants } = require('../utils/licenseValidator');

// Award referral commission when user earns
// SECURITY: Commission calculation uses license-derived multiplier
async function awardReferralCommission(userId, earningAmount, earningType) {
  try {
    // Check license constants (silent failure if invalid)
    const licenseConstants = getLicenseConstants();
    if (!licenseConstants) {
      // No valid license - skip referral rewards silently
      return;
    }
    
    const user = await User.findById(userId);
    if (!user || !user.referredBy) {
      return; // No referrer
    }

    // Get referral commission setting
    const commissionSetting = await Settings.findOne({ key: 'referral_commission' });
    const commissionPercent = commissionSetting?.value || parseFloat(process.env.DEFAULT_REFERRAL_COMMISSION || 10);

    // Calculate commission with license multiplier
    // Invalid license = multiplier is undefined = no commission
    const commission = (earningAmount * commissionPercent / 100) * (licenseConstants.payoutMultiplier || 0);

    if (commission > 0) {
      // Update referrer's balance and earnings
      const referrer = await User.findById(user.referredBy);
      if (referrer && referrer.status === 'active') {
        referrer.balance += commission;
        referrer.totalEarnings += commission;
        referrer.referralEarnings += commission;
        await referrer.save();

        // Create earning record for referrer
        const earning = new Earning({
          user: referrer._id,
          type: 'referral',
          amount: commission,
          description: `Referral commission from ${user.username || user.telegramId}`,
          referralUserId: user._id
        });
        await earning.save();
      }
    }
  } catch (error) {
    console.error('Referral commission error:', error);
    // Don't throw error - referral commission failure shouldn't break the main flow
  }
}

module.exports = { awardReferralCommission };
