import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export default function StatementModal({ entity, onClose }) {
  const [statement, setStatement] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!entity?.id) return;
    window.api.transactions.getStatementByEntity(entity.id)
      .then(setStatement)
      .catch((err) => {
        console.error(err);
        setError('Ekstre verisi alinamadi.');
      });
  }, [entity]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">Hareket Ekstresi</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{entity?.title}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        {error && <p className="p-6 text-red-500">{error}</p>}
        {!error && !statement && <p className="p-6 text-slate-400">Yukleniyor...</p>}

        {statement && (
          <div className="p-6 space-y-4">
            <div className="text-sm">
              <span className="text-slate-500">Guncel Bakiye: </span>
              <span className="font-mono font-bold">{Number(statement.entity.balance || 0).toFixed(2)} ₺</span>
            </div>
            <div className="max-h-96 overflow-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Tarih</th>
                    <th className="px-4 py-3">Tur</th>
                    <th className="px-4 py-3 text-right">Tutar</th>
                    <th className="px-4 py-3">Not</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {statement.movements.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-3 text-xs">{new Date(m.transaction_date).toLocaleString('tr-TR')}</td>
                      <td className="px-4 py-3 text-xs">{m.transaction_type}</td>
                      <td className="px-4 py-3 text-right text-sm font-mono">{Number(m.amount).toFixed(2)} ₺</td>
                      <td className="px-4 py-3 text-xs">{m.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
