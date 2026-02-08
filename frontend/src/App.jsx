import React, { useState, useEffect, createContext, useContext } from 'react';
import { Toaster } from 'react-hot-toast';
import { api } from './api';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState(api.getUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (api.getToken()) {
      api.getMe()
        .then(u => { setUser(u); api.setUser(u); })
        .catch(() => { api.clearAuth(); setUser(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const data = await api.login(username, password);
    setUser(data.user);
  };

  const logout = () => { api.logout(); setUser(null); };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <Toaster position="bottom-right" toastOptions={{ duration: 3000, style: { borderRadius: '12px', padding: '12px 16px' } }} />
      {user ? <Dashboard /> : <Login />}
    </AuthContext.Provider>
  );
}
