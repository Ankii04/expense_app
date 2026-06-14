const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Helper: Find or create a user by name (to support adding unregistered friends to groups)
async function findOrCreatePlaceholderUser(name, phone) {
  const cleanName = name.trim();
  // Search for an existing user with this name (or phone if provided)
  let userQuery;
  let params;

  if (phone) {
    userQuery = 'SELECT id, name FROM users WHERE name = $1 OR email = $2';
    params = [cleanName, phone.trim()];
  } else {
    userQuery = 'SELECT id, name FROM users WHERE name = $1';
    params = [cleanName];
  }

  const existingUser = await db.query(userQuery, params);
  if (existingUser.rows.length > 0) {
    return existingUser.rows[0].id;
  }

  // Create a placeholder user
  const dummyEmail = `placeholder_${cleanName.replace(/\s+/g, '_').toLowerCase()}_${uuidv4().substring(0, 8)}@spendify.local`;
  const dummyPasswordHash = 'placeholder_account_no_login';
  
  const createdRes = await db.query(
    `INSERT INTO users (name, email, password_hash) 
     VALUES ($1, $2, $3) 
     RETURNING id`,
    [cleanName, dummyEmail, dummyPasswordHash]
  );
  return createdRes.rows[0].id;
}

// GET /api/groups
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Get all groups where user is a member
    const groupsRes = await db.query(
      `SELECT g.id, g.name, g.created_by, g.created_at
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = $1
       ORDER BY g.created_at DESC`,
      [req.user.id]
    );
    const groups = groupsRes.rows;

    // Attach members, expense counts, and debt count to each group
    const balanceService = require('../services/balanceService');
    for (const group of groups) {
      const membersRes = await db.query(
        `SELECT gm.user_id AS id, u.name, gm.joined_at, gm.left_at
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = $1`,
        [group.id]
      );
      group.members = membersRes.rows;

      const expenseCountRes = await db.query(
        `SELECT COUNT(*) FROM expenses WHERE group_id = $1`,
        [group.id]
      );
      group.expenseCount = parseInt(expenseCountRes.rows[0].count, 10);

      try {
        const balDetails = await balanceService.calculateBalances(group.id);
        group.debtCount = balDetails.simplifiedDebts.length;
      } catch (e) {
        group.debtCount = 0;
      }
    }

    res.json(groups);
  } catch (err) {
    console.error('Get Groups Error:', err.message);
    res.status(500).json({ error: 'Server error retrieving groups.' });
  }
});

