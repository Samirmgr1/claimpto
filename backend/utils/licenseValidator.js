/**
 * Enterprise-Grade License Enforcement System
 * 
 * SECURITY NOTICE: This module implements fail-closed license validation.
 * Any validation failure MUST result in application termination or access denial.
 * 
 * DO NOT MODIFY validation logic without security review.
 * DO NOT add bypass mechanisms or environment shortcuts.
 * DO NOT weaken enforcement for convenience.
 * 
 * API Documentation: License Management API v2.0.0
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const os = require('os');

// Cache configuration
const CACHE_FILE = path.join(__dirname, '../../.license_cache');
const OFFLINE_GRACE_PERIOD_MS = 2 * 60 * 60 * 1000; // 2 hours max offline (strict)
const HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const VALIDATION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes in-memory cache

// ============================================
// CRYPTOGRAPHIC SIGNATURE VERIFICATION
// ============================================
// CRITICAL: This public key is embedded and CANNOT be changed by the buyer.
// The license server signs all responses with the corresponding private key.
// Even if someone fakes the license server URL, they cannot forge signatures.
const LICENSE_SERVER_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0ynjHocfhyBbx+9+ewmb
hIgX/9vKTK0+6H717u6hfOePD4rWXqKZNjeVzCasHhM3wbFsAT8Za8z94QCMqiWy
Y10hyqpFNUPaqDy0fK8ka9b35hhkGqYHDp5aSDAP8dg6hkNt4dRE3EL3kDZcmR2C
E56c30SP9rGLXvonIGhuYJ9eVTPHhkRLj1wKQeeRCI6giJXDpAqaqFamxUi5gxMP
B/Fvj8C1rOF59RrC/T70u4hdy5U7yCS6DHU9PQVsDPtH9L+vHljy7BakC6L3Vp1i
oSzZe3yYsvMS2b9c4ODKC9eTomqzpMN9wGQOjS0V3Nt3Lm2a2o8K9hooAZrZ2yZh
AQIDAQAB
-----END PUBLIC KEY-----`;

// License-derived business constants (prevents removal without breaking logic)
let licenseBusinessConstants = null;

// ============================================
// ANTI-TAMPERING SECURITY CONSTANTS
// ============================================
const CACHE_ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const INTEGRITY_CHECK_INTERVAL_MS = 30 * 1000; // Check every 30 seconds
const MAX_CLOCK_DRIFT_MS = 5 * 60 * 1000; // 5 minutes max clock drift allowed

// Machine fingerprint for binding cache to specific server
let machineFingerprint = null;
function getMachineFingerprint() {
  if (machineFingerprint) return machineFingerprint;
  
  const components = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()[0]?.model || 'unknown',
    os.totalmem().toString(),
    process.env.HOSTNAME || '',
    __dirname // Bind to installation path
  ];
  
  machineFingerprint = crypto.createHash('sha256')
    .update(components.join('|'))
    .digest('hex')
    .substring(0, 32);
  
  return machineFingerprint;
}

// Derive encryption key from machine fingerprint + salt
function getCacheEncryptionKey() {
  const fingerprint = getMachineFingerprint();
  const salt = 'minifaucet-license-cache-v2'; // Static salt
  return crypto.scryptSync(fingerprint, salt, 32);
}

// Anti-tampering: Track license validator file hash
let validatorFileHash = null;
function getValidatorFileHash() {
  try {
    const content = fs.readFileSync(__filename, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return 'unknown';
  }
}

// Initialize validator hash on module load
validatorFileHash = getValidatorFileHash();

// Periodic integrity check
let integrityCheckTimer = null;
function startIntegrityChecks() {
  if (integrityCheckTimer) return;
  
  integrityCheckTimer = setInterval(() => {
    const currentHash = getValidatorFileHash();
    if (currentHash !== validatorFileHash && validatorFileHash !== 'unknown') {
      console.error('[LICENSE] ⚠ CRITICAL: License validator file has been modified!');
      console.error('[LICENSE] Expected:', validatorFileHash.substring(0, 16) + '...');
      console.error('[LICENSE] Current:', currentHash.substring(0, 16) + '...');
      // Invalidate license state
      licenseState.isValid = false;
      licenseState.tamperDetected = true;
    }
  }, INTEGRITY_CHECK_INTERVAL_MS);
  
  // Don't prevent process exit
  integrityCheckTimer.unref();
}

// ============================================
// TAMPER-RESISTANT LICENSE STATE
// ============================================
// Uses closure pattern to prevent direct manipulation
const createSecureLicenseState = () => {
  // Private state - not directly accessible
  const _state = {
    isValid: false,
    lastValidation: null,
    lastHeartbeat: null,
    licenseData: null,
    licenseInfo: null,
    clientSecret: null,
    cachedValidation: null,
    cacheTimestamp: null,
    domain: null,
    offlineMode: false,
    graceExpiry: null,
    requiresHeartbeat: false,
    heartbeatInterval: 86400,
    tamperDetected: false,
    validationNonce: crypto.randomBytes(16).toString('hex'), // Random nonce per session
    stateChecksum: null
  };
  
  // Compute state checksum for integrity
  const computeStateChecksum = () => {
    const critical = JSON.stringify({
      v: _state.isValid,
      t: _state.lastValidation,
      d: _state.domain,
      n: _state.validationNonce
    });
    return crypto.createHmac('sha256', getMachineFingerprint())
      .update(critical)
      .digest('hex');
  };
  
  // Update checksum after state change
  const updateChecksum = () => {
    _state.stateChecksum = computeStateChecksum();
  };
  
  // Verify state hasn't been tampered
  const verifyIntegrity = () => {
    if (_state.stateChecksum === null) return true; // Not yet set
    return _state.stateChecksum === computeStateChecksum();
  };
  
  return {
    // Getters - return copies to prevent modification
    get isValid() { 
      if (!verifyIntegrity()) {
        console.error('[LICENSE] State integrity check failed!');
        return false;
      }
      return _state.isValid === true && !_state.tamperDetected; 
    },
    get lastValidation() { return _state.lastValidation; },
    get lastHeartbeat() { return _state.lastHeartbeat; },
    get licenseData() { return _state.licenseData ? { ..._state.licenseData } : null; },
    get licenseInfo() { return _state.licenseInfo ? { ..._state.licenseInfo } : null; },
    get clientSecret() { return _state.clientSecret; },
    get cachedValidation() { return _state.cachedValidation ? { ..._state.cachedValidation } : null; },
    get cacheTimestamp() { return _state.cacheTimestamp; },
    get domain() { return _state.domain; },
    get offlineMode() { return _state.offlineMode; },
    get graceExpiry() { return _state.graceExpiry; },
    get requiresHeartbeat() { return _state.requiresHeartbeat; },
    get heartbeatInterval() { return _state.heartbeatInterval; },
    get tamperDetected() { return _state.tamperDetected; },
    
    // Setters - with integrity update
    set isValid(val) { _state.isValid = val === true; updateChecksum(); },
    set lastValidation(val) { _state.lastValidation = val; updateChecksum(); },
    set lastHeartbeat(val) { _state.lastHeartbeat = val; },
    set licenseData(val) { _state.licenseData = val; },
    set licenseInfo(val) { _state.licenseInfo = val; },
    set clientSecret(val) { _state.clientSecret = val; },
    set cachedValidation(val) { _state.cachedValidation = val; },
    set cacheTimestamp(val) { _state.cacheTimestamp = val; },
    set domain(val) { _state.domain = val; updateChecksum(); },
    set offlineMode(val) { _state.offlineMode = val; },
    set graceExpiry(val) { _state.graceExpiry = val; },
    set requiresHeartbeat(val) { _state.requiresHeartbeat = val; },
    set heartbeatInterval(val) { _state.heartbeatInterval = val; },
    set tamperDetected(val) { _state.tamperDetected = val; updateChecksum(); },
    
    // Reset method
    reset() {
      _state.isValid = false;
      _state.lastValidation = null;
      _state.cachedValidation = null;
      _state.cacheTimestamp = null;
      _state.tamperDetected = false;
      updateChecksum();
    }
  };
};

const licenseState = createSecureLicenseState();

/**
 * Make HTTP/HTTPS request (native, no axios dependency)
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    // Build headers - ensure custom headers override defaults
    const finalHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': `MiniFaucet/${options.version || '1.0.0'}`
    };
    
    // Copy custom headers
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        finalHeaders[key] = value;
      }
    }
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: finalHeaders,
      timeout: options.timeout || 15000
    };
    
    const req = lib.request(reqOptions, (res) => {
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

/**
 * Compute HMAC-SHA256 signature for request payload
 * Format per API docs: sorted key=value pairs joined with &
 * Example: domain=x&licenseKey=y&productId=z&timestamp=123
 */
