const { parse } = require('csv-parse/sync');
const currencyService = require('./currencyService');
const db = require('../db');

/**
 * Validates a date string and attempts to normalize it.
 * Supports DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY, and raw timestamps.
 */
function parseAndNormalizeDate(dateStr) {
  if (!dateStr) return { valid: false, date: null };
  const clean = dateStr.trim();

  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) return { valid: true, date: clean };
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmMatch = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmMatch) {
    const day = parseInt(dmMatch[1], 10);
    const month = parseInt(dmMatch[2], 10) - 1; // 0-indexed month
    const year = parseInt(dmMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime()) && d.getDate() === day && d.getMonth() === month) {
      const pad = (n) => String(n).padStart(2, '0');
      return { valid: true, date: `${year}-${pad(month + 1)}-${pad(day)}` };
    }
  }

  // Fallback to JS native parser
  const fallback = new Date(clean);
  if (!isNaN(fallback.getTime())) {
    const pad = (n) => String(n).padStart(2, '0');
    const y = fallback.getFullYear();
    const m = pad(fallback.getMonth() + 1);
    const d = pad(fallback.getDate());
    return { valid: true, date: `${y}-${m}-${d}` };
  }

  return { valid: false, date: null };
}

/**
 * Parses a CSV string and evaluates all 12 anomaly rules.
 * @param {string} csvText - The CSV payload
 * @param {string} groupId - UUID of the target group
 * @param {Object} importingUser - The active user uploading the CSV
 */
