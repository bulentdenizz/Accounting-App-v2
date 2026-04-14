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

  ipcMain.handle('api:transactions:update', async (event, data) => {
    const db = getDb();
    const oldId = data.id;
    const oldTx = db.prepare("SELECT * FROM transactions WHERE id = ?").get(oldId);
    if (!oldTx) throw new Error("Transaction not found");

    const updateTransaction = db.transaction((txData) => {
      // 1. REVERSE OLD IMPACTS
      const oldLineItems = db.prepare("SELECT * FROM transaction_items WHERE transaction_id = ?").all(oldId);
      for (const li of oldLineItems) {
        if (li.item_id) {
          if (oldTx.transaction_type === 'sale') {
            db.prepare("UPDATE items SET stock_quantity = stock_quantity + ? WHERE id = ?").run(li.quantity, li.item_id);
          } else if (oldTx.transaction_type === 'purchase') {
            db.prepare("UPDATE items SET stock_quantity = stock_quantity - ? WHERE id = ?").run(li.quantity, li.item_id);
          }
        }
      }
      
      if (oldTx.transaction_type === 'sale' || oldTx.transaction_type === 'payment_in') {
        db.prepare("UPDATE entities SET balance = balance - ? WHERE id = ?").run(oldTx.amount, oldTx.entity_id);
      } else if (oldTx.transaction_type === 'purchase' || oldTx.transaction_type === 'payment_out') {
        db.prepare("UPDATE entities SET balance = balance - ? WHERE id = ?").run(oldTx.amount, oldTx.entity_id);
      }

      // 2. APPLY NEW DATA
      db.prepare(`
        UPDATE transactions 
        SET entity_id = ?, transaction_type = ?, amount = ?, due_date = ?, description = ?
        WHERE id = ?
      `).run(
        txData.entity_id,
        txData.transaction_type,
        txData.amount,
        txData.due_date || null,
        txData.description || null,
        oldId
      );

      // Replace line items
      db.prepare("DELETE FROM transaction_items WHERE transaction_id = ?").run(oldId);
      const insertItem = db.prepare(`
        INSERT INTO transaction_items (transaction_id, item_id, item_name, quantity, unit_price, tax_rate, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      if (txData.items && txData.items.length > 0) {
        for (const li of txData.items) {
          insertItem.run(oldId, li.item_id || null, li.item_name, li.quantity, li.unit_price, li.tax_rate || 0, li.subtotal);
          if (li.item_id) {
            if (txData.transaction_type === 'sale') {
              db.prepare("UPDATE items SET stock_quantity = stock_quantity - ? WHERE id = ?").run(li.quantity, li.item_id);
            } else if (txData.transaction_type === 'purchase') {
              db.prepare("UPDATE items SET stock_quantity = stock_quantity + ? WHERE id = ?").run(li.quantity, li.item_id);
            }
          }
        }
      }

      // Update new balance
      if (txData.transaction_type === 'sale' || txData.transaction_type === 'payment_in') {
        db.prepare("UPDATE entities SET balance = balance + ? WHERE id = ?").run(txData.amount, txData.entity_id);
      } else if (txData.transaction_type === 'purchase' || txData.transaction_type === 'payment_out') {
        db.prepare("UPDATE entities SET balance = balance + ? WHERE id = ?").run(txData.amount, txData.entity_id);
      }
    });

    try {
      updateTransaction(data);
      return { success: true };
    } catch (err) {
      console.error("Update transaction failed:", err);
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

  // PDF GENERATION
  ipcMain.handle('api:pdf:generate', async (event, invoice) => {
    const { BrowserWindow, shell, app } = require('electron');
    const path = require('path');
    const fs = require('fs');

    let printWindow = new BrowserWindow({ show: false });
    
    // Modern, Premium Invoice Template
    const html = `
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #eee; padding-bottom: 20px; }
          .company-info h1 { margin: 0; color: #2563eb; }
          .invoice-details { text-align: right; }
          .customer-info { margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 30px; }
          th { background: #f1f5f9; text-align: left; padding: 12px; font-size: 14px; text-transform: uppercase; color: #64748b; }
          td { padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; }
          .totals { margin-top: 30px; display: flex; flex-direction: column; align-items: flex-end; }
          .total-row { display: flex; justify-content: space-between; width: 250px; padding: 5px 0; }
          .grand-total { font-size: 20px; font-bold; color: #2563eb; border-top: 2px solid #2563eb; margin-top: 10px; padding-top: 10px; }
          .footer { margin-top: 50px; text-align: center; color: #94a3b8; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-info">
            <h1>ACCOUNTING PRO</h1>
            <p>Modern Muhasebe Çözümleri</p>
          </div>
          <div class="invoice-details">
            <h2>${invoice.transaction_type === 'sale' ? 'SATIŞ FATURASI' : 'ÖDEME MAKBUZU'}</h2>
            <p>No: #INV-${invoice.id}</p>
            <p>Tarih: ${new Date(invoice.transaction_date).toLocaleDateString('tr-TR')}</p>
          </div>
        </div>
        <div class="customer-info">
          <strong>Sayın / Alıcı:</strong><br/>
          ${invoice.entity_name}<br/>
          ${invoice.entity_address || ''}
        </div>
        <table>
          <thead>
            <tr>
              <th>Açıklama</th>
              <th>Miktar</th>
              <th>Birim Fiyat</th>
              <th>KDV</th>
              <th style="text-align:right">Toplam</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items.map(item => `
              <tr>
                <td>${item.item_name}</td>
                <td>${item.quantity}</td>
                <td>${item.unit_price.toFixed(2)} ₺</td>
                <td>%${item.tax_rate}</td>
                <td style="text-align:right">${item.subtotal.toFixed(2)} ₺</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="totals">
          <div class="total-row"><span>Genel Toplam:</span> <strong>${invoice.amount.toFixed(2)} ₺</strong></div>
          <div class="total-row grand-total"><span>Ödenecek:</span> <span>${invoice.amount.toFixed(2)} ₺</span></div>
        </div>
        <div class="footer">Bu makbuz Accounting Pro sistemi tarafından otomatik oluşturulmuştur.</div>
      </body>
      </html>
    `;

    try {
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      const pdf = await printWindow.webContents.printToPDF({
        printBackground: true,
        marginsType: 0,
        pageSize: 'A4'
      });
      
      const fileName = `Invoice_${invoice.id}_${Date.now()}.pdf`;
      const filePath = path.join(app.getPath('downloads'), fileName);
      fs.writeFileSync(filePath, pdf);
      shell.openPath(filePath);
      return { success: true, path: filePath };
    } catch (err) {
      console.error("PDF generation error:", err);
      throw err;
    } finally {
      printWindow.close();
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
