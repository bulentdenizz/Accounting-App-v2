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

  // Get line items for a specific transaction
  ipcMain.handle('api:transactions:getItems', async (event, transactionId) => {
    try {
      const db = getDb();
      return db.prepare(`
        SELECT ti.*, i.unit
        FROM transaction_items ti
        LEFT JOIN items i ON ti.item_id = i.id
        WHERE ti.transaction_id = ?
        ORDER BY ti.id ASC
      `).all(transactionId);
    } catch (err) {
      console.error("Error fetching transaction items:", err);
      throw err;
    }
  });

  ipcMain.handle('api:transactions:create', async (event, data) => {
    const db = getDb();

    // data.items = [ { item_id, item_name, quantity, unit_price, tax_rate, subtotal }, ... ]
    // data.due_date = ISO date string or null
    // data.transaction_type = 'sale' | 'purchase' | 'payment_in' | 'payment_out'
    // data.amount = total amount (sum of subtotals)
    // data.entity_id, data.description, data.user_id

    const transaction = db.transaction((txData) => {
      // 1. Insert the main transaction record
      const insertTx = db.prepare(`
        INSERT INTO transactions (entity_id, transaction_type, amount, due_date, description, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const txResult = insertTx.run(
        txData.entity_id,
        txData.transaction_type,
        txData.amount,
        txData.due_date || null,
        txData.description || null,
        txData.user_id || null
      );
      const newTxId = txResult.lastInsertRowid;

      // 2. Insert line items (if any) and update stock
      const insertItem = db.prepare(`
        INSERT INTO transaction_items (transaction_id, item_id, item_name, quantity, unit_price, tax_rate, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      if (txData.items && txData.items.length > 0) {
        for (const lineItem of txData.items) {
          insertItem.run(
            newTxId,
            lineItem.item_id || null,
            lineItem.item_name,
            lineItem.quantity,
            lineItem.unit_price,
            lineItem.tax_rate || 0,
            lineItem.subtotal
          );

          // Update stock for each item if it references a stock item
          if (lineItem.item_id) {
            if (txData.transaction_type === 'sale') {
              db.prepare("UPDATE items SET stock_quantity = stock_quantity - ? WHERE id = ?")
                .run(lineItem.quantity, lineItem.item_id);
            } else if (txData.transaction_type === 'purchase') {
              db.prepare("UPDATE items SET stock_quantity = stock_quantity + ? WHERE id = ?")
                .run(lineItem.quantity, lineItem.item_id);
            }
          }
        }
      } else if (txData.item_id && txData.quantity) {
        // Backward compat: single item from Transactions page
        if (txData.transaction_type === 'sale') {
          db.prepare("UPDATE items SET stock_quantity = stock_quantity - ? WHERE id = ?")
            .run(txData.quantity, txData.item_id);
        } else if (txData.transaction_type === 'purchase') {
          db.prepare("UPDATE items SET stock_quantity = stock_quantity + ? WHERE id = ?")
            .run(txData.quantity, txData.item_id);
        }
      }

      // 3. Update entity balance
      if (txData.transaction_type === 'sale') {
        db.prepare("UPDATE entities SET balance = balance + ? WHERE id = ?")
          .run(txData.amount, txData.entity_id);
      } else if (txData.transaction_type === 'purchase') {
        db.prepare("UPDATE entities SET balance = balance + ? WHERE id = ?")
          .run(txData.amount, txData.entity_id);
      } else if (txData.transaction_type === 'payment_in') {
        db.prepare("UPDATE entities SET balance = balance - ? WHERE id = ?")
          .run(txData.amount, txData.entity_id);
      } else if (txData.transaction_type === 'payment_out') {
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



  ipcMain.handle('api:transactions:delete', async (event, id) => {
    const db = getDb();
    const tx = db.prepare("SELECT * FROM transactions WHERE id = ?").get(id);
    if (!tx) throw new Error("Transaction not found");

    const reverseTransaction = db.transaction(() => {
      // Reverse stock changes for all line items
      const lineItems = db.prepare("SELECT * FROM transaction_items WHERE transaction_id = ?").all(id);
      for (const lineItem of lineItems) {
        if (lineItem.item_id) {
          if (tx.transaction_type === 'sale') {
            db.prepare("UPDATE items SET stock_quantity = stock_quantity + ? WHERE id = ?")
              .run(lineItem.quantity, lineItem.item_id);
          } else if (tx.transaction_type === 'purchase') {
            db.prepare("UPDATE items SET stock_quantity = stock_quantity - ? WHERE id = ?")
              .run(lineItem.quantity, lineItem.item_id);
          }
        }
      }

      // Reverse the balance change on the entity
      if (tx.transaction_type === 'sale' || tx.transaction_type === 'payment_in') {
        db.prepare("UPDATE entities SET balance = balance - ? WHERE id = ?")
          .run(tx.amount, tx.entity_id);
      } else if (tx.transaction_type === 'purchase' || tx.transaction_type === 'payment_out') {
        db.prepare("UPDATE entities SET balance = balance - ? WHERE id = ?")
          .run(tx.amount, tx.entity_id);
      }

      // Delete line items first
      db.prepare("DELETE FROM transaction_items WHERE transaction_id = ?").run(id);
      db.prepare("DELETE FROM transactions WHERE id = ?").run(id);
    });

    try {
      reverseTransaction();
      return { success: true };
    } catch (err) {
      console.error("Delete transaction failed:", err);
      throw err;
    }
  });




  // ==================
  // AUTH SERVICES
  // ==================
  ipcMain.handle('api:auth:login', async (event, { username }) => {
    try {
      const db = getDb();
      const user = db.prepare("SELECT id, username, role FROM users WHERE username = ? COLLATE NOCASE").get(username);
      return user || null;
    } catch (err) {
       console.error("Login verification failed:", err);
       throw err;
    }
  });
}
