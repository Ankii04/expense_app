/**
 * Debt Simplifier - Min-Cash-Flow Algorithm
 * Given a balances map { memberId: netBalance }, returns a minimal
 * list of transactions: [{ from, to, amount }]
 */
export function simplifyDebts(balances) {
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
      transactions.push({ from: debt.id, to: credit.id, amount: Math.round(amount * 100) / 100 });
    }

    credit.bal -= amount;
    debt.bal   += amount;

    if (Math.abs(credit.bal) < 0.01) ci++;
    if (Math.abs(debt.bal)   < 0.01) di++;
  }

  return transactions;
}