// POST /api/groups
router.post('/', authMiddleware, async (req, res) => {
  const { name, members } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Group name is required.' });
  }

  try {
    // 1. Insert Group
    const groupRes = await db.query(
      `INSERT INTO groups (name, created_by) 
       VALUES ($1, $2) 
       RETURNING id, name, created_by, created_at`,
      [name.trim(), req.user.id]
    );
    const group = groupRes.rows[0];

    // 2. Add members
    const addedMemberIds = new Set();
    
    // Always add the creator as the first member
    await db.query(
      `INSERT INTO group_members (group_id, user_id, joined_at) 
       VALUES ($1, $2, CURRENT_DATE) 
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [group.id, req.user.id]
    );
    addedMemberIds.add(req.user.id);

    // Add remaining members
    if (Array.isArray(members)) {
      for (const m of members) {
        if (!m.name || !m.name.trim()) continue;

        let uId;
        // If member specifies they are matching the active user, map it
        if (m.name.trim().toLowerCase() === req.user.email.toLowerCase() || m.name.trim() === 'You') {
          uId = req.user.id;
        } else {
          uId = await findOrCreatePlaceholderUser(m.name, m.phone);
        }

        if (addedMemberIds.has(uId)) continue; // skip duplicates

        const joinedDate = m.joined_at ? new Date(m.joined_at) : new Date();
        const leftDate = m.left_at ? new Date(m.left_at) : null;

        await db.query(
          `INSERT INTO group_members (group_id, user_id, joined_at, left_at) 
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (group_id, user_id) DO NOTHING`,
          [group.id, uId, joinedDate, leftDate]
        );
        addedMemberIds.add(uId);
      }
    }

    res.status(201).json(group);
  } catch (err) {
    console.error('Create Group Error:', err.message);
    res.status(500).json({ error: 'Server error creating group.' });
  }
});

// GET /api/groups/:id
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch group
    const groupRes = await db.query(
      `SELECT id, name, created_by, created_at FROM groups WHERE id = $1`,
      [id]
    );
    if (groupRes.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found.' });
    }
    const group = groupRes.rows[0];

    // Fetch members
    const membersRes = await db.query(
      `SELECT gm.user_id AS id, u.name, gm.joined_at, gm.left_at
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1`,
      [id]
    );
    group.members = membersRes.rows;

    // Fetch expenses
    const expensesRes = await db.query(
      `SELECT e.id, e.description, e.total_amount, e.currency, e.amount_in_inr, 
              e.paid_by, e.expense_date AS date, e.split_type, e.is_settlement
       FROM expenses e
       WHERE e.group_id = $1
       ORDER BY e.expense_date DESC, e.created_at DESC`,
      [id]
    );
    group.expenses = expensesRes.rows;

    // Fetch splits for those expenses
    for (const exp of group.expenses) {
      const splitsRes = await db.query(
        `SELECT user_id, amount_owed, share_value, percentage 
         FROM expense_splits 
         WHERE expense_id = $1`,
        [exp.id]
      );
      // Map splits back to dictionary format: { [userId]: amount }
      const splitsObj = {};
      splitsRes.rows.forEach(s => {
        splitsObj[s.user_id] = parseFloat(s.amount_owed);
      });
      exp.splits = splitsObj;
      exp.amount = parseFloat(exp.amount_in_inr); // client expects `amount` field
    }

    res.json(group);
  } catch (err) {
    console.error('Get Group Details Error:', err.message);
    res.status(500).json({ error: 'Server error retrieving group details.' });
  }
});

// POST /api/groups/:id/members
router.post('/:id/members', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, phone, joined_at, left_at } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Member name is required.' });
  }

  try {
    const uId = await findOrCreatePlaceholderUser(name, phone);

    const joinedDate = joined_at ? new Date(joined_at) : new Date();
    const leftDate = left_at ? new Date(left_at) : null;

    const memberInsert = await db.query(
      `INSERT INTO group_members (group_id, user_id, joined_at, left_at) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (group_id, user_id) 
       DO UPDATE SET joined_at = EXCLUDED.joined_at, left_at = EXCLUDED.left_at
       RETURNING user_id, joined_at, left_at`,
      [id, uId, joinedDate, leftDate]
    );

    res.status(201).json({
      id: uId,
      name: name.trim(),
      joined_at: memberInsert.rows[0].joined_at,
      left_at: memberInsert.rows[0].left_at,
    });
  } catch (err) {
    console.error('Add Member Error:', err.message);
    res.status(500).json({ error: 'Server error adding member.' });
  }
});

// PUT /api/groups/:id/members/:userId
router.put('/:id/members/:userId', authMiddleware, async (req, res) => {
  const { id, userId } = req.params;
  const { left_at, joined_at } = req.body;

  try {
    let updateQuery = 'UPDATE group_members SET ';
    const params = [id, userId];
    let paramIdx = 3;
    const updates = [];

    if (left_at !== undefined) {
      updates.push(`left_at = $${paramIdx++}`);
      params.push(left_at ? new Date(left_at) : null);
    }
    if (joined_at !== undefined) {
      updates.push(`joined_at = $${paramIdx++}`);
      params.push(new Date(joined_at));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    updateQuery += updates.join(', ') + ' WHERE group_id = $1 AND user_id = $2 RETURNING *';

    const result = await db.query(updateQuery, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Group member record not found.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update Member Error:', err.message);
    res.status(500).json({ error: 'Server error updating member.' });
  }
});

// DELETE /api/groups/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const deleteRes = await db.query(
      `DELETE FROM groups WHERE id = $1 RETURNING *`,
      [id]
    );

    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    res.json({ message: 'Group deleted successfully.' });
  } catch (err) {
    console.error('Delete Group Error:', err.message);
    res.status(500).json({ error: 'Server error deleting group.' });
  }
});

module.exports = router;
