const express = require('express');
const router = express.Router();
const { authenticateAdmin, requireAdmin } = require('../middleware/auth');
const { AdPlacement, AD_SLOTS, AD_SLOT_LABELS, AD_SLOT_SIZES } = require('../models/AdPlacement');

// ============================================
// PUBLIC ENDPOINTS (No auth required)
// ============================================

// Cache for public ad placements (30-second TTL)
let adPlacementsCache = null;
let adPlacementsCacheTime = 0;
const AD_PLACEMENTS_CACHE_TTL = 30000; // 30 seconds

/**
 * GET /api/ad-placements/public
 * Returns all active ad placements grouped by slotId
 * Cached with 30s TTL for performance
 */
router.get('/public', async (req, res) => {
  try {
    const now = Date.now();
    
    // Return cached data if fresh
    if (adPlacementsCache && (now - adPlacementsCacheTime) < AD_PLACEMENTS_CACHE_TTL) {
      return res.json(adPlacementsCache);
    }

    // Fetch active placements, sorted by priority (descending)
    const placements = await AdPlacement.find({ isActive: true })
      .sort({ priority: -1, createdAt: -1 })
      .select('name slotId adCode adNetwork priority')
      .lean();

    // Group by slotId
    const grouped = {};
    for (const placement of placements) {
      if (!grouped[placement.slotId]) {
        grouped[placement.slotId] = [];
      }
      grouped[placement.slotId].push({
        _id: placement._id,
        name: placement.name,
        adCode: placement.adCode,
        adNetwork: placement.adNetwork,
        priority: placement.priority
      });
    }

    const response = {
      placements: grouped,
      slots: AD_SLOTS,
      totalActive: placements.length
    };

    // Cache the response
    adPlacementsCache = response;
    adPlacementsCacheTime = now;

    res.json(response);
  } catch (error) {
    console.error('Error fetching public ad placements:', error);
    res.status(500).json({ message: 'Failed to fetch ad placements' });
  }
});

/**
 * GET /api/ad-placements/slots
 * Returns available slot definitions with labels and recommended sizes
 */
router.get('/slots', async (req, res) => {
  try {
    const slots = Object.entries(AD_SLOTS).map(([key, value]) => ({
      id: value,
      key: key,
      label: AD_SLOT_LABELS[value] || value,
      recommendedSize: AD_SLOT_SIZES[value] || null
    }));

    res.json({ slots });
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ message: 'Failed to fetch slot definitions' });
  }
});

// ============================================
// ADMIN ENDPOINTS (Require authentication)
// ============================================

/**
 * GET /api/ad-placements/admin
 * List all ad placements for admin management
 */
router.get('/admin', authenticateAdmin, requireAdmin, async (req, res) => {
  try {
    const placements = await AdPlacement.find()
      .sort({ slotId: 1, priority: -1, createdAt: -1 })
      .lean();

    // Enrich with labels
    const enriched = placements.map(p => ({
      ...p,
      slotLabel: AD_SLOT_LABELS[p.slotId] || p.slotId,
      recommendedSize: AD_SLOT_SIZES[p.slotId] || null
    }));

    res.json({
      placements: enriched,
      slots: Object.entries(AD_SLOTS).map(([key, value]) => ({
        id: value,
        key,
        label: AD_SLOT_LABELS[value] || value,
        recommendedSize: AD_SLOT_SIZES[value] || null
      })),
      adNetworks: [
        { id: 'custom', label: 'Custom HTML/JS' },
        { id: 'adsense', label: 'Google AdSense' },
        { id: 'bitmedia', label: 'BitMedia.io' },
        { id: 'coinzilla', label: 'Coinzilla' },
        { id: 'cryptocoinads', label: 'CryptoCoinAds' },
        { id: 'a-ads', label: 'A-ADS (Anonymous Ads)' },
        { id: 'cointraffic', label: 'CoinTraffic' },
        { id: 'mellow_ads', label: 'Mellow Ads' },
        { id: 'adsterra', label: 'Adsterra' },
        { id: 'propellerads', label: 'PropellerAds' },
        { id: 'monetag', label: 'Monetag' },
        { id: 'other', label: 'Other Network' }
      ],
      total: placements.length
    });
  } catch (error) {
    console.error('Error fetching admin ad placements:', error);
    res.status(500).json({ message: 'Failed to fetch ad placements' });
  }
});

/**
 * POST /api/ad-placements/admin
 * Create a new ad placement
 */