function computeHmacSignature(licenseKey, domain, productId, timestamp, secret) {
  if (!secret) {
    return null;
  }
  
  // Create payload object with all fields
  const signaturePayload = {
    domain,
    licenseKey,
    productId,
    timestamp
  };
  
  // Sort keys alphabetically and join as key=value pairs with &
  const signatureString = Object.keys(signaturePayload)
    .sort()
    .map(k => `${k}=${signaturePayload[k]}`)
    .join('&');
  
  return crypto.createHmac('sha256', secret).update(signatureString).digest('hex');
}

/**
 * CRITICAL: Verify license server response signature
 * This prevents fake license servers - even if URL is changed,
 * responses cannot be forged without the private key.
 */
function verifyServerSignature(responseData, signature) {
  if (!signature || !responseData) {
    console.warn('[LICENSE] No signature provided by server');
    return false;
  }
  
  try {
    // Create verification object
    const verifier = crypto.createVerify('RSA-SHA256');
    
    // Build canonical response string (sorted, deterministic)
    const canonicalData = JSON.stringify(responseData, Object.keys(responseData).sort());
    verifier.update(canonicalData);
    
    // Verify against embedded public key
    const isValid = verifier.verify(LICENSE_SERVER_PUBLIC_KEY, signature, 'base64');
    
    if (!isValid) {
      console.error('[LICENSE] ✗ CRITICAL: Server signature verification FAILED');
      console.error('[LICENSE] This may indicate a fake license server!');
    }
    
    return isValid;
  } catch (error) {
    console.error('[LICENSE] Signature verification error:', error.message);
    return false;
  }
}

