export default function Dashboard() {
  return (
    <div>
      <header className="mb-10">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Panel</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Özet raporlarınız yakında eklenecek.</p>
      </header>
      
      {/* Boş Kart */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
         <p className="text-slate-400 text-center italic">Faz 4'te buraya grafikler ve özetler gelecek.</p>
      </div>
    </div>
  );
}
