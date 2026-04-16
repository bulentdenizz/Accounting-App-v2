# Regression Test Matrix

## Critical Financial Flows

1. Sale create -> update -> delete keeps `entities.balance` consistent.
2. Purchase create -> update -> delete keeps `entities.balance` consistent.
3. Payment in allocation closes customer sale documents (`open` -> `partial` -> `closed`).
4. Payment out allocation closes supplier purchase documents.
5. Return flows:
   - `sale_return` increases stock and decreases customer balance.
   - `purchase_return` decreases stock and decreases supplier balance.

## Stock Safety

1. Sale with insufficient stock fails in backend.
2. Purchase return with insufficient stock fails in backend.
3. Successful sale/purchase updates `items.stock_quantity` correctly.

## Data Safety

1. Entity with transaction history cannot be hard-deleted (soft-delete only).
2. Item referenced by transaction lines cannot be deleted.
3. Backup endpoint creates a physical DB copy.

## UI Smoke Checks

1. Quick action buttons open Transactions modal with preselected type.
2. Due list page renders open/partial documents by due date.
3. Statement modal opens from Customer and Supplier lists.
4. Login requires username + password.
