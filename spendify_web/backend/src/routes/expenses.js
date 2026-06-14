const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const currencyService = require('../services/currencyService');

// POST /api/groups/:id/expenses
// Create a shared group expense
router.post('/groups/:id/expenses', authMiddleware, async (req, res) => {
  const { id: groupId } = req.params;
  const {
    description,
    amount,
    currency = 'INR',
    paidBy,
    splitType = 'equal',
    splits = {}, // { [userId]: value }
    date,
    is_settlement = false,
  } = req.body;

  if (!amount || !paidBy) {
    return res.status(400).json({ error: 'Amount and Paid By fields are required.' });
  }

  try {
    // 1. Convert amount to INR
    const conv = currencyService.convertToINR(amount, currency);
    const amountInINR = conv.amountInINR;

    // 2. Fetch active members for date validation
    const membersRes = await db.query(
      `SELECT user_id AS id FROM group_members WHERE group_id = $1`,
      [groupId]
    );
    const memberIds = membersRes.rows.map(m => m.id);

    if (memberIds.length === 0) {
      return res.status(400).json({ error: 'Group has no members.' });
    }

    const expenseDate = date ? new Date(date) : new Date();

    // 3. Insert main Expense record
    const expenseInsert = await db.query(
      `INSERT INTO expenses (group_id, description, total_amount, currency, amount_in_inr, paid_by, expense_date, split_type, is_settlement) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [groupId, description || '', amount, currency, amountInINR, paidBy, expenseDate, splitType, is_settlement]
    );
    const expense = expenseInsert.rows[0];

    // 4. Calculate and save splits
    const insertSplit = async (uId, owed, shVal, pct) => {
      await db.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount_owed, share_value, percentage) 
         VALUES ($1, $2, $3, $4, $5)`,
        [expense.id, uId, owed, shVal, pct]
      );
    };

    if (splitType === 'equal') {
      const share = amountInINR / memberIds.length;
      for (const uId of memberIds) {
        await insertSplit(uId, share, null, null);
      }
    } else if (splitType === 'exact') {
      for (const [uId, val] of Object.entries(splits)) {
        const splitConv = currencyService.convertToINR(val, currency);
        await insertSplit(uId, splitConv.amountInINR, null, null);
      }
    } else if (splitType === 'percentage') {
      for (const [uId, val] of Object.entries(splits)) {
        const pct = parseFloat(val) || 0;
        const owed = (pct / 100) * amountInINR;
        await insertSplit(uId, owed, null, pct);
      }
    } else if (splitType === 'shares') {
      const totalShares = Object.values(splits).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      for (const [uId, val] of Object.entries(splits)) {
        const shares = parseFloat(val) || 0;
        const owed = totalShares > 0 ? (shares / totalShares) * amountInINR : 0;
        await insertSplit(uId, owed, shares, null);
      }
    }

    res.status(201).json(expense);
  } catch (err) {
    console.error('Create Group Expense Error:', err.message);
    res.status(500).json({ error: 'Server error creating shared expense.' });
  }
});

// GET /api/groups/:id/expenses
// Get all expenses for a group
router.get('/groups/:id/expenses', authMiddleware, async (req, res) => {
  const { id: groupId } = req.params;

  try {
    const expensesRes = await db.query(
      `SELECT id, description, total_amount, currency, amount_in_inr, paid_by, expense_date AS date, split_type, is_settlement
       FROM expenses 
       WHERE group_id = $1 
       ORDER BY expense_date DESC, created_at DESC`,
      [groupId]
    );
    const expenses = expensesRes.rows;

    // Attach splits
    for (const exp of expenses) {
      const splitsRes = await db.query(
        `SELECT user_id, amount_owed FROM expense_splits WHERE expense_id = $1`,
        [exp.id]
      );
      const splitsObj = {};
      splitsRes.rows.forEach(s => {
        splitsObj[s.user_id] = parseFloat(s.amount_owed);
      });
      exp.splits = splitsObj;
      exp.amount = parseFloat(exp.amount_in_inr);
    }

    res.json(expenses);
  } catch (err) {
    console.error('Get Group Expenses Error:', err.message);
    res.status(500).json({ error: 'Server error retrieving expenses.' });
  }
});

// GET /api/expenses
// Get personal expenses (group_id is null)
router.get('/expenses', authMiddleware, async (req, res) => {
  try {
    const expensesRes = await db.query(
      `SELECT id, description AS note, total_amount AS amount, currency, amount_in_inr, paid_by, expense_date AS date, split_type, category
       FROM expenses
       WHERE group_id IS NULL AND paid_by = $1
       ORDER BY expense_date DESC, created_at DESC`,
      [req.user.id]
    );
    res.json(expensesRes.rows);
  } catch (err) {
    console.error('Get Personal Expenses Error:', err.message);
    res.status(500).json({ error: 'Server error retrieving personal expenses.' });
  }
});

