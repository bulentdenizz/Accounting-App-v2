import { createContext, useState, useEffect, useContext } from 'react';

// Temayı tutacağımız global bağlam (Context)
const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Varsayılan olarak gece modunu (dark) açıyoruz.
  const [isDarkMode, setIsDarkMode] = useState(true);

  // isDarkMode değiştiğinde, HTML sayfasına 'dark' kelimesini ekleyip çıkarıyoruz
  // TailwindCSS bu sayede gece gündüz renklerini (dark:bg-slate-900 vb.) algılar.
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Tema Değiştirme Fonksiyonu
  const toggleTheme = () => {
    setIsDarkMode((oncekiDurum) => !oncekiDurum);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Diğer componentlerde temayı kolayca kullanmak için kancamız
export const useTheme = () => useContext(ThemeContext);
