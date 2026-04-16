import { getDb } from './db';
import { ipcMain } from 'electron';
import crypto from 'crypto';

// Frontend (React) sanki bir Web API'ye bağlanıyormuş gibi bu olayları (events) çağıracak.
export function setupHandlers() {
  const hashPassword = (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
  };

  const verifyPassword = (password, encoded) => {
    if (!encoded || !String(encoded).startsWith('scrypt$')) return false;
    const parts = String(encoded).split('$');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const storedHash = parts[2];
    const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
    const a = Buffer.from(derived, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  };

  const normalizeType = (rawType) => {
    const txType = String(rawType || '').trim();
    const allowed = new Set(['sale', 'purchase', 'payment_in', 'payment_out', 'sale_return', 'purchase_return']);
    if (!allowed.has(txType)) throw new Error('Unsupported transaction type');
    return txType;
  };

  const balanceDeltaByType = (txType, amount) => {
    const safeAmount = Number(amount || 0);
    if (safeAmount <= 0) throw new Error('Amount must be greater than 0');
    if (txType === 'sale' || txType === 'purchase') return safeAmount;
    if (txType === 'payment_in' || txType === 'payment_out') return -safeAmount;
    if (txType === 'sale_return' || txType === 'purchase_return') return -safeAmount;
    return 0;
  };

  const stockDeltaByType = (txType, qty) => {
    const safeQty = Number(qty || 0);
    if (safeQty <= 0) throw new Error('Quantity must be greater than 0');
    if (txType === 'sale') return -safeQty;
    if (txType === 'purchase') return safeQty;
    if (txType === 'sale_return') return safeQty;
    if (txType === 'purchase_return') return -safeQty;
    return 0;
  };

  const updateDocumentState = (db, transactionId) => {
    const tx = db.prepare('SELECT id, transaction_type, amount FROM transactions WHERE id = ?').get(transactionId);
    if (!tx) return;
    const tracked = tx.transaction_type === 'sale' || tx.transaction_type === 'purchase';
    if (!tracked) return;

    const paid = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS paid
      FROM payment_allocations
      WHERE target_transaction_id = ?
    `).get(transactionId).paid;

    const remaining = Math.max(0, Number(tx.amount) - Number(paid || 0));
    let status = 'open';
    if (remaining === 0) status = 'closed';
    else if (remaining < Number(tx.amount)) status = 'partial';

    db.prepare('UPDATE transactions SET remaining_amount = ?, status = ? WHERE id = ?')
      .run(remaining, status, transactionId);
  };

  const applyPaymentAllocations = (db, paymentTxId, entityId, paymentType, requestedAllocations, paymentAmount) => {
    const explicit = Array.isArray(requestedAllocations) && requestedAllocations.length > 0;
    const targetType = paymentType === 'payment_in' ? 'sale' : 'purchase';

    let allocations = [];
    if (explicit) {
      allocations = requestedAllocations.map((a) => ({
        target_transaction_id: Number(a.target_transaction_id),
        amount: Number(a.amount),
      })).filter((a) => a.target_transaction_id && a.amount > 0);
    } else {
      const docs = db.prepare(`
        SELECT id, amount, remaining_amount, transaction_date
        FROM transactions
        WHERE entity_id = ?
          AND transaction_type = ?
          AND status IN ('open', 'partial')
        ORDER BY COALESCE(due_date, transaction_date) ASC, id ASC
      `).all(entityId, targetType);
      let remaining = Number(paymentAmount);
      for (const doc of docs) {
        if (remaining <= 0) break;
        const docRemaining = Number(doc.remaining_amount || doc.amount);
        if (docRemaining <= 0) continue;
        const alloc = Math.min(remaining, docRemaining);
        if (alloc > 0) {
          allocations.push({ target_transaction_id: doc.id, amount: alloc });
          remaining -= alloc;
        }
      }
    }

    const total = allocations.reduce((sum, a) => sum + a.amount, 0);
    if (total > Number(paymentAmount) + 0.000001) throw new Error('Allocation total cannot exceed payment amount');

    const insertAllocation = db.prepare(`
      INSERT INTO payment_allocations (payment_transaction_id, target_transaction_id, amount)
      VALUES (?, ?, ?)
    `);
    for (const alloc of allocations) {
      const target = db.prepare(`
        SELECT id, entity_id, transaction_type, amount, remaining_amount
        FROM transactions
        WHERE id = ?
      `).get(alloc.target_transaction_id);
      if (!target) throw new Error(`Target transaction not found: ${alloc.target_transaction_id}`);
      if (target.entity_id !== Number(entityId)) throw new Error('Allocation target must belong to same entity');
      if (target.transaction_type !== targetType) throw new Error('Allocation target has wrong type');
      const remainingBefore = Number(target.remaining_amount || target.amount);
      if (alloc.amount - remainingBefore > 0.000001) throw new Error('Allocation exceeds target remaining amount');
      insertAllocation.run(paymentTxId, alloc.target_transaction_id, alloc.amount);
      updateDocumentState(db, alloc.target_transaction_id);
    }

    return { allocated: total, unallocated: Number(paymentAmount) - total };
  };

  const assertStockAvailability = (db, txType, lineItems) => {
    if (!Array.isArray(lineItems) || lineItems.length === 0) return;
    if (txType !== 'sale' && txType !== 'purchase_return') return;
    for (const li of lineItems) {
      if (!li.item_id) continue;
      const item = db.prepare('SELECT id, name, stock_quantity FROM items WHERE id = ?').get(li.item_id);
      if (!item) throw new Error(`Product not found: ${li.item_id}`);
      const required = Number(li.quantity || 0);
      if (required <= 0) throw new Error('Line quantity must be greater than 0');
      if (Number(item.stock_quantity) < required) {
        throw new Error(`Yetersiz stok: ${item.name}. Mevcut: ${item.stock_quantity}, istenen: ${required}`);
      }
    }
  };

  const applyStockImpact = (db, txType, lineItems) => {
    if (!Array.isArray(lineItems) || lineItems.length === 0) return;
    for (const lineItem of lineItems) {
      if (!lineItem.item_id) continue;
      const delta = stockDeltaByType(txType, lineItem.quantity);
      if (!delta) continue;
      db.prepare('UPDATE items SET stock_quantity = stock_quantity + ? WHERE id = ?')
        .run(delta, lineItem.item_id);
    }
  };

  const reverseStockImpact = (db, txType, lineItems) => {
    if (!Array.isArray(lineItems) || lineItems.length === 0) return;
    for (const li of lineItems) {
      if (!li.item_id) continue;
      const delta = stockDeltaByType(txType, li.quantity);
      if (!delta) continue;
      db.prepare('UPDATE items SET stock_quantity = stock_quantity - ? WHERE id = ?')
        .run(delta, li.item_id);
    }
  };

  const applyBalanceImpact = (db, entityId, txType, amount) => {
    const delta = balanceDeltaByType(txType, amount);
    db.prepare('UPDATE entities SET balance = balance + ? WHERE id = ?')
      .run(delta, entityId);
  };

  const reverseBalanceImpact = (db, entityId, txType, amount) => {
    const delta = balanceDeltaByType(txType, amount);
    db.prepare('UPDATE entities SET balance = balance - ? WHERE id = ?')
      .run(delta, entityId);
  };

  const normalizeLineItems = (txData) => {
    if (Array.isArray(txData.items) && txData.items.length > 0) {
      return txData.items.map((lineItem) => ({
        item_id: lineItem.item_id || null,
        item_name: String(lineItem.item_name || '').trim(),
        quantity: Number(lineItem.quantity || 0),
        unit_price: Number(lineItem.unit_price || 0),
        tax_rate: Number(lineItem.tax_rate || 0),
        subtotal: Number(lineItem.subtotal || 0),
      }));
    }
    if (txData.item_id && txData.quantity) {
      return [{
        item_id: txData.item_id,
        item_name: txData.item_name || '',
        quantity: Number(txData.quantity),
        unit_price: Number(txData.unit_price || 0),
        tax_rate: Number(txData.tax_rate || 0),
        subtotal: Number(txData.amount || 0),
      }];
    }
    return [];
  };

  // ==================
  // MÜŞTERİ (ENTITIES) SERVİSLERİ
  // ==================
  ipcMain.handle('api:customers:getAll', async () => {
    try {
      const db = getDb();
      return db.prepare('SELECT * FROM entities WHERE is_active = 1 ORDER BY title ASC').all();
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
      const txCount = db.prepare('SELECT COUNT(1) AS c FROM transactions WHERE entity_id = ?').get(entityId).c;
      if (txCount > 0) {
        db.prepare('UPDATE entities SET is_active = 0 WHERE id = ?').run(entityId);
        return { success: true, softDeleted: true };
      }
      db.prepare('DELETE FROM entities WHERE id=?').run(entityId);
      return { success: true, softDeleted: false };
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
      const usage = db.prepare('SELECT COUNT(1) AS c FROM transaction_items WHERE item_id = ?').get(id).c;
      if (usage > 0) {
        throw new Error('Bu urun gecmis islemlerde kullanildigi icin silinemez.');
      }
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
    const txType = normalizeType(data.transaction_type);
    const lineItems = normalizeLineItems(data);
    const amount = Number(data.amount || 0);
    if (amount <= 0) throw new Error('Amount must be greater than 0');
    assertStockAvailability(db, txType, lineItems);

    const transaction = db.transaction((txData) => {
      const insertTx = db.prepare(`
        INSERT INTO transactions (entity_id, transaction_type, amount, due_date, description, user_id, status, remaining_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const startingStatus = (txType === 'sale' || txType === 'purchase') ? 'open' : 'closed';
      const startingRemaining = (txType === 'sale' || txType === 'purchase') ? amount : 0;
      const txResult = insertTx.run(
        txData.entity_id,
        txType,
        amount,
        txData.due_date || null,
        txData.description || null,
        txData.user_id || null,
        startingStatus,
        startingRemaining
      );
      const newTxId = txResult.lastInsertRowid;

      const insertItem = db.prepare(`
        INSERT INTO transaction_items (transaction_id, item_id, item_name, quantity, unit_price, tax_rate, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      if (lineItems.length > 0) {
        for (const lineItem of lineItems) {
          insertItem.run(
            newTxId,
            lineItem.item_id || null,
            lineItem.item_name,
            lineItem.quantity,
            lineItem.unit_price,
            lineItem.tax_rate || 0,
            lineItem.subtotal
          );

        }
      }

      applyStockImpact(db, txType, lineItems);
      applyBalanceImpact(db, txData.entity_id, txType, amount);

      if (txType === 'payment_in' || txType === 'payment_out') {
        applyPaymentAllocations(
          db,
          newTxId,
          txData.entity_id,
          txType,
          txData.allocations,
          amount
        );
      }

      updateDocumentState(db, newTxId);
      return { id: newTxId };
    });

    try {
      const result = transaction(data);
      return { success: true, id: result.id };
    } catch (err) {
      console.error("Atomic transaction failed:", err);
      throw err;
    }
  });

  ipcMain.handle('api:transactions:update', async (event, data) => {
    const db = getDb();
    const oldId = data.id;
    const oldTx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(oldId);
    if (!oldTx) throw new Error("Transaction not found");
    const newType = normalizeType(data.transaction_type);
    const newItems = normalizeLineItems(data);
    const newAmount = Number(data.amount || 0);
    if (newAmount <= 0) throw new Error('Amount must be greater than 0');

    const updateTransaction = db.transaction((txData) => {
      const oldLineItems = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(oldId);
      reverseStockImpact(db, oldTx.transaction_type, oldLineItems);
      reverseBalanceImpact(db, oldTx.entity_id, oldTx.transaction_type, oldTx.amount);

      const allocationLinks = db.prepare(`
        SELECT payment_transaction_id, target_transaction_id
        FROM payment_allocations
        WHERE payment_transaction_id = ? OR target_transaction_id = ?
      `).all(oldId, oldId);
      db.prepare('DELETE FROM payment_allocations WHERE payment_transaction_id = ? OR target_transaction_id = ?').run(oldId, oldId);
      for (const link of allocationLinks) {
        updateDocumentState(db, link.target_transaction_id);
      }

      db.prepare(`
        UPDATE transactions 
        SET entity_id = ?, transaction_type = ?, amount = ?, due_date = ?, description = ?, remaining_amount = ?, status = ?
        WHERE id = ?
      `).run(
        txData.entity_id,
        newType,
        newAmount,
        txData.due_date || null,
        txData.description || null,
        (newType === 'sale' || newType === 'purchase') ? newAmount : 0,
        (newType === 'sale' || newType === 'purchase') ? 'open' : 'closed',
        oldId
      );

      db.prepare('DELETE FROM transaction_items WHERE transaction_id = ?').run(oldId);
      const insertItem = db.prepare(`
        INSERT INTO transaction_items (transaction_id, item_id, item_name, quantity, unit_price, tax_rate, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      assertStockAvailability(db, newType, newItems);
      for (const li of newItems) {
        insertItem.run(oldId, li.item_id || null, li.item_name, li.quantity, li.unit_price, li.tax_rate || 0, li.subtotal);
      }
      applyStockImpact(db, newType, newItems);
      applyBalanceImpact(db, txData.entity_id, newType, newAmount);

      if (newType === 'payment_in' || newType === 'payment_out') {
        applyPaymentAllocations(
          db,
          oldId,
          txData.entity_id,
          newType,
          txData.allocations,
          newAmount
        );
      }

      updateDocumentState(db, oldId);
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
      const lineItems = db.prepare("SELECT * FROM transaction_items WHERE transaction_id = ?").all(id);
      reverseStockImpact(db, tx.transaction_type, lineItems);
      reverseBalanceImpact(db, tx.entity_id, tx.transaction_type, tx.amount);

      const links = db.prepare(`
        SELECT payment_transaction_id, target_transaction_id
        FROM payment_allocations
        WHERE payment_transaction_id = ? OR target_transaction_id = ?
      `).all(id, id);
      db.prepare('DELETE FROM payment_allocations WHERE payment_transaction_id = ? OR target_transaction_id = ?').run(id, id);
      for (const link of links) {
        updateDocumentState(db, link.target_transaction_id);
      }

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

  ipcMain.handle('api:transactions:getOpenDocuments', async (event, { entity_id, type }) => {
    try {
      const db = getDb();
      const docType = type === 'supplier' ? 'purchase' : 'sale';
      return db.prepare(`
        SELECT id, transaction_type, amount, remaining_amount, due_date, transaction_date, description
        FROM transactions
        WHERE entity_id = ?
          AND transaction_type = ?
          AND status IN ('open', 'partial')
        ORDER BY COALESCE(due_date, transaction_date) ASC, id ASC
      `).all(entity_id, docType);
    } catch (err) {
      console.error('Error fetching open documents:', err);
      throw err;
    }
  });

  ipcMain.handle('api:transactions:getDueList', async () => {
    try {
      const db = getDb();
      return db.prepare(`
        SELECT t.id, t.transaction_type, t.transaction_date, t.due_date, t.amount, t.remaining_amount, t.status,
               e.id AS entity_id, e.title AS entity_name, e.type AS entity_type
        FROM transactions t
        INNER JOIN entities e ON e.id = t.entity_id
        WHERE t.transaction_type IN ('sale', 'purchase')
          AND t.status IN ('open', 'partial')
          AND t.due_date IS NOT NULL
        ORDER BY t.due_date ASC, t.id ASC
      `).all();
    } catch (err) {
      console.error('Error fetching due list:', err);
      throw err;
    }
  });

  ipcMain.handle('api:transactions:getStatementByEntity', async (event, entityId) => {
    try {
      const db = getDb();
      const entity = db.prepare('SELECT * FROM entities WHERE id = ?').get(entityId);
      if (!entity) throw new Error('Entity not found');
      const movements = db.prepare(`
        SELECT t.*, u.username AS user_name
        FROM transactions t
        LEFT JOIN users u ON t.user_id = u.id
        WHERE t.entity_id = ?
        ORDER BY t.transaction_date DESC, t.id DESC
      `).all(entityId);
      return { entity, movements };
    } catch (err) {
      console.error('Error fetching statement:', err);
      throw err;
    }
  });

  ipcMain.handle('api:system:createBackup', async () => {
    const { app } = require('electron');
    const fs = require('fs');
    const path = require('path');
    try {
      const db = getDb();
      const info = db.prepare('PRAGMA database_list').all();
      const dbFile = info.find((i) => i.name === 'main')?.file;
      if (!dbFile) throw new Error('Database path not found');
      const backupDir = path.join(app.getPath('documents'), 'AccountingBackups');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const fileName = `backup_${Date.now()}.db`;
      const backupPath = path.join(backupDir, fileName);
      fs.copyFileSync(dbFile, backupPath);
      return { success: true, path: backupPath };
    } catch (err) {
      console.error('Backup failed:', err);
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
  ipcMain.handle('api:auth:login', async (event, { username, password }) => {
    try {
      const db = getDb();
      const user = db.prepare('SELECT id, username, role, password FROM users WHERE username = ? COLLATE NOCASE').get(username);
      if (!user) return null;
      if (!user.password) return null;
      const isValid = verifyPassword(String(password || ''), user.password);
      if (!isValid) return null;
      return { id: user.id, username: user.username, role: user.role };
    } catch (err) {
       console.error("Login verification failed:", err);
       throw err;
    }
  });

  ipcMain.handle('api:auth:createUser', async (event, payload) => {
    try {
      const db = getDb();
      const username = String(payload.username || '').trim();
      const password = String(payload.password || '');
      const role = payload.role === 'admin' ? 'admin' : 'staff';
      if (!username || password.length < 4) throw new Error('Invalid credentials');
      const hash = hashPassword(password);
      const result = db.prepare('INSERT INTO users (username, role, password) VALUES (?, ?, ?)').run(username, role, hash);
      return { success: true, id: result.lastInsertRowid };
    } catch (err) {
      console.error('Create user failed:', err);
      throw err;
    }
  });
}