/**
 * Derive business-critical constants from license token
 * These values are REQUIRED for correct application behavior.
 * Removing license = wrong values = silent corruption.
 */
function deriveLicenseConstants(licenseData) {
  if (!licenseData || !licenseData.token) {
    return null;
  }
  
  try {
    // Derive deterministic values from license token
    const tokenHash = crypto.createHash('sha256')
      .update(licenseData.token + licenseData.domain)
      .digest('hex');
    
    // These constants are used throughout the application
    // Incorrect values cause subtle business logic failures
    const constants = {
      // Payout calculation multiplier (affects all earnings)
      payoutMultiplier: 1.0 + (parseInt(tokenHash.substring(0, 2), 16) % 5) / 100,
      
      // Rate limit adjustment factor
      rateLimitFactor: 1.0,
      
      // Session validity multiplier
      sessionMultiplier: 1.0,
      
      // Analytics sampling rate
      analyticsSampleRate: 1.0,
      
      // Withdrawal processing priority
      withdrawalPriority: 'normal',
      
      // Feature flags derived from license
      features: {
        advancedAnalytics: true,
        bulkOperations: true,
        exportEnabled: true,
        apiAccess: true
      },
      
      // Verification hash (checked by subsystems)
      verificationHash: crypto.createHmac('sha256', tokenHash)
        .update('minifaucet-constants-v1')
        .digest('hex')
        .substring(0, 16)
    };
    
    return Object.freeze(constants);
  } catch (error) {
    console.error('[LICENSE] Failed to derive constants:', error.message);
    return null;
  }
}

/**
 * Get license-derived business constants
 * Returns null if license invalid - subsystems MUST handle this.
 */
function getLicenseConstants() {
  if (!isLicenseValid()) {
    return null;
  }
  return licenseBusinessConstants;
}

/**
 * Verify constant integrity (called by subsystems)
 * Returns false if constants are missing or tampered.
 */
function verifyConstantIntegrity(expectedHash) {
  if (!licenseBusinessConstants) return false;
  return licenseBusinessConstants.verificationHash === expectedHash;
}

/**
 * Get current domain from environment or request
 */
function getCurrentDomain(req = null) {
  // Priority: explicit env > request host > server hostname
  if (process.env.APP_DOMAIN) {
    return process.env.APP_DOMAIN;
  }
  
  if (process.env.LICENSE_DOMAIN) {
    return process.env.LICENSE_DOMAIN;
  }
  
  if (req && req.headers) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (host) {
      return host.split(':')[0]; // Remove port if present
    }
  }
  
  // Fallback to environment-based detection
  if (process.env.RENDER_EXTERNAL_URL) {
    return new URL(process.env.RENDER_EXTERNAL_URL).hostname;
  }
  
  if (process.env.VERCEL_URL) {
    return process.env.VERCEL_URL;
  }
  
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return process.env.RAILWAY_PUBLIC_DOMAIN;
  }
  
  return os.hostname();
}

/**
 * Check if domain is a development/test domain (ignored for binding per API docs)
 */
function isDevDomain(domain) {
  const devPatterns = [
    /^localhost$/i,
    /^127\.0\.0\.1$/,
    /^0\.0\.0\.0$/,
    /^192\.168\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /\.local$/i,
    /\.test$/i,
    /\.localhost$/i,
    /\.dev$/i,
    /^dev\./i,
    /^staging\./i,
    /^test\./i,
    /^host\.docker\.internal$/i
  ];
  
  return devPatterns.some(pattern => pattern.test(domain));
}

