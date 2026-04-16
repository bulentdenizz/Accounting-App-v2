import { useEffect, useMemo, useState } from 'react';

export default function DueList() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    window.api.transactions.getDueList()
      .then(setRows)
      .catch((err) => console.error('Due list error:', err));
  }, []);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const classify = (dueDate) => {
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diff = Math.floor((due - today) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 'Gecikmis';
    if (diff <= 7) return 'Yaklasan';
    return 'Ileri Tarih';
  };

  return (
    <div className="space-y-6">
      <header className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Vade Merkezi</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Acik satis ve alim belgelerinin vade listesi.</p>
      </header>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-bold">Belge</th>
                <th className="px-6 py-4 font-bold">Tur</th>
                <th className="px-6 py-4 font-bold">Musteri/Tedarikci</th>
                <th className="px-6 py-4 font-bold">Vade</th>
                <th className="px-6 py-4 font-bold text-right">Kalan</th>
                <th className="px-6 py-4 font-bold">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-6 py-4 text-sm font-mono">#{r.id}</td>
                  <td className="px-6 py-4 text-sm">{r.transaction_type === 'sale' ? 'Satis' : 'Alim'}</td>
                  <td className="px-6 py-4 text-sm font-semibold">{r.entity_name}</td>
                  <td className="px-6 py-4 text-sm">{new Date(r.due_date).toLocaleDateString('tr-TR')}</td>
                  <td className="px-6 py-4 text-right text-sm font-mono">{Number(r.remaining_amount || r.amount).toFixed(2)} ₺</td>
                  <td className="px-6 py-4 text-xs font-bold">{classify(r.due_date)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan="6" className="p-10 text-center text-slate-400 italic">Acik vade kaydi bulunmuyor.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
