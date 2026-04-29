const mongoose = require('mongoose');

/**
 * AdPlacement Model
 * 
 * Stores admin-configured HTML/JS ad codes from any ad network
 * (AdSense, BitMedia, Coinzilla, CryptoCoinAds, etc.)
 * and maps them to predefined slot positions in the app UI.
 */

// Available ad slot positions across the app
const AD_SLOTS = {
  // Dashboard page slots
  DASHBOARD_TOP: 'dashboard_top',
  DASHBOARD_AFTER_STATS: 'dashboard_after_stats',
  DASHBOARD_AFTER_FAUCET: 'dashboard_after_faucet',
  DASHBOARD_BOTTOM: 'dashboard_bottom',

  // Earnings page slots
  EARNINGS_TOP: 'earnings_top',
  EARNINGS_BOTTOM: 'earnings_bottom',

  // Tasks page slots
  TASKS_TOP: 'tasks_top',
  TASKS_BETWEEN_LIST: 'tasks_between_list',
  TASKS_BOTTOM: 'tasks_bottom',

  // Ads page slots
  ADS_PAGE_TOP: 'ads_page_top',
  ADS_PAGE_BOTTOM: 'ads_page_bottom',

  // Referrals page slots
  REFERRALS_TOP: 'referrals_top',
  REFERRALS_BOTTOM: 'referrals_bottom',

  // Withdrawals page slots
  WITHDRAWALS_TOP: 'withdrawals_top',
  WITHDRAWALS_BOTTOM: 'withdrawals_bottom',

  // Profile page slots
  PROFILE_TOP: 'profile_top',
  PROFILE_BOTTOM: 'profile_bottom',

  // Global slots (appear across all pages)
  GLOBAL_HEADER: 'global_header',
  GLOBAL_FOOTER: 'global_footer',
  GLOBAL_STICKY_BOTTOM: 'global_sticky_bottom',
  GLOBAL_POPUP: 'global_popup',
};

// Human-readable labels for admin UI
const AD_SLOT_LABELS = {
  [AD_SLOTS.DASHBOARD_TOP]: '📊 Dashboard — Top Banner',
  [AD_SLOTS.DASHBOARD_AFTER_STATS]: '📊 Dashboard — After Stats Grid',
  [AD_SLOTS.DASHBOARD_AFTER_FAUCET]: '📊 Dashboard — After Faucet Section',
  [AD_SLOTS.DASHBOARD_BOTTOM]: '📊 Dashboard — Bottom',
  [AD_SLOTS.EARNINGS_TOP]: '💰 Earnings — Top Banner',
  [AD_SLOTS.EARNINGS_BOTTOM]: '💰 Earnings — Bottom',
  [AD_SLOTS.TASKS_TOP]: '✅ Tasks — Top Banner',
  [AD_SLOTS.TASKS_BETWEEN_LIST]: '✅ Tasks — Between Task Items',
  [AD_SLOTS.TASKS_BOTTOM]: '✅ Tasks — Bottom',
  [AD_SLOTS.ADS_PAGE_TOP]: '📺 Ads Page — Top Banner',
  [AD_SLOTS.ADS_PAGE_BOTTOM]: '📺 Ads Page — Bottom',
  [AD_SLOTS.REFERRALS_TOP]: '👥 Referrals — Top Banner',
  [AD_SLOTS.REFERRALS_BOTTOM]: '👥 Referrals — Bottom',
  [AD_SLOTS.WITHDRAWALS_TOP]: '💸 Withdrawals — Top Banner',
  [AD_SLOTS.WITHDRAWALS_BOTTOM]: '💸 Withdrawals — Bottom',
  [AD_SLOTS.PROFILE_TOP]: '👤 Profile — Top Banner',
  [AD_SLOTS.PROFILE_BOTTOM]: '👤 Profile — Bottom',
  [AD_SLOTS.GLOBAL_HEADER]: '🌐 Global — Below Header (All Pages)',
  [AD_SLOTS.GLOBAL_FOOTER]: '🌐 Global — Above Footer (All Pages)',
  [AD_SLOTS.GLOBAL_STICKY_BOTTOM]: '🌐 Global — Sticky Bottom Banner',
  [AD_SLOTS.GLOBAL_POPUP]: '🌐 Global — Popup/Interstitial',
};

