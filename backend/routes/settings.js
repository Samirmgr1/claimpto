const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const WithdrawalMethod = require('../models/WithdrawalMethod');

// Get all public settings for frontend sync
router.get('/public', async (req, res) => {
  try {
    const settings = await Settings.find();
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });

    // Get enabled withdrawal methods
    const withdrawalMethods = await WithdrawalMethod.find({ isEnabled: true })
      .sort({ sortOrder: 1, name: 1 })
      .select('name slug description logo currency minAmount maxAmount processingTime fee feeType customFields');

    // Comprehensive settings object
    res.json({
      // App Settings
      appName: settingsObj.app_name || process.env.APP_NAME || 'MiniFaucet',
      currencySymbol: settingsObj.currency_symbol || process.env.CURRENCY_SYMBOL || '₮',
      currencyName: settingsObj.currency_name || 'Coins',
      
      // Currency Configuration
      currencyMode: settingsObj.currency_mode || 'fiat', // 'fiat' or 'points'
      pointsExchangeRate: settingsObj.points_exchange_rate || 1000, // Points per 1 USD
      
      // Support Settings
      supportTelegramId: settingsObj.support_telegram_id || '',
      
      // Faucet Settings
      faucetEnabled: settingsObj.faucet_enabled !== false,
      faucetReward: settingsObj.faucet_reward || parseFloat(process.env.DEFAULT_FAUCET_REWARD || 0.1),
      faucetCooldown: settingsObj.faucet_cooldown || parseFloat(process.env.DEFAULT_FAUCET_COOLDOWN || 60),
      
      // Referral Settings
      referralEnabled: settingsObj.referral_enabled !== false,
      referralCommission: settingsObj.referral_commission || parseFloat(process.env.DEFAULT_REFERRAL_COMMISSION || 10),
      
      // Withdrawal Settings
      withdrawalEnabled: settingsObj.withdrawal_enabled !== false,
      minWithdrawal: settingsObj.min_withdrawal_amount || parseFloat(process.env.MIN_WITHDRAWAL_AMOUNT || 1),
      maxWithdrawal: settingsObj.max_withdrawal_amount || 1000,
      withdrawalMethods: withdrawalMethods,
      
      // Task Settings
      tasksEnabled: settingsObj.tasks_enabled !== false,
      
      // Ads Settings
      adsEnabled: settingsObj.ads_enabled !== false,
      
      // Maintenance Mode
      maintenanceMode: settingsObj.maintenance_mode === true,
      maintenanceMessage: settingsObj.maintenance_message || 'We are currently performing maintenance. Please check back later.',
      
      // Legal Settings
      privacyPolicy: settingsObj.privacy_policy || '',
      termsAndConditions: settingsObj.terms_and_conditions || '',
      
      // Social Media Links
      socialLinks: {
        telegram: settingsObj.social_telegram || '',
        twitter: settingsObj.social_twitter || '',
        youtube: settingsObj.social_youtube || '',
        discord: settingsObj.social_discord || '',
        instagram: settingsObj.social_instagram || ''
      },
      
      // Platform Access Control
      accessControl: {
        telegramWebEnabled: settingsObj.telegram_web_enabled !== false,
        telegramDesktopEnabled: settingsObj.telegram_desktop_enabled !== false,
        telegramMobileEnabled: settingsObj.telegram_mobile_enabled !== false,
        adblockerEnforcementEnabled: settingsObj.adblocker_enforcement_enabled === true
      },
      
      // Cloudflare Turnstile (only expose site key - never the secret key)
      turnstile: {
        enabled: settingsObj.turnstile_enabled === true,
        siteKey: settingsObj.turnstile_site_key || ''
      }
    });
  } catch (error) {
    console.error('Get public settings error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
