import { useState } from 'react';
import { Menu, X, Users, LayoutDashboard, LogOut, Sun, Moon, Package } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function Sidebar() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Sol menü açık/kapalı durumu
  const { user, logout } = useAuth(); // Kullanıcı bilgilerini ve çıkış fonksiyonunu alıyoruz
  const { isDarkMode, toggleTheme } = useTheme(); // Tema bilgilerini aldığımız Context
  
  // Menüde görünecek bağlantılar
  const menuItems = [
    { adres: '/', etiket: 'Panel', ikon: <LayoutDashboard size={20} /> },
    { adres: '/musteriler', etiket: 'Müşteriler', ikon: <Users size={20} /> },
    { adres: '/tedarikciler', etiket: 'Tedarikçiler', ikon: <Package size={20} /> }
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
              group w-full flex items-center px-3 py-2.5 rounded-xl transition-all duration-200
              ${isActive 
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 font-semibold' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 hover:text-blue-600 dark:hover:bg-slate-800/50 dark:hover:text-blue-400 font-medium'}
              ${!isSidebarOpen && 'justify-center'}
            `}
          >
            <div className="shrink-0 transition-transform duration-200 group-hover:scale-110">
              {item.ikon}
            </div>
            {isSidebarOpen && <span className="ml-3 text-sm whitespace-nowrap flex-1 text-left">{item.etiket}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Alt Kısım: Tema, Giriş Yapan Kişi Bilgisi ve Çıkış */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
         
         {/* Tema Değiştirme Butonu */}
         <button 
           onClick={toggleTheme} 
           className="group w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors duration-200 text-sm font-medium"
         >
           <div className="transition-transform duration-200 group-hover:scale-110">
             {isDarkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-slate-600 dark:text-slate-400" />}
           </div>
           {isSidebarOpen && (isDarkMode ? 'Gündüz Modu' : 'Gece Modu')}
         </button>

         {/* Kullanıcı Profili */}
         {isSidebarOpen && (
            <div className="mt-4 mb-3 px-2">
                <p className="text-xs text-slate-400 font-bold uppercase">{user.rol}</p>
                <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{user.ad}</p>
            </div>
         )}
         
         {/* Çıkış Butonu */}
        <button 
           onClick={logout} 
           className="group w-full flex items-center gap-3 p-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-colors duration-200 text-sm font-medium"
        >
          <div className="transition-transform duration-200 group-hover:scale-110">
             <LogOut size={20} />
          </div>
          {isSidebarOpen && 'Çıkış Yap'}
        </button>
      </div>

    </aside>
  );
}
