/**
 * CSV Parser for Spendify Web
 * Handles: date normalization, USD→INR conversion, duplicate detection,
 * negative/zero value warnings, unrecognized categories.
 *
 * Fixed: never throws — all errors are collected as row-level error strings.
 */

const USD_TO_INR = 83;
const KNOWN_CATEGORIES = ['food', 'transport', 'shopping', 'bills', 'entertainment', 'health', 'other'];

/* ── Date parser ── */
function parseDate(str) {
  if (!str || typeof str !== 'string') return null;
  str = str.trim();
  if (!str) return null;

  let m;

  // DD/MM/YYYY  or  D/M/YYYY
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T00:00:00`);
    if (!isNaN(d)) return d;
  }

  // DD-MM-YYYY  (day first, dash separator)
  m = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    // ambiguous — try day-first then month-first
    const d1 = new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T00:00:00`);
    if (!isNaN(d1)) return d1;
    const d2 = new Date(`${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}T00:00:00`);
    if (!isNaN(d2)) return d2;
  }

  // YYYY-MM-DD
  m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T00:00:00`);
    if (!isNaN(d)) return d;
  }

  // DD/MM/YY  (2-digit year)
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m) {
    const year = parseInt(m[3]) < 50 ? 2000 + parseInt(m[3]) : 1900 + parseInt(m[3]);
    const d = new Date(`${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T00:00:00`);
    if (!isNaN(d)) return d;
  }

  // Fallback: JS native parse (handles "June 15, 2026", ISO strings, etc.)
  const fallback = new Date(str);
  return isNaN(fallback) ? null : fallback;
}

/* ── Amount parser ── */
function normalizeAmount(raw) {
  if (raw === null || raw === undefined || raw === '') return { amount: 0, currency: 'INR', originalUSD: null };
  const str = String(raw).trim();
  const isUSD = str.startsWith('$') || /usd/i.test(str);
  const cleaned = str.replace(/[₹$,\s]/g, '').replace(/[^0-9.\-]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return { amount: NaN, currency: 'INR', originalUSD: null };
  const amount = isUSD ? Math.round(num * USD_TO_INR * 100) / 100 : num;
  return { amount, currency: isUSD ? 'USD→INR' : 'INR', originalUSD: isUSD ? num : null };
}

/* ── Robust CSV tokenizer (handles quoted fields containing commas) ── */
function tokenizeLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Handle escaped quotes ""
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/* ── Parse raw CSV text into array of row objects ── */
function parseCSV(text) {
  // Normalize line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = tokenizeLine(lines[0]).map(h =>
    h.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
  );

  return lines.slice(1).map(line => {
    const vals = tokenizeLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').replace(/^"|"$/g, '').trim(); });
    return row;
  });
}

/* ── Main export ── */
export function parseAndValidateCSV(csvText, existingExpenses = [], groupMembers = []) {
  if (!csvText || typeof csvText !== 'string') return [];

  let rows;
  try {
    rows = parseCSV(csvText);
  } catch (err) {
    throw new Error('Could not read CSV structure: ' + err.message);
  }

  if (rows.length === 0) return [];

  const results = [];
  const seenKeys = new Set();
  const existingKeys = new Set(
    existingExpenses.map(e =>
      `${(e.note || '').toLowerCase()}-${e.amount}-${(e.date || '').slice(0, 10)}`
    )
  );

  for (const row of rows) {
    const warnings = [];
    const errors = [];

    /* ── Date ── */
    const rawDate = (
      row['date'] || row['transaction date'] || row['created at'] ||
      row['txn date'] || row['value date'] || ''
    );
    let parsedDate = null;
    try {
      parsedDate = parseDate(rawDate);
    } catch (_) { /* ignore */ }
    if (!parsedDate) {
      errors.push(`Unrecognized date: "${rawDate}". Expected DD/MM/YYYY, YYYY-MM-DD, etc.`);
    }

    /* ── Amount ── */
    const rawAmount = row['amount'] || row['price'] || row['cost'] || row['debit'] || '';
    let amount = 0, currency = 'INR', originalUSD = null;
    try {
      ({ amount, currency, originalUSD } = normalizeAmount(rawAmount));
    } catch (_) { /* ignore */ }

    if (isNaN(amount)) {
      errors.push(`Could not parse amount: "${rawAmount}"`);
      amount = 0;
    }
    if (amount < 0) {
      warnings.push(`Negative amount — importing as positive (₹${Math.abs(amount)})`);
    }
    if (amount === 0) {
      warnings.push('Zero amount — this row may be a placeholder or header');
    }
    if (currency === 'USD→INR') {
      warnings.push(`Converted $${originalUSD} USD → ₹${Math.abs(amount)} INR (rate: ×83)`);
    }

    /* ── Note ── */
    const note = (
      row['note'] || row['description'] || row['narration'] ||
      row['name'] || row['merchant'] || row['remarks'] || ''
    );

    /* ── Category ── */
    const rawCat  = ((row['category'] || row['type'] || '')).toLowerCase().trim();
    const category = KNOWN_CATEGORIES.includes(rawCat) ? rawCat : 'other';
    if (rawCat && !KNOWN_CATEGORIES.includes(rawCat)) {
      warnings.push(`Unknown category "${row['category'] || rawCat}" → mapped to "other"`);
    }

    /* ── Duplicate detection ── */
    const dateStr = parsedDate ? parsedDate.toISOString().slice(0, 10) : 'unknown';
    const key     = `${note.toLowerCase()}-${Math.abs(amount)}-${dateStr}`;
    if (existingKeys.has(key)) {
      errors.push('Duplicate: this expense already exists in your records');
    }
    if (seenKeys.has(key)) {
      warnings.push('Duplicate row within this CSV file');
    }
    seenKeys.add(key);

    /* ── Group member date check ── */
    if (groupMembers.length > 0 && parsedDate) {
      const paidByName = row['paid by'] || row['payer'] || '';
      const member = groupMembers.find(
        m => m.name.toLowerCase() === paidByName.toLowerCase()
      );
      if (paidByName && !member) {
        warnings.push(`Payer "${paidByName}" not found in group members`);
      }
      if (member) {
        const expTs  = parsedDate.getTime();
        const joinTs = member.joined_at ? new Date(member.joined_at).getTime() : 0;
        const leftTs = member.left_at   ? new Date(member.left_at).getTime()   : Infinity;
        if (expTs < joinTs) warnings.push(`Date is before ${member.name}'s join date`);
        if (expTs > leftTs) warnings.push(`Date is after ${member.name}'s leave date`);
      }
    }

    results.push({
      id:       `csv-${Math.random().toString(36).slice(2)}`,
      note:     note || 'Unnamed',
      amount:   Math.abs(amount),
      category,
      date:     parsedDate ? parsedDate.toISOString() : new Date().toISOString(),
      warnings,
      errors,
      raw:      row,
    });
  }

  return results;
}
