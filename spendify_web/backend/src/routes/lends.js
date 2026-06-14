const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// GET /api/lends
router.get('/', authMiddleware, async (req, res) => {
  try {
    const lendsRes = await db.query(
      `SELECT id, type, contact_name AS "contactName", contact_phone AS "contactPhone", 
              amount, note, date::text, paid
       FROM lends 
       WHERE user_id = $1
       ORDER BY date DESC, created_at DESC`,
      [req.user.id]
    );

    // Format fields (amount to number, paid to boolean)
    const formatted = lendsRes.rows.map(r => ({
      ...r,
      amount: parseFloat(r.amount),
      paid: r.paid === true,
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Get Lends Error:', err.message);
    res.status(500).json({ error: 'Server error retrieving lends.' });
  }
});

// POST /api/lends
router.post('/', authMiddleware, async (req, res) => {
  const { type, contactName, contactPhone, amount, note, date } = req.body;

  if (!type || !contactName || !amount) {
    return res.status(400).json({ error: 'type, contactName, and amount are required.' });
  }

  try {
    const lendDate = date ? new Date(date) : new Date();

    const insertRes = await db.query(
      `INSERT INTO lends (user_id, type, contact_name, contact_phone, amount, note, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, type, contact_name AS "contactName", contact_phone AS "contactPhone", 
                 amount, note, date::text, paid`,
      [req.user.id, type, contactName.trim(), contactPhone || '', amount, note || '', lendDate]
    );

    const created = insertRes.rows[0];
    created.amount = parseFloat(created.amount);

    res.status(201).json(created);
  } catch (err) {
    console.error('Create Lend Error:', err.message);
    res.status(500).json({ error: 'Server error creating lend.' });
  }
});

// PUT /api/lends/:id
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { paid, amount, note, contactName, contactPhone, date } = req.body;

  try {
    const checkRes = await db.query('SELECT * FROM lends WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Lending record not found.' });
    }
    const current = checkRes.rows[0];

    const updatedPaid = paid !== undefined ? paid : current.paid;
    const updatedAmt = amount !== undefined ? amount : parseFloat(current.amount);
    const updatedNote = note !== undefined ? note : current.note;
    const updatedName = contactName !== undefined ? contactName : current.contact_name;
    const updatedPhone = contactPhone !== undefined ? contactPhone : current.contact_phone;
    const updatedDate = date ? new Date(date) : current.date;

    const updateRes = await db.query(
      `UPDATE lends
       SET paid = $1, amount = $2, note = $3, contact_name = $4, contact_phone = $5, date = $6
       WHERE id = $7 AND user_id = $8
       RETURNING id, type, contact_name AS "contactName", contact_phone AS "contactPhone", 
                 amount, note, date::text, paid`,
      [updatedPaid, updatedAmt, updatedNote, updatedName, updatedPhone, updatedDate, id, req.user.id]
    );

    const updated = updateRes.rows[0];
    updated.amount = parseFloat(updated.amount);

    res.json(updated);
  } catch (err) {
    console.error('Update Lend Error:', err.message);
    res.status(500).json({ error: 'Server error updating lend.' });
  }
});

// DELETE /api/lends/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const deleteRes = await db.query(
      `DELETE FROM lends WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, req.user.id]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Lending record not found.' });
    }

    res.json({ message: 'Lending record deleted successfully.' });
  } catch (err) {
    console.error('Delete Lend Error:', err.message);
    res.status(500).json({ error: 'Server error deleting lend.' });
  }
});

module.exports = router;
