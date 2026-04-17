import { useState } from 'react';
import { Menu, X, Users, LayoutDashboard, LogOut, Package, Banknote, CalendarClock, ChevronRight, Settings as SettingsIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

export default function Sidebar() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 
  const { logout } = useAuth(); 
  const { t } = useTranslation();
  
  const menuItems = [
    { adres: '/', etiket: t('sidebar_dashboard'), ikon: <LayoutDashboard size={20} /> },
    { adres: '/musteriler', etiket: t('sidebar_customers'), ikon: <Users size={20} /> },
    { adres: '/tedarikciler', etiket: t('sidebar_suppliers'), ikon: <Package size={20} /> },
    { adres: '/envanter', etiket: t('sidebar_inventory'), ikon: <Package size={20} /> },
    { adres: '/islemler', etiket: t('sidebar_transactions'), ikon: <Banknote size={20} /> },
    { adres: '/vadeler', etiket: 'Vadeler', ikon: <CalendarClock size={20} /> },
    { adres: '/ayarlar', etiket: 'Ayarlar', ikon: <SettingsIcon size={20} /> }
  ];

  return (
    <aside className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 z-40 relative ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
      
      {/* Brand Logo Area */}
      <div className={`h-16 flex items-center px-6 border-b border-transparent ${!isSidebarOpen && 'justify-center px-0'}`}>
        {isSidebarOpen ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-black text-lg shadow-lg shadow-emerald-500/20">
              M
            </div>
            <h1 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight whitespace-nowrap">
              {t('app_name_accounting')}<span className="text-emerald-600 font-extrabold">{t('app_name_pro')}</span>
            </h1>
          </div>
        ) : (
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-500/20">
            M
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 mt-6">
        {menuItems.map((item) => (
          <NavLink
            key={item.adres}
            to={item.adres}
            className={({ isActive }) => `
              group flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 relative
              ${isActive 
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 font-bold' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-700 dark:hover:text-slate-200 font-medium'}
              ${!isSidebarOpen && 'justify-center'}
            `}
          >
            <div className="shrink-0 transition-transform duration-200 group-hover:scale-110">
              {item.ikon}
            </div>
            {isSidebarOpen && (
              <>
                <span className="ml-3 text-sm whitespace-nowrap flex-1">{item.etiket}</span>
                <ChevronRight className={`w-4 h-4 transition-all duration-300 opacity-0 group-hover:opacity-100 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-2'}`} />
              </>
            )}
            
            {/* Active Indicator Pin */}
            {({ isActive }) => isActive && isSidebarOpen && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-600 rounded-r-full" />
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer Area */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="w-full flex items-center gap-3 p-2.5 rounded-xl text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm font-medium"
        >
          {isSidebarOpen ? (
            <>
              <X size={18} />
              <span>{t('sidebar_collapse') || 'Menüyü Daralt'}</span>
            </>
          ) : (
            <div className="w-full flex justify-center">
              <Menu size={20} />
            </div>
          )}
        </button>

        <button 
           onClick={logout} 
           className="group w-full flex items-center gap-3 p-2.5 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-sm font-bold"
        >
          <div className="transition-transform duration-200 group-hover:translate-x-1">
             <LogOut size={18} />
          </div>
          {isSidebarOpen && t('sidebar_logout')}
        </button>
      </div>
    </aside>
  );
}

