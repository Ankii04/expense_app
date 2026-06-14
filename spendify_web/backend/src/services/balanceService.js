const db = require('../db');

/**
 * Min-Cash-Flow Debt Simplification Algorithm
 * Given a balances map { [userId]: netBalance }, returns a minimal list of transactions:
 * [{ from: userId, to: userId, amount: number }]
 */
function simplifyDebts(balances) {
  const entries = Object.entries(balances).map(([id, bal]) => ({ id, bal }));
  const creditors = entries.filter(e => e.bal > 0.01).sort((a, b) => b.bal - a.bal);
  const debtors   = entries.filter(e => e.bal < -0.01).sort((a, b) => a.bal - b.bal);

  const transactions = [];
  let ci = 0, di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const credit  = creditors[ci];
    const debt    = debtors[di];
    const amount  = Math.min(credit.bal, -debt.bal);

    if (amount > 0.01) {
      transactions.push({
        from: debt.id,
        to: credit.id,
        amount: Math.round(amount * 100) / 100
      });
    }

    credit.bal -= amount;
    debt.bal   += amount;

    if (Math.abs(credit.bal) < 0.01) ci++;
    if (Math.abs(debt.bal)   < 0.01) di++;
  }

  return transactions;
}

/**
 * Calculates net balances and simplified debts for a group.
 * @param {string} groupId - UUID of the group
 * @returns {Object} { balances: { [userId]: number }, simplifiedDebts: Array }
 */
async function calculateBalances(groupId) {
  // 1. Fetch group members with membership timelines
  const membersRes = await db.query(
    `SELECT u.id, u.name, gm.joined_at, gm.left_at 
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1`,
    [groupId]
  );
  const members = membersRes.rows;

  if (members.length === 0) {
    return { balances: {}, simplifiedDebts: [] };
  }

  // Initialize balances map
  const balances = {};
  members.forEach(m => {
    balances[m.id] = 0.0;
  });

  // Helper to check if a member is active on a given date
  const isMemberActive = (member, dateStr) => {
    const d = new Date(dateStr).getTime();
    const joinedAt = new Date(member.joined_at).getTime();
    const leftAt = member.left_at ? new Date(member.left_at).getTime() : Infinity;
    return d >= joinedAt && d <= leftAt;
  };

  // 2. Fetch all expenses (excluding settlements which are calculated separately)
  const expensesRes = await db.query(
    `SELECT id, amount_in_inr, paid_by, expense_date, split_type, is_settlement
     FROM expenses 
     WHERE group_id = $1 AND is_settlement = FALSE`,
    [groupId]
  );
  const expenses = expensesRes.rows;

  // 3. Fetch all splits for those expenses
  const splitsRes = await db.query(
    `SELECT es.expense_id, es.user_id, es.amount_owed, es.share_value, es.percentage
     FROM expense_splits es
     JOIN expenses e ON e.id = es.expense_id
     WHERE e.group_id = $1`,
    [groupId]
  );
  const splits = splitsRes.rows;

  // Group splits by expense_id for quick O(1) lookup
  const splitsByExpense = {};
  splits.forEach(s => {
    if (!splitsByExpense[s.expense_id]) {
      splitsByExpense[s.expense_id] = {};
    }
    splitsByExpense[s.expense_id][s.user_id] = s;
  });

  // Calculate shares based on SAM Rule: only active members owe
  for (const exp of expenses) {
    const activeMembers = members.filter(m => isMemberActive(m, exp.expense_date));
    if (activeMembers.length === 0) continue;

    const payer = exp.paid_by;
    const total = parseFloat(exp.amount_in_inr);
    const expSplits = splitsByExpense[exp.id] || {};

    let calculatedShares = {};

    if (exp.split_type === 'equal') {
      const perPerson = total / activeMembers.length;
      activeMembers.forEach(m => {
        calculatedShares[m.id] = perPerson;
      });
    } else if (exp.split_type === 'percentage') {
      // Find total percentage sum of active members to re-normalize
      let activePctSum = 0;
      activeMembers.forEach(m => {
        const splitVal = expSplits[m.id];
        activePctSum += splitVal ? parseFloat(splitVal.percentage) || 0 : 0;
      });

      activeMembers.forEach(m => {
        const splitVal = expSplits[m.id];
        const pct = splitVal ? parseFloat(splitVal.percentage) || 0 : 0;
        calculatedShares[m.id] = activePctSum > 0 ? (pct / activePctSum) * total : 0;
      });
    } else if (exp.split_type === 'shares') {
      // Find total shares sum of active members to re-normalize
      let activeSharesSum = 0;
      activeMembers.forEach(m => {
        const splitVal = expSplits[m.id];
        activeSharesSum += splitVal ? parseFloat(splitVal.share_value) || 0 : 0;
      });

      activeMembers.forEach(m => {
        const splitVal = expSplits[m.id];
        const sh = splitVal ? parseFloat(splitVal.share_value) || 0 : 0;
        calculatedShares[m.id] = activeSharesSum > 0 ? (sh / activeSharesSum) * total : 0;
      });
    } else if (exp.split_type === 'exact') {
      // For exact split type, we just take the stored exact amount (if member is active)
      activeMembers.forEach(m => {
        const splitVal = expSplits[m.id];
        calculatedShares[m.id] = splitVal ? parseFloat(splitVal.amount_owed) || 0 : 0;
      });
    }

    // Apply calculated shares: Payer gets credited, active members get debited
    if (balances[payer] !== undefined) {
      balances[payer] += total;
    }
    for (const [userId, share] of Object.entries(calculatedShares)) {
      if (balances[userId] !== undefined) {
        balances[userId] -= share;
      }
    }
  }

  // 4. Process all settlements from settlements table
  const settlementsRes = await db.query(
    `SELECT paid_by, paid_to, amount 
     FROM settlements 
     WHERE group_id = $1`,
    [groupId]
  );
  const settlements = settlementsRes.rows;

  settlements.forEach(s => {
    const payer = s.paid_by;
    const payee = s.paid_to;
    const amount = parseFloat(s.amount);

    if (balances[payer] !== undefined) {
      balances[payer] += amount; // Payer gets credit (paid off debt)
    }
    if (balances[payee] !== undefined) {
      balances[payee] -= amount; // Payee gets debited (received cash)
    }
  });

  // 5. Also check for legacy settlement expenses stored in the expenses table (if any)
  const settlementExpensesRes = await db.query(
    `SELECT id, amount_in_inr, paid_by 
     FROM expenses 
     WHERE group_id = $1 AND is_settlement = TRUE`,
    [groupId]
  );
  const settlementExpenses = settlementExpensesRes.rows;

  for (const se of settlementExpenses) {
    const payer = se.paid_by;
    const amount = parseFloat(se.amount_in_inr);
    const expSplits = splitsByExpense[se.id] || {};

    // Get the other party from splits
    const payee = Object.keys(expSplits).find(uId => uId !== payer);
    if (payee) {
      if (balances[payer] !== undefined) {
        balances[payer] += amount;
      }
      if (balances[payee] !== undefined) {
        balances[payee] -= amount;
      }
    }
  }

  // Standardize balances to 2 decimal places
  for (const userId of Object.keys(balances)) {
    balances[userId] = Math.round(balances[userId] * 100) / 100;
  }

  // 6. Simplify Debts
  // Clone balances object because simplifyDebts mutates the balances
  const balancesClone = { ...balances };
  const simplified = simplifyDebts(balancesClone);

  return {
    balances,
    simplifiedDebts: simplified,
  };
}

module.exports = {
  calculateBalances,
  simplifyDebts,
};