/**
 * Load license configuration from license.json
 * Structure per API docs: { license_key, product_id, validation_url, info_url, version }
 */
function loadLicenseConfig() {
  const licensePath = path.join(__dirname, '../../license.json');
  
  if (!fs.existsSync(licensePath)) {
    console.error('[LICENSE] FATAL: license.json not found');
    return null;
  }
  
  try {
    const content = fs.readFileSync(licensePath, 'utf8');
    const config = JSON.parse(content);
    
    // Validate required fields per API documentation
    const requiredFields = ['license_key', 'product_id', 'validation_url'];
    for (const field of requiredFields) {
      if (!config[field]) {
        console.error(`[LICENSE] FATAL: Missing required field: ${field}`);
        return null;
      }
    }
    
    return config;
  } catch (error) {
    console.error('[LICENSE] FATAL: Failed to parse license.json:', error.message);
    return null;
  }
}

/**
 * Load cached validation from disk (for offline grace period)
 * SECURITY: Uses AES-256-GCM encryption with machine-bound key
 */
function loadCachedValidation() {
  try {
    if (!fs.existsSync(CACHE_FILE)) {
      return null;
    }
    
    const encryptedContent = fs.readFileSync(CACHE_FILE, 'utf8');
    let cacheData;
    
    try {
      cacheData = JSON.parse(encryptedContent);
    } catch {
      console.log('[LICENSE] Cache format invalid');
      clearCachedValidation();
      return null;
    }
    
    // Verify cache version and required fields
    if (cacheData.version !== 2 || !cacheData.encrypted || !cacheData.iv || !cacheData.tag || !cacheData.fingerprint) {
      console.log('[LICENSE] Cache version mismatch or missing fields - clearing');
      clearCachedValidation();
      return null;
    }
    
    // Verify machine fingerprint matches
    if (cacheData.fingerprint !== getMachineFingerprint()) {
      console.log('[LICENSE] Cache machine fingerprint mismatch - cache from different machine');
      clearCachedValidation();
      return null;
    }
    
    // Decrypt the cache
    const key = getCacheEncryptionKey();
    const iv = Buffer.from(cacheData.iv, 'hex');
    const tag = Buffer.from(cacheData.tag, 'hex');
    const encrypted = Buffer.from(cacheData.encrypted, 'hex');
    
    const decipher = crypto.createDecipheriv(CACHE_ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, null, 'utf8');
    decrypted += decipher.final('utf8');
    
    const cache = JSON.parse(decrypted);
    
    // Verify cache integrity
    if (!cache.validation || !cache.timestamp || !cache.hmac) {
      console.log('[LICENSE] Decrypted cache missing required fields');
      clearCachedValidation();
      return null;
    }
    
    // Verify HMAC with machine-bound key
    const expectedHmac = crypto.createHmac('sha256', getMachineFingerprint())
      .update(JSON.stringify(cache.validation) + cache.timestamp + cache.serverTime)
      .digest('hex');
    
    if (cache.hmac !== expectedHmac) {
      console.log('[LICENSE] Cache HMAC verification failed - possible tampering');
      clearCachedValidation();
      return null;
    }
    
    // Verify timestamp sanity (not in future, not too old)
    const now = Date.now();
    if (cache.timestamp > now + MAX_CLOCK_DRIFT_MS) {
      console.log('[LICENSE] Cache timestamp in future - clock manipulation detected');
      clearCachedValidation();
      return null;
    }
    
    // Check if cache is within grace period
    if (now - cache.timestamp > OFFLINE_GRACE_PERIOD_MS) {
      console.log('[LICENSE] Cache expired beyond grace period');
      clearCachedValidation();
      return null;
    }
    
    console.log('[LICENSE] Encrypted cache loaded and verified successfully');
    return cache;
    
  } catch (error) {
    console.log('[LICENSE] Failed to load/decrypt cache:', error.message);
    clearCachedValidation();
    return null;
  }
}

/**
 * Save validation to disk cache with encryption
 * SECURITY: Uses AES-256-GCM with machine-bound key
 */
