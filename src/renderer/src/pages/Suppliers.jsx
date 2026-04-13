import { useState, useEffect } from 'react';
import { Plus, X, Phone, AlignLeft, Search, Pencil, Trash2 } from 'lucide-react';

export default function Suppliers() {
  const [tedarikciler, setTedarikciler] = useState([]);
  const [modalAcik, setModalAcik] = useState(false);
  const [aramaMetni, setAramaMetni] = useState("");
  const [hataMesaji, setHataMesaji] = useState("");
  
  // Eğer edit moddaysak bu state'e ID kaydederiz
  const [duzenlenecekId, setDuzenlenecekId] = useState(null);

  // Yeni/Düzenlenecek kayıt (Kayıt type her zaman Supplier)
  const bosForm = { title: '', phone: '', type: 'Supplier', address: '' };
  const [kayitFormu, setKayitFormu] = useState(bosForm);

  const verileriGetir = async () => {
    try {
      const dbVerileri = await window.api.customers.getAll();
      // Yalnızca Supplier tipindeki kayıtları filtrele
      setTedarikciler(dbVerileri.filter(item => item.type === 'Supplier'));
    } catch (err) {
      console.error("Veriler çekilemedi:", err);
    }
  };

  useEffect(() => {
    verileriGetir();
  }, []);

  const telefonFormatla = (value) => {
    const numbers = value.replace(/[^\d]/g, '');
    let formatted = '';
    if (numbers.length > 0) formatted += numbers.substring(0, 1);
    if (numbers.length > 1) formatted += ' ' + numbers.substring(1, 4);
    if (numbers.length > 4) formatted += ' ' + numbers.substring(4, 7);
    if (numbers.length > 7) formatted += ' ' + numbers.substring(7, 11);
    return formatted;
  };

  const formKaydiYap = async (e) => {
    e.preventDefault(); 
    setHataMesaji("");

    if(!kayitFormu.title.trim()) {
      setHataMesaji("Lütfen bir İsim/Unvan giriniz.");
      return;
    }
    
    // Telefon Validasyonu
    const telRegex = /^0 5\d{2} \d{3} \d{4}$/;
    if (!telRegex.test(kayitFormu.phone)) {
       setHataMesaji("Lütfen geçerli bir telefon numarası girin: Örn: 0 555 555 5555");
       return;
    }

    try {
      if (duzenlenecekId) {
         await window.api.customers.update({ ...kayitFormu, id: duzenlenecekId });
      } else {
         await window.api.customers.create(kayitFormu);
      }
      
      setModalAcik(false);
      setKayitFormu(bosForm);
      setDuzenlenecekId(null);
      verileriGetir(); 
    } catch (err) {
      console.error("İşlem başarısız:", err);
      setHataMesaji("Kayıt işlemi sırasında bir hata oluştu.");
    }
  };

  const kayitSil = async (id, title) => {
    if(window.confirm(`"${title}" isimli tedarikçiyi silmek istediğinizden emin misiniz?`)) {
      try {
         await window.api.customers.delete(id);
         verileriGetir();
      } catch(e) {
         alert("Silinirken hata oluştu!");
      }
    }
  };

  const duzenlemeYenilikYap = (tedarikci) => {
    setDuzenlenecekId(tedarikci.id);
    setKayitFormu({ title: tedarikci.title, phone: tedarikci.phone, type: 'Supplier', address: tedarikci.address || '' });
    setModalAcik(true);
  };

  const modalAc = () => {
    setDuzenlenecekId(null);
    setKayitFormu(bosForm);
    setHataMesaji("");
    setModalAcik(true);
  };

  const filtrelenmisTedarikciler = tedarikciler.filter(m => 
    m.title.toLowerCase().includes(aramaMetni.toLowerCase()) || 
    (m.phone && m.phone.includes(aramaMetni))
  );

  return (
    <div className="h-full flex flex-col relative">
      <header className="mb-6 flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Tedarikçiler
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700">
              Toplam {tedarikciler.length}Kayıt
            </span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Sizin ödeme yaptığınız kişileri / Kurumları yönetin.</p>
        </div>
        
        <button 
           onClick={modalAc}
           className="group flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 px-5 py-3 font-semibold rounded-xl transition-all duration-200 shadow-sm"
        >
           <div className="transition-transform duration-200 group-hover:scale-110">
             <Plus size={20} />
           </div>
           Yeni Tedarikçi Ekle
        </button>
      </header>

      <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
             <Search size={18} className="text-slate-400" />
          </div>
          <input 
             type="text" 
             placeholder="Tedarikçiler içinde ara..." 
             className="w-full bg-white dark:bg-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm"
             value={aramaMetni}
             onChange={(e) => setAramaMetni(e.target.value)}
          />
      </div>
      
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
             <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-bold">Unvan / İsim</th>
                    <th className="px-6 py-4 font-bold">İletişim</th>
                    <th className="px-6 py-4 font-bold text-right">Bakiye</th>
                    <th className="px-6 py-4 font-bold text-center">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {filtrelenmisTedarikciler.length === 0 && (
                     <tr><td colSpan="4" className="p-12 text-center text-slate-400 italic">Tedarikçi bulunamadı.</td></tr>
                  )}

                  {filtrelenmisTedarikciler.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors group">
                      
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {m.title}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                         {m.phone ? <><Phone size={14} /> {m.phone}</> : '-'}
                      </td>
                      
                      <td className="px-6 py-4 text-right">
                         <span className="font-mono font-bold text-red-600 dark:text-red-400 text-sm">
                            0,00 ₺
                         </span>
                      </td>

                      <td className="px-6 py-4 text-center">
                         <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => duzenlemeYenilikYap(m)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors" title="Düzenle">
                               <Pencil size={18} />
                            </button>
                            <button onClick={() => kayitSil(m.id, m.title)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors" title="Sil">
                               <Trash2 size={18} />
                            </button>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
      </div>

      {modalAcik && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
               
               <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                     {duzenlenecekId ? 'Tedarikçiyi Düzenle' : '+ Yeni Tedarikçi'}
                  </h3>
                  <button onClick={() => setModalAcik(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                     <X size={20} />
                  </button>
               </div>

               <form onSubmit={formKaydiYap} className="p-6 space-y-5">
                  {hataMesaji && (
                    <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-lg text-xs text-center border border-red-100 dark:border-red-900/50">
                       {hataMesaji}
                    </div>
                  )}

                  <div className="space-y-1.5">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Ad / Soyad / Unvan</label>
                     <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                           <AlignLeft size={16} className="text-slate-400" />
                        </div>
                        <input autoFocus required
                           className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                           value={kayitFormu.title} onChange={e => setKayitFormu({...kayitFormu, title: e.target.value})} />
                     </div>
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Telefon Numarası</label>
                     <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                           <Phone size={16} className="text-slate-400" />
                        </div>
                        <input 
                           placeholder="0 555 555 5555"
                           className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                           value={kayitFormu.phone} 
                           onChange={e => setKayitFormu({...kayitFormu, phone: telefonFormatla(e.target.value) })} />
                     </div>
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Kısa Açıklama / Adres</label>
                     <textarea rows="2"
                        className="w-full bg-slate-50 dark:bg-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none font-medium"
                        value={kayitFormu.address} onChange={e => setKayitFormu({...kayitFormu, address: e.target.value})} />
                  </div>

                  <div className="pt-2">
                     <button type="submit"
                        className="w-full py-3.5 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] transition-all active:scale-[0.98]">
                        {duzenlenecekId ? 'Güncelle' : 'Kaydet'}
                     </button>
                  </div>

               </form>
           </div>
        </div>
      )}
    </div>
  );
}
