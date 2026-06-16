-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. GROUPS
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. GROUP MEMBERS
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
    left_at DATE,
    CONSTRAINT unique_group_user UNIQUE(group_id, user_id),
    CONSTRAINT chk_joined_left CHECK (left_at IS NULL OR joined_at <= left_at)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);

-- 4. EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE, -- Nullable for personal expenses
    description VARCHAR(255) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    amount_in_inr DECIMAL(10, 2) NOT NULL,
    paid_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    split_type VARCHAR(20) NOT NULL CHECK (split_type IN ('equal', 'exact', 'percentage', 'shares')),
    is_settlement BOOLEAN DEFAULT FALSE,
    imported_from_csv BOOLEAN DEFAULT FALSE,
    category VARCHAR(50) DEFAULT 'other',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- 5. EXPENSE SPLITS
CREATE TABLE IF NOT EXISTS expense_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_owed DECIMAL(10, 2) NOT NULL,
    share_value DECIMAL(10, 4), -- Nullable, used if split_type = 'shares'
    percentage DECIMAL(5, 2),   -- Nullable, used if split_type = 'percentage'
    CONSTRAINT unique_expense_user UNIQUE(expense_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_user_id ON expense_splits(user_id);

-- 6. SETTLEMENTS
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    paid_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    paid_to UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    settlement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_settlement_users CHECK (paid_by <> paid_to)
);

CREATE INDEX IF NOT EXISTS idx_settlements_group_id ON settlements(group_id);
CREATE INDEX IF NOT EXISTS idx_settlements_payer ON settlements(paid_by);
CREATE INDEX IF NOT EXISTS idx_settlements_payee ON settlements(paid_to);

-- 7. CSV IMPORT LOGS
CREATE TABLE IF NOT EXISTS csv_import_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    imported_by UUID REFERENCES users(id) ON DELETE SET NULL,
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    total_rows INT NOT NULL DEFAULT 0,
    successful_rows INT NOT NULL DEFAULT 0,
    anomaly_count INT NOT NULL DEFAULT 0,
    import_report JSONB
);

CREATE INDEX IF NOT EXISTS idx_csv_import_group ON csv_import_logs(group_id);

-- 8. CSV ANOMALIES
CREATE TABLE IF NOT EXISTS csv_anomalies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_id UUID NOT NULL REFERENCES csv_import_logs(id) ON DELETE CASCADE,
    row_number INT NOT NULL,
    issue_type VARCHAR(50) NOT NULL,
    raw_data JSONB NOT NULL,
    action_taken VARCHAR(255),
    requires_approval BOOLEAN DEFAULT FALSE,
    approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_csv_anomalies_import ON csv_anomalies(import_id);

-- 9. BUDGETS (For LocalStorage Migration of budgets)
CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    CONSTRAINT unique_user_category UNIQUE(user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);

-- 10. LENDS (For LocalStorage P2P Lends Migration)
CREATE TABLE IF NOT EXISTS lends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('lend', 'borrow')),
    contact_name VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    amount DECIMAL(10, 2) NOT NULL,
    note TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    paid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lends_user ON lends(user_id);

-- 11. RECURRING EXPENSES (For LocalStorage Recurring Migration)
CREATE TABLE IF NOT EXISTS recurring_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    note VARCHAR(255),
    category VARCHAR(50),
    frequency VARCHAR(50) NOT NULL DEFAULT 'monthly',
    next_date DATE NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_expenses(user_id);