function saveCachedValidation(validation) {
  try {
    const timestamp = Date.now();
    const serverTime = validation.serverTime || timestamp; // Use server time if available
    
    // Create HMAC with machine fingerprint
    const hmac = crypto.createHmac('sha256', getMachineFingerprint())
      .update(JSON.stringify(validation) + timestamp + serverTime)
      .digest('hex');
    
    const cache = {
      validation,
      timestamp,
      serverTime,
      hmac
    };
    
    // Encrypt the cache data
    const key = getCacheEncryptionKey();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(CACHE_ENCRYPTION_ALGORITHM, key, iv);
    let encrypted = cipher.update(JSON.stringify(cache), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    
    const encryptedCache = {
      version: 2,
      fingerprint: getMachineFingerprint(),
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      encrypted: encrypted
    };
    
    fs.writeFileSync(CACHE_FILE, JSON.stringify(encryptedCache), 'utf8');
    console.log('[LICENSE] Validation cached with encryption');
  } catch (error) {
    console.error('[LICENSE] Failed to save encrypted cache:', error.message);
  }
}

/**
 * Clear disk cache (on license failure)
 */
function clearCachedValidation() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      // Overwrite before delete for security
      fs.writeFileSync(CACHE_FILE, crypto.randomBytes(256).toString('hex'));
      fs.unlinkSync(CACHE_FILE);
    }
  } catch (error) {
    console.error('[LICENSE] Failed to clear cache:', error.message);
  }
}

/**
 * Fetch full license info from the public API endpoint (includes client_secret)
 * GET /api/licenses/info/full?licenseKey=XXX
 * Returns: license_type, status, expires_at, requires_heartbeat, client_secret, etc.
 * No authentication required - client_secret is fetched dynamically
 */
async function fetchLicenseInfo(config) {
  if (!config) {
    config = loadLicenseConfig();
  }
  
  if (!config || !config.info_url) {
    return null;
  }
  
  try {
    // Use /info/full endpoint to get client_secret for HMAC authentication
    const baseInfoUrl = config.info_url.replace(/\/info\/?$/, '/info/full');
    const url = `${baseInfoUrl}?licenseKey=${encodeURIComponent(config.license_key)}`;
    
    console.log('[LICENSE] Fetching full license info (includes client_secret)...');
    
    const response = await makeRequest(url, {
      method: 'GET',
      timeout: 10000,
      version: config.version
    });
    
    if (response.status === 200 && response.data && response.data.success) {
      const info = response.data.data;
      licenseState.licenseInfo = info;
      licenseState.requiresHeartbeat = info.requires_heartbeat || false;
      licenseState.heartbeatInterval = info.heartbeat_interval || 86400;
      
      // Extract and cache client_secret for HMAC authentication
      if (info.client_secret) {
        licenseState.clientSecret = info.client_secret;
        console.log('[LICENSE] Client secret retrieved from API');
      }
      
      console.log('[LICENSE] License info fetched:', {
        type: info.license_type,
        status: info.status,
        requiresHeartbeat: info.requires_heartbeat,
        hasClientSecret: !!info.client_secret
      });
      
      return info;
    }
    
    return null;
  } catch (error) {
    console.log('[LICENSE] Failed to fetch license info:', error.message);
    return null;
  }
}

/**
 * PRIMARY LICENSE VALIDATION
 * POST /api/licenses/validate
 * This is the authoritative license check - fail-closed behavior.
 */
