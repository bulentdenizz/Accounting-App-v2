import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

let db;

export function initDb() {
  if (db) return db;

  // Store the database file in the user data folder
  const dbPath = path.join(app.getPath('userData'), 'accounting_pro.db');
  db = new Database(dbPath);

  // "Entities" (Current Accounts - Customers/Suppliers)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      tax_office TEXT,
      tax_number TEXT,
      phone TEXT,
      balance REAL DEFAULT 0,
      type TEXT CHECK(type IN ('Customer', 'Supplier')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  
  console.log("Database initialized at:", dbPath);
  return db;
}

// Database Operations
export const dbOps = {
  getEntities: () => {
    if (!db) initDb();
    return db.prepare("SELECT * FROM entities ORDER BY title ASC").all();
  },
  createEntity: (data) => {
    if (!db) initDb();
    const info = db.prepare(
      "INSERT INTO entities (title, phone, type) VALUES (?, ?, ?)"
    ).run(data.title, data.phone, data.type);
    return info.lastInsertRowid;
  }
};