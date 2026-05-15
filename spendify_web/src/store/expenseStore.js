import { v4 as uuidv4 } from 'uuid';

const KEYS = {
  EXPENSES: 'spendify_expenses',
  GROUPS: 'spendify_groups',
  BUDGETS: 'spendify_budgets',
  LENDS: 'spendify_lends',
  PROFILE: 'spendify_profile',
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
  };
  list.unshift(entry);
  save(KEYS.EXPENSES, list);
  return entry;
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
    members: group.members || [], // { name, phone, balance }
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
  }
};

// ─── Lends ─────────────────────────────────────────────────────────
export const getLends = () => load(KEYS.LENDS);

export const addLend = (lend) => {
  const list = getLends();
  const entry = {
    id: uuidv4(),
    ...lend,
    date: new Date().toISOString(),
    paid: false,
  };
  list.unshift(entry);
  save(KEYS.LENDS, list);
  return entry;
};

// ─── Profile ───────────────────────────────────────────────────────
export const getProfile = () => load(KEYS.PROFILE, { name: 'User' });

export const saveProfile = (profile) => save(KEYS.PROFILE, profile);
