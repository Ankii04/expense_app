const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');
const importService = require('../services/importService');

// POST /api/groups/:id/import
// Upload and parse CSV file, saving anomalies and auto-inserting valid rows
router.post('/groups/:id/import', authMiddleware, upload.single('file'), async (req, res) => {
  const { id: groupId } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a CSV file.' });
  }

  try {
    const csvText = req.file.buffer.toString('utf-8');
    
    // Fetch importing user details for logs
    const userRes = await db.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    const importingUser = { id: req.user.id, name: userRes.rows[0].name };

    // Process the CSV using the 12 validation rules
    const report = await importService.processCsvImport(csvText, groupId, importingUser);

    // Save the main import log
    const logRes = await db.query(
      `INSERT INTO csv_import_logs (group_id, filename, imported_by, total_rows, successful_rows, anomaly_count, import_report)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [groupId, req.file.originalname, req.user.id, report.totalRows, report.successfulRows, report.anomalyCount, report]
    );
    const importLog = logRes.rows[0];

    // Fetch group members to calculate splits
    const membersRes = await db.query('SELECT user_id AS id FROM group_members WHERE group_id = $1', [groupId]);
    const memberIds = membersRes.rows.map(m => m.id);

    // Process each row's report
    for (const r of report.reports) {
      if (r.status === 'REJECTED') {
        // Log rejected anomaly
        await db.query(
          `INSERT INTO csv_anomalies (import_id, row_number, issue_type, raw_data, action_taken, requires_approval, approved)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [importLog.id, r.rowNumber, r.errors[0] || 'REJECTED', r, r.actionTaken, false, false]
        );
      } else if (r.requiresApproval) {
        // Log anomaly requiring user approval (e.g. duplicate check)
        await db.query(
          `INSERT INTO csv_anomalies (import_id, row_number, issue_type, raw_data, action_taken, requires_approval, approved)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [importLog.id, r.rowNumber, 'DUPLICATE_ENTRY', r, r.actionTaken, true, false]
        );
      } else {
        // For standard OK or WARNING rows (where approval is not required), insert as an expense directly!
        const expData = r.data;
        
        // 1. Insert main expense
        const expRes = await db.query(
          `INSERT INTO expenses (group_id, description, total_amount, currency, amount_in_inr, paid_by, expense_date, split_type, imported_from_csv)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'equal', TRUE)
           RETURNING id`,
          [groupId, expData.note || 'Imported CSV Expense', expData.amount, expData.currency, expData.amountInINR, expData.paidBy, expData.date]
        );
        const expId = expRes.rows[0].id;

        // 2. Insert equal splits
        const share = expData.amountInINR / memberIds.length;
        for (const uId of memberIds) {
          await db.query(
            `INSERT INTO expense_splits (expense_id, user_id, amount_owed)
             VALUES ($1, $2, $3)`,
            [expId, uId, share]
          );
        }

        // Check if there was a warning to log
        if (r.status === 'WARNING') {
          await db.query(
            `INSERT INTO csv_anomalies (import_id, row_number, issue_type, raw_data, action_taken, requires_approval, approved, approved_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [importLog.id, r.rowNumber, r.warnings[0] || 'WARNING', r, 'Imported automatically with warnings.', false, true]
          );
        }
      }
    }

    res.status(201).json(importLog);
  } catch (err) {
    console.error('Import CSV Error:', err.message);
    res.status(500).json({ error: 'Server error parsing CSV file.' });
  }
});

// GET /api/groups/:id/import/:importId
// Get import report and anomalies
router.get('/groups/:id/import/:importId', authMiddleware, async (req, res) => {
  const { importId } = req.params;

  try {
    const logRes = await db.query(
      `SELECT * FROM csv_import_logs WHERE id = $1`,
      [importId]
    );

    if (logRes.rows.length === 0) {
      return res.status(404).json({ error: 'Import log not found.' });
    }

    const anomaliesRes = await db.query(
      `SELECT * FROM csv_anomalies WHERE import_id = $1 ORDER BY row_number ASC`,
      [importId]
    );

    res.json({
      log: logRes.rows[0],
      anomalies: anomaliesRes.rows,
    });
  } catch (err) {
    console.error('Get Import Report Error:', err.message);
    res.status(500).json({ error: 'Server error retrieving import report.' });
  }
});

// POST /api/groups/:id/import/:importId/approve
// Approve a duplicate check or anomaly row, creating it as an expense
router.post('/groups/:id/import/:importId/approve', authMiddleware, async (req, res) => {
  const { id: groupId, importId } = req.params;
  const { rowNumber } = req.body;

  if (!rowNumber) {
    return res.status(400).json({ error: 'rowNumber is required in body.' });
  }

  try {
    // 1. Fetch anomaly details
    const anomalyRes = await db.query(
      `SELECT * FROM csv_anomalies WHERE import_id = $1 AND row_number = $2 AND requires_approval = TRUE AND approved = FALSE`,
      [importId, rowNumber]
    );

    if (anomalyRes.rows.length === 0) {
      return res.status(404).json({ error: 'Pending anomaly row not found.' });
    }

    const anomaly = anomalyRes.rows[0];
    const rowReport = anomaly.raw_data;
    const expData = rowReport.data;

    // 2. Fetch group members
    const membersRes = await db.query('SELECT user_id AS id FROM group_members WHERE group_id = $1', [groupId]);
    const memberIds = membersRes.rows.map(m => m.id);

    // 3. Create expense
    const expRes = await db.query(
      `INSERT INTO expenses (group_id, description, total_amount, currency, amount_in_inr, paid_by, expense_date, split_type, imported_from_csv)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'equal', TRUE)
       RETURNING *`,
      [groupId, expData.note || 'Approved Duplicate CSV Expense', expData.amount, expData.currency, expData.amountInINR, expData.paidBy, expData.date]
    );
    const expense = expRes.rows[0];

    // 4. Create equal splits
    const share = expData.amountInINR / memberIds.length;
    for (const uId of memberIds) {
      await db.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount_owed)
         VALUES ($1, $2, $3)`,
        [expense.id, uId, share]
      );
    }

    // 5. Update anomaly row status to approved
    await db.query(
      `UPDATE csv_anomalies 
       SET approved = TRUE, approved_at = NOW(), action_taken = 'Approved by user.' 
       WHERE id = $1`,
      [anomaly.id]
    );

    res.json({ message: 'Anomaly approved and expense created successfully.', expense });
  } catch (err) {
    console.error('Approve Anomaly Error:', err.message);
    res.status(500).json({ error: 'Server error approving anomaly.' });
  }
});

module.exports = router;
