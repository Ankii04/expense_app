// CSV Parser with detailed Audit & Anomaly detection

// standard USD -> INR conversion rate
const USD_TO_INR_RATE = 83;

// Helper to parse dates in formats: dd/mm/yyyy, mm-dd-yyyy, yyyy-mm-dd, etc.
export const parseDateCSV = (dateStr) => {
  if (!dateStr) return null;
  const clean = dateStr.trim();
  
  // Try standard parsing
  let d = new Date(clean);
  if (!isNaN(d.getTime())) return d;

  // Try dd/mm/yyyy or dd-mm-yyyy
  let match = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    d = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(d.getTime())) return d;
  }

  // Try mm/dd/yyyy
  match = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    d = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(d.getTime())) return d;
  }

  return null;
};

export const parseCSV = (csvText, group = null, existingExpenses = []) => {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return { rows: [], anomalies: ['CSV file is empty or missing headers'] };

  // Parse headers
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  
  const getIndex = (aliases) => {
    return headers.findIndex(h => aliases.some(alias => h.includes(alias)));
  };

  const idxDate = getIndex(['date', 'time']);
  const idxAmount = getIndex(['amount', 'value', 'price']);
  const idxNote = getIndex(['note', 'description', 'title', 'item']);
  const idxPayer = getIndex(['payer', 'paid_by', 'who', 'phone']);
  const idxCurrency = getIndex(['currency', 'unit']);
  const idxSplit = getIndex(['split', 'shares', 'type']);

  const anomalies = [];
  const rows = [];
  const duplicatesGrouped = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Simple comma split handling quotes
    const cols = [];
    let current = '';
    let inQuotes = false;
    for (let char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cols.push(current.trim());

    const rowNum = i + 1;
    const errors = [];
    const warnings = [];

    // Extract columns
    let rawDate = idxDate !== -1 ? cols[idxDate] : null;
    let rawAmount = idxAmount !== -1 ? cols[idxAmount] : null;
    let rawNote = idxNote !== -1 ? cols[idxNote] : null;
    let rawPayer = idxPayer !== -1 ? cols[idxPayer] : null;
    let rawCurrency = idxCurrency !== -1 ? cols[idxCurrency] : 'INR';
    let rawSplit = idxSplit !== -1 ? cols[idxSplit] : 'equal';

    // 1. Missing required fields
    if (!rawDate) errors.push('Missing Date');
    if (!rawAmount) errors.push('Missing Amount');
    if (!rawNote) errors.push('Missing Note/Description');
    if (!rawPayer) errors.push('Missing Payer');

    if (errors.length > 0) {
      anomalies.push({
        row: rowNum,
        type: 'ERROR',
        description: `Line skipped due to missing fields: ${errors.join(', ')}`,
        data: line
      });
      continue;
    }

    // 2. Validate Amount & Handle Currency
    let amount = parseFloat(rawAmount.replace(/[^0-9\.\-]/g, ''));
    let originalCurrency = rawCurrency.toUpperCase();
    let isConverted = false;
    let conversionWarning = null;

    if (isNaN(amount)) {
      anomalies.push({
        row: rowNum,
        type: 'ERROR',
        description: `Invalid numeric amount: "${rawAmount}"`,
        data: line
      });
      continue;
    }

    // Check USD Currency indicator or Symbol in amount string
    if (rawAmount.includes('$') || originalCurrency === 'USD') {
      const convertedAmt = amount * USD_TO_INR_RATE;
      conversionWarning = `USD converted to INR (Rate: 83. $${amount} -> ₹${convertedAmt})`;
      amount = convertedAmt;
      isConverted = true;
    }

    // Zero amounts
    if (amount === 0) {
      warnings.push('Zero amount expense flagged');
    }

    // Negative amounts
    if (amount < 0) {
      warnings.push(`Negative amount detected (${amount}). Treated as a refund.`);
      amount = Math.abs(amount); // treat as absolute refund amount
    }

    // 3. Date Standardization
    const parsedDate = parseDateCSV(rawDate);
    if (!parsedDate) {
      anomalies.push({
        row: rowNum,
        type: 'ERROR',
        description: `Inconsistent/Unparseable date format: "${rawDate}"`,
        data: line
      });
      continue;
    }
    const isoDateStr = parsedDate.toISOString();

    // 4. Group Member & Membership Dates Verification
    let memberMatch = null;
    if (group) {
      memberMatch = group.members.find(
        m => m.name.toLowerCase() === rawPayer.toLowerCase() || m.phone.toLowerCase() === rawPayer.toLowerCase()
      );

      if (!memberMatch) {
        warnings.push(`Unrecognized member name: "${rawPayer}"`);
      } else {
        // Date active range checks
        if (memberMatch.joined_at) {
          const join = new Date(memberMatch.joined_at);
          if (parsedDate < join) {
            warnings.push(`Expense dated (${rawDate}) before member ${memberMatch.name} joined the group`);
          }
        }
        if (memberMatch.left_at) {
          const leave = new Date(memberMatch.left_at);
          if (parsedDate > leave) {
            warnings.push(`Expense dated (${rawDate}) after member ${memberMatch.name} left the group`);
          }
        }
      }
    }

    // 5. Settlement check
    let isSettlement = false;
    const lowerNote = rawNote.toLowerCase();
    if (lowerNote.includes('settle') || lowerNote.includes('settlement') || lowerNote.includes('payment record')) {
      isSettlement = true;
      warnings.push(`Settlement flagged as regular expense: "${rawNote}"`);
    }

    const entry = {
      row: rowNum,
      id: `csv-${Date.now()}-${rowNum}`,
      title: rawNote,
      amount,
      payerPhone: memberMatch ? memberMatch.phone : (rawPayer === 'you' ? 'self' : rawPayer),
      payerName: memberMatch ? memberMatch.name : rawPayer,
      date: isoDateStr,
      split_type: rawSplit.toLowerCase() === 'custom' ? 'custom' : 'equal',
      is_settlement: isSettlement,
      warnings,
      isConverted,
      conversionWarning
    };

    // 6. Duplicate Detection (against CSV itself or existing ledger)
    const isDuplicate = existingExpenses.some(e => {
      const timeDiff = Math.abs(new Date(e.date) - parsedDate) < 60000; // within 1 minute
      const matchNote = e.title?.toLowerCase() === rawNote.toLowerCase() || e.note?.toLowerCase() === rawNote.toLowerCase();
      const matchAmt = Math.abs(e.amount - amount) < 0.01;
      return timeDiff && matchNote && matchAmt;
    }) || rows.some(r => {
      const timeDiff = Math.abs(new Date(r.date) - parsedDate) < 60000;
      const matchNote = r.title.toLowerCase() === rawNote.toLowerCase();
      const matchAmt = Math.abs(r.amount - amount) < 0.01;
      return timeDiff && matchNote && matchAmt;
    });

    if (isDuplicate) {
      entry.isDuplicate = true;
      warnings.push('Duplicate entry detected (same note, amount, and date)');
    }

    rows.push(entry);
    
    if (warnings.length > 0) {
      anomalies.push({
        row: rowNum,
        type: 'WARNING',
        description: warnings.join('. '),
        data: `Note: ${rawNote}, Amount: ${amount}, Payer: ${rawPayer}`
      });
    }
  }

  return { rows, anomalies };
};
