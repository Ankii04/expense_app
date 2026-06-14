/**
   Greedy Debt Simplification (min-flow solver)
   Takes an array of members: [{ phone, name, balance }]
   Returns an array of simplified transfers: [{ fromName, toName, amount }]
*/
export const simplifyDebts = (members) => {
  if (!members || members.length === 0) return [];

  // Clone and filter out members with negligible balance (within 0.01 margin)
  const balances = members
    .map(m => ({
      name: m.name,
      balance: Number(m.balance) || 0
    }))
    .filter(m => Math.abs(m.balance) > 0.01);

  const debtors = balances.filter(b => b.balance < 0).sort((a, b) => a.balance - b.balance); // most negative first
  const creditors = balances.filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance); // most positive first

  const transfers = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const oweAmount = Math.abs(debtor.balance);
    const creditAmount = creditor.balance;

    const settledAmount = Math.min(oweAmount, creditAmount);

    transfers.push({
      fromName: debtor.name,
      toName: creditor.name,
      amount: settledAmount
    });

    debtor.balance += settledAmount;
    creditor.balance -= settledAmount;

    if (Math.abs(debtor.balance) < 0.01) {
      dIdx++;
    }
    if (Math.abs(creditor.balance) < 0.01) {
      cIdx++;
    }
  }

  return transfers;
};
