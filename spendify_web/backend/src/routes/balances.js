const express = require('express');
const router = express.Router();
const balanceService = require('../services/balanceService');
const authMiddleware = require('../middleware/auth');

// GET /api/groups/:id/balances
router.get('/groups/:id/balances', authMiddleware, async (req, res) => {
  const { id: groupId } = req.params;

  try {
    const result = await balanceService.calculateBalances(groupId);
    res.json(result);
  } catch (err) {
    console.error('Get Balances Error:', err.message);
    res.status(500).json({ error: 'Server error calculating group balances.' });
  }
});

module.exports = router;