router.post('/admin', authenticateAdmin, requireAdmin, async (req, res) => {
  try {
    const { name, slotId, adCode, adNetwork, isActive, priority, notes } = req.body;

    // Validate required fields
    if (!name || !slotId || !adCode) {
      return res.status(400).json({ message: 'Name, slot, and ad code are required' });
    }

    // Validate slot ID
    if (!Object.values(AD_SLOTS).includes(slotId)) {
      return res.status(400).json({ message: 'Invalid slot ID' });
    }

    const placement = new AdPlacement({
      name: name.trim(),
      slotId,
      adCode,
      adNetwork: adNetwork || 'custom',
      isActive: isActive !== false,
      priority: priority || 0,
      notes: notes || ''
    });

    await placement.save();

    // Clear cache
    invalidateAdPlacementsCache();

    res.status(201).json({
      message: 'Ad placement created successfully',
      placement: {
        ...placement.toObject(),
        slotLabel: AD_SLOT_LABELS[placement.slotId] || placement.slotId
      }
    });
  } catch (error) {
    console.error('Error creating ad placement:', error);
    res.status(500).json({ message: 'Failed to create ad placement' });
  }
});

/**
 * PUT /api/ad-placements/admin/:id
 * Update an existing ad placement
 */
router.put('/admin/:id', authenticateAdmin, requireAdmin, async (req, res) => {
  try {
    const { name, slotId, adCode, adNetwork, isActive, priority, notes } = req.body;

    const placement = await AdPlacement.findById(req.params.id);
    if (!placement) {
      return res.status(404).json({ message: 'Ad placement not found' });
    }

    // Validate slot ID if being changed
    if (slotId && !Object.values(AD_SLOTS).includes(slotId)) {
      return res.status(400).json({ message: 'Invalid slot ID' });
    }

    // Update fields
    if (name !== undefined) placement.name = name.trim();
    if (slotId !== undefined) placement.slotId = slotId;
    if (adCode !== undefined) placement.adCode = adCode;
    if (adNetwork !== undefined) placement.adNetwork = adNetwork;
    if (isActive !== undefined) placement.isActive = isActive;
    if (priority !== undefined) placement.priority = priority;
    if (notes !== undefined) placement.notes = notes;

    await placement.save();

    // Clear cache
    invalidateAdPlacementsCache();

    res.json({
      message: 'Ad placement updated successfully',
      placement: {
        ...placement.toObject(),
        slotLabel: AD_SLOT_LABELS[placement.slotId] || placement.slotId
      }
    });
  } catch (error) {
    console.error('Error updating ad placement:', error);
    res.status(500).json({ message: 'Failed to update ad placement' });
  }
});

/**
 * PATCH /api/ad-placements/admin/:id/toggle
 * Quick toggle active status
 */
router.patch('/admin/:id/toggle', authenticateAdmin, requireAdmin, async (req, res) => {
  try {
    const placement = await AdPlacement.findById(req.params.id);
    if (!placement) {
      return res.status(404).json({ message: 'Ad placement not found' });
    }

    placement.isActive = !placement.isActive;
    await placement.save();

    // Clear cache
    invalidateAdPlacementsCache();

    res.json({
      message: `Ad placement ${placement.isActive ? 'activated' : 'deactivated'}`,
      placement: {
        ...placement.toObject(),
        slotLabel: AD_SLOT_LABELS[placement.slotId] || placement.slotId
      }
    });
  } catch (error) {
    console.error('Error toggling ad placement:', error);
    res.status(500).json({ message: 'Failed to toggle ad placement' });
  }
});

/**
 * DELETE /api/ad-placements/admin/:id
 * Delete an ad placement
 */
router.delete('/admin/:id', authenticateAdmin, requireAdmin, async (req, res) => {
  try {
    const placement = await AdPlacement.findByIdAndDelete(req.params.id);
    if (!placement) {
      return res.status(404).json({ message: 'Ad placement not found' });
    }

    // Clear cache
    invalidateAdPlacementsCache();

    res.json({ message: 'Ad placement deleted successfully' });
  } catch (error) {
    console.error('Error deleting ad placement:', error);
    res.status(500).json({ message: 'Failed to delete ad placement' });
  }
});

/**
 * Cache invalidation helper
 */
function invalidateAdPlacementsCache() {
  adPlacementsCache = null;
  adPlacementsCacheTime = 0;
}

module.exports = router;

