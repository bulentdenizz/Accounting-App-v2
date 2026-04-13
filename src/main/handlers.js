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
  // KULLANICI GİRİŞ (AUTH) SERVİSLERİ
  // ==================
  ipcMain.handle('api:auth:login', async (event, { isim }) => {
    try {
      const db = getDb();
      // Gerçek bir sistemde şifre de kontrol edilir
      const user = db.prepare("SELECT id, isim, rol FROM users WHERE isim = ? COLLATE NOCASE").get(isim);
      
      // Bulunduysa objeyi dön, yoksa null
      return user || null;
    } catch (err) {
       console.error("Kullanıcı girişi hatası:", err);
       throw err;
    }
  });
}
