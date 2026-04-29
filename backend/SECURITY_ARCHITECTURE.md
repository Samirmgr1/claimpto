# Security Architecture: Action Token System

## Executive Summary

This document describes the **Action Token System** implemented to secure economic endpoints (faucet claims, ad rewards, withdrawals) against automated script attacks while operating entirely within MongoDB (no Redis).

---

## 1. Threat Model

### Attacker Profile

- **Tools**: Termux, Python, cURL, browser automation
- **Goal**: Automate reward collection without human interaction
- **Capabilities**:
  - Can obtain valid JWT tokens (via legitimate Telegram login)
  - Can call API endpoints directly
  - Can parse and replay captured requests
  - Cannot break cryptographic signatures
  - Cannot manipulate server-side timestamps

### Attack Vectors Mitigated

| Attack                       | Mitigation                                  |
| ---------------------------- | ------------------------------------------- |
| Direct API calls to `/claim` | Requires valid action token from `/start`   |
| Replay attacks               | Single-use tokens (atomic consumption)      |
| Token harvesting             | Short TTL + action binding                  |
| Instant claims               | Server-enforced minimum time                |
| Race conditions              | Atomic `findOneAndUpdate` operations        |
| Token forgery                | HMAC signature verification                 |
| Session accumulation         | Previous tokens invalidated on new issuance |

---

## 2. Architecture

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        SECURE CLAIM FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Client calls /faucet/start                                  │
│     └─> Server validates: user status, cooldown, rate limit     │
│     └─> Server issues ActionToken with:                         │
│         • tokenId (cryptographically random)                    │
│         • userId binding                                        │
│         • actionType binding                                    │
│         • context (reward amount, ad providers)                 │
│         • HMAC signature                                        │
│         • minTimeSeconds (e.g., 15 seconds)                     │
│         • expiresAt (e.g., 5 minutes)                           │
│     └─> Returns tokenId to client                               │
│                                                                  │
│  2. Client performs action (watches ads, waits)                 │
│                                                                  │
│  3. Client calls /faucet/claim with actionToken                 │
│     └─> Server atomically consumes token:                       │
│         • findOneAndUpdate({ consumed: false } → { consumed: true })
│         • Verifies HMAC signature                               │
│         • Checks minTime has passed                             │
│         • Returns error if ANY check fails                      │
│     └─> If successful: grants reward                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Blocks Scripts

1. **Cannot Skip `/start`**
   - Scripts cannot call `/claim` directly
   - Token is required and validated

2. **Cannot Reuse Tokens**
   - Each token is consumed atomically
   - `findOneAndUpdate` ensures only ONE request succeeds

3. **Cannot Fake Time**
   - Server records `issuedAt` timestamp
   - Server checks if `minTimeSeconds` has elapsed
   - Client has no control over this

4. **Cannot Forge Tokens**
   - Tokens are signed with HMAC-SHA256
   - Secret key is server-side only
   - Even with DB read access, cannot forge valid signatures

5. **Cannot Accumulate Tokens**
   - Previous unconsumed tokens are invalidated
   - Only one valid token per user/action at a time

---

## 3. Database Schema

### ActionToken Collection

```javascript
{
  tokenId: String,        // 64-char hex, unique index
  userId: ObjectId,       // Bound user, indexed
  actionType: String,     // 'faucet_claim', 'ad_watch', etc.
  context: Object,        // Action-specific data
  signature: String,      // HMAC-SHA256 signature
  issuedAt: Date,         // When token was created
  expiresAt: Date,        // TTL index for auto-deletion
  minTimeSeconds: Number, // Minimum wait time
  consumed: Boolean,      // Whether token was used
  consumedAt: Date,       // When token was consumed
  issuedFromIp: String,   // Forensic data
  consumedFromIp: String  // Forensic data
}

// Indexes
{ tokenId: 1 }                              // Unique
{ expiresAt: 1 }, expireAfterSeconds: 0     // TTL
{ userId: 1, actionType: 1, consumed: 1 }   // Query optimization
```

### AdSession Collection (Enhanced)

```javascript
{
  sessionId: String,           // 64-char hex, unique index
  user: ObjectId,              // Bound user
  provider: String,            // 'adsgram', 'monetag', etc.
  reward: Number,              // Reward amount
  status: String,              // 'pending', 'completed', etc.
  minWatchTimeSeconds: Number, // Minimum watch time
  signature: String,           // HMAC-SHA256 signature
  createdAt: Date,             // Session creation time
  completedAt: Date,           // When completed
  completedFromIp: String      // Forensic data
}
```

---

## 4. Atomic Consumption

The critical security operation is **atomic token consumption**:

```javascript
const token = await ActionToken.findOneAndUpdate(
  {
    tokenId,
    userId,
    actionType,
    consumed: false, // Only unconsumed tokens
    expiresAt: { $gt: now }, // Only non-expired tokens
  },
  {
    $set: {
      consumed: true,
      consumedAt: now,
    },
  },
  { new: false }, // Return original to check minTime
);
```

