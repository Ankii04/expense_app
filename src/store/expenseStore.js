import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  EXPENSES: '@antigravity_expenses',
  BUDGETS: '@antigravity_budgets',
  SPLITS: '@antigravity_splits',
  GROUPS: '@antigravity_groups',
  RECURRING: '@antigravity_recurring',
};

// ─── Generic helpers ────────────────────────────────────────────
const load = async (key) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const save = async (key, data) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Storage save error:', e);
  }
};

// ─── Unique ID (no native crypto needed) ────────────────────────
const uid = () =>
  Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);

// ─────────────────────────────────────────────────────────────────
//  EXPENSES
// ─────────────────────────────────────────────────────────────────
export const getExpenses = () => load(KEYS.EXPENSES);

export const addExpense = async (expense) => {
  const list = await getExpenses();
  const entry = {
    id: uid(),
    amount: Number(expense.amount) || 0,
    category: expense.category || 'other',
    upiId: expense.upiId || '',
    payeeName: expense.payeeName || '',
    note: expense.note || '',
    contactName: expense.contactName || '',
    contactPhone: expense.contactPhone || '',
    upiApp: expense.upiApp || '',
    date: expense.date || new Date().toISOString(),
  };
  list.unshift(entry);
  await save(KEYS.EXPENSES, list);
  return entry;
};

export const deleteExpense = async (id) => {
  let list = await getExpenses();
  list = list.filter((e) => e.id !== id);
  await save(KEYS.EXPENSES, list);
};

export const getExpensesByMonth = async (monthKey) => {
  const list = await getExpenses();
  return list.filter((e) => {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return key === monthKey;
  });
};

export const getExpensesByCategory = async (monthKey) => {
  const expenses = await getExpensesByMonth(monthKey);
  const map = {};
  expenses.forEach((e) => {
    if (!map[e.category]) map[e.category] = 0;
    map[e.category] += e.amount;
  });
  return map;
};

export const getMonthTotal = async (monthKey) => {
  const expenses = await getExpensesByMonth(monthKey);
  return expenses.reduce((sum, e) => sum + e.amount, 0);
};

// ─────────────────────────────────────────────────────────────────
//  BUDGETS  –  { categoryId: amount }
// ─────────────────────────────────────────────────────────────────
export const getBudgets = async () => {
  try {
    const raw = await AsyncStorage.getItem(KEYS.BUDGETS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const setBudget = async (categoryId, amount) => {
  const budgets = await getBudgets();
  budgets[categoryId] = Number(amount) || 0;
  await AsyncStorage.setItem(KEYS.BUDGETS, JSON.stringify(budgets));
};

export const deleteBudget = async (categoryId) => {
  const budgets = await getBudgets();
  delete budgets[categoryId];
  await AsyncStorage.setItem(KEYS.BUDGETS, JSON.stringify(budgets));
};

// ─────────────────────────────────────────────────────────────────
//  SPLITS
// ─────────────────────────────────────────────────────────────────
export const getSplits = () => load(KEYS.SPLITS);

export const addSplit = async (split) => {
  const list = await getSplits();
  const entry = {
    id: uid(),
    title: split.title || 'Untitled',
    totalAmount: Number(split.totalAmount) || 0,
    splitType: split.splitType || 'equal', // 'equal' | 'custom'
    members: split.members || [],
    // each member: { name, phone, share, paid: boolean }
    date: new Date().toISOString(),
  };
  list.unshift(entry);
  await save(KEYS.SPLITS, list);
  return entry;
};

export const updateSplit = async (id, updates) => {
  const list = await getSplits();
  const idx = list.findIndex((s) => s.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates };
    await save(KEYS.SPLITS, list);
  }
};

export const deleteSplit = async (id) => {
  let list = await getSplits();
  list = list.filter((s) => s.id !== id);
  await save(KEYS.SPLITS, list);
};

// ─────────────────────────────────────────────────────────────────
//  GROUPS
// ─────────────────────────────────────────────────────────────────
export const getGroups = () => load(KEYS.GROUPS);

export const addGroup = async (group) => {
  const list = await getGroups();
  const entry = {
    id: uid(),
    name: group.name || 'New Group',
    members: group.members || [], // { name, phone, balance }
    expenses: [], // { title, amount, payerPhone, date }
    date: new Date().toISOString(),
  };
  list.unshift(entry);
  await save(KEYS.GROUPS, list);
  return entry;
};

export const updateGroup = async (id, updates) => {
  const list = await getGroups();
  const idx = list.findIndex((g) => g.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates };
    await save(KEYS.GROUPS, list);
  }
};

export const deleteGroup = async (id) => {
  let list = await getGroups();
  list = list.filter((g) => g.id !== id);
  await save(KEYS.GROUPS, list);
};

// ─────────────────────────────────────────────────────────────────
//  RECURRING
// ─────────────────────────────────────────────────────────────────
export const getRecurring = () => load(KEYS.RECURRING);

export const addRecurring = async (item) => {
  const list = await getRecurring();
  const entry = {
    id: uid(),
    name: item.name || '',
    upiId: item.upiId || '',
    amount: Number(item.amount) || 0,
    frequency: item.frequency || 'monthly', // daily | weekly | monthly
    nextDue: item.nextDue || new Date().toISOString(),
    category: item.category || 'other',
    enabled: true,
    date: new Date().toISOString(),
  };
  list.unshift(entry);
  await save(KEYS.RECURRING, list);
  return entry;
};

export const updateRecurring = async (id, updates) => {
  const list = await getRecurring();
  const idx = list.findIndex((r) => r.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates };
    await save(KEYS.RECURRING, list);
  }
};

export const deleteRecurring = async (id) => {
  let list = await getRecurring();
  list = list.filter((r) => r.id !== id);
  await save(KEYS.RECURRING, list);
};

// ─── Clear all (for dev) ────────────────────────────────────────
export const clearAll = async () => {
  await AsyncStorage.multiRemove(Object.values(KEYS));
};
