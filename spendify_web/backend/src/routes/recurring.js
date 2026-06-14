const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// GET /api/recurring
router.get('/', authMiddleware, async (req, res) => {
  try {
    const listRes = await db.query(
      `SELECT id, amount, note, category, frequency, next_date AS "nextDate", active 
       FROM recurring_expenses 
       WHERE user_id = $1
       ORDER BY next_date ASC, created_at DESC`,
      [req.user.id]
    );

    const formatted = listRes.rows.map(r => ({
      ...r,
      amount: parseFloat(r.amount),
      active: r.active === true,
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Get Recurring Error:', err.message);
    res.status(500).json({ error: 'Server error retrieving recurring templates.' });
  }
});

// POST /api/recurring
router.post('/', authMiddleware, async (req, res) => {
  const { amount, note, category, frequency = 'monthly', nextDate } = req.body;

  if (!amount || !nextDate) {
    return res.status(400).json({ error: 'amount and nextDate are required.' });
  }

  try {
    const targetDate = new Date(nextDate);

    const insertRes = await db.query(
      `INSERT INTO recurring_expenses (user_id, amount, note, category, frequency, next_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, amount, note, category, frequency, next_date AS "nextDate", active`,
      [req.user.id, amount, note || '', category || 'other', frequency, targetDate]
    );

    const created = insertRes.rows[0];
    created.amount = parseFloat(created.amount);

    res.status(201).json(created);
  } catch (err) {
    console.error('Create Recurring Error:', err.message);
    res.status(500).json({ error: 'Server error creating recurring template.' });
  }
});

// PUT /api/recurring/:id
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { amount, note, category, frequency, nextDate, active } = req.body;

  try {
    const checkRes = await db.query('SELECT * FROM recurring_expenses WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Recurring template not found.' });
    }
    const current = checkRes.rows[0];

    const updatedAmt = amount !== undefined ? amount : parseFloat(current.amount);
    const updatedNote = note !== undefined ? note : current.note;
    const updatedCategory = category !== undefined ? category : current.category;
    const updatedFreq = frequency !== undefined ? frequency : current.frequency;
    const updatedDate = nextDate ? new Date(nextDate) : current.next_date;
    const updatedActive = active !== undefined ? active : current.active;

    const updateRes = await db.query(
      `UPDATE recurring_expenses
       SET amount = $1, note = $2, category = $3, frequency = $4, next_date = $5, active = $6
       WHERE id = $7 AND user_id = $8
       RETURNING id, amount, note, category, frequency, next_date AS "nextDate", active`,
      [updatedAmt, updatedNote, updatedCategory, updatedFreq, updatedDate, updatedActive, id, req.user.id]
    );

    const updated = updateRes.rows[0];
    updated.amount = parseFloat(updated.amount);

    res.json(updated);
  } catch (err) {
    console.error('Update Recurring Error:', err.message);
    res.status(500).json({ error: 'Server error updating recurring template.' });
  }
});

// DELETE /api/recurring/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const deleteRes = await db.query(
      `DELETE FROM recurring_expenses WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, req.user.id]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Recurring template not found.' });
    }

    res.json({ message: 'Recurring template deleted successfully.' });
  } catch (err) {
    console.error('Delete Recurring Error:', err.message);
    res.status(500).json({ error: 'Server error deleting recurring template.' });
  }
});

module.exports = router;
