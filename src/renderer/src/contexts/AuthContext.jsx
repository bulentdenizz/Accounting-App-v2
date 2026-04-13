import { createContext, useState, useContext } from 'react';

// Bu Context (Küresel Durum), sisteme giriş yapan kişinin bilgilerini her yerden okuyabilmemizi sağlar.
const AuthContext = createContext();

export function AuthProvider({ children }) {
  // State to hold the active user info
  const [user, setUser] = useState(null);

  // Login handler
  const login = async (username) => {
    try {
      // IPC call to SQLite wrapper
      const dbUser = await window.api.auth.login({ username });
      
      if (dbUser) {
        setUser({ name: dbUser.username, role: dbUser.role });
        return { success: true };
      } else {
        return { success: false, message: "User not found!" };
      }
    } catch (err) {
      console.error(err);
      return { success: false, message: "System error!" };
    }
  };

  const logout = () => {
    setUser(null);
  };

  const values = { user, login, logout };

  return (
    <AuthContext.Provider value={values}>
      {children}
    </AuthContext.Provider>
  );
}

// Kolay kullanım için kendi özel React kancamız (Custom Hook)
// Kullanımı: const { user, logout } = useAuth();
export const useAuth = () => useContext(AuthContext);
