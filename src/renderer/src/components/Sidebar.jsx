import { useState } from 'react';
import { Menu, X, Users, LayoutDashboard, LogOut, Sun, Moon, Package, Globe } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function Sidebar() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 
  const { user, logout } = useAuth(); 
  const { isDarkMode, toggleTheme } = useTheme();
  
  // Çeviri kullanımı
  const { t, i18n } = useTranslation();
  
  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'tr' ? 'en' : 'tr');
  };

  const menuItems = [
    { adres: '/', etiket: t('sidebar_dashboard'), ikon: <LayoutDashboard size={20} /> },
    { adres: '/musteriler', etiket: t('sidebar_customers'), ikon: <Users size={20} /> },
    { adres: '/tedarikciler', etiket: t('sidebar_suppliers'), ikon: <Package size={20} /> },
    { adres: '/envanter', etiket: t('sidebar_inventory'), ikon: <Package size={20} /> }
  ];

  return (
    <aside className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
      
      <div className={`p-6 flex items-center justify-between ${!isSidebarOpen && 'justify-center'}`}>
        {isSidebarOpen && (
          <h1 className="text-xl font-black text-blue-600 dark:text-blue-500 tracking-tighter italic whitespace-nowrap">
            {t('app_name_accounting')}<span className="text-slate-900 dark:text-slate-100 font-light">{t('app_name_pro')}</span>
          </h1>
        )}
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400">
          {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

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

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
         
         <div className="flex gap-2">
           <button 
             onClick={toggleTheme} 
             title={t('sidebar_dark_mode')}
             className="flex-1 flex justify-center items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors duration-200 text-sm font-medium"
           >
             <div className="transition-transform duration-200 hover:scale-110">
               {isDarkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-slate-600 dark:text-slate-400" />}
             </div>
             {isSidebarOpen && (isDarkMode ? t('sidebar_light_mode') : t('sidebar_dark_mode'))}
           </button>
           
           {!isSidebarOpen && (
             <button 
               onClick={toggleLanguage} 
               title="TR/EN"
               className="p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors duration-200 flex justify-center text-slate-600 dark:text-slate-400"
             >
               <Globe size={20} />
             </button>
           )}
         </div>

         {isSidebarOpen && (
           <button 
             onClick={toggleLanguage} 
             className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors duration-200 text-sm font-medium"
           >
             <span className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                <Globe size={20} />
                Language
             </span>
             <span className="text-xs font-bold px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md">
               {i18n.language.toUpperCase()}
             </span>
           </button>
         )}

         {isSidebarOpen && (
            <div className="mt-4 mb-3 px-2 flex justify-between items-center">
                <div>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{user.role}</p>
                   <p className="text-sm text-slate-800 dark:text-slate-200 font-bold capitalize">{user.name}</p>
                </div>
            </div>
         )}
         
        <button 
           onClick={logout} 
           className="group w-full flex items-center gap-3 p-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-colors duration-200 text-sm font-medium"
        >
          <div className="transition-transform duration-200 group-hover:scale-110">
             <LogOut size={20} />
          </div>
          {isSidebarOpen && t('sidebar_logout')}
        </button>
      </div>
    </aside>
  );
}