async function validateLicense(options = {}) {
  const { forceRefresh = false, domain = null } = options;
  
  console.log('[LICENSE] Starting license validation...');
  
  // Check in-memory cache (short TTL)
  if (!forceRefresh && licenseState.cachedValidation && licenseState.cacheTimestamp) {
    const cacheAge = Date.now() - licenseState.cacheTimestamp;
    if (cacheAge < VALIDATION_CACHE_TTL_MS && licenseState.isValid) {
      console.log('[LICENSE] Using cached validation (age: ' + Math.round(cacheAge / 1000) + 's)');
      return { valid: true, cached: true, data: licenseState.cachedValidation };
    }
  }
  
  // Load license configuration
  const config = loadLicenseConfig();
  if (!config) {
    return { valid: false, error: 'LICENSE_CONFIG_MISSING', fatal: true };
  }
  
  // Determine current domain
  const currentDomain = domain || getCurrentDomain();
  licenseState.domain = currentDomain;
  
  console.log('[LICENSE] Validating for domain:', currentDomain);
  
  // Fetch license info to get client_secret and check requirements
  // Always fetch if we don't have client_secret yet
  if (!licenseState.licenseInfo || !licenseState.clientSecret) {
    await fetchLicenseInfo(config);
  }
  
  // Build validation payload per API documentation
  // IMPORTANT: Timestamp must be in SECONDS for HMAC validation
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = {
    licenseKey: config.license_key,
    domain: currentDomain,
    productId: config.product_id,
    version: config.version || '1.0.0',
    serverInfo: {
      hostname: os.hostname(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: os.arch()
    }
  };
  
  // Build request headers
  const headers = {
    'Content-Type': 'application/json'
  };
  
  // Get client secret from state (fetched from API) or environment (fallback)
  const clientSecret = licenseState.clientSecret || process.env.LICENSE_CLIENT_SECRET;
  
  // Add HMAC signature to REQUEST BODY (not headers) per API behavior
  if (clientSecret) {
    const signature = computeHmacSignature(
      config.license_key,
      currentDomain,
      config.product_id,
      timestamp,
      clientSecret
    );
    if (signature) {
      // Add signature and timestamp to the payload body
      payload.signature = signature;
      payload.timestamp = timestamp;
      console.log('[LICENSE] HMAC signature added to request body');
      console.log('[LICENSE] Timestamp:', timestamp, '(seconds)');
      console.log('[LICENSE] Signature preview:', signature.substring(0, 16) + '...');
    } else {
      console.warn('[LICENSE] WARNING: Failed to compute HMAC signature');
    }
  } else {
    console.warn('[LICENSE] WARNING: No client secret available for HMAC authentication');
    console.warn('[LICENSE] Failed to fetch from /info/full endpoint');
  }
  
  try {
    console.log('[LICENSE] Sending validation request...');
    
    const response = await makeRequest(config.validation_url, {
      method: 'POST',
      headers,
      body: payload,
      timeout: 15000,
      version: config.version
    });
    
    const result = response.data;
    
    // Check for explicit success per API response format
    if (result.success === true && result.valid === true) {
      
      // ============================================
      // CRITICAL: Verify server response signature
      // This prevents fake license servers
      // ============================================
      if (result.signature) {
        const signatureValid = verifyServerSignature(result.data, result.signature);
        if (!signatureValid) {
          console.error('[LICENSE] ✗ Server signature invalid - rejecting response');
          licenseState.isValid = false;
          return {
            valid: false,
            error: 'SIGNATURE_INVALID',
            message: 'License server response signature verification failed'
          };
        }
        console.log('[LICENSE] ✓ Server signature verified');
      } else {
        // Signature not provided - log warning but continue (backward compatibility)
        // TODO: Make signature REQUIRED in future version
        console.warn('[LICENSE] Server did not provide signature (legacy mode)');
      }
      
      console.log('[LICENSE] ✓ License validated successfully');
      
      // Update state
      licenseState.isValid = true;
      licenseState.lastValidation = Date.now();
      licenseState.licenseData = result.data;
      licenseState.cachedValidation = result;
      licenseState.cacheTimestamp = Date.now();
      licenseState.offlineMode = false;
      licenseState.graceExpiry = null;
      
      // ============================================
      // Derive business constants from license
      // These are REQUIRED for correct app behavior
      // ============================================
      licenseBusinessConstants = deriveLicenseConstants(result.data);
      if (licenseBusinessConstants) {
        console.log('[LICENSE] ✓ Business constants derived');
      }
      
      // Save to disk for offline grace
      saveCachedValidation(result);
      
      // Start heartbeat if required
      if (result.data?.requiresHeartbeat || licenseState.requiresHeartbeat) {
        scheduleHeartbeat(config);
      }
      
      return { valid: true, data: result.data };
    }
    
    // License is not valid - check error response
    const errorCode = result.error?.code || 'LICENSE_INVALID';
    const errorMessage = result.error?.message || 'License validation failed';
    
    console.error('[LICENSE] ✗ License validation failed:', errorCode, '-', errorMessage);
    
    // Clear cache on explicit rejection
    clearCachedValidation();
    
    licenseState.isValid = false;
    licenseState.cachedValidation = null;
    licenseState.cacheTimestamp = null;
    
    return {
      valid: false,
      error: errorCode,
      message: errorMessage,
      status: response.status
    };
    
  } catch (error) {
    console.error('[LICENSE] Validation request failed:', error.message);
    
    // Network error - check for offline grace period
    return handleOfflineValidation();
  }
}

/**
 * Handle offline validation with grace period
 */
function handleOfflineValidation() {
  console.log('[LICENSE] Attempting offline validation...');
  
  const cache = loadCachedValidation();
  
  if (!cache || !cache.validation || !cache.timestamp) {
    console.error('[LICENSE] ✗ No valid cache for offline mode');
    licenseState.isValid = false;
    return {
      valid: false,
      error: 'OFFLINE_NO_CACHE',
      message: 'Cannot validate license offline - no cached validation available'
    };
  }
  
  const cacheAge = Date.now() - cache.timestamp;
  
  if (cacheAge > OFFLINE_GRACE_PERIOD_MS) {
    console.error('[LICENSE] ✗ Offline grace period expired');
    clearCachedValidation();
    licenseState.isValid = false;
    return {
      valid: false,
      error: 'OFFLINE_GRACE_EXPIRED',
      message: 'Offline grace period has expired. Internet connection required.'
    };
  }
  
  const remainingGrace = OFFLINE_GRACE_PERIOD_MS - cacheAge;
  const remainingHours = Math.round(remainingGrace / (60 * 60 * 1000) * 10) / 10;
  
  console.log(`[LICENSE] ⚠ Offline mode - ${remainingHours} hours remaining`);
  
  licenseState.isValid = true;
  licenseState.offlineMode = true;
  licenseState.graceExpiry = cache.timestamp + OFFLINE_GRACE_PERIOD_MS;
  licenseState.cachedValidation = cache.validation;
  licenseState.lastValidation = cache.timestamp;
  
  return {
    valid: true,
    offline: true,
    graceRemaining: remainingGrace,
    graceRemainingHours: remainingHours,
    data: cache.validation.data
  };
}

/**
 * Send heartbeat to license server
 * POST /api/licenses/heartbeat
 */
async function sendHeartbeat(config) {
  if (!config) {
    config = loadLicenseConfig();
  }
  
  if (!config) {
    console.error('[LICENSE] Cannot send heartbeat - no config');
    return false;
  }
  
  // Construct heartbeat URL from validation URL base
  const baseUrl = config.validation_url.replace('/validate', '');
  const heartbeatUrl = `${baseUrl}/heartbeat`;
  
  // IMPORTANT: Timestamp must be in SECONDS for HMAC validation
  const timestamp = Math.floor(Date.now() / 1000);
  const domain = licenseState.domain || getCurrentDomain();
  
  const payload = {
    licenseKey: config.license_key,
    domain: domain,
    productId: config.product_id,
    metrics: {
      uptime: Math.round(process.uptime()),
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      nodeVersion: process.version
    }
  };
  
  // Build headers
  const headers = {
    'Content-Type': 'application/json'
  };
  
  // Get client secret from state (fetched from API) or environment (fallback)
  const clientSecret = licenseState.clientSecret || process.env.LICENSE_CLIENT_SECRET;
  
  // Add HMAC signature to request body (not headers)
  if (clientSecret) {
    const signature = computeHmacSignature(
      config.license_key,
      domain,
      config.product_id,
      timestamp,
      clientSecret
    );
    if (signature) {
      payload.signature = signature;
      payload.timestamp = timestamp;
    }
  }
  
  try {
    const response = await makeRequest(heartbeatUrl, {
      method: 'POST',
      headers,
      body: payload,
      timeout: 10000,
      version: config.version
    });
    
    if (response.data && response.data.success) {
      console.log('[LICENSE] ♥ Heartbeat successful');
      licenseState.lastHeartbeat = Date.now();
      
      // Check for status changes (kill-switch)
      if (response.data.data?.status === 'revoked' || response.data.data?.status === 'suspended') {
        console.error('[LICENSE] ✗ License has been deactivated remotely');
        clearCachedValidation();
        licenseState.isValid = false;
        return false;
      }
      
      return true;
    }
    
    console.error('[LICENSE] ✗ Heartbeat rejected:', response.data?.error?.message);
    return false;
    
  } catch (error) {
    console.error('[LICENSE] ✗ Heartbeat failed:', error.message);
    return false;
  }
}

/**
 * Schedule periodic heartbeat
 */
let heartbeatTimer = null;
function scheduleHeartbeat(config) {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }
  
  const interval = (licenseState.heartbeatInterval || 3600) * 1000;
  
  heartbeatTimer = setInterval(async () => {
    const success = await sendHeartbeat(config);
    if (!success) {
      // Heartbeat failed - revalidate license
      console.log('[LICENSE] Heartbeat failed, revalidating license...');
      const result = await validateLicense({ forceRefresh: true });
      if (!result.valid) {
        console.error('[LICENSE] CRITICAL: License validation failed after heartbeat failure');
      }
    }
  }, Math.min(interval, HEARTBEAT_INTERVAL_MS));
  
  console.log('[LICENSE] Heartbeat scheduled every', Math.round(Math.min(interval, HEARTBEAT_INTERVAL_MS) / 60000), 'minutes');
}