**Why This Works:**

- MongoDB's `findOneAndUpdate` is atomic
- If two requests race, only ONE will match `consumed: false`
- The other will get `null` and fail
- No locking required, no race conditions

---

## 5. Minimum Time Enforcement

```javascript
// In canBeConsumed():
const now = Date.now();
const issuedTime = this.issuedAt.getTime();
const minTimePassed = now - issuedTime >= this.minTimeSeconds * 1000;
```

**Security Properties:**

- `issuedAt` is set by server, not client
- Client cannot manipulate timestamps
- If script completes too fast, request is rejected
- Token is STILL consumed (prevents retry)

---

## 6. HMAC Signature Verification

```javascript
// Signature generation (server-only secret)
const signature = crypto
  .createHmac("sha256", secret)
  .update(
    JSON.stringify({
      tokenId,
      userId: userId.toString(),
      actionType,
      context,
      issuedAt: issuedAt.toISOString(),
    }),
  )
  .digest("hex");

// Signature verification (constant-time comparison)
crypto.timingSafeEqual(
  Buffer.from(actualSignature, "hex"),
  Buffer.from(expectedSignature, "hex"),
);
```

**Why This Matters:**

- Even if attacker has DB read access, they cannot:
  - Create new valid tokens
  - Modify existing token fields
  - Change reward amounts
  - Extend expiration times

---

## 7. Scalability Analysis (50k+ Users)

### Without Redis Concerns

| Aspect            | Analysis                               |
| ----------------- | -------------------------------------- |
| Token Issuance    | Single document insert, O(1)           |
| Token Consumption | Single atomic update with index, O(1)  |
| Token Cleanup     | Automatic via MongoDB TTL index        |
| Index Size        | ~100 bytes per token, 50k tokens = 5MB |
| Query Performance | All queries use indexes                |

### MongoDB Load Estimation

```
Assumptions:
- 50,000 active users
- Each user claims faucet 10x/day
- Each user watches 20 ads/day

Daily Operations:
- Token issuance: 50k × 10 = 500k inserts
- Token consumption: 50k × 10 = 500k updates
- Ad sessions: 50k × 20 = 1M operations

Operations per second (spread over 24h):
- (500k + 500k + 1M) / 86400 ≈ 23 ops/second

This is well within MongoDB's capabilities on modest hardware.
```

### TTL Index for Cleanup

```javascript
// Tokens auto-deleted when expiresAt < now
{ expiresAt: 1 }, { expireAfterSeconds: 0 }
```

- No manual cleanup required
- No cron jobs needed
- MongoDB handles garbage collection

---

## 8. Remaining Risks & Trade-offs

### Acknowledged Weaknesses

1. **No Rate Limiting on Token Issuance (without Redis)**
   - Mitigated by: DB-based rate limiting (count tokens issued per hour)
   - Trade-off: Slightly higher DB load for rate limit checks

2. **Token Table Growth**
   - Mitigated by: TTL index auto-deletes expired tokens
   - Trade-off: Table can grow during peak usage before cleanup

3. **Single Point of Failure (MongoDB)**
   - Mitigated by: MongoDB replica sets
   - Trade-off: Additional infrastructure complexity

4. **Clock Skew**
   - Risk: If server clocks are out of sync in a cluster
   - Mitigation: Use NTP, MongoDB Timestamp for ordering

### What This Does NOT Protect Against

| Threat                        | Why Not Protected           | Mitigation                          |
| ----------------------------- | --------------------------- | ----------------------------------- |
| Legitimate users with scripts | They have valid tokens      | Rate limiting, account suspension   |
| Stolen JWT tokens             | Token theft is out of scope | Short JWT expiry, device binding    |
| Compromised server            | Full access = game over     | Server hardening, monitoring        |
| Insider threats               | Admin has DB access         | Audit logging, separation of duties |

---

## 9. Implementation Checklist

### Backend Files Created/Modified

- [x] `models/ActionToken.js` - New model with atomic consumption
- [x] `models/AdSession.js` - Enhanced with security features
- [x] `models/PeeredAdSession.js` - New model for secure peered ad sessions
- [x] `middleware/actionToken.js` - Token issuance/consumption utilities
- [x] `routes/earnings.js` - Added `/faucet/start`, secured `/faucet/claim`
- [x] `routes/ads.js` - Enhanced with atomic session completion + secure peered ads

### Required Environment Variables

```bash
# Existing
JWT_SECRET=your-jwt-secret

# New (optional, falls back to JWT_SECRET)
ACTION_TOKEN_SECRET=separate-secret-for-action-tokens
AD_SESSION_SECRET=separate-secret-for-ad-sessions
PEERED_SESSION_SECRET=separate-secret-for-peered-sessions
```

### Database Indexes (Auto-created by Mongoose)

