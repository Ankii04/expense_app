import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from './db';

// ─── Unique ID (no native crypto needed) ────────────────────────
const uid = () =>
  Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);

let migrationPromise = null;

export const runMigrationIfNeeded = () => {
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    try {
      const migrated = await AsyncStorage.getItem('@spendify_sqlite_migrated');
      if (migrated === 'true') return;

      console.log('Running SQLite migration from AsyncStorage...');

      // 1. Personal expenses
      const expensesRaw = await AsyncStorage.getItem('@antigravity_expenses');
      if (expensesRaw) {
        const expenses = JSON.parse(expensesRaw);
        if (Array.isArray(expenses)) {
          for (const e of expenses) {
            db.runSync(
              `INSERT OR IGNORE INTO personal_expenses (id, amount, category, payeeName, note, contactName, contactPhone, upiApp, date)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
              [e.id, Number(e.amount) || 0, e.category || 'other', e.payeeName || '', e.note || '', e.contactName || '', e.contactPhone || '', e.upiApp || '', e.date || new Date().toISOString()]
            );
          }
        }
      }

      // 2. Budgets
      const budgetsRaw = await AsyncStorage.getItem('@antigravity_budgets');
      if (budgetsRaw) {
        const budgets = JSON.parse(budgetsRaw);
        if (budgets && typeof budgets === 'object') {
          Object.entries(budgets).forEach(([catId, amt]) => {
            db.runSync(
              'INSERT OR REPLACE INTO budgets (category_id, amount) VALUES (?, ?);',
              [catId, Number(amt) || 0]
            );
          });
        }
      }

      // 3. Splits
      const splitsRaw = await AsyncStorage.getItem('@antigravity_splits');
      if (splitsRaw) {
        const splits = JSON.parse(splitsRaw);
        if (Array.isArray(splits)) {
          for (const s of splits) {
            db.runSync(
              'INSERT OR IGNORE INTO splits (id, title, totalAmount, splitType, date) VALUES (?, ?, ?, ?, ?);',
              [s.id, s.title || 'Untitled', Number(s.totalAmount) || 0, s.splitType || 'equal', s.date || new Date().toISOString()]
            );
            const members = s.members || [];
            for (const m of members) {
              db.runSync(
                'INSERT INTO split_members (split_id, name, phone, share, paidAmount) VALUES (?, ?, ?, ?, ?);',
                [s.id, m.name, m.phone, Number(m.share) || 0, Number(m.paidAmount) || 0]
              );
            }
          }
        }
      }

      // 4. Groups
      const groupsRaw = await AsyncStorage.getItem('@antigravity_groups');
      if (groupsRaw) {
        const groups = JSON.parse(groupsRaw);
        if (Array.isArray(groups)) {
          for (const g of groups) {
            db.runSync(
              'INSERT OR IGNORE INTO groups (id, name, date) VALUES (?, ?, ?);',
              [g.id, g.name || 'New Group', g.date || new Date().toISOString()]
            );
            const members = g.members || [];
            for (const m of members) {
              const joinedAt = m.joined_at || g.date || new Date().toISOString();
              const leftAt = m.left_at || null;
              db.runSync(
                `INSERT OR IGNORE INTO group_members (group_id, phone, name, balance, totalSpent, joined_at, left_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?);`,
                [g.id, m.phone, m.name, Number(m.balance) || 0, Number(m.totalSpent) || 0, joinedAt, leftAt]
              );
            }
            const expenses = g.expenses || [];
            for (const e of expenses) {
              const isSettlement = e.is_settlement ? 1 : 0;
              const splitType = e.split_type || 'equal';
              db.runSync(
                `INSERT OR IGNORE INTO group_expenses (id, group_id, title, amount, payerPhone, date, split_type, is_settlement)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
                [e.id, g.id, e.title, Number(e.amount) || 0, e.payerPhone, e.date || new Date().toISOString(), splitType, isSettlement]
              );

              if (e.shares) {
                Object.entries(e.shares).forEach(([phone, share]) => {
                  db.runSync(
                    'INSERT OR IGNORE INTO group_expense_splits (expense_id, member_phone, share) VALUES (?, ?, ?);',
                    [e.id, phone, Number(share) || 0]
                  );
                });
              } else if (e.splitMembers) {
                const count = e.splitMembers.length;
                const share = count > 0 ? (Number(e.amount) || 0) / count : 0;
                e.splitMembers.forEach(phone => {
                  db.runSync(
                    'INSERT OR IGNORE INTO group_expense_splits (expense_id, member_phone, share) VALUES (?, ?, ?);',
                    [e.id, phone, share]
                  );
                });
              }
            }
          }
        }
      }

      // 5. Recurring
      const recurringRaw = await AsyncStorage.getItem('@antigravity_recurring');
      if (recurringRaw) {
        const recurring = JSON.parse(recurringRaw);
        if (Array.isArray(recurring)) {
          for (const r of recurring) {
            db.runSync(
              `INSERT OR IGNORE INTO recurring (id, name, upiId, amount, frequency, nextDue, category, enabled, date)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
              [r.id, r.name, r.upiId || '', Number(r.amount) || 0, r.frequency || 'monthly', r.nextDue || new Date().toISOString(), r.category || 'other', r.enabled ? 1 : 0, r.date || new Date().toISOString()]
            );
          }
        }
      }

      // 6. Lends
      const lendsRaw = await AsyncStorage.getItem('@spendify_lends');
      if (lendsRaw) {
        const lends = JSON.parse(lendsRaw);
        if (Array.isArray(lends)) {
          for (const l of lends) {
            db.runSync(
              `INSERT OR IGNORE INTO lends (id, contactName, contactPhone, type, amount, note, paid, date)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
              [l.id, l.contactName, l.contactPhone || '', l.type || 'lend', Number(l.amount) || 0, l.note || '', l.paid ? 1 : 0, l.date || new Date().toISOString()]
            );
          }
        }
      }

      // 7. Profile
      const profileRaw = await AsyncStorage.getItem('@spendify_profile');
      if (profileRaw) {
        const profile = JSON.parse(profileRaw);
        if (profile && profile.name) {
          db.runSync(
            'UPDATE users SET name = ?, photo = ? WHERE phone = ?;',
            [profile.name, profile.photo || null, 'self']
          );
        }
      }

      await AsyncStorage.setItem('@spendify_sqlite_migrated', 'true');
      console.log('SQLite migration completed successfully.');
    } catch (err) {
      console.warn('Migration error:', err);
    }
  })();

  return migrationPromise;
};

