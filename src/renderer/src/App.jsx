import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Sayfalarımızı İçeri Aktarıyoruz
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';

// Route Koruyucu: Eğer giriş yapılmadıysa kişiyi zorla Login Ekranına atar
function KorumaliAlan({ children }) {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/giris" replace />; 
  }
  return children;
}

// Ana Uygulama İçeriği
function MainApp() {
  const { user } = useAuth();

  return (
    <HashRouter>
      <Routes>
        
        {/* Giriş Ekranı (Login) Rotası */}
        {/* Eğer kişi giriş yapmışsa, tekrar login ekranına dönmesini engelliyoruz */}
        <Route 
          path="/giris" 
          element={user ? <Navigate to="/" replace /> : <Login />} 
        />

        {/* Uygulamanın İç Kısmı (Sadece giriş yapanlar görebilir) */}
        <Route 
           path="/" 
           element={
             <KorumaliAlan>
               <Layout />
             </KorumaliAlan>
           }
        >
          {/* İç Sayfalarımız (Layout içindeki Outlet alanında görünecekler) */}
          <Route index element={<Dashboard />} /> {/* Ana sayfa (Panel) */}
          <Route path="musteriler" element={<Customers />} /> {/* Müşteriler sayfası */}
        </Route>

      </Routes>
    </HashRouter>
  );
}

// Tüm uygulamayı AuthProvider ile sarmalıyoruz ki her bileşen `user` verisine ulaşabilsin
export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}