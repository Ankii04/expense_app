const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// GET /api/budgets
// Load all category budgets for the current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const budgetsRes = await db.query(
      `SELECT category, amount FROM budgets WHERE user_id = $1`,
      [req.user.id]
    );
    
    // Format response as a key-value object { [category]: amount } matching the frontend client state
    const budgetsObj = {};
    budgetsRes.rows.forEach(b => {
      budgetsObj[b.category] = parseFloat(b.amount);
    });

    res.json(budgetsObj);
  } catch (err) {
    console.error('Get Budgets Error:', err.message);
    res.status(500).json({ error: 'Server error retrieving budgets.' });
  }
});

// POST /api/budgets
// Set or update a budget for a category
router.post('/', authMiddleware, async (req, res) => {
  const { category, amount } = req.body;

  if (!category || amount === undefined) {
    return res.status(400).json({ error: 'category and amount are required.' });
  }

  try {
    await db.query(
      `INSERT INTO budgets (user_id, category, amount) 
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, category) 
       DO UPDATE SET amount = EXCLUDED.amount`,
      [req.user.id, category.trim(), amount]
    );

    res.status(200).json({ message: 'Budget updated successfully.', category, amount });
  } catch (err) {
    console.error('Set Budget Error:', err.message);
    res.status(500).json({ error: 'Server error updating budget.' });
  }
});

module.exports = router;
