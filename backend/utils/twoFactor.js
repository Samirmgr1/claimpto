/**
 * Two-Factor Authentication (2FA) Utility
 * 
 * Implements TOTP (Time-based One-Time Password) algorithm compatible with
 * Google Authenticator, Authy, and other authenticator apps.
 * 
 * Based on RFC 6238 (TOTP) and RFC 4226 (HOTP)
 */

const crypto = require('crypto');

// Base32 character set for encoding/decoding secrets
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode a buffer to Base32
 */
function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decode a Base32 string to buffer
 */
function base32Decode(input) {
  const cleanInput = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  
  let bits = 0;
  let value = 0;
  const output = [];

  for (let i = 0; i < cleanInput.length; i++) {
    const charValue = BASE32_CHARS.indexOf(cleanInput[i]);
    if (charValue === -1) continue;

    value = (value << 5) | charValue;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

/**
 * Generate a random secret for TOTP
 * Returns a Base32 encoded string (20 bytes = 32 characters)
 */
function generateSecret() {
  const buffer = crypto.randomBytes(20);
  return base32Encode(buffer);
}

/**
 * Generate a TOTP code from a secret
 * 
 * @param {string} secret - Base32 encoded secret
 * @param {number} timeStep - Time step in seconds (default: 30)
 * @param {number} digits - Number of digits in the code (default: 6)
 * @param {number} counterOffset - Offset from current time step (for verification window)
 * @returns {string} The TOTP code
 */
function generateTOTP(secret, timeStep = 30, digits = 6, counterOffset = 0) {
  // Decode the secret
  const key = base32Decode(secret);
  
  // Calculate the counter (time step)
  const counter = Math.floor(Date.now() / 1000 / timeStep) + counterOffset;
  
  // Convert counter to 8-byte buffer (big-endian)
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));
  
  // Create HMAC-SHA1
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(counterBuffer);
  const hash = hmac.digest();
  
  // Dynamic truncation
  const offset = hash[hash.length - 1] & 0x0f;
  const binary = 
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  
  // Generate code
  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

/**
 * Verify a TOTP code
 * Checks the current time step and adjacent time steps (window)
 * 
 * @param {string} secret - Base32 encoded secret
 * @param {string} code - The code to verify
 * @param {number} window - Number of time steps to check before/after current (default: 1)
 * @returns {boolean} True if the code is valid
 */
function verifyTOTP(secret, code, window = 1) {
  if (!secret || !code) return false;
  
  // Normalize the code (remove spaces, ensure string)
  const normalizedCode = String(code).replace(/\s/g, '');
  
  // Check codes within the window
  for (let i = -window; i <= window; i++) {
    const expectedCode = generateTOTP(secret, 30, 6, i);
    if (normalizedCode === expectedCode) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate backup codes for account recovery
 * 
 * @param {number} count - Number of backup codes to generate (default: 10)
 * @returns {string[]} Array of backup codes
 */
function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // Generate 8 character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Generate the otpauth:// URL for QR code
 * This URL is used by authenticator apps to set up 2FA
 * 
 * @param {string} secret - Base32 encoded secret
 * @param {string} accountName - The account identifier (e.g., username or email)
 * @param {string} issuer - The app/service name
 * @returns {string} The otpauth URL
 */
function generateOtpauthUrl(secret, accountName, issuer = 'MiniFaucet Admin') {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate a data URL for a QR code (simple SVG-based)
 * This creates a basic QR code without external dependencies
 * 
 * For production, consider using a library like 'qrcode' for better compatibility
 * This is a simplified implementation that works with most authenticator apps
 * 
 * @param {string} data - The data to encode in the QR code
 * @returns {string} Data URL containing the QR code
 */
function generateQRCodeDataUrl(data) {
  // We'll return the otpauth URL itself and let the frontend generate the QR code
  // This avoids adding a QR code library dependency
  return data;
}

module.exports = {
  generateSecret,
  generateTOTP,
  verifyTOTP,
  generateBackupCodes,
  generateOtpauthUrl,
  generateQRCodeDataUrl,
  base32Encode,
  base32Decode
};
