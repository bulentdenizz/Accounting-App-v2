import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

let db;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function initDb() {
  if (db) return db;

  const dbPath = path.join(app.getPath('userData'), 'accounting_app_v5.db');

  // ── Pre-migration Safety Backup ──────────────────────────────────────────
  // Her başlatmada, herhangi bir schema değişikliği uygulanmadan önce otomatik
  // bir yedek dosyası oluşturulur. migrations_bak klasöründe en fazla 5 adet saklanır.
  try {
    if (fs.existsSync(dbPath)) {
      const backupDir = path.join(app.getPath('userData'), 'migrations_bak');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const backupFile = path.join(backupDir, `pre_migration_${Date.now()}.db`);
      fs.copyFileSync(dbPath, backupFile);
      const backups = fs.readdirSync(backupDir)
        .filter((f) => f.startsWith('pre_migration_'))
        .sort()
        .reverse();
      backups.slice(5).forEach((f) => fs.unlinkSync(path.join(backupDir, f)));
    }
  } catch (err) {
    console.warn('Pre-migration backup failed (non-fatal):', err.message);
  }
  // ────────────────────────────────────────────────────────────────────────

  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL'); // Write-Ahead Logging: daha güvenli yazma modu

  // ── 1. Kullanıcılar ──────────────────────────────────────────────────────
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      role     TEXT CHECK(role IN ('admin', 'staff')) NOT NULL,
      password TEXT
    )
  `).run();

  // ── 2. Müşteri / Tedarikçi ───────────────────────────────────────────────
  db.prepare(`
    CREATE TABLE IF NOT EXISTS entities (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL,
      phone      TEXT,
      address    TEXT,
      type       TEXT CHECK(type IN ('Customer', 'Supplier')) NOT NULL,
      balance    REAL DEFAULT 0,
      is_active  INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // ── 3. Stok Ürünleri ─────────────────────────────────────────────────────
  db.prepare(`
    CREATE TABLE IF NOT EXISTS items (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      supplier_id    INTEGER,
      unit           TEXT,
      unit_price     REAL DEFAULT 0,
      tax_rate       REAL DEFAULT 0,
      stock_quantity REAL DEFAULT 0,
      FOREIGN KEY (supplier_id) REFERENCES entities(id)
    )
  `).run();

  // ── 4. Finansal İşlemler (Ana Defter) ────────────────────────────────────
  // Phase 1: is_cancelled, cancelled_at, cancel_reason, invoice_number,
  //          tax_amount, amount_excl_tax alanları eklendi.
  db.prepare(`
    CREATE TABLE IF NOT EXISTS transactions (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id            INTEGER,
      transaction_type     TEXT CHECK(transaction_type IN (
                             'purchase','sale','payment_in','payment_out',
                             'sale_return','purchase_return'
                           )) NOT NULL,
      amount               REAL NOT NULL,
      amount_excl_tax      REAL,
      tax_amount           REAL NOT NULL DEFAULT 0,
      invoice_number       TEXT,
      transaction_date     DATETIME DEFAULT CURRENT_TIMESTAMP,
      due_date             DATETIME,
      description          TEXT,
      status               TEXT CHECK(status IN ('open','partial','closed','cancelled')) NOT NULL DEFAULT 'open',
      remaining_amount     REAL NOT NULL DEFAULT 0,
      user_id              INTEGER,
      is_cancelled         INTEGER NOT NULL DEFAULT 0,
      cancelled_at         DATETIME,
      cancel_reason        TEXT,
      cancelled_by_user_id INTEGER,
      FOREIGN KEY (entity_id) REFERENCES entities(id),
      FOREIGN KEY (user_id)   REFERENCES users(id)
    )
  `).run();

  // ── 5. Fatura Kalemleri ──────────────────────────────────────────────────
  db.prepare(`
    CREATE TABLE IF NOT EXISTS transaction_items (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      item_id        INTEGER,
      item_name      TEXT NOT NULL,
      quantity       REAL NOT NULL DEFAULT 1,
      unit_price     REAL NOT NULL DEFAULT 0,
      tax_rate       REAL NOT NULL DEFAULT 0,
      subtotal       REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id)        REFERENCES items(id)
    )
  `).run();

  // ── 6. Ödeme–Belge Bağlantısı ───────────────────────────────────────────
  db.prepare(`
    CREATE TABLE IF NOT EXISTS payment_allocations (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_transaction_id INTEGER NOT NULL,
      target_transaction_id  INTEGER NOT NULL,
      amount                 REAL NOT NULL CHECK(amount > 0),
      created_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payment_transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (target_transaction_id)  REFERENCES transactions(id) ON DELETE CASCADE
    )
  `).run();

  // ── 7. Sistem Ayarları ───────────────────────────────────────────────────
  db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `).run();

  // ── 8. Fatura Numarası Sıra Tablosu (Phase 1) ───────────────────────────
  db.prepare(`
    CREATE TABLE IF NOT EXISTS invoice_sequences (
      type        TEXT PRIMARY KEY,
      prefix      TEXT NOT NULL,
      last_number INTEGER NOT NULL DEFAULT 0,
      year        INTEGER NOT NULL
    )
  `).run();

  // ── 9. Stok Hareketleri (Phase 2) ─────────────────────────────────────────
  db.prepare(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id   INTEGER,
      item_id          INTEGER NOT NULL,
      movement_type    TEXT NOT NULL 
                       CHECK(movement_type IN (
                         'purchase_in',
                         'sale_out',
                         'return_in',
                         'return_out',
                         'manual_adj',
                         'opening_stock'
                       )),
      quantity_change  REAL NOT NULL,
      balance_after    REAL NOT NULL,
      unit_price       REAL,
      notes            TEXT,
      created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id),
      FOREIGN KEY (item_id) REFERENCES items(id)
    )
  `).run();

  db.prepare('CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(item_id, created_at DESC)').run();

  // ── Geriye Dönük Uyumlu Kolon Eklemeleri (idempotent) ───────────────────
  // Mevcut bir kurulumda eksik olan kolonları ekler; yeniden çalıştırıldığında
  // zaten var olan kolonlara dokunmaz.
  const addColumnIfMissing = (tableName, columnName, ddl) => {
    const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
    if (!cols.some((c) => c.name === columnName)) {
      db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${ddl}`).run();
      console.log(`[DB Migration] Added column: ${tableName}.${columnName}`);
    }
  };

  // Önceki versiyonlardan gelen eksikler
  addColumnIfMissing('entities',     'is_active',            'is_active INTEGER NOT NULL DEFAULT 1');
  addColumnIfMissing('transactions', 'status',               "status TEXT NOT NULL DEFAULT 'open'");
  addColumnIfMissing('transactions', 'remaining_amount',     'remaining_amount REAL NOT NULL DEFAULT 0');
  // Phase 1 — Finansal bütünlük ve denetim izlenebilirliği
  addColumnIfMissing('transactions', 'is_cancelled',         'is_cancelled INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('transactions', 'cancelled_at',         'cancelled_at DATETIME');
  addColumnIfMissing('transactions', 'cancel_reason',        'cancel_reason TEXT');
  addColumnIfMissing('transactions', 'cancelled_by_user_id', 'cancelled_by_user_id INTEGER');
  addColumnIfMissing('transactions', 'invoice_number',       'invoice_number TEXT');
  addColumnIfMissing('transactions', 'tax_amount',           'tax_amount REAL NOT NULL DEFAULT 0');
  addColumnIfMissing('transactions', 'amount_excl_tax',      'amount_excl_tax REAL');
  
  // Phase 5 — Snapshot COGS
  addColumnIfMissing('transaction_items', 'unit_cost_at_sale', 'unit_cost_at_sale REAL');

  // ── Mevcut Veri Normalizasyonu ───────────────────────────────────────────
  db.prepare(`
    UPDATE transactions
    SET status = 'closed', remaining_amount = 0
    WHERE transaction_type IN ('payment_in','payment_out','sale_return','purchase_return')
      AND status != 'cancelled'
  `).run();

  db.prepare(`
    UPDATE transactions
    SET remaining_amount = amount
    WHERE transaction_type IN ('sale','purchase')
      AND (remaining_amount IS NULL OR remaining_amount <= 0)
      AND status NOT IN ('closed','cancelled')
  `).run();

  // ── Fatura Sırası Başlangıç Değerleri ───────────────────────────────────
  const currentYear = new Date().getFullYear();
  db.prepare('INSERT OR IGNORE INTO invoice_sequences VALUES (?,?,0,?)').run('sale',     'SAT', currentYear);
  db.prepare('INSERT OR IGNORE INTO invoice_sequences VALUES (?,?,0,?)').run('purchase', 'ALI', currentYear);

  // Mevcut satış/alış kayıtlarına LEGACY fatura numarası ata (tek seferlik)
  db.prepare(`
    UPDATE transactions
    SET invoice_number =
      CASE transaction_type
        WHEN 'sale'     THEN 'SAT-LEGACY-' || id
        WHEN 'purchase' THEN 'ALI-LEGACY-' || id
        ELSE NULL
      END
    WHERE invoice_number IS NULL
      AND transaction_type IN ('sale','purchase')
  `).run();

  // ── İndeksler ────────────────────────────────────────────────────────────
  db.prepare('CREATE INDEX IF NOT EXISTS idx_entities_type               ON entities(type)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_transactions_entity_date    ON transactions(entity_id, transaction_date DESC)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_transactions_type_status    ON transactions(transaction_type, status)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_transactions_cancelled      ON transactions(is_cancelled)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_transactions_invoice_no     ON transactions(invoice_number)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_payment_alloc_payment       ON payment_allocations(payment_transaction_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_payment_alloc_target        ON payment_allocations(target_transaction_id)').run();

  // ── Varsayılan Admin Kullanıcısı ─────────────────────────────────────────
  try {
    const adminCheck = db.prepare("SELECT * FROM users WHERE username = 'Admin'").get();
    if (!adminCheck) {
      db.prepare("INSERT INTO users (username, role, password) VALUES ('Admin', 'admin', ?)").run(hashPassword('1234'));
    } else if (adminCheck.password && !String(adminCheck.password).startsWith('scrypt$')) {
      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashPassword('1234'), adminCheck.id);
    }
  } catch (e) {
    console.error('Error creating default admin:', e);
  }

  console.log('[DB] Initialized at:', dbPath);
  return db;
}

export const getDb = () => db;