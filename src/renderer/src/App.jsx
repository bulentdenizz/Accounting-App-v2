import { useEffect, useState } from 'react';

function App() {
  const [customers, setCustomers] = useState([]); // 'entities' yerine 'customers'
  const [newCustomer, setNewCustomer] = useState({ title: '', phone: '', type: 'Customer' });

  const fetchCustomers = async () => {
    try {
      const data = await window.api.getEntities(); // Veritabanı fonksiyonumuz aynı kalıyor
      setCustomers(data);
    } catch (err) {
      console.error("Yükleme hatası:", err);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!newCustomer.title) return alert("Lütfen müşteri adını/ünvanını girin!");

    await window.api.createEntity(newCustomer);
    setNewCustomer({ title: '', phone: '', type: 'Customer' });
    fetchCustomers();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
      <div className="max-w-5xl mx-auto text-center mb-10">
        <h1 className="text-4xl font-extrabold text-blue-500 tracking-tight">Accounting Pro</h1>
        <p className="text-slate-400 mt-2 italic text-sm">Müşteri ve Finans Yönetimi</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">

        {/* SOL TARAF: YENİ KAYIT FORMU */}
        <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 h-fit">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
            <h2 className="text-xl font-bold text-white">Yeni Kayıt Oluştur</h2>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Müşteri / Firma Adı</label>
              <input
                type="text"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-700"
                value={newCustomer.title}
                onChange={(e) => setNewCustomer({ ...newCustomer, title: e.target.value })}
                placeholder="Örn: Bülent Yazılım"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">İletişim Numarası</label>
              <input
                type="text"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-700"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                placeholder="05..."
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Kayıt Tipi</label>
              <select
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                value={newCustomer.type}
                onChange={(e) => setNewCustomer({ ...newCustomer, type: e.target.value })}
              >
                <option value="Customer">Müşteri (Satış Yapılan)</option>
                <option value="Supplier">Tedarikçi (Mal Alınan)</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl mt-2 shadow-lg shadow-blue-900/20 transition-all active:scale-95"
            >
              Sisteme Kaydet
            </button>
          </form>
        </div>

        {/* SAĞ TARAF: LİSTELEME */}
        <div className="lg:col-span-2 bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-100">Kayıtlı Müşteriler</h2>
            <span className="bg-slate-900 text-blue-400 text-xs px-3 py-1 rounded-full border border-slate-700">
              Toplam: {customers.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-700/30 text-slate-500 text-[10px] uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-6 py-4">Ünvan / İsim</th>
                  <th className="px-6 py-4">Kategori</th>
                  <th className="px-6 py-4">İletişim</th>
                  <th className="px-6 py-4 text-right">Durum (Bakiye)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-16 text-center text-slate-600 italic">
                      Henüz kayıtlı bir müşteri veya tedarikçi bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  customers.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-700/20 transition-colors group">
                      <td className="px-6 py-5 font-bold text-slate-200 group-hover:text-blue-400 transition-colors">
                        {item.title}
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter border ${item.type === 'Customer'
                            ? 'bg-emerald-900/20 text-emerald-400 border-emerald-800/50'
                            : 'bg-amber-900/20 text-amber-400 border-amber-800/50'
                          }`}>
                          {item.type === 'Customer' ? 'MÜŞTERİ' : 'TEDARİKÇİ'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-slate-400 text-sm font-medium">{item.phone || 'Girilmedi'}</td>
                      <td className="px-6 py-5 text-right font-mono text-emerald-500 font-bold">
                        0,00 ₺
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;