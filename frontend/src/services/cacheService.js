/**
 * Cache Service for API Response Caching
 * Reduces unnecessary network calls and improves UX
 */

class CacheService {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
    
    // Cache duration in milliseconds
    this.cacheDurations = {
      // User endpoints
      'user/dashboard': 30000,       // 30 seconds - user balance changes frequently
      'settings/public': 300000,     // 5 minutes - settings rarely change
      'referrals/stats': 60000,      // 1 minute
      'tasks/available': 30000,      // 30 seconds - tasks may update
      'withdrawals/methods': 300000, // 5 minutes - methods rarely change
      'withdrawals/history': 30000,  // 30 seconds
      'faucetpay/info': 300000,      // 5 minutes
      'earnings/faucet/status': 10000, // 10 seconds - status updates frequently
      'ads/providers': 300000,       // 5 minutes
      'user/earnings': 30000,        // 30 seconds
      
      // Admin endpoints
      'admin/dashboard': 30000,      // 30 seconds - stats update frequently
      'admin/users': 15000,          // 15 seconds - user list
      'admin/tasks': 30000,          // 30 seconds - tasks list
      'admin/withdrawals': 15000,    // 15 seconds - pending withdrawals
      'admin/withdrawal-methods': 300000, // 5 minutes
      'admin/settings': 60000,       // 1 minute - admin settings
      'admin/analytics': 60000,      // 1 minute - analytics data
      'admin/faucetpay/payments': 15000, // 15 seconds - payment history
      'admin/faucetpay/balance': 60000,  // 1 minute - balance check
      'admin/faucetpay/stats': 30000,    // 30 seconds - stats
      
      'default': 30000               // Default 30 seconds
    };
  }

  /**
   * Generate cache key from URL and params
   */
  getCacheKey(url, params = null) {
    if (params) {
      const paramString = typeof params === 'string' ? params : JSON.stringify(params);
      return `${url}?${paramString}`;
    }
    return url;
  }

  /**
   * Get cache duration for a specific endpoint
   */
  getCacheDuration(url) {
    // Find matching cache duration
    for (const [key, duration] of Object.entries(this.cacheDurations)) {
      if (url.includes(key)) {
        return duration;
      }
    }
    return this.cacheDurations.default;
  }

  /**
   * Check if cached data is valid
   */
  isValid(cacheEntry) {
    if (!cacheEntry) return false;
    return Date.now() - cacheEntry.timestamp < cacheEntry.duration;
  }

  /**
   * Get cached data
   */
  get(key) {
    const entry = this.cache.get(key);
    if (this.isValid(entry)) {
      console.log(`[Cache] HIT: ${key}`);
      return entry.data;
    }
    if (entry) {
      console.log(`[Cache] EXPIRED: ${key}`);
      this.cache.delete(key);
    }
    return null;
  }

  /**
   * Set cached data
   */
  set(key, data, customDuration = null) {
    const duration = customDuration || this.getCacheDuration(key);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      duration
    });
    console.log(`[Cache] SET: ${key} (expires in ${duration}ms)`);
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(key) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
      console.log(`[Cache] INVALIDATED: ${key}`);
    }
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern) {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    if (count > 0) {
      console.log(`[Cache] INVALIDATED ${count} entries matching: ${pattern}`);
    }
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    console.log('[Cache] CLEARED all entries');
  }

  /**
   * Deduplicate concurrent requests for the same resource
   * Returns existing promise if a request is already in-flight
   */
  async deduplicatedFetch(key, fetchFn) {
    // Check cache first
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Check if there's already a pending request
    if (this.pendingRequests.has(key)) {
      console.log(`[Cache] DEDUP: Waiting for existing request: ${key}`);
      return this.pendingRequests.get(key);
    }

    // Create new request promise
    const requestPromise = (async () => {
      try {
        const data = await fetchFn();
        this.set(key, data);
        return data;
      } finally {
        this.pendingRequests.delete(key);
      }
    })();

    this.pendingRequests.set(key, requestPromise);
    return requestPromise;
  }

  /**
   * Get cache stats for debugging
   */
  getStats() {
    return {
      size: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Singleton instance
const cacheService = new CacheService();

export default cacheService;
