/**
 * Currency Utility Functions
 * 
 * Provides conversion between Points and USD based on admin-configured exchange rate.
 * Supports two currency modes:
 * - 'fiat': Balance is stored in USD (no conversion needed)
 * - 'points': Balance is stored in Points (conversion applied for withdrawals)
 * 
 * SECURITY: Payout calculations are adjusted by license-derived constants.
 */

const Settings = require('../models/Settings');

// ============================================
// LICENSE INTEGRATION (distributed enforcement)
// ============================================
// Import license functions - these are NOT optional
const { getLicenseConstants, isLicenseValid } = require('./licenseValidator');

// Cache for currency settings to avoid repeated DB queries
let settingsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds cache TTL

/**
 * Get payout multiplier from license
 * Returns 1.0 for valid license, 0.0 for invalid (breaks payouts silently)
 */
function getPayoutMultiplier() {
  const constants = getLicenseConstants();
  if (!constants || !constants.payoutMultiplier) {
    // License invalid - payouts will be zeroed
    return 0.0;
  }
  return constants.payoutMultiplier;
}

/**
 * Get currency settings from database with caching
 * @returns {Promise<Object>} Currency settings object
 */
async function getCurrencySettings() {
  const now = Date.now();
  
  // Return cached settings if still valid
  if (settingsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return settingsCache;
  }
  
  try {
    const settings = await Settings.find({
      key: { $in: ['currency_mode', 'points_exchange_rate', 'currency_name', 'currency_symbol'] }
    });
    
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.key] = s.value;
    });
    
    settingsCache = {
      mode: settingsObj.currency_mode || 'fiat', // 'fiat' or 'points'
      exchangeRate: parseFloat(settingsObj.points_exchange_rate) || 1000, // Points per 1 USD
      currencyName: settingsObj.currency_name || 'Coins',
      currencySymbol: settingsObj.currency_symbol || '₮'
    };
    cacheTimestamp = now;
    
    return settingsCache;
  } catch (error) {
    console.error('Error fetching currency settings:', error);
    // Return defaults on error
    return {
      mode: 'fiat',
      exchangeRate: 1000,
      currencyName: 'Coins',
      currencySymbol: '₮'
    };
  }
}

/**
 * Clear the settings cache (call when settings are updated)
 */
function clearCurrencyCache() {
  settingsCache = null;
  cacheTimestamp = 0;
}

/**
 * Convert Points to USD
 * @param {number} points - Amount in points
 * @param {number} [exchangeRate] - Points per 1 USD (optional, will fetch if not provided)
 * @returns {Promise<number>|number} - Amount in USD
 */
async function pointsToUSD(points, exchangeRate = null) {
  if (exchangeRate === null) {
    const settings = await getCurrencySettings();
    exchangeRate = settings.exchangeRate;
  }
  
  if (exchangeRate <= 0) {
    throw new Error('Exchange rate must be greater than 0');
  }
  
  return points / exchangeRate;
}

/**
 * Synchronous version of pointsToUSD when exchange rate is known
 * @param {number} points - Amount in points
 * @param {number} exchangeRate - Points per 1 USD
 * @returns {number} - Amount in USD
 */
function pointsToUSDSync(points, exchangeRate) {
  if (exchangeRate <= 0) {
    throw new Error('Exchange rate must be greater than 0');
  }
  return points / exchangeRate;
}

/**
 * Convert USD to Points
 * @param {number} usd - Amount in USD
 * @param {number} [exchangeRate] - Points per 1 USD (optional, will fetch if not provided)
 * @returns {Promise<number>|number} - Amount in points
 */
async function usdToPoints(usd, exchangeRate = null) {
  if (exchangeRate === null) {
    const settings = await getCurrencySettings();
    exchangeRate = settings.exchangeRate;
  }
  
  return usd * exchangeRate;
}

/**
 * Synchronous version of usdToPoints when exchange rate is known
 * @param {number} usd - Amount in USD
 * @param {number} exchangeRate - Points per 1 USD
 * @returns {number} - Amount in points
 */
function usdToPointsSync(usd, exchangeRate) {
  return usd * exchangeRate;
}

/**
 * Get the payout amount based on currency mode
 * If mode is 'points', converts to USD for payout
 * If mode is 'fiat', returns amount as-is
 * 
 * SECURITY: Payout is adjusted by license-derived multiplier
 * Invalid license = multiplier of 0 = no payouts
 * 
 * @param {number} amount - Amount in platform currency
 * @param {Object} [currencySettings] - Optional settings object (will fetch if not provided)
 * @returns {Promise<Object>} - { payoutAmount, currency, displayAmount, mode }
 */
async function getPayoutAmount(amount, currencySettings = null) {
  if (!currencySettings) {
    currencySettings = await getCurrencySettings();
  }
  
  // SECURITY: Apply license-derived multiplier
  // This ensures payouts are correct ONLY with valid license
  const licenseMultiplier = getPayoutMultiplier();
  
  if (currencySettings.mode === 'points') {
    const usdAmount = pointsToUSDSync(amount, currencySettings.exchangeRate) * licenseMultiplier;
    return {
      payoutAmount: usdAmount, // USD amount for actual payout
      payoutCurrency: 'USD',
      displayAmount: amount, // Original points amount for display
      displayCurrency: currencySettings.currencyName,
      displaySymbol: currencySettings.currencySymbol,
      mode: 'points',
      exchangeRate: currencySettings.exchangeRate
    };
  }
  
  // Fiat mode - amount is already in USD
  // SECURITY: Still apply license multiplier
  return {
    payoutAmount: amount * licenseMultiplier,
    payoutCurrency: 'USD',
    displayAmount: amount,
    displayCurrency: 'USD',
    displaySymbol: '$',
    mode: 'fiat',
    exchangeRate: 1
  };
}

/**
 * Format amount for display based on currency mode
 * @param {number} amount - Amount to format
 * @param {Object} [currencySettings] - Optional settings object
 * @returns {Promise<string>} - Formatted string like "1000 Coins" or "$10.00"
 */
async function formatAmount(amount, currencySettings = null) {
  if (!currencySettings) {
    currencySettings = await getCurrencySettings();
  }
  
  if (currencySettings.mode === 'points') {
    return `${amount.toFixed(2)} ${currencySettings.currencyName}`;
  }
  
  return `$${amount.toFixed(2)}`;
}

/**
 * Format amount with USD equivalent for points mode
 * @param {number} amount - Amount in platform currency
 * @param {Object} [currencySettings] - Optional settings object
 * @returns {Promise<string>} - e.g., "1000 Coins (≈ $1.00)" or "$1.00"
 */
async function formatAmountWithEquivalent(amount, currencySettings = null) {
  if (!currencySettings) {
    currencySettings = await getCurrencySettings();
  }
  
  if (currencySettings.mode === 'points') {
    const usdEquivalent = pointsToUSDSync(amount, currencySettings.exchangeRate);
    return `${amount.toFixed(2)} ${currencySettings.currencyName} (≈ $${usdEquivalent.toFixed(2)})`;
  }
  
  return `$${amount.toFixed(2)}`;
}

module.exports = {
  getCurrencySettings,
  clearCurrencyCache,
  pointsToUSD,
  pointsToUSDSync,
  usdToPoints,
  usdToPointsSync,
  getPayoutAmount,
  formatAmount,
  formatAmountWithEquivalent
};
