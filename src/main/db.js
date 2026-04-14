import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

let db;

export function initDb() {
  if (db) return db;

  const dbPath = path.join(app.getPath('userData'), 'accounting_app_v5.db'); // v5: Added due_date + transaction_items
  db = new Database(dbPath);

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
      transaction_type TEXT CHECK(transaction_type IN ('purchase', 'sale', 'payment_in', 'payment_out')) NOT NULL,
      amount REAL NOT NULL,
      transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      due_date DATETIME,
      description TEXT,
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
  
  // Create default admin user
  try {
    const adminCheck = db.prepare("SELECT * FROM users WHERE username = 'Admin'").get();
    if(!adminCheck) {
       db.prepare("INSERT INTO users (username, role, password) VALUES ('Admin', 'admin', '123')").run();
    }
  } catch(e) {
    console.error("Error inserting default data: ", e);
  }

  console.log("Database initialized at:", dbPath);
  return db;
}

export const getDb = () => db;