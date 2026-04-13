import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

let db;

export function initDb() {
  if (db) return db;

  // Veritabanı dosyasının konumu (Windows'ta AppData, Mac'te Application Support içine kurulur)
  const dbPath = path.join(app.getPath('userData'), 'accounting_pro.db');
  db = new Database(dbPath);

  // 1. Kullanıcılar (Auth - Ekip Üyeleri) Tablosu
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      isim TEXT UNIQUE NOT NULL,
      rol TEXT CHECK(rol IN ('yonetici', 'isci')) NOT NULL,
      sifre TEXT -- Gerçek projede hash tutulmalıdır
    )
  `).run();

  // 2. Müşteriler ve Tedarikçiler Tablosu (Cari Hesaplar)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      tax_office TEXT,
      tax_number TEXT,
      phone TEXT,
      address TEXT,
      type TEXT CHECK(type IN ('Customer', 'Supplier')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // 3. Stok (Ürün / Hizmet) Tablosu
  db.prepare(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      isim TEXT NOT NULL,
      birim TEXT,
      birim_fiyati REAL DEFAULT 0,
      stok_miktari REAL DEFAULT 0
    )
  `).run();

  // 4. Finansal İşlemler (Faturalar, Tahsilatlar)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id INTEGER,
      islem_tipi TEXT CHECK(islem_tipi IN ('satis_faturasi', 'alis_faturasi', 'tahsilat', 'odeme')) NOT NULL,
      tutar REAL NOT NULL,
      tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
      aciklama TEXT,
      kaydi_acan_user_id INTEGER,
      FOREIGN KEY (entity_id) REFERENCES entities(id),
      FOREIGN KEY (kaydi_acan_user_id) REFERENCES users(id)
    )
  `).run();
  
  // Test için sisteme default bir yönetici (Admin) ekleyelim
  try {
    const adminCheck = db.prepare("SELECT * FROM users WHERE isim = 'Admin'").get();
    if(!adminCheck) {
       db.prepare("INSERT INTO users (isim, rol, sifre) VALUES ('Admin', 'yonetici', '123')").run();
    }
  } catch(e) {
    console.error("Test verisi eklenirken hata: ", e);
  }

  console.log("Database initialized at:", dbPath);
  return db;
}

// Güvenli Bağlantı (Getter) Fonksiyonu
export const getDb = () => db;