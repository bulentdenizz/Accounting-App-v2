const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'com.bulent.ledger', 'accounting_app_v5.db');

// Backup the DB first
fs.copyFileSync(dbPath, dbPath + '.backup_' + Date.now());

const db = new Database(dbPath);

console.log('Veritabanına bağlanıldı:', dbPath);

db.transaction(() => {
  // Option to clear first? Let's clear to avoid duplication mess.
  db.prepare('DELETE FROM payment_allocations').run();
  db.prepare('DELETE FROM transaction_items').run();
  db.prepare('DELETE FROM stock_movements').run();
  db.prepare('DELETE FROM transactions').run();
  db.prepare('DELETE FROM items').run();
  db.prepare('DELETE FROM entities').run();
  db.prepare('DELETE FROM invoice_sequences').run();
  db.prepare('DELETE FROM sqlite_sequence').run();

  db.prepare("INSERT INTO invoice_sequences (type, prefix, last_number, year) VALUES ('sale', 'SAT', 0, 2026), ('purchase', 'ALI', 0, 2026)").run();

  console.log('Eski veriler temizlendi.');

  const customers = [
    { title: 'Ahmet Yılmaz', type: 'Customer', phone: '05551112233' },
    { title: 'Mehmet Kaya', type: 'Customer', phone: '05551112234' },
    { title: 'Ayşe Demir', type: 'Customer', phone: '05551112235' },
    { title: 'Canan Çelik', type: 'Customer', phone: '05551112236' },
  ];
  const suppliers = [
    { title: 'Anadolu Yem Sanayi', type: 'Supplier', phone: '05550001122' },
    { title: 'Bereket Lojistik', type: 'Supplier', phone: '05550001123' },
  ];

  const insertEntity = db.prepare("INSERT INTO entities (title, type, phone, balance, created_at) VALUES (?, ?, ?, 0, ?)");
  
  const customerIds = [];
  const supplierIds = [];

  const now = new Date();

  // Create Entities
  for (let c of customers) {
    const res = insertEntity.run(c.title, c.type, c.phone, new Date(now.getTime() - 31 * 24 * 3600 * 1000).toISOString());
    customerIds.push(res.lastInsertRowid);
  }
  for (let s of suppliers) {
    const res = insertEntity.run(s.title, s.type, s.phone, new Date(now.getTime() - 31 * 24 * 3600 * 1000).toISOString());
    supplierIds.push(res.lastInsertRowid);
  }
  
  const items = [
    { name: 'Sığır Süt Yemi 50kg', unit: 'Adet', unit_price: 450.0 },
    { name: 'Besi Yemi 50kg', unit: 'Adet', unit_price: 420.0 },
    { name: 'Kuzu Büyütme 50kg', unit: 'Adet', unit_price: 480.0 },
    { name: 'Yonca Balyası', unit: 'Adet', unit_price: 150.0 },
    { name: 'Kaya Tuzu 10kg', unit: 'Adet', unit_price: 75.0 },
  ];

  const insertItem = db.prepare("INSERT INTO items (name, unit, unit_price, tax_rate, stock_quantity) VALUES (?, ?, ?, 1, 0)");
  const itemIds = [];
  for (let i of items) {
    const res = insertItem.run(i.name, i.unit, i.unit_price);
    itemIds.push(res.lastInsertRowid);
  }

  console.log('Temel veriler (müsteri, tedarikci, urunler) eklendi.');

  const insertTx = db.prepare(`
    INSERT INTO transactions (entity_id, transaction_type, amount, amount_excl_tax, tax_amount, invoice_number, transaction_date, due_date, description, status, remaining_amount, is_cancelled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  const insertTxItem = db.prepare(`
    INSERT INTO transaction_items (transaction_id, item_id, item_name, quantity, unit_price, tax_rate, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertStockMovement = db.prepare(`
    INSERT INTO stock_movements (transaction_id, item_id, movement_type, quantity_change, balance_after, unit_price, created_at, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateStock = db.prepare("UPDATE items SET stock_quantity = stock_quantity + ? WHERE id = ?");
  const updateBalance = db.prepare("UPDATE entities SET balance = balance + ? WHERE id = ?");

  const getSeq = db.prepare("SELECT prefix, last_number FROM invoice_sequences WHERE type = ?");
  const updateSeq = db.prepare("UPDATE invoice_sequences SET last_number = ? WHERE type = ?");

  function getInvNumber(type) {
    if (type !== 'sale' && type !== 'purchase') return null;
    const seq = getSeq.get(type);
    const next = seq.last_number + 1;
    updateSeq.run(next, type);
    return `${seq.prefix}-2026-${String(next).padStart(4, '0')}`;
  }

  // Generate 30 days of transactions
  for (let i = 30; i >= 0; i--) {
    const txDate = new Date(now.getTime() - i * 24 * 3600 * 1000);
    const dateStr = txDate.toISOString();
    
    // Alış yapalım ki stok dolsun (her 5 günde bir)
    if (i % 5 === 0) {
      const sid = supplierIds[Math.floor(Math.random() * supplierIds.length)];
      const invNum = getInvNumber('purchase');
      let amount = 0;
      let taxAmount = 0;
      const tLines = [];
      
      for (let j = 0; j < 3; j++) {
        const itemObj = items[j];
        const item_id = itemIds[j];
        const qty = 50 + Math.floor(Math.random() * 50);
        const stotal = qty * itemObj.unit_price * 1.01; 
        const tax = stotal - (qty * itemObj.unit_price);
        amount += stotal;
        taxAmount += tax;
        tLines.push({ item_id, name: itemObj.name, qty, price: itemObj.unit_price, stotal });
      }

      const txRes = insertTx.run(sid, 'purchase', amount, amount - taxAmount, taxAmount, invNum, dateStr, null, 'Toptan Alış', 'open', amount);
      const txId = txRes.lastInsertRowid;
      
      updateBalance.run(amount, sid);
      
      for (let line of tLines) {
        insertTxItem.run(txId, line.item_id, line.name, line.qty, line.price, 1, line.stotal);
        updateStock.run(line.qty, line.item_id);
        const newStock = db.prepare("SELECT stock_quantity FROM items WHERE id = ?").get(line.item_id).stock_quantity;
        insertStockMovement.run(txId, line.item_id, 'purchase_in', line.qty, newStock, line.price, dateStr, 'Toptan Alış');
      }

      // Ve ödeme yapalım
      const payAmount = amount * 0.5; // Yarısını nakit ödedik
      insertTx.run(sid, 'payment_out', payAmount, 0, 0, null, dateStr, null, 'Nakit Ödeme', 'closed', 0);
      updateBalance.run(-payAmount, sid);
      // Kısmi ödeme yapıldığından transaction durumunu güncelleyelim
      db.prepare("UPDATE transactions SET remaining_amount = remaining_amount - ?, status = 'partial' WHERE id = ?").run(payAmount, txId);
    }

    // Satış yapalım (Günde 1-3 adet)
    const dailySales = 1 + Math.floor(Math.random() * 3);
    for (let c = 0; c < dailySales; c++) {
      const cid = customerIds[Math.floor(Math.random() * customerIds.length)];
      const invNum = getInvNumber('sale');
      
      let amount = 0;
      let taxAmount = 0;
      const tLines = [];
      const itemIdx = Math.floor(Math.random() * items.length);
      const itemObj = items[itemIdx];
      const item_id = itemIds[itemIdx];
      
      // Check stock
      const stock = db.prepare("SELECT stock_quantity FROM items WHERE id = ?").get(item_id).stock_quantity;
      let qty = 1 + Math.floor(Math.random() * 10);
      if (qty > stock) qty = stock; // Yetersiz stoğa düşmesin
      if (qty <= 0) continue;

      const stotal = qty * itemObj.unit_price * 1.01;
      const tax = stotal - (qty * itemObj.unit_price);
      amount += stotal;
      taxAmount += tax;
      
      const txRes = insertTx.run(cid, 'sale', amount, amount - taxAmount, taxAmount, invNum, dateStr, null, 'Perakende Satış', 'open', amount);
      const txId = txRes.lastInsertRowid;

      updateBalance.run(amount, cid);

      insertTxItem.run(txId, item_id, itemObj.name, qty, itemObj.unit_price, 1, stotal);
      updateStock.run(-qty, item_id);
      const newStock = db.prepare("SELECT stock_quantity FROM items WHERE id = ?").get(item_id).stock_quantity;
      insertStockMovement.run(txId, item_id, 'sale_out', -qty, newStock, itemObj.unit_price, dateStr, 'Satış');

      // %80 ihtimalle peşin tahsilat yapalım
      if (Math.random() > 0.2) {
        insertTx.run(cid, 'payment_in', amount, 0, 0, null, dateStr, null, 'Peşin Tahsilat', 'closed', 0);
        updateBalance.run(-amount, cid);
        db.prepare("UPDATE transactions SET remaining_amount = 0, status = 'closed' WHERE id = ?").run(txId);
      }
    }
  }

  console.log('30 günlük rastgele test satışları ve alışları başarıyla tamamlandı.');
})();
