const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Telegram rate limits (conservative for safety and policy compliance)
const RATE_LIMITS = {
  messagesPerSecond: 25,        // Telegram allows ~30/sec, we use 25 for safety
  messagesPerMinute: 1000,      // Conservative limit
  batchSize: 25,                // Messages per batch
  batchDelayMs: 1100,           // Delay between batches (slightly over 1 sec)
  retryDelayMs: 5000,           // Delay before retry on rate limit
  maxRetries: 3,                // Max retry attempts per message
  connectionTimeout: 15000,     // 15 second timeout
  largeBroadcastThreshold: 1000 // Use slower rate for broadcasts > 1000 users
};

/**
 * Sleep utility function
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Send a message to a specific Telegram user with retry logic
 * @param {string} chatId - Telegram chat ID
 * @param {string} message - Message text (supports HTML formatting)
 * @param {object} options - Additional options
 * @returns {Promise<object>} - Telegram API response
 */
async function sendMessage(chatId, message, options = {}) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('Telegram bot token not configured');
    return { ok: false, error: 'Bot token not configured', errorCode: 0 };
  }

  const maxRetries = options.maxRetries || RATE_LIMITS.maxRetries;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: options.parseMode || 'HTML',
        disable_web_page_preview: options.disablePreview !== false,
        disable_notification: options.silent || false
      }, {
        timeout: options.timeout || RATE_LIMITS.connectionTimeout
      });

      return { ok: true, data: response.data };
    } catch (error) {
      lastError = error;
      const errorCode = error.response?.data?.error_code;
      const errorMessage = error.response?.data?.description || error.message;

      // Handle specific error codes
      if (errorCode === 429) {
        // Rate limited - wait and retry
        const retryAfter = error.response?.data?.parameters?.retry_after || 30;
        console.warn(`Rate limited on chat ${chatId}, waiting ${retryAfter}s (attempt ${attempt}/${maxRetries})`);
        
        if (attempt < maxRetries) {
          await sleep(retryAfter * 1000);
          continue;
        }
      } else if (errorCode === 403 || errorCode === 400) {
        // User blocked bot or chat not found - don't retry
        return {
          ok: false,
          error: errorMessage,
          errorCode,
          blocked: errorCode === 403,
          notFound: errorCode === 400
        };
      } else if (attempt < maxRetries) {
        // Other error - retry with exponential backoff
        const delay = RATE_LIMITS.retryDelayMs * attempt;
        console.warn(`Error sending to ${chatId}: ${errorMessage}. Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      // Final attempt failed
      console.error(`Failed to send message to ${chatId} after ${maxRetries} attempts:`, errorMessage);
      return {
        ok: false,
        error: errorMessage,
        errorCode: errorCode || 0
      };
    }
  }

  return {
    ok: false,
    error: lastError?.message || 'Unknown error',
    errorCode: 0
  };
}

/**
 * Advanced broadcast notification to multiple users
 * Designed for scalability up to 50,000+ users with Telegram policy compliance
 * 
 * @param {Array} users - Array of user objects with telegramId
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {object} options - Additional options
 * @param {function} progressCallback - Called with progress updates
 * @returns {Promise<object>} - Summary of broadcast results
 */
async function sendBroadcast(users, title, message, options = {}, progressCallback = null) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('Telegram bot token not configured - skipping broadcast');
    return { 
      ok: false, 
      error: 'Bot token not configured',
      sent: 0, 
      failed: 0, 
      total: users.length 
    };
  }

  const startTime = Date.now();
  
  // Filter out users without telegram IDs
  const eligibleUsers = users.filter(u => u.telegramId && u.telegramId.toString().trim() !== '');
  
  const results = {
    sent: 0,
    failed: 0,
    blocked: 0,
    skipped: users.length - eligibleUsers.length,
    errors: [],
    blockedUserIds: [],
    total: users.length,
    eligible: eligibleUsers.length
  };

  if (eligibleUsers.length === 0) {
    return {
      ok: false,
      error: 'No eligible users with Telegram IDs',
      ...results
    };
  }

  // Format the message with title and priority styling
  const priorityEmojis = {
    low: '📌',
    normal: '📢',
    high: '⚠️',
    urgent: '🚨'
  };
  const emoji = priorityEmojis[options.priority] || '📢';
  const formattedMessage = `<b>${emoji} ${title}</b>\n\n${message}`;

  // Calculate optimal batch settings based on audience size
  const isLargeBroadcast = eligibleUsers.length > RATE_LIMITS.largeBroadcastThreshold;
  const batchSize = options.batchSize || (isLargeBroadcast ? 20 : RATE_LIMITS.batchSize);
  const batchDelay = options.delay || (isLargeBroadcast ? 1500 : RATE_LIMITS.batchDelayMs);

  console.log(`Starting broadcast to ${eligibleUsers.length} users (batch: ${batchSize}, delay: ${batchDelay}ms)`);

  // Process in batches
  for (let i = 0; i < eligibleUsers.length; i += batchSize) {
    const batch = eligibleUsers.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(eligibleUsers.length / batchSize);

    // Process batch with controlled concurrency
    const batchResults = await Promise.all(
      batch.map(async (user) => {
        const result = await sendMessage(user.telegramId, formattedMessage, {
          parseMode: 'HTML',
          maxRetries: 2, // Fewer retries for broadcasts
          timeout: 10000,
          silent: options.silent
        });

        return {
          userId: user._id,
          telegramId: user.telegramId,
          username: user.username,
          ...result
        };
      })
    );

    // Process results
    batchResults.forEach(result => {
      if (result.ok) {
        results.sent++;
      } else {
        results.failed++;
        
        // Track blocked users
        if (result.blocked || result.errorCode === 403) {
          results.blocked++;
          results.blockedUserIds.push(result.userId);
        }
        
        // Store sample errors for debugging (max 50)
        if (results.errors.length < 50) {
          results.errors.push({
            userId: result.userId,
            telegramId: result.telegramId,
            username: result.username,
            error: result.error,
            errorCode: result.errorCode
          });
        }
      }
    });

    // Report progress
    if (progressCallback) {
      progressCallback({
        batch: batchNumber,
        totalBatches,
        processed: Math.min(i + batchSize, eligibleUsers.length),
        total: eligibleUsers.length,
        sent: results.sent,
        failed: results.failed,
        percentComplete: Math.round(((i + batchSize) / eligibleUsers.length) * 100)
      });
    }

    // Delay between batches (except for last batch)
    if (i + batchSize < eligibleUsers.length) {
      await sleep(batchDelay);
      
      // Additional delay every 500 messages for large broadcasts
      if (isLargeBroadcast && (i + batchSize) % 500 === 0) {
        console.log(`Broadcast progress: ${results.sent}/${eligibleUsers.length} sent, pausing briefly...`);
        await sleep(2000); // Extra 2 second pause every 500 messages
      }
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  const deliveryRate = results.sent + results.failed > 0 
    ? Math.round((results.sent / (results.sent + results.failed)) * 100) 
    : 0;

  console.log(`Broadcast complete in ${duration}s: ${results.sent}/${results.eligible} sent (${deliveryRate}% rate), ${results.failed} failed (${results.blocked} blocked)`);
  
  return {
    ok: results.sent > 0,
    ...results,
    durationSeconds: duration,
    deliveryRate
  };
}

/**
 * Send notification to a single user via Telegram
 * @param {string} telegramId - User's Telegram ID
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Notification type (for emoji selection)
 */
async function sendNotification(telegramId, title, message, type = 'system') {
  const typeEmojis = {
    system: '⚙️',
    withdrawal: '💸',
    task: '✅',
    referral: '👥',
    announcement: '📢',
    reward: '🎁',
    warning: '⚠️',
    success: '✅'
  };

  const emoji = typeEmojis[type] || '📌';
  const formattedMessage = `<b>${emoji} ${title}</b>\n\n${message}`;

  return await sendMessage(telegramId, formattedMessage);
}

/**
 * Check if the bot is properly configured and working
 * @returns {Promise<object>} - Bot info or error
 */
async function getBotInfo() {
  if (!TELEGRAM_BOT_TOKEN) {
    return { ok: false, error: 'Bot token not configured' };
  }

  try {
    const response = await axios.get(`${TELEGRAM_API_URL}/getMe`, {
      timeout: 5000
    });
    return { ok: true, data: response.data.result };
  } catch (error) {
    return { 
      ok: false, 
      error: error.response?.data?.description || error.message 
    };
  }
}

/**
 * Get estimated time for broadcast based on user count
 * @param {number} userCount - Number of users
 * @returns {object} - Estimated time info
 */
function getEstimatedBroadcastTime(userCount) {
  const isLarge = userCount > RATE_LIMITS.largeBroadcastThreshold;
  const batchSize = isLarge ? 20 : RATE_LIMITS.batchSize;
  const batchDelay = isLarge ? 1500 : RATE_LIMITS.batchDelayMs;
  
  const batches = Math.ceil(userCount / batchSize);
  const totalDelayMs = (batches - 1) * batchDelay;
  
  // Add extra delays for large broadcasts
  const extraDelays = isLarge ? Math.floor(userCount / 500) * 2000 : 0;
  
  const estimatedSeconds = Math.ceil((totalDelayMs + extraDelays) / 1000) + batches;
  const estimatedMinutes = Math.ceil(estimatedSeconds / 60);

  return {
    estimatedSeconds,
    estimatedMinutes,
    formatted: estimatedMinutes > 1 ? `~${estimatedMinutes} minutes` : `~${estimatedSeconds} seconds`,
    batches,
    batchSize,
    isLargeBroadcast: isLarge
  };
}

module.exports = {
  sendMessage,
  sendBroadcast,
  sendNotification,
  getBotInfo,
  getEstimatedBroadcastTime,
  RATE_LIMITS
};