// Recommended sizes for each slot
const AD_SLOT_SIZES = {
  [AD_SLOTS.DASHBOARD_TOP]: { label: '320×50 / 320×100 Banner', width: 320, height: 100 },
  [AD_SLOTS.DASHBOARD_AFTER_STATS]: { label: '300×250 Rectangle', width: 300, height: 250 },
  [AD_SLOTS.DASHBOARD_AFTER_FAUCET]: { label: '320×50 / 320×100 Banner', width: 320, height: 100 },
  [AD_SLOTS.DASHBOARD_BOTTOM]: { label: '300×250 / 320×50 Banner', width: 300, height: 250 },
  [AD_SLOTS.EARNINGS_TOP]: { label: '320×50 / 320×100 Banner', width: 320, height: 100 },
  [AD_SLOTS.EARNINGS_BOTTOM]: { label: '300×250 Rectangle', width: 300, height: 250 },
  [AD_SLOTS.TASKS_TOP]: { label: '320×50 / 320×100 Banner', width: 320, height: 100 },
  [AD_SLOTS.TASKS_BETWEEN_LIST]: { label: '300×250 / Native Ad', width: 300, height: 250 },
  [AD_SLOTS.TASKS_BOTTOM]: { label: '300×250 Rectangle', width: 300, height: 250 },
  [AD_SLOTS.ADS_PAGE_TOP]: { label: '320×50 / 320×100 Banner', width: 320, height: 100 },
  [AD_SLOTS.ADS_PAGE_BOTTOM]: { label: '300×250 Rectangle', width: 300, height: 250 },
  [AD_SLOTS.REFERRALS_TOP]: { label: '320×50 / 320×100 Banner', width: 320, height: 100 },
  [AD_SLOTS.REFERRALS_BOTTOM]: { label: '300×250 Rectangle', width: 300, height: 250 },
  [AD_SLOTS.WITHDRAWALS_TOP]: { label: '320×50 / 320×100 Banner', width: 320, height: 100 },
  [AD_SLOTS.WITHDRAWALS_BOTTOM]: { label: '300×250 Rectangle', width: 300, height: 250 },
  [AD_SLOTS.PROFILE_TOP]: { label: '320×50 / 320×100 Banner', width: 320, height: 100 },
  [AD_SLOTS.PROFILE_BOTTOM]: { label: '300×250 Rectangle', width: 300, height: 250 },
  [AD_SLOTS.GLOBAL_HEADER]: { label: '728×90 Leaderboard / 320×50 Mobile', width: 728, height: 90 },
  [AD_SLOTS.GLOBAL_FOOTER]: { label: '728×90 Leaderboard / 320×50 Mobile', width: 728, height: 90 },
  [AD_SLOTS.GLOBAL_STICKY_BOTTOM]: { label: '320×50 Sticky Banner', width: 320, height: 50 },
  [AD_SLOTS.GLOBAL_POPUP]: { label: '300×250 / 336×280 Popup', width: 300, height: 250 },
};

const adPlacementSchema = new mongoose.Schema({
  // Admin-friendly label
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  // Which slot this ad occupies
  slotId: {
    type: String,
    required: true,
    enum: Object.values(AD_SLOTS),
    index: true
  },

  // Raw HTML/JS ad code from any ad network
  adCode: {
    type: String,
    required: true
  },

  // Ad network identifier (for reference only)
  adNetwork: {
    type: String,
    trim: true,
    default: 'custom',
    enum: [
      'custom',
      'adsense',
      'bitmedia',
      'coinzilla',
      'cryptocoinads',
      'a-ads',
      'cointraffic',
      'mellow_ads',
      'adsterra',
      'propellerads',
      'monetag',
      'other'
    ]
  },

  // Whether this placement is active
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  // Priority for ordering (higher = shown first if multiple ads in same slot)
  priority: {
    type: Number,
    default: 0
  },

  // Optional notes for admin
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
adPlacementSchema.index({ slotId: 1, isActive: 1, priority: -1 });

const AdPlacement = mongoose.model('AdPlacement', adPlacementSchema);

module.exports = { AdPlacement, AD_SLOTS, AD_SLOT_LABELS, AD_SLOT_SIZES };

