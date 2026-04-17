import { useState, useEffect } from 'react';
import { Save, Store, MapPin, Phone, Download, UploadCloud, RefreshCw } from 'lucide-react';

export default function Settings() {
  const [settings, setSettings] = useState({
    store_name: '',
    store_address: '',
    store_phone: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    window.api.settings.getAll()
      .then(data => {
        setSettings(prev => ({ ...prev, ...data }));
      })
      .catch(err => console.error("Settings load error:", err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');
    try {
      const res = await window.api.settings.update(settings);
      if (res.success) {
        setMessage('Ayarlar başarıyla kaydedildi.');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      console.error(err);
      setMessage('Ayarlar kaydedilirken hata oluştu!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackup = async () => {
    try {
      const res = await window.api.system.createBackup();
      if (res.success) {
        alert("Yedek başarıyla alındı:\n" + res.path);
      }
    } catch (err) {
      console.error(err);
      alert("Yedek alınırken hata oluştu.");
    }
  };

  const handleRestore = async () => {
    if (!window.confirm("DİKKAT: Mevcut verilerinizin üzerine yazılacak ve uygulama yeniden başlatılacaktır.\n\nEmin misiniz?")) return;
    try {
      const res = await window.api.system.restoreBackup();
      if (res && res.success === false && res.msg === 'İptal edildi') return;
      // If success, the app restarts immediately.
    } catch (err) {
      console.error(err);
      alert("Geri yükleme hatası:\n" + err.message);
    }
  };

  const handleReconcile = async () => {
    if (!window.confirm("Tüm cari bakiyeler ve stok miktarları, işlem geçmişinden yeniden hesaplanacaktır.\n\nDevam etmek istiyor musunuz?")) return;
    try {
      const res = await window.api.system.reconcileLedger();
      if (res.success) {
        let msg = res.message;
        if (res.details && res.details.length > 0) {
          msg += '\n\nDüzeltmeler:\n' + res.details.map(d => 
            d.type === 'balance' 
              ? `• ${d.entity}: ${d.was} → ${d.corrected} (fark: ${d.drift})` 
              : `• ${d.item}: ${d.was} → ${d.corrected} (fark: ${d.drift})`
          ).join('\n');
        }
        alert(msg);
      }
    } catch (err) {
      console.error(err);
      alert("Mutabakat hatası:\n" + err.message);
    }
  };

  return (
    <div className="h-full flex flex-col relative space-y-6 max-w-3xl mx-auto w-full">
      <header className="mb-2 fin-panel p-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            İşletme Ayarları
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Fatura basımı ve işletme bilgilerinizi buradan yönetebilirsiniz.
          </p>
        </div>
      </header>

      <div className="fin-panel p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {message && (
            <div className={`p-4 rounded-xl text-sm font-bold border ${message.includes('hata') ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
              {message}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">DÜKKAN/FİRMA ADI (Zorunlu)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Store size={16} className="text-slate-400" />
                </div>
                <input 
                  type="text" 
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                  value={settings.store_name || ''} 
                  onChange={e => setSettings({...settings, store_name: e.target.value})} 
                  placeholder="Firmaya ait resmi ad"
                />
              </div>
              <p className="text-xs text-slate-400 pl-1">Bu alan PDF (Makbuz/Fatura) oluşturulurken zorunludur.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">FİRMA ADRESİ</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-top pt-3.5 pointer-events-none">
                  <MapPin size={16} className="text-slate-400" />
                </div>
                <textarea 
                  rows="3"
                  className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium resize-none"
                  value={settings.store_address || ''} 
                  onChange={e => setSettings({...settings, store_address: e.target.value})} 
                  placeholder="İşletmenin açık adresi"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">TELEFON NUMARASI</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone size={16} className="text-slate-400" />
                </div>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                  value={settings.store_phone || ''} 
                  onChange={e => setSettings({...settings, store_phone: e.target.value})} 
                  placeholder="Örn: 0555 555 55 55"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button 
              type="submit" 
              disabled={isSaving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] disabled:opacity-50"
            >
              <Save size={18} />
              {isSaving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
            </button>
          </div>
        </form>
      </div>

      <div className="fin-panel p-6 mt-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Veritabanı Yönetimi</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Sisteminizi güvende tutmak için düzenli aralıklarla yedek alın. Geri yükleme işlemi yapıldığında mevcut veriler silinir ve uygulama yeniden başlatılır.
        </p>
        
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={handleBackup}
            type="button"
            className="flex items-center gap-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 px-5 py-3 rounded-xl font-bold transition-colors"
          >
            <Download size={18} />
            Yedek Al (Backup)
          </button>
          
          <button 
            onClick={handleRestore}
            type="button"
            className="flex items-center gap-2 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20 px-5 py-3 rounded-xl font-bold transition-colors"
          >
            <UploadCloud size={18} />
            Yedekten Dön (Restore)
          </button>
        </div>
      </div>

      <div className="fin-panel p-6 mt-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Veri Mutabakatı (Reconciliation)</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Tüm müşteri/tedarikçi bakiyelerini ve stok miktarlarını işlem geçmişinden yeniden hesaplar. Herhangi bir sapma tespit edilirse otomatik düzeltir.
        </p>
        <button 
          onClick={handleReconcile}
          type="button"
          className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 px-5 py-3 rounded-xl font-bold transition-colors"
        >
          <RefreshCw size={18} />
          Bakiyeleri Yeniden Hesapla
        </button>
      </div>
    </div>
  );
}
