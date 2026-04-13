import { getDb } from './db';
import { ipcMain } from 'electron';

// Frontend (React) sanki bir Web API'ye bağlanıyormuş gibi bu olayları (events) çağıracak.
export function setupHandlers() {
  
  // ==================
  // MÜŞTERİ (ENTITIES) SERVİSLERİ
  // ==================
  ipcMain.handle('api:customers:getAll', async () => {
    try {
      const db = getDb();
      return db.prepare("SELECT * FROM entities ORDER BY title ASC").all();
    } catch (err) {
      console.error("Müşteriler getirilirken hata:", err);
      throw err;
    }
  });

  ipcMain.handle('api:customers:create', async (event, data) => {
    try {
      const db = getDb();
      const stm = db.prepare(
        "INSERT INTO entities (title, phone, type, address) VALUES (?, ?, ?, ?)"
      );
      // Tax fields are removed as requested
      const res = stm.run(
        data.title, 
        data.phone, 
        data.type, 
        data.address || null
      );
      return res.lastInsertRowid;
    } catch (err) {
       console.error("Müşteri oluşturulurken hata:", err);
       throw err;
    }
  });

  ipcMain.handle('api:customers:update', async (event, data) => {
    try {
      const db = getDb();
      const stm = db.prepare(
        "UPDATE entities SET title=?, phone=?, address=? WHERE id=?"
      );
      stm.run(data.title, data.phone, data.address || null, data.id);
      return true;
    } catch (err) {
      console.error("Güncelleme hatası:", err);
      throw err;
    }
  });

  ipcMain.handle('api:customers:delete', async (event, entityId) => {
    try {
      const db = getDb();
      db.prepare("DELETE FROM entities WHERE id=?").run(entityId);
      return true;
    } catch (err) {
      console.error("Silme hatası:", err);
      throw err;
    }
  });


  // ==================
  // ITEMS / STOCK SERVICES
  // ==================
  ipcMain.handle('api:items:getAll', async () => {
    try {
      const db = getDb();
      // Join entities to get the supplier title
      return db.prepare(`
        SELECT items.*, entities.title as supplier_name 
        FROM items 
        LEFT JOIN entities ON items.supplier_id = entities.id 
        ORDER BY items.id DESC
      `).all();
    } catch (err) {
      console.error("Hata:", err);
      throw err;
    }
  });

  ipcMain.handle('api:items:create', async (event, data) => {
    try {
      const db = getDb();
      const stm = db.prepare(
        "INSERT INTO items (name, supplier_id, unit, unit_price, tax_rate, stock_quantity) VALUES (?, ?, ?, ?, ?, ?)"
      );
      const res = stm.run(
        data.name, 
        data.supplier_id || null, 
        data.unit || 'Adet', 
        data.unit_price || 0, 
        data.tax_rate || 0, 
        data.stock_quantity || 0
      );
      return res.lastInsertRowid;
    } catch (err) {
       console.error("Hata:", err);
       throw err;
    }
  });

  ipcMain.handle('api:items:update', async (event, data) => {
    try {
      const db = getDb();
      const stm = db.prepare(
        "UPDATE items SET name=?, supplier_id=?, unit=?, unit_price=?, tax_rate=?, stock_quantity=? WHERE id=?"
      );
      stm.run(data.name, data.supplier_id || null, data.unit, data.unit_price, data.tax_rate, data.stock_quantity, data.id);
      return true;
    } catch (err) {
      console.error("Hata:", err);
      throw err;
    }
  });

  ipcMain.handle('api:items:delete', async (event, id) => {
    try {
      const db = getDb();
      db.prepare("DELETE FROM items WHERE id=?").run(id);
      return true;
    } catch (err) {
      console.error("Hata:", err);
      throw err;
    }
  });

  // ==================
  // TRANSACTIONS / LEDGER SERVICES
  // ==================
  ipcMain.handle('api:transactions:getAll', async () => {
    try {
      const db = getDb();
      return db.prepare(`
        SELECT t.*, e.title as entity_name, u.username as user_name
        FROM transactions t
        LEFT JOIN entities e ON t.entity_id = e.id
        LEFT JOIN users u ON t.user_id = u.id
        ORDER BY t.transaction_date DESC
      `).all();
    } catch (err) {
      console.error("Error fetching transactions:", err);
      throw err;
    }
  });

  ipcMain.handle('api:transactions:create', async (event, data) => {
    const db = getDb();
    const transaction = db.transaction((txData) => {
      // 1. Insert the record
      const insertTx = db.prepare(`
        INSERT INTO transactions (entity_id, transaction_type, amount, description, user_id)
        VALUES (?, ?, ?, ?, ?)
      `);
      insertTx.run(
        txData.entity_id,
        txData.transaction_type,
        txData.amount,
        txData.description || null,
        txData.user_id || null
      );

      // 2. Logic for Stock and Balances
      if (txData.transaction_type === 'sale') {
        // Sale: Stock Down, Customer Balance Up
        if (txData.item_id && txData.quantity) {
          db.prepare("UPDATE items SET stock_quantity = stock_quantity - ? WHERE id = ?")
            .run(txData.quantity, txData.item_id);
        }
        db.prepare("UPDATE entities SET balance = balance + ? WHERE id = ?")
          .run(txData.amount, txData.entity_id);

      } else if (txData.transaction_type === 'purchase') {
        // Purchase: Stock Up, Supplier Balance Up
        if (txData.item_id && txData.quantity) {
          db.prepare("UPDATE items SET stock_quantity = stock_quantity + ? WHERE id = ?")
            .run(txData.quantity, txData.item_id);
        }
        db.prepare("UPDATE entities SET balance = balance + ? WHERE id = ?")
          .run(txData.amount, txData.entity_id);

      } else if (txData.transaction_type === 'payment_in') {
        // Payment from Customer: Balance Down
        db.prepare("UPDATE entities SET balance = balance - ? WHERE id = ?")
          .run(txData.amount, txData.entity_id);

      } else if (txData.transaction_type === 'payment_out') {
        // Payment to Supplier: Balance Down
        db.prepare("UPDATE entities SET balance = balance - ? WHERE id = ?")
          .run(txData.amount, txData.entity_id);
      }
    });

    try {
      transaction(data);
      return { success: true };
    } catch (err) {
      console.error("Atomic transaction failed:", err);
      throw err;
    }
  });


  // ==================
  // AUTH SERVICES
  // ==================
  ipcMain.handle('api:auth:login', async (event, { username }) => {
    try {
      const db = getDb();
      // Real app should securely check password hashes
      const user = db.prepare("SELECT id, username, role FROM users WHERE username = ? COLLATE NOCASE").get(username);
      
      return user || null;
    } catch (err) {
       console.error("Login verification failed:", err);
       throw err;
    }
  });
}
