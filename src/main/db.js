import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import crypto from 'crypto';

let db;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function initDb() {
  if (db) return db;

  const dbPath = path.join(app.getPath('userData'), 'accounting_app_v5.db'); // v5: Added due_date + transaction_items
  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  // 1. Users (Auth - Team Members) Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      role TEXT CHECK(role IN ('admin', 'staff')) NOT NULL,
      password TEXT
    )
  `).run();

  // 2. Entities (Customers / Suppliers)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      type TEXT CHECK(type IN ('Customer', 'Supplier')) NOT NULL,
      balance REAL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // 3. Items (Stock / Inventory) Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      supplier_id INTEGER,
      unit TEXT,
      unit_price REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      stock_quantity REAL DEFAULT 0,
      FOREIGN KEY (supplier_id) REFERENCES entities(id)
    )
  `).run();

  // 4. Financial Transactions (Ledger)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER,
      transaction_type TEXT CHECK(transaction_type IN ('purchase', 'sale', 'payment_in', 'payment_out', 'sale_return', 'purchase_return')) NOT NULL,
      amount REAL NOT NULL,
      transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      due_date DATETIME,
      description TEXT,
      status TEXT CHECK(status IN ('open', 'partial', 'closed', 'cancelled')) NOT NULL DEFAULT 'open',
      remaining_amount REAL NOT NULL DEFAULT 0,
      user_id INTEGER,
      FOREIGN KEY (entity_id) REFERENCES entities(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `).run();

  // 5. Invoice Line Items (multi-product per transaction)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      item_id INTEGER,
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      tax_rate REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id)
    )
  `).run();

  // 6. Payment allocation: which payment closes which document
  db.prepare(`
    CREATE TABLE IF NOT EXISTS payment_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_transaction_id INTEGER NOT NULL,
      target_transaction_id INTEGER NOT NULL,
      amount REAL NOT NULL CHECK(amount > 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payment_transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (target_transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    )
  `).run();

  // 7. Settings
  db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `).run();

  // Backward-compatible lightweight migrations
  const addColumnIfMissing = (tableName, columnName, ddl) => {
    const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
    if (!cols.some((c) => c.name === columnName)) {
      db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${ddl}`).run();
    }
  };

  addColumnIfMissing('entities', 'is_active', 'is_active INTEGER NOT NULL DEFAULT 1');
  addColumnIfMissing('transactions', 'status', "status TEXT NOT NULL DEFAULT 'open'");
  addColumnIfMissing('transactions', 'remaining_amount', 'remaining_amount REAL NOT NULL DEFAULT 0');

  // Normalize legacy rows after schema upgrades
  db.prepare(`
    UPDATE transactions
    SET status = 'closed', remaining_amount = 0
    WHERE transaction_type IN ('payment_in', 'payment_out', 'sale_return', 'purchase_return')
  `).run();
  db.prepare(`
    UPDATE transactions
    SET remaining_amount = amount
    WHERE transaction_type IN ('sale', 'purchase')
      AND (remaining_amount IS NULL OR remaining_amount <= 0)
  `).run();

  db.prepare('CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_transactions_entity_date ON transactions(entity_id, transaction_date DESC)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON transactions(transaction_type, status)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_transaction_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_payment_allocations_target ON payment_allocations(target_transaction_id)').run();
  
  // Create default admin user
  try {
    const adminCheck = db.prepare("SELECT * FROM users WHERE username = 'Admin'").get();
    if(!adminCheck) {
      const hash = hashPassword('1234');
      db.prepare("INSERT INTO users (username, role, password) VALUES ('Admin', 'admin', ?)").run(hash);
    } else if (adminCheck.password && !String(adminCheck.password).startsWith('scrypt$')) {
      const hash = hashPassword('1234');
      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hash, adminCheck.id);
    }
  } catch(e) {
    console.error("Error inserting default data: ", e);
  }

  console.log("Database initialized at:", dbPath);
  return db;
}

export const getDb = () => db;