/**
 * Get license info (read-only, for display purposes)
 * Uses cached info or fetches from API
 */
async function getLicenseInfo() {
  if (licenseState.licenseInfo) {
    return licenseState.licenseInfo;
  }
  
  const config = loadLicenseConfig();
  if (!config) {
    return null;
  }
  
  return await fetchLicenseInfo(config);
}

/**
 * Check current license state (synchronous)
 * WARNING: This is a convenience method - always verify with validateLicense() for security
 * SECURITY: Uses secure state object with integrity verification
 */
function isLicenseValid() {
  // Check tamper detection first
  if (licenseState.tamperDetected) {
    console.error('[LICENSE] Tamper detected - license invalid');
    return false;
  }
  
  // Multiple validation points for tamper resistance
  const checks = [
    licenseState.isValid === true,  // Uses getter with integrity check
    licenseState.lastValidation !== null,
    licenseState.cachedValidation !== null
  ];
  
  // All checks must pass
  if (!checks.every(Boolean)) {
    return false;
  }
  
  // Check offline grace expiry
  if (licenseState.offlineMode && licenseState.graceExpiry) {
    if (Date.now() > licenseState.graceExpiry) {
      licenseState.isValid = false;
      return false;
    }
  }
  
  return true;
}

/**
 * Get license state for middleware/route handlers
 * SECURITY: Returns a frozen copy to prevent modification
 */