// POST /api/expenses
// Create a personal expense (group_id is null)
router.post('/expenses', authMiddleware, async (req, res) => {
  const { amount, note, category = 'other', date } = req.body;

  if (!amount) {
    return res.status(400).json({ error: 'Amount is required.' });
  }

  try {
    const conv = currencyService.convertToINR(amount, 'INR');
    const expenseDate = date ? new Date(date) : new Date();

    const result = await db.query(
      `INSERT INTO expenses (group_id, description, total_amount, currency, amount_in_inr, paid_by, expense_date, split_type, category)
       VALUES (NULL, $1, $2, 'INR', $3, $4, $5, 'equal', $6)
       RETURNING id, description AS note, total_amount AS amount, currency, amount_in_inr, paid_by, expense_date AS date, category`,
      [note || '', amount, conv.amountInINR, req.user.id, expenseDate, category]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create Personal Expense Error:', err.message);
    res.status(500).json({ error: 'Server error creating personal expense.' });
  }
});

// PUT /api/expenses/:id
// Update an expense by ID (either group or personal)
router.put('/expenses/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { description, amount, paidBy, splitType, splits, category, date } = req.body;

  try {
    // Check if expense exists
    const checkRes = await db.query('SELECT * FROM expenses WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found.' });
    }
    const currentExp = checkRes.rows[0];

    const updatedDesc = description !== undefined ? description : currentExp.description;
    const updatedAmt = amount !== undefined ? parseFloat(amount) : parseFloat(currentExp.total_amount);
    const updatedPaidBy = paidBy !== undefined ? paidBy : currentExp.paid_by;
    const updatedSplitType = splitType !== undefined ? splitType : currentExp.split_type;
    const updatedCategory = category !== undefined ? category : currentExp.category;
    const updatedDate = date ? new Date(date) : currentExp.expense_date;

    const conv = currencyService.convertToINR(updatedAmt, currentExp.currency);
    const amountInINR = conv.amountInINR;

    // Update main expense
    const updateRes = await db.query(
      `UPDATE expenses 
       SET description = $1, total_amount = $2, amount_in_inr = $3, paid_by = $4, split_type = $5, category = $6, expense_date = $7
       WHERE id = $8 
       RETURNING *`,
      [updatedDesc, updatedAmt, amountInINR, updatedPaidBy, updatedSplitType, updatedCategory, updatedDate, id]
    );

    const updatedExpense = updateRes.rows[0];

    // Recalculate and re-insert splits if it's a group expense
    if (currentExp.group_id) {
      // Fetch members of group to handle equal splits if needed
      const membersRes = await db.query('SELECT user_id AS id FROM group_members WHERE group_id = $1', [currentExp.group_id]);
      const memberIds = membersRes.rows.map(m => m.id);

      // Delete old splits
      await db.query('DELETE FROM expense_splits WHERE expense_id = $1', [id]);

      const insertSplit = async (uId, owed, shVal, pct) => {
        await db.query(
          `INSERT INTO expense_splits (expense_id, user_id, amount_owed, share_value, percentage) 
           VALUES ($1, $2, $3, $4, $5)`,
          [id, uId, owed, shVal, pct]
        );
      };

      const finalSplits = splits || {};

      if (updatedSplitType === 'equal') {
        const share = amountInINR / memberIds.length;
        for (const uId of memberIds) {
          await insertSplit(uId, share, null, null);
        }
      } else if (updatedSplitType === 'exact') {
        for (const [uId, val] of Object.entries(finalSplits)) {
          const splitConv = currencyService.convertToINR(val, currentExp.currency);
          await insertSplit(uId, splitConv.amountInINR, null, null);
        }
      } else if (updatedSplitType === 'percentage') {
        for (const [uId, val] of Object.entries(finalSplits)) {
          const pct = parseFloat(val) || 0;
          const owed = (pct / 100) * amountInINR;
          await insertSplit(uId, owed, null, pct);
        }
      } else if (updatedSplitType === 'shares') {
        const totalShares = Object.values(finalSplits).reduce((s, v) => s + (parseFloat(v) || 0), 0);
        for (const [uId, val] of Object.entries(finalSplits)) {
          const shares = parseFloat(val) || 0;
          const owed = totalShares > 0 ? (shares / totalShares) * amountInINR : 0;
          await insertSplit(uId, owed, shares, null);
        }
      }
    }

    res.json(updatedExpense);
  } catch (err) {
    console.error('Update Expense Error:', err.message);
    res.status(500).json({ error: 'Server error updating expense.' });
  }
});

// DELETE /api/expenses/:id
// Delete an expense (either group or personal)
router.delete('/expenses/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const deleteRes = await db.query('DELETE FROM expenses WHERE id = $1 RETURNING *', [id]);
    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found.' });
    }
    res.json({ message: 'Expense deleted successfully.' });
  } catch (err) {
    console.error('Delete Expense Error:', err.message);
    res.status(500).json({ error: 'Server error deleting expense.' });
  }
});

module.exports = router;
