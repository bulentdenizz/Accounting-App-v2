import { createContext, useState, useContext } from 'react';

// Bu Context (Küresel Durum), sisteme giriş yapan kişinin bilgilerini her yerden okuyabilmemizi sağlar.
const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Aktif kullanıcı bilgisini tutan State. null ise kimse giriş yapmamış demektir.
  const [user, setUser] = useState(null);

  // Giriş Yapma Fonksiyonu (Artık veritabanını sorgular)
  const login = async (kullaniciAdi) => {
    try {
      // IPC köprüsünden SQLite veritabanına istek atılır (Yarın burası fetch('api.com/login') olabilir)
      const dbUser = await window.api.auth.login({ isim: kullaniciAdi });
      
      if (dbUser) {
        setUser({ ad: dbUser.isim, rol: dbUser.rol });
        return { basarili: true };
      } else {
        return { basarili: false, mesaj: "Kullanıcı bulunamadı!" };
      }
    } catch (err) {
      console.error(err);
      return { basarili: false, mesaj: "Sistem hatası!" };
    }
  };

  // Çıkış Yapma Fonksiyonu
  const logout = () => {
    setUser(null);
  };

  // Diğer bileşenlere (componentlere) dağıtılacak değerler
  const degiskenler = { user, login, logout };

  return (
    <AuthContext.Provider value={degiskenler}>
      {children}
    </AuthContext.Provider>
  );
}

// Kolay kullanım için kendi özel React kancamız (Custom Hook)
// Kullanımı: const { user, logout } = useAuth();
export const useAuth = () => useContext(AuthContext);
