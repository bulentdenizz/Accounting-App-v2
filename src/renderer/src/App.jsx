import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

// Sayfalarımızı İçeri Aktarıyoruz
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Inventory from './pages/Inventory';
import Transactions from './pages/Transactions';
import DueList from './pages/DueList';
import Settings from './pages/Settings';
import StockMovements from './pages/StockMovements';
import Reports from './pages/Reports';

// Route guard: Redirects to Login if user is not authenticated
function ProtectedRoute({ children }) {
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

        {/* Protected App Area */}
        <Route 
           path="/" 
           element={
             <ProtectedRoute>
               <Layout />
             </ProtectedRoute>
           }
        >
          {/* İç Sayfalarımız (Layout içindeki Outlet alanında görünecekler) */}
          <Route index element={<Dashboard />} /> {/* Ana sayfa (Panel) */}
          <Route path="musteriler" element={<Customers />} /> {/* Müşteriler sayfası */}
          <Route path="tedarikciler" element={<Suppliers />} /> {/* Tedarikçiler sayfası */}
          <Route path="envanter" element={<Inventory />} /> {/* Stok sayfası */}
          <Route path="stok-hareketleri" element={<StockMovements />} />
          <Route path="islemler" element={<Transactions />} /> {/* İşlemler sayfası */}
          <Route path="vadeler" element={<DueList />} />
          <Route path="raporlar" element={<Reports />} />
          <Route path="ayarlar" element={<Settings />} />
        </Route>

      </Routes>
    </HashRouter>
  );
}

// Tüm uygulamayı AuthProvider ile sarmalıyoruz ki her bileşen `user` verisine ulaşabilsin
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}