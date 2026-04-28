import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { Stethoscope, Loader2 } from 'lucide-react';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { setAuthFromToken } = useAuth();
  const [error, setError] = useState('');
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = window.location.hash || '';
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      setError('Missing session id');
      setTimeout(() => navigate('/login'), 1500);
      return;
    }
    const sessionId = decodeURIComponent(match[1]);

    (async () => {
      try {
        const res = await api.post('/auth/google', { session_id: sessionId });
        setAuthFromToken(res.data.token, res.data.user);
        // Clean hash and navigate to the main app
        window.history.replaceState(null, '', window.location.pathname);
        const target = res.data.user?.role === 'admin' ? '/admin' : '/dashboard';
        navigate(target, { replace: true });
      } catch (e) {
        setError(e.response?.data?.detail || 'Google sign-in failed');
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      }
    })();
  }, [navigate, setAuthFromToken]);

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4">
      <div className="bg-mc-surface border border-mc-border rounded-2xl shadow-sm p-10 text-center max-w-md w-full" data-testid="auth-callback">
        <div className="w-14 h-14 bg-mc-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Stethoscope size={28} className="text-white" strokeWidth={1.5} />
        </div>
        {error ? (
          <>
            <h2 className="font-heading text-xl text-mc-text font-600 mb-2">Sign-in failed</h2>
            <p className="text-sm text-mc-text-secondary font-body">{error}</p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 text-mc-text">
              <Loader2 className="animate-spin" size={20} />
              <span className="font-body text-sm">Signing you in with Google…</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