```javascript
// ActionToken indexes
{ tokenId: 1 }                              // Unique
{ expiresAt: 1 }, expireAfterSeconds: 0     // TTL
{ userId: 1, actionType: 1, consumed: 1 }   // Query

// AdSession indexes
{ sessionId: 1 }                            // Unique
{ createdAt: 1 }, expireAfterSeconds: 3600  // TTL
{ user: 1, status: 1, completedAt: -1 }     // Query

// PeeredAdSession indexes
{ sessionId: 1 }                            // Unique
{ createdAt: 1 }, expireAfterSeconds: 900   // TTL (15 min)
{ user: 1, status: 1 }                      // Query
```

---

## 10. Testing the Security

### Manual Test: Verify Token Requirement

```bash
# This should FAIL (no token)
curl -X POST /api/earnings/faucet/claim \
  -H "Authorization: Bearer $JWT" \
  -d '{}'

# Expected: 403 "Please start a faucet session first"
```

### Manual Test: Verify Replay Prevention

```bash
# Get a token
TOKEN=$(curl -X POST /api/earnings/faucet/start \
  -H "Authorization: Bearer $JWT" | jq -r '.actionToken')

# Wait minimum time, then claim
sleep 15
curl -X POST /api/earnings/faucet/claim \
  -H "Authorization: Bearer $JWT" \
  -d "{\"actionToken\": \"$TOKEN\"}"
# Expected: 200 OK

# Try to claim again with same token
curl -X POST /api/earnings/faucet/claim \
  -H "Authorization: Bearer $JWT" \
  -d "{\"actionToken\": \"$TOKEN\"}"
# Expected: 403 "Session expired or already claimed"
```

### Manual Test: Verify Minimum Time

```bash
# Get a token
TOKEN=$(curl -X POST /api/earnings/faucet/start \
  -H "Authorization: Bearer $JWT" | jq -r '.actionToken')

# Immediately try to claim (should fail)
curl -X POST /api/earnings/faucet/claim \
  -H "Authorization: Bearer $JWT" \
  -d "{\"actionToken\": \"$TOKEN\"}"
# Expected: 429 "Please wait X more seconds"
```

---

## 11. Monitoring Recommendations

### Suspicious Activity Indicators

```javascript
// Log these events for security monitoring:
console.warn("[SECURITY] Token consumed too quickly:", {
  tokenId,
  userId,
  elapsed: sessionAge,
  required: minTimeSeconds,
});

console.error("[SECURITY] Token signature verification failed:", {
  tokenId,
  userId,
});
```

### Metrics to Track

- Tokens issued per hour (by action type)
- Token consumption success rate
- Tokens rejected for min-time violation
- Tokens rejected for signature failure
- Average time between issuance and consumption

---

## Conclusion

This action token system provides strong security guarantees against automated script attacks while operating entirely within MongoDB. The key principles are:

1. **Separation of Identity and Authorization**: JWT proves who you are; action tokens prove you're allowed to perform a specific action.

2. **Server-Side Authority**: All critical decisions (timing, signatures) are controlled by the server.

3. **Atomic Operations**: Race conditions are impossible due to MongoDB's atomic `findOneAndUpdate`.

4. **Defense in Depth**: Multiple layers (tokens, signatures, timing) must all pass.

The trade-off compared to Redis is slightly higher database load for rate limiting and token management, but this is acceptable for 50k+ users and provides persistence guarantees that in-memory stores don't offer.

---

## Appendix: Attack Scenario Analysis

### Scenario 1: Direct API Call to /faucet/claim

**Attack**: Script calls `/faucet/claim` directly without going through `/faucet/start`

**Blocked by**: Missing `actionToken` in request body → 403 "Please start a faucet session first"

### Scenario 2: Token Replay

**Attack**: Script saves a token from a previous session and tries to reuse it

**Blocked by**: Token is consumed atomically on first use → 403 "Session expired or already claimed"

### Scenario 3: Instant Claim

**Attack**: Script calls `/faucet/start`, then immediately calls `/faucet/claim`

**Blocked by**: Server checks `issuedAt + minTimeSeconds` → 429 "Please wait X more seconds"

### Scenario 4: Token Harvesting

**Attack**: Script calls `/faucet/start` many times to accumulate tokens, then claims them all at once

**Blocked by**:

- Each new `/start` invalidates previous unconsumed tokens
- Rate limiting on token issuance (50 per hour)
- Tokens expire after 5 minutes

### Scenario 5: Parallel Claims (Race Condition)

**Attack**: Script fires multiple `/faucet/claim` requests simultaneously with the same token

**Blocked by**:

- Atomic `findOneAndUpdate` with `consumed: false` condition
- Only ONE request succeeds; others get "already consumed"

### Scenario 6: Session Manipulation

**Attack**: Attacker modifies session data in database to increase reward

**Blocked by**: HMAC signature verification fails → 403 "Security verification failed"

### Scenario 7: Ad Session Abuse

**Attack**: Script starts ad session, skips showing ad, immediately calls /complete

**Blocked by**:

- `minWatchTimeSeconds` enforced server-side (10 seconds minimum)
- Session signature verification
- Atomic completion prevents race conditions
