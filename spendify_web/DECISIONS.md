# Architectural Decisions: Spendify Fullstack Migration

This document records the architectural choices and rationales implemented during the Spendify migration.

## 1. Relational Database vs. NoSQL
**Decision**: Utilized PostgreSQL.
**Rationale**: 
- Shared expense systems require high relational integrity.
- Splitting expenses creates strong foreign key constraints between `expenses`, `users`, and `expense_splits`.
- Offloading mathematical integrity to databases (e.g. cascading deletes on group removal) reduces bugs and maintains consistency.

## 2. Server-Side Debt Simplification & Balance Calculation
**Decision**: Relocated balance compilation and debt simplification (min-cash-flow solver) from client-side JS to Express service layers.
**Rationale**:
- Eliminates the need to download the entire list of group expenses and splits to calculate who owes whom in the frontend.
- Decreases page-load network footprint.
- Secures business logic from client side tamper checks.
- Returns pre-calculated totals and simplified transaction arrays directly through `/api/balances/:groupId` and `/api/groups`.

## 3. Active Membership Bounds (SAM Rule)
**Decision**: Enforced membership timelines in the query engine rather than during import/creation.
**Rationale**:
- Expenses can be back-dated. Filtering member obligations dynamically based on `joined_at` and `left_at` limits when computing balances ensures that splits remain correct even if member dates or past expenses are edited later.
- If a member is added to a group with a retrofitted join date, the query dynamically recalculates correct splits.

## 4. Anomaly Isolation in Import Logs
**Decision**: Segregated CSV parsing into two flows:
1. Auto-insertion of valid rows (`OK` and standard warnings).
2. Quarantine of duplicate anomalies (`DUPLICATE_ENTRY`) in a `csv_anomalies` table.
**Rationale**:
- Prevents CSV uploads from silently double-counting or duplicating past entries.
- Retains files in progress without locking the user from partial imports.
- Gives the user a visual dashboard to individually approve or reject quarantined duplicate rows.

## 5. Session and Auth State
**Decision**: JWT Tokens with a standard Axios request/response interceptor redirecting on 401s.
**Rationale**:
- Clean stateless backend integration.
- Avoids session state tracking on server restart.
