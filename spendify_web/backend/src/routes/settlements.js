const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// POST /api/groups/:id/settlements
// Create a settlement payment
router.post('/groups/:id/settlements', authMiddleware, async (req, res) => {
  const { id: groupId } = req.params;
  const { paidBy, paidTo, amount, date } = req.body;

  if (!paidBy || !paidTo || !amount) {
    return res.status(400).json({ error: 'paidBy, paidTo, and amount are required.' });
  }

  try {
    const settlementDate = date ? new Date(date) : new Date();

    const insertRes = await db.query(
      `INSERT INTO settlements (group_id, paid_by, paid_to, amount, settlement_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [groupId, paidBy, paidTo, amount, settlementDate]
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    console.error('Create Settlement Error:', err.message);
    res.status(500).json({ error: 'Server error recording settlement.' });
  }
});

// GET /api/groups/:id/settlements
// Retrieve all settlements for a group
router.get('/groups/:id/settlements', authMiddleware, async (req, res) => {
  const { id: groupId } = req.params;

  try {
    const settlementsRes = await db.query(
      `SELECT s.id, s.group_id, s.paid_by, s.paid_to, s.amount, s.settlement_date AS date, s.created_at,
              payer.name AS payer_name, payee.name AS payee_name
       FROM settlements s
       JOIN users payer ON payer.id = s.paid_by
       JOIN users payee ON payee.id = s.paid_to
       WHERE s.group_id = $1
       ORDER BY s.settlement_date DESC, s.created_at DESC`,
      [groupId]
    );

    res.json(settlementsRes.rows);
  } catch (err) {
    console.error('Get Settlements Error:', err.message);
    res.status(500).json({ error: 'Server error retrieving settlements.' });
  }
});

module.exports = router;
