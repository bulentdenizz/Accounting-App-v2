import { useState } from 'react';
import { Menu, X, Users, LayoutDashboard, LogOut } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Sidebar() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Sol menü açık/kapalı durumu
  const { user, logout } = useAuth(); // Kullanıcı bilgilerini ve çıkış fonksiyonunu alıyoruz

  // Menüde görünecek bağlantılar
  const menuItems = [
    { adres: '/', etiket: 'Panel', ikon: <LayoutDashboard size={20} /> },
    { adres: '/musteriler', etiket: 'Müşteriler', ikon: <Users size={20} /> }
  ];

  return (
    <aside className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
      
      {/* Üst Kısım: Logo ve Menü Aç/Kapat Butonu */}
      <div className={`p-6 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
        {isSidebarOpen && (
          <h1 className="text-xl font-black text-blue-600 dark:text-blue-500 tracking-tighter italic whitespace-nowrap">
            ACCOUNTING<span className="text-slate-900 dark:text-slate-100 font-light">PRO</span>
          </h1>
        )}
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400">
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Orta Kısım: Sayfa Yönlendirmeleri (Linkler) */}
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {menuItems.map((item) => (
          <NavLink
            key={item.adres}
            to={item.adres}
            className={({ isActive }) => `
              w-full flex items-center p-3 rounded-xl transition-all 
              ${isActive ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}
              ${!isSidebarOpen && 'justify-center'}
            `}
          >
            {item.ikon}
            {isSidebarOpen && <span className="ml-3 font-medium text-sm whitespace-nowrap">{item.etiket}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Alt Kısım: Giriş Yapan Kişi Bilgisi ve Çıkış */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
         {isSidebarOpen && (
            <div className="mb-3 px-2">
                <p className="text-xs text-slate-400 font-bold uppercase">{user.rol}</p>
                <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{user.ad}</p>
            </div>
         )}
        <button 
           onClick={logout} 
           className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/30 transition-colors text-sm font-medium"
        >
          <LogOut size={20} />
          {isSidebarOpen && 'Çıkış Yap'}
        </button>
      </div>

    </aside>
  );
}