// ─────────────────────────────────────────────────────────────────
//  EXPENSES
// ─────────────────────────────────────────────────────────────────
export const getExpenses = async () => {
  await runMigrationIfNeeded();
  const rows = db.getAllSync('SELECT * FROM personal_expenses ORDER BY date DESC;');
  return rows;
};

export const addExpense = async (expense) => {
  await runMigrationIfNeeded();
  const entry = {
    id: uid(),
    amount: Number(expense.amount) || 0,
    category: expense.category || 'other',
    payeeName: expense.payeeName || '',
    note: expense.note || '',
    contactName: expense.contactName || '',
    contactPhone: expense.contactPhone || '',
    upiApp: expense.upiApp || '',
    date: expense.date || new Date().toISOString(),
  };
  db.runSync(
    `INSERT INTO personal_expenses (id, amount, category, payeeName, note, contactName, contactPhone, upiApp, date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [entry.id, entry.amount, entry.category, entry.payeeName, entry.note, entry.contactName, entry.contactPhone, entry.upiApp, entry.date]
  );
  return entry;
};

export const deleteExpense = async (id) => {
  await runMigrationIfNeeded();
  db.runSync('DELETE FROM personal_expenses WHERE id = ?;', [id]);
};

export const updateExpense = async (id, updates) => {
  await runMigrationIfNeeded();
  const keys = Object.keys(updates);
  if (keys.length === 0) return;
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const params = keys.map(k => updates[k]);
  params.push(id);
  db.runSync(`UPDATE personal_expenses SET ${sets} WHERE id = ?;`, params);
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
//  BUDGETS
// ─────────────────────────────────────────────────────────────────
export const getBudgets = async () => {
  await runMigrationIfNeeded();
  const rows = db.getAllSync('SELECT * FROM budgets;');
  const map = {};
  rows.forEach(r => {
    map[r.category_id] = r.amount;
  });
  return map;
};

export const setBudget = async (categoryId, amount) => {
  await runMigrationIfNeeded();
  db.runSync(
    'INSERT OR REPLACE INTO budgets (category_id, amount) VALUES (?, ?);',
    [categoryId, Number(amount) || 0]
  );
};

export const deleteBudget = async (categoryId) => {
  await runMigrationIfNeeded();
  db.runSync('DELETE FROM budgets WHERE category_id = ?;', [categoryId]);
};

// ─────────────────────────────────────────────────────────────────
//  SPLITS
// ─────────────────────────────────────────────────────────────────
export const getSplits = async () => {
  await runMigrationIfNeeded();
  const splits = db.getAllSync('SELECT * FROM splits ORDER BY date DESC;');
  const result = [];
  for (const s of splits) {
    const members = db.getAllSync('SELECT name, phone, share, paidAmount FROM split_members WHERE split_id = ?;', [s.id]);
    const formattedMembers = members.map(m => ({
      ...m,
      paid: m.paidAmount >= m.share
    }));
    result.push({
      id: s.id,
      title: s.title,
      totalAmount: s.totalAmount,
      splitType: s.splitType,
      date: s.date,
      members: formattedMembers
    });
  }
  return result;
};

export const addSplit = async (split) => {
  await runMigrationIfNeeded();
  const entry = {
    id: uid(),
    title: split.title || 'Untitled',
    totalAmount: Number(split.totalAmount) || 0,
    splitType: split.splitType || 'equal',
    date: new Date().toISOString(),
  };
  db.runSync(
    'INSERT INTO splits (id, title, totalAmount, splitType, date) VALUES (?, ?, ?, ?, ?);',
    [entry.id, entry.title, entry.totalAmount, entry.splitType, entry.date]
  );
  const members = split.members || [];
  for (const m of members) {
    db.runSync(
      'INSERT INTO split_members (split_id, name, phone, share, paidAmount) VALUES (?, ?, ?, ?, ?);',
      [entry.id, m.name, m.phone, Number(m.share) || 0, Number(m.paidAmount) || 0]
    );
  }
  return entry;
};

export const updateSplit = async (id, updates) => {
  await runMigrationIfNeeded();
  if (updates.members) {
    db.runSync('DELETE FROM split_members WHERE split_id = ?;', [id]);
    for (const m of updates.members) {
      db.runSync(
        'INSERT INTO split_members (split_id, name, phone, share, paidAmount) VALUES (?, ?, ?, ?, ?);',
        [id, m.name, m.phone, Number(m.share) || 0, Number(m.paidAmount) || 0]
      );
    }
  }
  const keys = Object.keys(updates).filter(k => k !== 'members');
  if (keys.length === 0) return;
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const params = keys.map(k => updates[k]);
  params.push(id);
  db.runSync(`UPDATE splits SET ${sets} WHERE id = ?;`, params);
};

export const deleteSplit = async (id) => {
  await runMigrationIfNeeded();
  db.runSync('DELETE FROM splits WHERE id = ?;', [id]);
};

// ─────────────────────────────────────────────────────────────────
//  GROUPS
// ─────────────────────────────────────────────────────────────────
export const getGroups = async () => {
  await runMigrationIfNeeded();
  const groups = db.getAllSync('SELECT * FROM groups ORDER BY date DESC;');
  const result = [];
  for (const g of groups) {
    const members = db.getAllSync('SELECT phone, name, balance, totalSpent, joined_at, left_at FROM group_members WHERE group_id = ?;', [g.id]);
    const expensesRaw = db.getAllSync('SELECT * FROM group_expenses WHERE group_id = ? ORDER BY date ASC;', [g.id]);
    const expenses = [];
    for (const e of expensesRaw) {
      const splits = db.getAllSync('SELECT member_phone, share FROM group_expense_splits WHERE expense_id = ?;', [e.id]);
      const shares = {};
      const splitMembers = [];
      splits.forEach(s => {
        shares[s.member_phone] = s.share;
        splitMembers.push(s.member_phone);
      });
      expenses.push({
        id: e.id,
        title: e.title,
        amount: e.amount,
        payerPhone: e.payerPhone,
        date: e.date,
        split_type: e.split_type,
        is_settlement: e.is_settlement,
        shares: Object.keys(shares).length > 0 ? shares : null,
        splitMembers: splitMembers.length > 0 ? splitMembers : null
      });
    }
    result.push({
      id: g.id,
      name: g.name,
      date: g.date,
      members,
      expenses
    });
  }
  return result;
};

export const addGroup = async (group) => {
  await runMigrationIfNeeded();
  const entry = {
    id: uid(),
    name: group.name || 'New Group',
    date: new Date().toISOString(),
  };
  db.runSync('INSERT INTO groups (id, name, date) VALUES (?, ?, ?);', [entry.id, entry.name, entry.date]);
  const members = group.members || [];
  for (const m of members) {
    const joinedAt = m.joined_at || entry.date;
    const leftAt = m.left_at || null;
    db.runSync(
      'INSERT INTO group_members (group_id, phone, name, balance, totalSpent, joined_at, left_at) VALUES (?, ?, ?, ?, ?, ?, ?);',
      [entry.id, m.phone, m.name, Number(m.balance) || 0, Number(m.totalSpent) || 0, joinedAt, leftAt]
    );
  }
  return {
    ...entry,
    members: members.map(m => ({
      ...m,
      joined_at: m.joined_at || entry.date,
      left_at: m.left_at || null
    })),
    expenses: []
  };
};

export const updateGroup = async (id, updates) => {
  await runMigrationIfNeeded();
  
  if (updates.name !== undefined) {
    db.runSync('UPDATE groups SET name = ? WHERE id = ?;', [updates.name, id]);
  }

  if (updates.members !== undefined) {
    const existingMembers = db.getAllSync('SELECT phone FROM group_members WHERE group_id = ?;', [id]).map(m => m.phone);
    const updatedPhones = updates.members.map(m => m.phone);

    const toDelete = existingMembers.filter(p => !updatedPhones.includes(p));
    for (const phone of toDelete) {
      db.runSync('DELETE FROM group_members WHERE group_id = ? AND phone = ?;', [id, phone]);
    }

    for (const m of updates.members) {
      if (existingMembers.includes(m.phone)) {
        db.runSync(
          `UPDATE group_members 
           SET name = ?, balance = ?, totalSpent = ?, joined_at = ?, left_at = ?
           WHERE group_id = ? AND phone = ?;`,
          [m.name, Number(m.balance) || 0, Number(m.totalSpent) || 0, m.joined_at || new Date().toISOString(), m.left_at || null, id, m.phone]
        );
      } else {
        db.runSync(
          `INSERT INTO group_members (group_id, phone, name, balance, totalSpent, joined_at, left_at)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [id, m.phone, m.name, Number(m.balance) || 0, Number(m.totalSpent) || 0, m.joined_at || new Date().toISOString(), m.left_at || null]
        );
      }
    }
  }

  if (updates.expenses !== undefined) {
    const existingExpenses = db.getAllSync('SELECT id FROM group_expenses WHERE group_id = ?;', [id]).map(e => e.id);
    const updatedExpIds = updates.expenses.map(e => e.id);

    const toDelete = existingExpenses.filter(eid => !updatedExpIds.includes(eid));
    for (const eid of toDelete) {
      db.runSync('DELETE FROM group_expenses WHERE id = ?;', [eid]);
    }

    for (const e of updates.expenses) {
      const isSettlement = e.is_settlement ? 1 : 0;
      const splitType = e.split_type || 'equal';
      if (existingExpenses.includes(e.id)) {
        db.runSync(
          `UPDATE group_expenses 
           SET title = ?, amount = ?, payerPhone = ?, date = ?, split_type = ?, is_settlement = ?
           WHERE id = ?;`,
          [e.title, Number(e.amount) || 0, e.payerPhone, e.date || new Date().toISOString(), splitType, isSettlement, e.id]
        );
      } else {
        db.runSync(
          `INSERT INTO group_expenses (id, group_id, title, amount, payerPhone, date, split_type, is_settlement)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [e.id, id, e.title, Number(e.amount) || 0, e.payerPhone, e.date || new Date().toISOString(), splitType, isSettlement]
        );
      }

      db.runSync('DELETE FROM group_expense_splits WHERE expense_id = ?;', [e.id]);
      if (e.shares) {
        Object.entries(e.shares).forEach(([phone, share]) => {
          db.runSync(
            'INSERT INTO group_expense_splits (expense_id, member_phone, share) VALUES (?, ?, ?);',
            [e.id, phone, Number(share) || 0]
          );
        });
      } else if (e.splitMembers) {
        const count = e.splitMembers.length;
        const share = count > 0 ? (Number(e.amount) || 0) / count : 0;
        e.splitMembers.forEach(phone => {
          db.runSync(
            'INSERT INTO group_expense_splits (expense_id, member_phone, share) VALUES (?, ?, ?);',
            [e.id, phone, share]
          );
        });
      }
    }
  }
};

export const deleteGroup = async (id) => {
  await runMigrationIfNeeded();
  db.runSync('DELETE FROM groups WHERE id = ?;', [id]);
};

// ─────────────────────────────────────────────────────────────────
//  RECURRING
// ─────────────────────────────────────────────────────────────────
export const getRecurring = async () => {
  await runMigrationIfNeeded();
  const rows = db.getAllSync('SELECT * FROM recurring ORDER BY date DESC;');
  return rows.map(r => ({
    ...r,
    enabled: r.enabled === 1
  }));
};

export const addRecurring = async (item) => {
  await runMigrationIfNeeded();
  const entry = {
    id: uid(),
    name: item.name || '',
    upiId: item.upiId || '',
    amount: Number(item.amount) || 0,
    frequency: item.frequency || 'monthly',
    nextDue: item.nextDue || new Date().toISOString(),
    category: item.category || 'other',
    enabled: true,
    date: new Date().toISOString(),
  };
  db.runSync(
    `INSERT INTO recurring (id, name, upiId, amount, frequency, nextDue, category, enabled, date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [entry.id, entry.name, entry.upiId, entry.amount, entry.frequency, entry.nextDue, entry.category, 1, entry.date]
  );
  return entry;
};

export const updateRecurring = async (id, updates) => {
  await runMigrationIfNeeded();
  if (updates.enabled !== undefined) {
    updates.enabled = updates.enabled ? 1 : 0;
  }
  const keys = Object.keys(updates);
  if (keys.length === 0) return;
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const params = keys.map(k => updates[k]);
  params.push(id);
  db.runSync(`UPDATE recurring SET ${sets} WHERE id = ?;`, params);
};

export const deleteRecurring = async (id) => {
  await runMigrationIfNeeded();
  db.runSync('DELETE FROM recurring WHERE id = ?;', [id]);
};

// ─────────────────────────────────────────────────────────────────
//  LENDS
// ─────────────────────────────────────────────────────────────────
export const getLends = async () => {
  await runMigrationIfNeeded();
  const rows = db.getAllSync('SELECT * FROM lends ORDER BY date DESC;');
  return rows.map(r => ({
    ...r,
    paid: r.paid === 1
  }));
};

export const addLend = async (lend) => {
  await runMigrationIfNeeded();
  const entry = {
    id: uid(),
    contactName: lend.contactName || '',
    contactPhone: lend.contactPhone || '',
    type: lend.type || 'lend',
    amount: Number(lend.amount) || 0,
    note: lend.note || '',
    paid: false,
    date: lend.date || new Date().toISOString(),
  };
  db.runSync(
    `INSERT INTO lends (id, contactName, contactPhone, type, amount, note, paid, date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [entry.id, entry.contactName, entry.contactPhone, entry.type, entry.amount, entry.note, 0, entry.date]
  );
  return entry;
};

export const updateLend = async (id, updates) => {
  await runMigrationIfNeeded();
  if (updates.paid !== undefined) {
    updates.paid = updates.paid ? 1 : 0;
  }
  const keys = Object.keys(updates);
  if (keys.length === 0) return;
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const params = keys.map(k => updates[k]);
  params.push(id);
  db.runSync(`UPDATE lends SET ${sets} WHERE id = ?;`, params);
};

export const deleteLend = async (id) => {
  await runMigrationIfNeeded();
  db.runSync('DELETE FROM lends WHERE id = ?;', [id]);
};

// ─────────────────────────────────────────────────────────────────
//  PROFILE
// ─────────────────────────────────────────────────────────────────
export const getProfile = async () => {
  await runMigrationIfNeeded();
  const user = db.getFirstSync('SELECT name, photo FROM users WHERE is_logged_in = 1 LIMIT 1;');
  return user || { name: 'User' };
};

export const setProfile = async (profile) => {
  await runMigrationIfNeeded();
  const active = db.getFirstSync('SELECT id FROM users WHERE is_logged_in = 1 LIMIT 1;');
  if (active) {
    db.runSync('UPDATE users SET name = ?, photo = ? WHERE id = ?;', [profile.name, profile.photo || null, active.id]);
  } else {
    db.runSync('INSERT INTO users (name, phone, photo, is_logged_in) VALUES (?, ?, ?, ?);', [profile.name, 'self', profile.photo || null, 1]);
  }
};

// ─────────────────────────────────────────────────────────────────
//  AUTHENTICATION HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────
export const checkLoginStatus = async () => {
  await runMigrationIfNeeded();
  const user = db.getFirstSync('SELECT * FROM users WHERE is_logged_in = 1 LIMIT 1;');
  // Ignore the default "self" guest user if it doesn't represent a real auth login
  // Actually, we can treat any active logged_in row as authenticated
  return user && user.phone !== 'self' ? user : null;
};

export const loginUser = async (phone, password) => {
  await runMigrationIfNeeded();
  const user = db.getFirstSync('SELECT * FROM users WHERE phone = ? LIMIT 1;', [phone]);
  if (!user) {
    throw new Error('User not found');
  }
  if (user.password_hash !== password) {
    throw new Error('Incorrect password');
  }
  // Logout others and login this user
  db.runSync('UPDATE users SET is_logged_in = 0;');
  db.runSync('UPDATE users SET is_logged_in = 1 WHERE phone = ?;', [phone]);
  return user;
};

export const registerUser = async (name, phone, password) => {
  await runMigrationIfNeeded();
  const existing = db.getFirstSync('SELECT * FROM users WHERE phone = ? LIMIT 1;', [phone]);
  if (existing) {
    throw new Error('Phone number already registered');
  }
  db.runSync(
    'INSERT INTO users (name, phone, password_hash, is_logged_in) VALUES (?, ?, ?, ?);',
    [name, phone, password, 0]
  );
  // Log them in
  db.runSync('UPDATE users SET is_logged_in = 0;');
  db.runSync('UPDATE users SET is_logged_in = 1 WHERE phone = ?;', [phone]);
  const user = db.getFirstSync('SELECT * FROM users WHERE phone = ? LIMIT 1;', [phone]);
  return user;
};

export const logoutUser = async () => {
  await runMigrationIfNeeded();
  db.runSync('UPDATE users SET is_logged_in = 0;');
  // Seed self guest back as logged in so local profile helpers don't crash
  db.runSync('UPDATE users SET is_logged_in = 1 WHERE phone = ?;', ['self']);
};

// ─── Clear all ───────────────────────────────────────────────────
export const clearAll = async () => {
  await runMigrationIfNeeded();
  db.runSync('DELETE FROM personal_expenses;');
  db.runSync('DELETE FROM budgets;');
  db.runSync('DELETE FROM splits;');
  db.runSync('DELETE FROM split_members;');
  db.runSync('DELETE FROM groups;');
  db.runSync('DELETE FROM group_members;');
  db.runSync('DELETE FROM group_expenses;');
  db.runSync('DELETE FROM group_expense_splits;');
  db.runSync('DELETE FROM recurring;');
  db.runSync('DELETE FROM lends;');
  db.runSync('DELETE FROM users WHERE phone != ?;', ['self']);
  db.runSync('UPDATE users SET is_logged_in = 1 WHERE phone = ?;', ['self']);
};

