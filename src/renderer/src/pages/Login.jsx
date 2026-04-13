import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login } = useAuth(); 
  
  const [username, setUsername] = useState('');
  const [errorText, setErrorText] = useState(''); 

  const handleLogin = async (e) => {
    e.preventDefault(); 
    setErrorText('');
    
    if(username.trim().length < 3) {
        setErrorText("Lütfen geçerli bir isim girin");
        return;
    }
    
    const result = await login(username); 
    if(!result.success) {
       setErrorText(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center p-4">
      {/* Giriş Kartı */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full">
        
        {/* Logo veya Başlık */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-blue-600 dark:text-blue-500 tracking-tighter italic">
            ACCOUNTING<span className="text-slate-900 dark:text-slate-100 font-light">PRO</span>
          </h1>
          <p className="text-slate-500 text-sm mt-2">Sisteme Giriş Yapın</p>
        </div>

        {/* Form Alanı */}
        <form onSubmit={handleLogin} className="space-y-5">
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase">Kullanıcı Adı</label>
            <input 
              className="w-full bg-slate-50 dark:bg-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Örn: Admin" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {errorText && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm text-center font-medium border border-red-100 dark:border-red-900/50">
               {errorText}
            </div>
          )}

          {/* Gönder Butonu */}
          <button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95"
          >
            Giriş Yap
          </button>
        </form>

      </div>
    </div>
  );
}
