# AI Usage & Collaboration: Spendify Fullstack App

This document outlines the workflow and contributions of the AI developer (Antigravity) in the Spendify fullstack migration.

## 1. Automated Generation & Layout Restructuring
- **Repository Restructuring**: Repackaged the standalone React workspace into `/frontend` and `/backend` packages, initializing separate configuration scripts.
- **SQL Schema Generation**: Drafted `/backend/src/db/schema.sql` defining 11 normalized tables with indexes, foreign keys, and temporal constraints.
- **Router Boilerplate**: Created Express routers mapping user logins, budgets, debt settlements, and lending logs.

## 2. Technical Integration and Logic Auditing
- **Debt Simplification**: Ported the min-cash-flow simplified debt solver to a server-side Javascript module.
- **SAM Rule Audit**: Integrated temporal membership checks (`joined_at` and `left_at`) directly into PostgreSQL balance accumulation routines.
- **Interceptors & API layers**: Replaced client-side memory adapters with Axios wrappers, configuring JWT authorization bearer headers.

## 3. UI Refactoring & Bug Mitigation
- **Split Type Parsing**: Solved floating point type-coercion bugs where inputs were treated as string primitives by applying explicit numerical casts (`Number(val)`).
- **Camera Scanner Lifecycle**: Wrapped unmount streams with active checks to turn off camera lights on transition and prevent camera capture locks.
- **Dynamic CSV Import Screen**: Connected CSV uploads directly to the backend processing reports, enabling visual approval checks for duplicate rows.