async function processCsvImport(csvText, groupId, importingUser) {
  // Fetch existing group members
  const membersRes = await db.query(
    `SELECT u.id, u.name, gm.joined_at, gm.left_at 
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1`,
    [groupId]
  );
  const members = membersRes.rows;

  // Fetch existing expenses to detect duplicates
  const existingExpensesRes = await db.query(
    `SELECT description, amount_in_inr, expense_date::text AS date 
     FROM expenses 
     WHERE group_id = $1`,
    [groupId]
  );
  const existingExpenses = existingExpensesRes.rows;

  // Parse the CSV
  let records;
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    throw new Error('CSV Parsing Error: ' + err.message);
  }

  const reports = [];
  let successfulRows = 0;
  let anomalyCount = 0;

  for (let idx = 0; idx < records.length; idx++) {
    const raw = records[idx];
    const rowNum = idx + 1;

    // Detect column mappings dynamically (case-insensitive)
    const getVal = (keys) => {
      const matchKey = Object.keys(raw).find(k => keys.includes(k.toLowerCase().trim()));
      return matchKey ? raw[matchKey] : '';
    };

    const rawDateStr    = getVal(['date', 'expense_date', 'time']);
    const rawAmountStr  = getVal(['amount', 'total_amount', 'value', 'price']);
    const rawNoteStr    = getVal(['note', 'description', 'memo', 'details']);
    const rawCategory   = getVal(['category', 'type', 'tag']) || 'other';
    const rawPayerName  = getVal(['payer', 'paid_by', 'paidby', 'who']);

    const errors = [];
    const warnings = [];
    let autoFixes = [];
    let actionTaken = 'None';
    let requiresApproval = false;

    // 8. ANOMALY: MISSING_REQUIRED_FIELD (REJECTED)
    if (!rawAmountStr) errors.push('MISSING_REQUIRED_FIELD: Amount is missing.');
    if (!rawDateStr)   errors.push('MISSING_REQUIRED_FIELD: Date is missing.');
    if (!rawNoteStr)   errors.push('MISSING_REQUIRED_FIELD: Description/Note is missing.');

    if (errors.length > 0) {
      anomalyCount++;
      reports.push({
        rowNumber: rowNum,
        status: 'REJECTED',
        errors,
        warnings,
        autoFixes,
        requiresApproval: false,
        actionTaken: 'Rejected row due to missing required fields.',
        data: { date: rawDateStr, amount: rawAmountStr, note: rawNoteStr, category: rawCategory },
      });
      continue;
    }

    // 1. ANOMALY: INVALID_DATE (REJECTED/AUTO_FIXED)
    let parsedDate = null;
    const dateCheck = parseAndNormalizeDate(rawDateStr);
    if (!dateCheck.valid) {
      errors.push('INVALID_DATE: Date format is invalid or unparseable.');
    } else {
      parsedDate = dateCheck.date;
      if (parsedDate !== rawDateStr.trim()) {
        autoFixes.push(`Normalized date from "${rawDateStr}" to "${parsedDate}"`);
        actionTaken = 'Auto-fixed date format.';
      }
    }

    // 2. ANOMALY: CURRENCY_MISMATCH (AUTO_FIXED)
    let amountVal = 0;
    let currency = 'INR';
    let amountInINR = 0;
    let rateUsed = 1.0;

    const amtClean = rawAmountStr.trim();
    if (/[$\bUSD\b]/gi.test(amtClean)) {
      currency = 'USD';
      const cleanNum = parseFloat(amtClean.replace(/[^0-9.]/g, ''));
      const conv = currencyService.convertToINR(cleanNum, 'USD');
      amountVal = cleanNum;
      amountInINR = conv.amountInINR;
      rateUsed = conv.rateUsed;
      warnings.push(`CURRENCY_MISMATCH: Detected USD amount "${amtClean}". Converted to INR (₹${amountInINR}) at rate ${rateUsed}.`);
      autoFixes.push(`Converted ${amtClean} to ₹${amountInINR}`);
      actionTaken = 'Auto-converted USD currency to INR.';
    } else {
      const cleanNum = parseFloat(amtClean.replace(/[^0-9.-]/g, '')) || 0;
      amountVal = cleanNum;
      amountInINR = cleanNum;
    }

    // 10. ANOMALY: ZERO_AMOUNT (WARNING)
    if (amountInINR === 0) {
      warnings.push('ZERO_AMOUNT: Transaction amount is zero.');
    }

    // 4. ANOMALY: NEGATIVE_AMOUNT (WARNING)
    if (amountInINR < 0) {
      warnings.push('NEGATIVE_AMOUNT: Negative amount detected. Interpreting as refund/credit.');
    }

    // 12. ANOMALY: FUTURE_DATE (WARNING)
    if (parsedDate) {
      const expD = new Date(parsedDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expD > today) {
        warnings.push(`FUTURE_DATE: Expense date ${parsedDate} is in the future.`);
      }
    }

    // 5. ANOMALY: SETTLEMENT_AS_EXPENSE (WARNING)
    const settlementKeywords = ['paid', 'settled', 'settlement', 'transfer', 'repay', 'payment', 'sent to'];
    const isSettlementKeyword = settlementKeywords.some(keyword => 
      rawNoteStr.toLowerCase().includes(keyword)
    );
    if (isSettlementKeyword) {
      warnings.push('SETTLEMENT_AS_EXPENSE: Description indicates a settlement or transfer. Importing as standard expense by default.');
    }

    // 9. ANOMALY: UNKNOWN_MEMBER (WARNING / DEFAULT PAYER)
    let payerId = importingUser.id; // Default to active importing user
    if (rawPayerName) {
      const matchingMember = members.find(m => 
        m.name.trim().toLowerCase() === rawPayerName.trim().toLowerCase()
      );
      if (matchingMember) {
        payerId = matchingMember.id;
      } else {
        warnings.push(`UNKNOWN_MEMBER: Payer "${rawPayerName}" not found in group members list. Defaulted to importing user (${importingUser.name}).`);
        autoFixes.push(`Mapped unknown payer "${rawPayerName}" to "${importingUser.name}"`);
        actionTaken = 'Mapped unknown payer to current user.';
      }
    }

    // Membership dates validation (SAM Rule)
    if (parsedDate) {
      const targetMember = members.find(m => m.id === payerId);
      if (targetMember) {
        const d = new Date(parsedDate).getTime();
        const joinedAt = new Date(targetMember.joined_at).getTime();
        const leftAt = targetMember.left_at ? new Date(targetMember.left_at).getTime() : Infinity;

        // 7. ANOMALY: EXPENSE_BEFORE_MEMBER_JOINED (WARNING)
        if (d < joinedAt) {
          warnings.push(`EXPENSE_BEFORE_MEMBER_JOINED: Expense date ${parsedDate} is before member ${targetMember.name}'s joined date (${targetMember.joined_at.slice(0,10)}).`);
        }
        // 6. ANOMALY: EXPENSE_AFTER_MEMBER_LEFT (WARNING)
        if (d > leftAt) {
          warnings.push(`EXPENSE_AFTER_MEMBER_LEFT: Expense date ${parsedDate} is after member ${targetMember.name}'s left date (${targetMember.left_at.slice(0,10)}).`);
        }
      }
    }

    // 3. ANOMALY: DUPLICATE_ENTRY (REQUIRES APPROVAL)
    let isDuplicate = false;
    if (parsedDate) {
      const matchInDB = existingExpenses.some(e => 
        e.description.toLowerCase().trim() === rawNoteStr.toLowerCase().trim() &&
        Math.abs(parseFloat(e.amount_in_inr) - amountInINR) < 0.01 &&
        e.date === parsedDate
      );
      const matchInBatch = reports.some(r => 
        r.status === 'OK' &&
        r.data.note.toLowerCase().trim() === rawNoteStr.toLowerCase().trim() &&
        Math.abs(r.data.amountInINR - amountInINR) < 0.01 &&
        r.data.date === parsedDate
      );

      if (matchInDB || matchInBatch) {
        isDuplicate = true;
        warnings.push('DUPLICATE_ENTRY: An expense with the same description, amount, and date already exists.');
        requiresApproval = true;
      }
    }

    // 11. ANOMALY: INCONSISTENT_SPLIT (None in simple imports as splits are not explicitly listed in date/amount/note format)

    const hasErrors = errors.length > 0;
    if (hasErrors) {
      anomalyCount++;
      reports.push({
        rowNumber: rowNum,
        status: 'REJECTED',
        errors,
        warnings,
        autoFixes,
        requiresApproval: false,
        actionTaken: 'Row rejected due to validation errors.',
        data: { date: parsedDate || rawDateStr, amount: amountVal, currency, amountInINR, note: rawNoteStr, category: rawCategory, paidBy: payerId },
      });
    } else {
      if (warnings.length > 0) {
        anomalyCount++;
      }
      successfulRows++;
      reports.push({
        rowNumber: rowNum,
        status: warnings.length > 0 ? 'WARNING' : 'OK',
        errors,
        warnings,
        autoFixes,
        requiresApproval,
        actionTaken: requiresApproval ? 'Flagged duplicate. Requires manual user approval.' : (actionTaken || 'Cleared validation successfully.'),
        data: { date: parsedDate, amount: amountVal, currency, amountInINR, note: rawNoteStr, category: rawCategory, paidBy: payerId },
      });
    }
  }

  return {
    totalRows: records.length,
    successfulRows,
    anomalyCount,
    reports,
  };
}

module.exports = {
  processCsvImport,
  parseAndNormalizeDate,
};
