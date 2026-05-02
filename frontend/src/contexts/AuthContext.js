import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Skip /auth/me check if we're processing an OAuth callback; AuthCallback will set auth.
    if (typeof window !== 'undefined' && window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    const token = localStorage.getItem('mediconsult_token');
    if (token) {
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => localStorage.removeItem('mediconsult_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password, captcha_token, captcha_answer) => {
    const res = await api.post('/auth/login', { email, password, captcha_token, captcha_answer });
    localStorage.setItem('mediconsult_token', res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (name, email, password, phone, captcha_token, captcha_answer) => {
    const res = await api.post('/auth/register', { name, email, password, phone, captcha_token, captcha_answer });
    localStorage.setItem('mediconsult_token', res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const setAuthFromToken = (token, userObj) => {
    localStorage.setItem('mediconsult_token', token);
    setUser(userObj);
  };

  const logout = () => {
    localStorage.removeItem('mediconsult_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setAuthFromToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
