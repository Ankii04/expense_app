import { v4 as uuidv4 } from 'uuid';

const KEYS = {
  EXPENSES: 'spendify_expenses',
  GROUPS: 'spendify_groups',
  BUDGETS: 'spendify_budgets',
  LENDS: 'spendify_lends',
  PROFILE: 'spendify_profile',
  USERS: 'spendify_users',
  CURRENT_USER: 'spendify_current_user',
  RECURRING: 'spendify_recurring',
};

const load = (key, fallback = []) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
};

const save = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// ─── Auth ──────────────────────────────────────────────────────────
export const getUsers = () => load(KEYS.USERS, []);

export const getCurrentUser = () => load(KEYS.CURRENT_USER, null);

export const registerUser = ({ name, email, password }) => {
  const users = getUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('An account with this email already exists.');
  }
  const user = { id: uuidv4(), name, email, password, createdAt: new Date().toISOString() };
  users.push(user);
  save(KEYS.USERS, users);
  save(KEYS.CURRENT_USER, user);
  return user;
};

export const loginUser = ({ email, password }) => {
  const users = getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!user) throw new Error('Invalid email or password.');
  save(KEYS.CURRENT_USER, user);
  return user;
};

export const logoutUser = () => {
  localStorage.removeItem(KEYS.CURRENT_USER);
};

// ─── Expenses ──────────────────────────────────────────────────────
export const getExpenses = () => load(KEYS.EXPENSES);

export const addExpense = (expense) => {
  const list = getExpenses();
  const entry = {
    id: uuidv4(),
    amount: Number(expense.amount),
    note: expense.note || '',
    category: expense.category || 'other',
    date: expense.date || new Date().toISOString(),
    upiId: expense.upiId || '',
    payeeName: expense.payeeName || '',
    contactPhone: expense.contactPhone || '',
    isRecurring: expense.isRecurring || false,
    recurringId: expense.recurringId || null,
  };
  list.unshift(entry);
  save(KEYS.EXPENSES, list);
  return entry;
};

export const updateExpense = (id, updates) => {
  const list = getExpenses();
  const idx = list.findIndex(e => e.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates };
    save(KEYS.EXPENSES, list);
    return list[idx];
  }
};

export const deleteExpense = (id) => {
  const list = getExpenses().filter(e => e.id !== id);
  save(KEYS.EXPENSES, list);
};

// ─── Budgets ───────────────────────────────────────────────────────
export const getBudgets = () => load(KEYS.BUDGETS, {});

export const setBudget = (catId, amount) => {
  const budgets = getBudgets();
  budgets[catId] = Number(amount) || 0;
  save(KEYS.BUDGETS, budgets);
};

// ─── Groups ────────────────────────────────────────────────────────
export const getGroups = () => load(KEYS.GROUPS);

export const addGroup = (group) => {
  const list = getGroups();
  const entry = {
    id: uuidv4(),
    name: group.name,
    description: group.description || '',
    members: (group.members || []).map(m => ({
      id: m.id || uuidv4(),
      name: m.name,
      phone: m.phone || '',
      joined_at: m.joined_at || new Date().toISOString(),
      left_at: m.left_at || null,
      balance: 0,
    })),
    expenses: [],
    createdAt: new Date().toISOString(),
  };
  list.unshift(entry);
  save(KEYS.GROUPS, list);
  return entry;
};

export const updateGroup = (id, updates) => {
  const list = getGroups();
  const idx = list.findIndex(g => g.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates };
    save(KEYS.GROUPS, list);
    return list[idx];
  }
};

export const deleteGroup = (id) => {
  const list = getGroups().filter(g => g.id !== id);
  save(KEYS.GROUPS, list);
};

// ─── Group Expenses ────────────────────────────────────────────────
export const addGroupExpense = (groupId, expense) => {
  const groups = getGroups();
  const idx = groups.findIndex(g => g.id === groupId);
  if (idx === -1) return;
  const entry = {
    id: uuidv4(),
    description: expense.description || '',
    amount: Number(expense.amount),
    paidBy: expense.paidBy, // member id
    splitType: expense.splitType || 'equal', // 'equal' | 'exact' | 'percentage' | 'shares'
    splits: expense.splits || {}, // { memberId: value }
    date: expense.date || new Date().toISOString(),
    category: expense.category || 'other',
    is_settlement: expense.is_settlement || false,
  };
  groups[idx].expenses = [...(groups[idx].expenses || []), entry];
  save(KEYS.GROUPS, groups);
  return entry;
};

