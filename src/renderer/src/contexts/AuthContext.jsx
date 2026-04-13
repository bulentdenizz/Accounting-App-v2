import { createContext, useState, useContext } from 'react';

// Bu Context (Küresel Durum), sisteme giriş yapan kişinin bilgilerini her yerden okuyabilmemizi sağlar.
const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Aktif kullanıcı bilgisini tutan State. null ise kimse giriş yapmamış demektir.
  const [user, setUser] = useState(null);

  // Giriş Yapma Fonksiyonu
  const login = (kullaniciAdi, rol) => {
    setUser({
      ad: kullaniciAdi,
      rol: rol // 'yonetici' veya 'isci'
    });
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
