const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'com.bulent.ledger', 'accounting_app_v5.db');
const db = new Database(dbPath);

const count = db.prepare('SELECT COUNT(*) as c FROM stock_movements').get().c;
console.log('Total stock movements:', count);

const last5 = db.prepare('SELECT * FROM stock_movements ORDER BY id DESC LIMIT 5').all();
console.log('Last 5 movements:', JSON.stringify(last5, null, 2));

const itemsCount = db.prepare('SELECT COUNT(*) as c FROM items').get().c;
console.log('Total items:', itemsCount);

db.close();
process.exit(0);
