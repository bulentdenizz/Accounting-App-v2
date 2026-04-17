import { getDb } from './db';
import { ipcMain } from 'electron';
import crypto from 'crypto';
import { generateInvoiceNumber } from './services/invoice-numbering.service.js';

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
          AND is_cancelled = 0
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

  const applyStockImpact = (db, txType, lineItems, txId = null) => {
    if (!Array.isArray(lineItems) || lineItems.length === 0) return;
    
    const movementTypeMap = {
      sale: 'sale_out',
      purchase: 'purchase_in',
      sale_return: 'return_in',
      purchase_return: 'return_out'
    };
    const movementType = movementTypeMap[txType];
    if (!movementType) return;

    for (const li of lineItems) {
      if (!li.item_id) continue;
      const delta = stockDeltaByType(txType, li.quantity);
      if (delta === 0) continue;

      const currentItem = db.prepare('SELECT stock_quantity, name FROM items WHERE id = ?').get(li.item_id);
      if (!currentItem) throw new Error(`Ürün bulunamadı: ${li.item_id}`);

      const balanceAfter = Number(currentItem.stock_quantity) + delta;

      if (balanceAfter < 0 && (txType === 'sale' || txType === 'purchase_return')) {
        throw new Error(`Yetersiz stok: "${currentItem.name}". Mevcut: ${currentItem.stock_quantity}, İstenen: ${li.quantity}`);
      }

      db.prepare('UPDATE items SET stock_quantity = ? WHERE id = ?').run(balanceAfter, li.item_id);

      db.prepare(`
        INSERT INTO stock_movements 
          (transaction_id, item_id, movement_type, quantity_change, balance_after, unit_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(txId, li.item_id, movementType, delta, balanceAfter, li.unit_price || null);
    }
  };

  const reverseStockImpact = (db, txType, lineItems, txId = null) => {
    if (!Array.isArray(lineItems) || lineItems.length === 0) return;
    
    for (const li of lineItems) {
      if (!li.item_id) continue;
      const originalDelta = stockDeltaByType(txType, li.quantity);
      if (originalDelta === 0) continue;
      
      const reverseDelta = -originalDelta;
      const currentItem = db.prepare('SELECT stock_quantity, name FROM items WHERE id = ?').get(li.item_id);
      if (!currentItem) continue;

      const balanceAfter = Number(currentItem.stock_quantity) + reverseDelta;

      db.prepare('UPDATE items SET stock_quantity = ? WHERE id = ?').run(balanceAfter, li.item_id);

      db.prepare(`
        INSERT INTO stock_movements 
          (transaction_id, item_id, movement_type, quantity_change, balance_after, unit_price, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(txId, li.item_id, 'manual_adj', reverseDelta, balanceAfter, li.unit_price || null, 'İşlem İptali / Geri Alma');
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

  ipcMain.handle('api:items:bulkUpdatePrice', async (event, { type, value, supplier_id }) => {
    try {
      const db = getDb();
      let query = "";
      let params = [];
      const safeValue = Number(value);

      if (type === 'percent') {
        query = 'UPDATE items SET unit_price = ROUND(unit_price * (1 + (? / 100)), 2)';
        params.push(safeValue);
      } else if (type === 'fixed') {
        query = 'UPDATE items SET unit_price = unit_price + ?';
        params.push(safeValue);
      } else {
        throw new Error('Invalid update type');
      }

      if (supplier_id && supplier_id !== 'all') {
         query += ' WHERE supplier_id = ?';
         params.push(Number(supplier_id));
      }
      
      const stm = db.prepare(query);
      const res = stm.run(...params);
      return { success: true, updatedCount: res.changes };
    } catch (err) {
      console.error("Bulk update error:", err);
      throw err;
    }
  });

  ipcMain.handle('api:inventory:adjustStock', async (event, { item_id, new_quantity, reason }) => {
    const db = getDb();
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(item_id);
    if (!item) throw new Error('Ürün bulunamadı.');

    const newQtyNum = Number(new_quantity);
    if (isNaN(newQtyNum) || newQtyNum < 0) throw new Error('Geçersiz miktar.');

    const delta = newQtyNum - Number(item.stock_quantity);

    const performAdjustment = db.transaction(() => {
      db.prepare('UPDATE items SET stock_quantity = ? WHERE id = ?')
        .run(newQtyNum, item_id);

      db.prepare(`
        INSERT INTO stock_movements 
          (item_id, movement_type, quantity_change, balance_after, unit_price, notes)
        VALUES (?, 'manual_adj', ?, ?, ?, ?)
      `).run(item_id, delta, newQtyNum, item.unit_price, reason || 'Manuel sayım düzeltmesi');
    });

    try {
      performAdjustment();
      return { success: true };
    } catch (err) {
      console.error('Manual stock adjustment error:', err);
      throw err;
    }
  });

  ipcMain.handle('api:inventory:getMovements', async (event, { item_id, limit = 50, offset = 0 } = {}) => {
    try {
      const db = getDb();
      let query = `
        SELECT sm.*, 
               i.name as item_name, i.unit as item_unit,
               t.invoice_number, t.transaction_date,
               e.title as entity_name
        FROM stock_movements sm
        JOIN items i ON sm.item_id = i.id
        LEFT JOIN transactions t ON sm.transaction_id = t.id
        LEFT JOIN entities e ON t.entity_id = e.id
      `;
      const params = [];

      if (item_id) {
        query += ` WHERE sm.item_id = ? `;
        params.push(item_id);
      }

      query += ` ORDER BY sm.created_at DESC LIMIT ? OFFSET ? `;
      params.push(limit, offset);

      const movements = db.prepare(query).all(...params);

      // Get total count
      let countQuery = `SELECT COUNT(*) as total FROM stock_movements`;
      let countParams = [];
      if (item_id) {
        countQuery += ` WHERE item_id = ?`;
        countParams.push(item_id);
      }
      const totalCount = db.prepare(countQuery).get(...countParams).total;

      return { data: movements, totalCount };
    } catch (err) {
      console.error('Error fetching stock movements:', err);
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
        WHERE t.is_cancelled = 0
        ORDER BY t.transaction_date DESC
      `).all();
    } catch (err) {
      console.error("Error fetching transactions:", err);
      throw err;
    }
  });

  ipcMain.handle('api:transactions:getPage', async (event, { limit = 20, offset = 0 } = {}) => {
    try {
      const db = getDb();
      const data = db.prepare(`
        SELECT t.*, e.title as entity_name, u.username as user_name
        FROM transactions t
        LEFT JOIN entities e ON t.entity_id = e.id
        LEFT JOIN users u ON t.user_id = u.id
        WHERE t.is_cancelled = 0
        ORDER BY t.transaction_date DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset);

      const totalCount = db.prepare('SELECT COUNT(*) AS c FROM transactions WHERE is_cancelled = 0').get().c;
      const cashIn = db.prepare("SELECT COALESCE(SUM(amount), 0) AS c FROM transactions WHERE transaction_type = 'payment_in' AND is_cancelled = 0").get().c;
      const cashOut = db.prepare("SELECT COALESCE(SUM(amount), 0) AS c FROM transactions WHERE transaction_type = 'payment_out' AND is_cancelled = 0").get().c;

      return { data, totalCount, cashInTotal: cashIn, cashOutTotal: cashOut };
    } catch (err) {
      console.error("Error fetching transactions page:", err);
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

    const taxAmount = lineItems.reduce((sum, li) => {
      const base = Number(li.quantity) * Number(li.unit_price);
      return sum + base * (Number(li.tax_rate || 0) / 100);
    }, 0);
    const amountExclTax = amount - taxAmount;

    const transaction = db.transaction((txData) => {
      const invNum = generateInvoiceNumber(db, txType);
      
      const insertTx = db.prepare(`
        INSERT INTO transactions (entity_id, transaction_type, amount, amount_excl_tax, tax_amount, invoice_number, due_date, description, user_id, status, remaining_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const startingStatus = (txType === 'sale' || txType === 'purchase') ? 'open' : 'closed';
      const startingRemaining = (txType === 'sale' || txType === 'purchase') ? amount : 0;
      const txResult = insertTx.run(
        txData.entity_id,
        txType,
        amount,
        amountExclTax,
        taxAmount,
        invNum,
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

      applyStockImpact(db, txType, lineItems, newTxId);
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
    const oldTx = db.prepare('SELECT * FROM transactions WHERE id = ? AND is_cancelled = 0').get(oldId);
    if (!oldTx) throw new Error("Transaction not found or cancelled");

    if ((oldTx.transaction_type === 'sale' || oldTx.transaction_type === 'purchase') && Number(oldTx.remaining_amount) !== Number(oldTx.amount)) {
      throw new Error("Bu belgede tahsilat/ödeme işlemi var. Güncellemeden önce ödemeleri kaldırın.");
    }

    const newType = normalizeType(data.transaction_type);
    const newItems = normalizeLineItems(data);
    const newAmount = Number(data.amount || 0);
    if (newAmount <= 0) throw new Error('Amount must be greater than 0');

    const newTaxAmount = newItems.reduce((sum, li) => {
      const base = Number(li.quantity) * Number(li.unit_price);
      return sum + base * (Number(li.tax_rate || 0) / 100);
    }, 0);
    const newAmountExclTax = newAmount - newTaxAmount;

    const updateTransaction = db.transaction((txData) => {
      const oldLineItems = db.prepare('SELECT * FROM transaction_items WHERE transaction_id = ?').all(oldId);
      reverseStockImpact(db, oldTx.transaction_type, oldLineItems, oldId);
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
        SET entity_id = ?, transaction_type = ?, amount = ?, amount_excl_tax = ?, tax_amount = ?, due_date = ?, description = ?, remaining_amount = ?, status = ?
        WHERE id = ?
      `).run(
        txData.entity_id,
        newType,
        newAmount,
        newAmountExclTax,
        newTaxAmount,
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
      applyStockImpact(db, newType, newItems, oldId);
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

  ipcMain.handle('api:transactions:delete', async (event, payload) => {
    const db = getDb();
    const id = typeof payload === 'object' ? payload.id : payload;
    const reason = typeof payload === 'object' ? payload.reason : 'Kullanıcı tarafından silindi';

    const tx = db.prepare("SELECT * FROM transactions WHERE id = ? AND is_cancelled = 0").get(id);
    if (!tx) throw new Error("İşlem bulunamadı veya zaten iptal edilmiş");

    if ((tx.transaction_type === 'sale' || tx.transaction_type === 'purchase') && Number(tx.remaining_amount) !== Number(tx.amount)) {
      throw new Error("Bu belgede tahsilat/ödeme işlemi var. İptal etmeden önce ödemeleri silin.");
    }

    const cancelTransaction = db.transaction(() => {
      const lineItems = db.prepare("SELECT * FROM transaction_items WHERE transaction_id = ?").all(id);
      reverseStockImpact(db, tx.transaction_type, lineItems, id);
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

      db.prepare(`
        UPDATE transactions 
        SET is_cancelled = 1, 
            cancelled_at = CURRENT_TIMESTAMP,
            cancel_reason = ?,
            status = 'cancelled'
        WHERE id = ?
      `).run(reason, id);
    });

    try {
      cancelTransaction();
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
          AND is_cancelled = 0
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
          AND t.is_cancelled = 0
        ORDER BY t.due_date ASC, t.id ASC
      `).all();
    } catch (err) {
      console.error('Error fetching due list:', err);
      throw err;
    }
  });

  // ==================
  // DASHBOARD SERVICES
  // ==================
  ipcMain.handle('api:dashboard:getStats', async () => {
    try {
      const db = getDb();

      // Müşteri / Alacak
      const recResult = db.prepare("SELECT COALESCE(SUM(balance), 0) AS total FROM entities WHERE type = 'Customer'").get();
      // Tedarikçi / Borç
      const payResult = db.prepare("SELECT COALESCE(SUM(balance), 0) AS total FROM entities WHERE type = 'Supplier'").get();

      // Toplam Stok Çeşit
      const itemResult = db.prepare("SELECT COUNT(id) AS total FROM items").get();

      // Kritik Stok (5'in altı)
      const lowStock = db.prepare("SELECT id, name, unit, stock_quantity FROM items WHERE stock_quantity <= 5").all();

      // Bugünkü Kasa (Giriş: sale, payment_in. Çıkış: purchase, payment_out)
      // Tarih dilimleri için SQLite date fonksiyonunu kullanıyoruz
      const todayCashQ = db.prepare(`
        SELECT COALESCE(SUM(
          CASE 
            WHEN transaction_type IN ('sale', 'payment_in') THEN amount 
            WHEN transaction_type IN ('purchase', 'payment_out') THEN -amount 
            ELSE 0 
          END
        ), 0) AS net
        FROM transactions 
        WHERE date(transaction_date) = date('now', 'localtime') AND is_cancelled = 0
      `).get();

      // Son 7 Günlük Tablo
      // Son 7 güne ait toplamları gün gün filtreliyoruz.
      const rawChart = db.prepare(`
        SELECT 
          date(transaction_date) as d, 
          transaction_type as type, 
          SUM(amount) as amt 
        FROM transactions 
        WHERE date(transaction_date) >= date('now', '-6 days', 'localtime') AND is_cancelled = 0
        GROUP BY date(transaction_date), transaction_type
      `).all();

      // Son 5 Ekstre İşlemi
      const recentTransactions = db.prepare(`
        SELECT t.*, e.title as entity_name
        FROM transactions t
        LEFT JOIN entities e ON t.entity_id = e.id
        WHERE t.is_cancelled = 0
        ORDER BY t.transaction_date DESC
        LIMIT 5
      `).all();

      // Önceki Hafta Satış Hacmi (Basit trend için)
      const thisWeekSales = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
        WHERE transaction_type = 'sale' AND date(transaction_date) >= date('now', '-7 days', 'localtime') AND is_cancelled = 0
      `).get().total;

      const lastWeekSales = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions 
        WHERE transaction_type = 'sale' AND date(transaction_date) >= date('now', '-14 days', 'localtime') AND date(transaction_date) < date('now', '-7 days', 'localtime') AND is_cancelled = 0
      `).get().total;

      let salesTrend = 0;
      if (lastWeekSales > 0) {
        salesTrend = ((thisWeekSales - lastWeekSales) / lastWeekSales) * 100;
      } else if (thisWeekSales > 0) {
        salesTrend = 100; // Önceki hafta 0 ise
      }

      return {
        totalReceivables: recResult.total,
        totalPayables: payResult.total,
        totalItems: itemResult.total,
        lowStockItems: lowStock,
        dailyCash: todayCashQ.net,
        recentTransactions: recentTransactions,
        rawChartData: rawChart,
        salesTrend: salesTrend
      };
    } catch (error) {
      console.error('Dashboard Stats Error:', error);
      throw error;
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

  ipcMain.handle('api:system:restoreBackup', async (event, backupPath) => {
    const { app, dialog } = require('electron');
    const fs = require('fs');
    try {
      let finalPath = backupPath;
      
      if (!finalPath) {
        const result = await dialog.showOpenDialog({
          properties: ['openFile'],
          filters: [{ name: 'Sistem Yedeği', extensions: ['db', 'sqlite'] }]
        });
        if (result.canceled || result.filePaths.length === 0) return { success: false, msg: 'İptal edildi' };
        finalPath = result.filePaths[0];
      }

      if (!fs.existsSync(finalPath)) throw new Error('Seçilen yedek dosyası bulunamadı.');

      const header = fs.readFileSync(finalPath, { length: 16 });
      if (!header.toString('utf8').startsWith('SQLite format 3')) {
         throw new Error('Seçilen dosya geçerli bir veritabanı yedeği değil.');
      }
      
      const db = getDb();
      const info = db.prepare('PRAGMA database_list').all();
      const dbFile = info.find((i) => i.name === 'main')?.file;
      if (!dbFile) throw new Error('Mevcut veritabanı yolu bulunamadı.');

      // Safety core backup
      fs.copyFileSync(dbFile, dbFile + '.safety_backup');

      db.close();
      fs.copyFileSync(finalPath, dbFile);

      app.relaunch();
      app.exit(0);
      return { success: true };
    } catch (err) {
      console.error('Restore failed:', err);
      throw err;
    }
  });

  // ==================
  // SETTINGS SERVICES
  // ==================
  ipcMain.handle('api:settings:getAll', async () => {
    try {
      const db = getDb();
      const rows = db.prepare('SELECT * FROM settings').all();
      const settingsObj = {};
      rows.forEach(r => { settingsObj[r.key] = r.value; });
      return settingsObj;
    } catch (err) {
      console.error('Settings getAll error:', err);
      throw err;
    }
  });

  ipcMain.handle('api:settings:update', async (event, settings) => {
    try {
      const db = getDb();
      const stm = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      const tx = db.transaction((sets) => {
        for (const [k, v] of Object.entries(sets)) {
          stm.run(String(k), String(v));
        }
      });
      tx(settings);
      return { success: true };
    } catch (err) {
      console.error('Settings update error:', err);
      throw err;
    }
  });

  // PDF GENERATION
  ipcMain.handle('api:pdf:generate', async (event, invoice) => {
    const db = getDb();
    const storeNameRow = db.prepare("SELECT value FROM settings WHERE key = 'store_name'").get();
    const storeName = storeNameRow?.value || '';

    if (!storeName.trim()) {
      throw new Error('Dükkan/Firma adı ayarlanmamış. Lütfen Ayarlar kısmından firma adını kaydedin.');
    }

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
            <h1>${storeName}</h1>
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
  // REPORT SERVICES
  // ==================
  ipcMain.handle('api:reports:getStats', async (event, { startDate, endDate }) => {
    try {
      const db = getDb();
      const whereClause = "WHERE is_cancelled = 0 AND date(transaction_date) BETWEEN ? AND ?";
      const params = [startDate, endDate];

      // 1. Genel Ciro ve KDV Özetleri
      const summary = db.prepare(`
        SELECT 
          transaction_type,
          SUM(amount) as total_amount,
          SUM(amount_excl_tax) as total_excl,
          SUM(tax_amount) as total_tax
        FROM transactions 
        ${whereClause}
        GROUP BY transaction_type
      `).all(...params);

      // 2. Tahsilat/Ödeme Özeti
      const payments = db.prepare(`
        SELECT 
          transaction_type,
          SUM(amount) as total
        FROM transactions 
        ${whereClause}
        AND transaction_type IN ('payment_in', 'payment_out')
        GROUP BY transaction_type
      `).all(...params);

      // 3. Aylık KDV Trendi (Son 12 Ay)
      const kdvTrend = db.prepare(`
        SELECT 
          strftime('%Y-%m', transaction_date) as month,
          SUM(CASE WHEN transaction_type = 'sale' THEN tax_amount ELSE 0 END) as output_kdv,
          SUM(CASE WHEN transaction_type = 'purchase' THEN tax_amount ELSE 0 END) as input_kdv
        FROM transactions 
        WHERE is_cancelled = 0 AND transaction_date >= date('now', '-11 months')
        GROUP BY month
        ORDER BY month ASC
      `).all();

      // 4. Karlılık Analizi (Basit COGS Yaklaşımı: Ortalama Alış vs Satış)
      // Bu sorgu, satılan ürünlerin o dönemdeki toplam satış geliri ve
      // o ürünlerin sistemdeki GENEL ortalama alış maliyeti arasındaki farkı hesaplar.
      const profitData = db.prepare(`
        WITH AveragePurchaseCosts AS (
          SELECT 
            item_id, 
            SUM(quantity * unit_price) / NULLIF(SUM(quantity), 0) as avg_cost
          FROM transaction_items ti
          JOIN transactions t ON ti.transaction_id = t.id
          WHERE t.transaction_type = 'purchase' AND t.is_cancelled = 0
          GROUP BY item_id
        )
        SELECT 
          ti.item_name,
          SUM(ti.quantity) as total_qty,
          SUM(ti.quantity * ti.unit_price) as total_revenue,
          SUM(ti.quantity * COALESCE(apc.avg_cost, 0)) as total_cost
        FROM transaction_items ti
        JOIN transactions t ON ti.transaction_id = t.id
        LEFT JOIN AveragePurchaseCosts apc ON ti.item_id = apc.item_id
        WHERE t.transaction_type = 'sale' AND t.is_cancelled = 0 
        AND date(t.transaction_date) BETWEEN ? AND ?
        GROUP BY ti.item_name
        ORDER BY (SUM(ti.quantity * ti.unit_price) - SUM(ti.quantity * COALESCE(apc.avg_cost, 0))) DESC
        LIMIT 10
      `).all(...params);

      return {
        summary,
        payments,
        kdvTrend,
        profitData
      };
    } catch (err) {
      console.error('Report stats error:', err);
      throw err;
    }
  });

  ipcMain.handle('api:reports:getInventoryValue', async () => {
    try {
      const db = getDb();
      // Envanter değerini "Ortalama Alış Fiyatı * Mevcut Stok" üzerinden hesaplar
      const result = db.prepare(`
        WITH AverageCosts AS (
          SELECT 
            item_id, 
            SUM(quantity * unit_price) / NULLIF(SUM(quantity), 0) as avg_cost
          FROM transaction_items ti
          JOIN transactions t ON ti.transaction_id = t.id
          WHERE t.transaction_type = 'purchase' AND t.is_cancelled = 0
          GROUP BY item_id
        )
        SELECT 
          SUM(i.stock_quantity * COALESCE(ac.avg_cost, i.unit_price)) as total_value
        FROM items i
        LEFT JOIN AverageCosts ac ON i.id = ac.item_id
      `).get();
      return result.total_value || 0;
    } catch (err) {
      console.error('Inventory valuation error:', err);
      throw err;
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