export const updateGroupExpense = (groupId, expenseId, updates) => {
  const groups = getGroups();
  const gIdx = groups.findIndex(g => g.id === groupId);
  if (gIdx === -1) return;
  const eIdx = groups[gIdx].expenses.findIndex(e => e.id === expenseId);
  if (eIdx === -1) return;
  groups[gIdx].expenses[eIdx] = { ...groups[gIdx].expenses[eIdx], ...updates };
  save(KEYS.GROUPS, groups);
};

export const deleteGroupExpense = (groupId, expenseId) => {
  const groups = getGroups();
  const idx = groups.findIndex(g => g.id === groupId);
  if (idx === -1) return;
  groups[idx].expenses = groups[idx].expenses.filter(e => e.id !== expenseId);
  save(KEYS.GROUPS, groups);
};

// ─── Balance Calculation ───────────────────────────────────────────
const isMemberActive = (member, expenseDate) => {
  const d = new Date(expenseDate).getTime();
  const joinedAt = member.joined_at ? new Date(member.joined_at).getTime() : 0;
  const leftAt = member.left_at ? new Date(member.left_at).getTime() : Infinity;
  return d >= joinedAt && d <= leftAt;
};

export const recalculateBalances = (group) => {
  if (!group) return {};
  const balances = {};
  group.members.forEach(m => { balances[m.id] = 0; });

  for (const expense of (group.expenses || [])) {
    const activeMembers = group.members.filter(m => isMemberActive(m, expense.date));
    if (activeMembers.length === 0) continue;
    const payer = expense.paidBy;
    const total = expense.amount;

    if (expense.is_settlement) {
      // Splits represent who benefited (borrower pays back to payer)
      const [borrowerId, settleAmt] = Object.entries(expense.splits || {})[0] || [];
      if (borrowerId && balances[payer] !== undefined) {
        balances[payer] = (balances[payer] || 0) + Number(settleAmt);
        balances[borrowerId] = (balances[borrowerId] || 0) - Number(settleAmt);
      }
      continue;
    }

    // Calculate each active member's share
    let shares = {};
    if (expense.splitType === 'equal') {
      const per = total / activeMembers.length;
      activeMembers.forEach(m => { shares[m.id] = per; });
    } else if (expense.splitType === 'exact') {
      for (const [mId, val] of Object.entries(expense.splits || {})) {
        shares[mId] = Number(val) || 0;
      }
    } else if (expense.splitType === 'percentage') {
      for (const [mId, pct] of Object.entries(expense.splits || {})) {
        shares[mId] = (Number(pct) / 100) * total;
      }
    } else if (expense.splitType === 'shares') {
      const totalShares = Object.values(expense.splits || {}).reduce((s, v) => s + Number(v), 0);
      for (const [mId, sh] of Object.entries(expense.splits || {})) {
        shares[mId] = totalShares > 0 ? (Number(sh) / totalShares) * total : 0;
      }
    }

    // Update balances: payer gets +, others get -
    for (const [mId, amt] of Object.entries(shares)) {
      if (balances[mId] === undefined) continue;
      if (mId === payer) continue; // payer doesn't owe themselves
      balances[payer] = (balances[payer] || 0) + amt;
      balances[mId] = (balances[mId] || 0) - amt;
    }
  }
  return balances;
};

// ─── Lends ─────────────────────────────────────────────────────────
export const getLends = () => load(KEYS.LENDS);

export const addLend = (lend) => {
  const list = getLends();
  const entry = {
    id: uuidv4(),
    ...lend,
    date: lend.date || new Date().toISOString(),
    paid: false,
  };
  list.unshift(entry);
  save(KEYS.LENDS, list);
  return entry;
};

export const updateLend = (id, updates) => {
  const list = getLends();
  const idx = list.findIndex(l => l.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates };
    save(KEYS.LENDS, list);
  }
};

export const deleteLend = (id) => {
  const list = getLends().filter(l => l.id !== id);
  save(KEYS.LENDS, list);
};

// ─── Recurring Expenses ────────────────────────────────────────────
export const getRecurring = () => load(KEYS.RECURRING);

export const addRecurring = (item) => {
  const list = getRecurring();
  const entry = {
    id: uuidv4(),
    ...item,
    nextDate: item.nextDate || new Date().toISOString(),
    active: true,
  };
  list.unshift(entry);
  save(KEYS.RECURRING, list);
  return entry;
};

export const updateRecurring = (id, updates) => {
  const list = getRecurring();
  const idx = list.findIndex(r => r.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates };
    save(KEYS.RECURRING, list);
  }
};

export const deleteRecurring = (id) => {
  const list = getRecurring().filter(r => r.id !== id);
  save(KEYS.RECURRING, list);
};

// ─── Profile ───────────────────────────────────────────────────────
export const getProfile = () => load(KEYS.PROFILE, { name: 'User' });

export const saveProfile = (profile) => save(KEYS.PROFILE, profile);
