# Project Scope: Spendify Web Migration

This document outlines the scope, rules, and functional boundaries of the Spendify web application migration from a frontend-only local storage app to a fullstack web application.

## 1. Functional Requirements

### Core Features
- **Authentication**: JWT-based user login and registration with token verification. Secure route protection on the React frontend.
- **Group Management**: Users can create groups, edit details, and add/remove members with custom joining and leaving dates.
- **Expense tracking & Splitting**: Supports standard personal expenses and group expenses. Group expenses support split types: Equal, Custom Amount, Percentage, and Shares.
- **Budgeting**: Category-level monthly budgets persisted to the database.
- **Lend & Borrow**: Tracker for loans and borrowings with automated ledger calculations.
- **Recurring Expenses**: Setup, scheduling, and tracking of recurring expense schedules.

### Special Constraints & Business Rules
1. **SAM Rule (Split Active Membership)**:
   Group members only owe splits for expenses incurred during their active membership window (`joined_at` <= `expense_date` <= `left_at`).
2. **Currency Conversion Rule**:
   Supports entries in USD ($) and INR (₹). USD entries are automatically converted to INR on the backend using a configured multiplier (defaulting to 83.0), storing both original values and converted values in the database.
3. **Duplicate Detection Rule**:
   CSV-imported rows with duplicate date, description, and amount are flagged. They are not auto-imported, and require manual user confirmation to resolve.
4. **CSV Settlement Import Rule**:
   CSV records that indicate settlements (using keywords like 'paid', 'settled', 'transfer', etc.) are flagged with warnings during import, keeping settlements distinct from standard consumption expenses.
5. **Placeholder Members Rule**:
   When importing members or creating groups, if a member does not correspond to an existing registered user, a placeholder user row is provisioned with a random email domain `<name>_<uuid>@spendify.local` to satisfy database integrity constraints.

## 2. Technical Scope & Deployment
- **Frontend**: Single Page Application built using React (Vite). Packaged with single-page routing configuration in `/frontend/vercel.json` for seamless Vercel deployment.
- **Backend**: REST API built with Node.js, Express, and PostgreSQL. Service configuration defined in `/backend/render.yaml` for Render blueprint orchestration.