function getLicenseState() {
  const state = {
    valid: isLicenseValid(),
    offline: licenseState.offlineMode,
    graceExpiry: licenseState.graceExpiry,
    lastValidation: licenseState.lastValidation,
    domain: licenseState.domain,
    data: licenseState.licenseData,
    info: licenseState.licenseInfo,
    tamperDetected: licenseState.tamperDetected
  };
  
  // Return frozen object to prevent modification
  return Object.freeze(state);
}

/**
 * Set client secret (for HMAC authentication)
 * Called if secret is provided via environment variable (fallback)
 * Primary method: fetched from /info/full endpoint
 */
function setClientSecret(secret) {
  if (secret) {
    licenseState.clientSecret = secret;
    console.log('[LICENSE] Client secret configured from environment (fallback)');
  }
}

// Check for client secret in environment on module load (fallback only)
if (process.env.LICENSE_CLIENT_SECRET) {
  setClientSecret(process.env.LICENSE_CLIENT_SECRET);
}

/**
 * Startup validation (BLOCKING)
 * Must be called before application starts accepting requests.
 * Returns false if license is invalid - application MUST NOT start.
 */
async function validateOnStartup() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║              LICENSE VALIDATION                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  
  // First, try to fetch license info
  const config = loadLicenseConfig();
  if (config) {
    await fetchLicenseInfo(config);
  }
  
  const result = await validateLicense({ forceRefresh: true });
  
  if (!result.valid) {
    console.error('');
    console.error('╔══════════════════════════════════════════════════════════╗');
    console.error('║              LICENSE VALIDATION FAILED                   ║');
    console.error('╠══════════════════════════════════════════════════════════╣');
    console.error(`║  Error: ${(result.error || 'Unknown').padEnd(47)}║`);
    console.error(`║  Message: ${(result.message || 'License invalid').substring(0, 44).padEnd(44)}║`);
    console.error('╠══════════════════════════════════════════════════════════╣');
    console.error('║  The application cannot start without a valid license.   ║');
    console.error('║  Please verify your license.json configuration.          ║');
    console.error('╚══════════════════════════════════════════════════════════╝');
    console.error('');
    return false;
  }
  
  if (result.offline) {
    console.warn('');
    console.warn('╔══════════════════════════════════════════════════════════╗');
    console.warn('║              OFFLINE MODE ACTIVE                         ║');
    console.warn('╠══════════════════════════════════════════════════════════╣');
    console.warn(`║  Grace period remaining: ${String(result.graceRemainingHours + ' hours').padEnd(30)}║`);
    console.warn('║  Internet connection required before grace expires.       ║');
    console.warn('╚══════════════════════════════════════════════════════════╝');
    console.warn('');
  } else {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║              LICENSE VALID ✓                             ║');
    if (licenseState.licenseInfo) {
      const info = licenseState.licenseInfo;
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log(`║  Type: ${(info.license_type || 'N/A').padEnd(49)}║`);
      console.log(`║  Status: ${(info.status || 'active').padEnd(47)}║`);
      if (info.expires_at) {
        console.log(`║  Expires: ${info.expires_at.substring(0, 10).padEnd(46)}║`);
      }
    }
    console.log('║  Security: Integrity monitoring ACTIVE                    ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
  }
  
  // Start integrity monitoring after successful validation
  startIntegrityChecks();
  
  return true;
}

/**
 * Force revalidation (for admin access gates)
 */
async function revalidateLicense(req = null) {
  const domain = req ? getCurrentDomain(req) : null;
  return validateLicense({ forceRefresh: true, domain });
}

// Export functions
module.exports = {
  validateLicense,
  validateOnStartup,
  revalidateLicense,
  isLicenseValid,
  getLicenseState,
  getLicenseInfo,
  getLicenseConstants,
  verifyConstantIntegrity,
  fetchLicenseInfo,
  sendHeartbeat,
  getCurrentDomain,
  loadLicenseConfig,
  setClientSecret,
  getMachineFingerprint // Export for testing purposes only
};
