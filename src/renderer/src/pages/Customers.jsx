export default function Customers() {
  return (
    <div>
      <header className="mb-10 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Müşteriler</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Müşteri ve Cari hesap yönetimi.</p>
        </div>
        <button className="bg-blue-600 px-5 py-2.5 text-white font-bold rounded-xl">
           Yeni Müşteri
        </button>
      </header>
      
      {/* Boş Kart İskeleti */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
         <p className="text-slate-400 text-center italic">Faz 2 ve Faz 3 ile veritabanına bağlanacak (Şu an tasarım iskeleti).</p>
      </div>
    </div>
  );
}
