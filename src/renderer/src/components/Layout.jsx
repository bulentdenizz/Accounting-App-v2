import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    // Ana çatı: Ekranı tamamen kaplayan kapsayıcı
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-300">
      
      {/* Sol Menü: Her zaman sol tarafta sabit kalacak */}
      <Sidebar />

      {/* Orta Alan: Değişecek sayfaların yükleneceği yer */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        <Outlet /> 
        {/* <Outlet /> özelliği React-Router'a aittir. URL değiştikçe değişen sayfalar buraya yerleşir. */}
      </main>

    </div>
  );
}
