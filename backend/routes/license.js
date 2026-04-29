/**
 * License API Routes
 * 
 * These endpoints provide license status and validation for the frontend.
 * The validate endpoint performs fresh validation against the license server.
 * 
 * SECURITY NOTE: These endpoints are advisory for the frontend.
 * The actual enforcement happens in the license middleware.
 */

const express = require('express');
const router = express.Router();
const {
  requireValidLicense,
  requireFreshLicense,
  getLicenseStatus,
  validateLicenseEndpoint
} = require('../middleware/license');
const { authenticateAdmin } = require('../middleware/auth');

/**
 * GET /api/license/status
 * 
 * Get current license status (quick check from cache)
 * Requires admin authentication
 */
router.get('/status', authenticateAdmin, getLicenseStatus);

/**
 * POST /api/license/validate
 * 
 * Perform fresh license validation
 * Used by frontend before rendering admin dashboard
 * Requires admin authentication
 */
router.post('/validate', authenticateAdmin, validateLicenseEndpoint);

/**
 * GET /api/license/check
 * 
 * REMOVED: Public endpoint was a security risk exposing license status.
 * This endpoint now returns a generic response without revealing license state.
 * The actual license enforcement happens in middleware.
 */
router.get('/check', async (req, res) => {
  // SECURITY: Don't expose actual license state to unauthenticated requests
  // Return generic response that doesn't reveal anything useful to attackers
  res.json({
    timestamp: new Date().toISOString(),
    status: 'operational'
  });
});

module.exports = router;
