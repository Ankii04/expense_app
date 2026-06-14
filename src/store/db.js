import * as SQLite from 'expo-sqlite';

const dbName = 'spendify_relational.db';
let db;

try {
  db = SQLite.openDatabaseSync(dbName);
} catch (error) {
  console.error('Failed to open database Sync:', error);
}

export const initDb = () => {
  if (!db) return;
  
  // Enable foreign keys
  db.execSync('PRAGMA foreign_keys = ON;');

  // 1. Users table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      photo TEXT,
      password_hash TEXT,
      is_logged_in INTEGER DEFAULT 0
    );
  `);

  // 2. Groups table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL
    );
  `);

  // 3. Group members table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      name TEXT NOT NULL,
      balance REAL DEFAULT 0,
      totalSpent REAL DEFAULT 0,
      joined_at TEXT NOT NULL,
      left_at TEXT DEFAULT NULL,
      FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
    );
  `);

  // 4. Group expenses table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS group_expenses (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      payerPhone TEXT NOT NULL,
      date TEXT NOT NULL,
      split_type TEXT DEFAULT 'equal',
      is_settlement INTEGER DEFAULT 0,
      FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
    );
  `);

  // 5. Group expense splits table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS group_expense_splits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id TEXT NOT NULL,
      member_phone TEXT NOT NULL,
      share REAL NOT NULL,
      FOREIGN KEY(expense_id) REFERENCES group_expenses(id) ON DELETE CASCADE
    );
  `);

  // 6. Personal expenses table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS personal_expenses (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      payeeName TEXT,
      note TEXT,
      contactName TEXT,
      contactPhone TEXT,
      upiApp TEXT,
      date TEXT NOT NULL
    );
  `);

  // 7. Budgets table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS budgets (
      category_id TEXT PRIMARY KEY,
      amount REAL NOT NULL
    );
  `);

  // 8. Splits table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS splits (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      totalAmount REAL NOT NULL,
      splitType TEXT NOT NULL,
      date TEXT NOT NULL
    );
  `);

  // 9. Split members table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS split_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      split_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      share REAL NOT NULL,
      paidAmount REAL DEFAULT 0,
      FOREIGN KEY(split_id) REFERENCES splits(id) ON DELETE CASCADE
    );
  `);

  // 10. Lends table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS lends (
      id TEXT PRIMARY KEY,
      contactName TEXT NOT NULL,
      contactPhone TEXT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      note TEXT,
      paid INTEGER DEFAULT 0,
      date TEXT NOT NULL
    );
  `);

  // 11. Recurring table
  db.execSync(`
    CREATE TABLE IF NOT EXISTS recurring (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      upiId TEXT,
      amount REAL NOT NULL,
      frequency TEXT NOT NULL,
      nextDue TEXT NOT NULL,
      category TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      date TEXT NOT NULL
    );
  `);

  // Seed default guest user if no users exist
  const userCount = db.getFirstSync('SELECT COUNT(*) as count FROM users;');
  if (userCount.count === 0) {
    db.runSync(
      'INSERT INTO users (name, phone, password_hash, is_logged_in) VALUES (?, ?, ?, ?);',
      ['User', 'self', '', 1]
    );
  }
};

// Execute init db on load
initDb();

export { db };
