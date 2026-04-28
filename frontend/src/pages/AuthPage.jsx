import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Stethoscope, Eye, EyeOff, ArrowRight } from 'lucide-react';

const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  const [mode, setMode] = useState(location.pathname === '/register' ? 'register' : 'login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/auth/callback';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleChange = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        const data = await login(form.email, form.password);
        navigate(data.user?.role === 'admin' ? '/admin' : '/dashboard');
      } else {
        if (!form.name.trim()) { setError('Name is required'); setLoading(false); return; }
        await register(form.name, form.email, form.password, form.phone);
        navigate('/doctors');
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) setError(detail.map(d => d.msg).join(' '));
      else setError(detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-mc-bg flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-mc-surface border border-mc-border rounded-2xl shadow-sm overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="bg-mc-primary p-8 text-center">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Stethoscope size={28} className="text-white" strokeWidth={1.5} />
            </div>
            <h1 className="font-heading text-2xl text-white font-600">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-white/70 text-sm mt-1 font-body">
              {mode === 'login' ? 'Sign in to your MediConsult account' : 'Join MediConsult today'}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-mc-border">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-3.5 text-sm font-medium font-body transition-colors ${mode === 'login' ? 'text-mc-primary border-b-2 border-mc-primary bg-white' : 'text-mc-text-secondary hover:text-mc-text bg-mc-bg'}`}
              data-testid="login-tab"
            >Login</button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-3.5 text-sm font-medium font-body transition-colors ${mode === 'register' ? 'text-mc-primary border-b-2 border-mc-primary bg-white' : 'text-mc-text-secondary hover:text-mc-text bg-mc-bg'}`}
              data-testid="register-tab"
            >Register</button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-4">
            {/* Google Sign-in */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white border border-mc-border text-mc-text font-medium rounded-xl py-3 text-sm font-body hover:bg-mc-bg hover:border-mc-secondary transition-all hover:-translate-y-0.5"
              data-testid="google-login-button"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.614z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-mc-border"></div>
              <span className="text-xs text-mc-text-secondary font-body">or {mode === 'login' ? 'sign in' : 'register'} with email</span>
              <div className="flex-1 h-px bg-mc-border"></div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 font-body" data-testid="auth-error">
                {error}
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-mc-text mb-1.5 font-body">Full Name *</label>
                <input
                  type="text" name="name" value={form.name} onChange={handleChange}
                  placeholder="Dr. John Doe" required
                  className="w-full px-4 py-3 border border-mc-border rounded-xl text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary focus:ring-2 focus:ring-mc-secondary/20 transition-all"
                  data-testid="register-name-input"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-mc-text mb-1.5 font-body">Email Address *</label>
              <input
                type="email" name="email" value={form.email} onChange={handleChange}
                placeholder="you@example.com" required
                className="w-full px-4 py-3 border border-mc-border rounded-xl text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary focus:ring-2 focus:ring-mc-secondary/20 transition-all"
                data-testid="email-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-mc-text mb-1.5 font-body">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} name="password" value={form.password}
                  onChange={handleChange} placeholder="••••••••" required minLength={6}
                  className="w-full px-4 py-3 pr-12 border border-mc-border rounded-xl text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary focus:ring-2 focus:ring-mc-secondary/20 transition-all"
                  data-testid="password-input"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mc-text-secondary hover:text-mc-text transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-mc-text mb-1.5 font-body">Phone Number</label>
                <input
                  type="tel" name="phone" value={form.phone} onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="w-full px-4 py-3 border border-mc-border rounded-xl text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary focus:ring-2 focus:ring-mc-secondary/20 transition-all"
                  data-testid="phone-input"
                />
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-mc-primary text-white font-medium rounded-xl py-3.5 text-sm font-body hover:bg-mc-primary-hover transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              data-testid="auth-submit-button"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>{mode === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight size={16} /></>
              )}
            </button>

            {mode === 'login' && (
              <p className="text-center text-sm text-mc-text-secondary font-body">
                Don't have an account?{' '}
                <button type="button" onClick={() => setMode('register')} className="text-mc-primary font-medium hover:underline">
                  Register now
                </button>
              </p>
            )}
            {mode === 'register' && (
              <p className="text-center text-sm text-mc-text-secondary font-body">
                Already have an account?{' '}
                <button type="button" onClick={() => setMode('login')} className="text-mc-primary font-medium hover:underline">
                  Sign in
                </button>
              </p>
            )}
          </form>
        </div>

        <p className="text-center text-xs text-mc-text-secondary mt-6 font-body">
          Admin? <Link to="/login" className="text-mc-primary hover:underline">Login here</Link>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
