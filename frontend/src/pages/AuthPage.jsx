import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Stethoscope, Eye, EyeOff, ArrowRight, ChevronDown } from 'lucide-react';

// Major country dialing codes with flag emojis
const COUNTRY_CODES = [
  { code: '+91',  country: 'IN', flag: '🇮🇳', name: 'India' },
  { code: '+1',   country: 'US', flag: '🇺🇸', name: 'United States' },
  { code: '+44',  country: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+49',  country: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: '+33',  country: 'FR', flag: '🇫🇷', name: 'France' },
  { code: '+971', country: 'AE', flag: '🇦🇪', name: 'UAE' },
  { code: '+61',  country: 'AU', flag: '🇦🇺', name: 'Australia' },
  { code: '+1',   country: 'CA', flag: '🇨🇦', name: 'Canada' },
  { code: '+65',  country: 'SG', flag: '🇸🇬', name: 'Singapore' },
  { code: '+64',  country: 'NZ', flag: '🇳🇿', name: 'New Zealand' },
  { code: '+81',  country: 'JP', flag: '🇯🇵', name: 'Japan' },
  { code: '+82',  country: 'KR', flag: '🇰🇷', name: 'South Korea' },
  { code: '+60',  country: 'MY', flag: '🇲🇾', name: 'Malaysia' },
  { code: '+92',  country: 'PK', flag: '🇵🇰', name: 'Pakistan' },
  { code: '+880', country: 'BD', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+94',  country: 'LK', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+966', country: 'SA', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+974', country: 'QA', flag: '🇶🇦', name: 'Qatar' },
  { code: '+973', country: 'BH', flag: '🇧🇭', name: 'Bahrain' },
  { code: '+968', country: 'OM', flag: '🇴🇲', name: 'Oman' },
  { code: '+27',  country: 'ZA', flag: '🇿🇦', name: 'South Africa' },
  { code: '+234', country: 'NG', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+20',  country: 'EG', flag: '🇪🇬', name: 'Egypt' },
  { code: '+55',  country: 'BR', flag: '🇧🇷', name: 'Brazil' },
  { code: '+52',  country: 'MX', flag: '🇲🇽', name: 'Mexico' },
  { code: '+86',  country: 'CN', flag: '🇨🇳', name: 'China' },
  { code: '+1868',country: 'TT', flag: '🌐', name: 'Other' },
];

const AuthPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  const [mode, setMode] = useState(location.pathname === '/register' ? 'register' : 'login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phoneCode, setPhoneCode] = useState('+91');
  const [showCodeDropdown, setShowCodeDropdown] = useState(false);
  const [codeSearch, setCodeSearch] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });

  const handleChange = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    setError('');
  };

  const selectedCountry = COUNTRY_CODES.find(c => c.code === phoneCode) || COUNTRY_CODES[0];

  const filteredCodes = COUNTRY_CODES.filter(c =>
    c.name.toLowerCase().includes(codeSearch.toLowerCase()) ||
    c.code.includes(codeSearch)
  );

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
        const fullPhone = form.phone ? `${phoneCode} ${form.phone}` : '';
        await register(form.name, form.email, form.password, fullPhone);
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
                <div className="flex gap-2">
                  {/* Country code picker */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => { setShowCodeDropdown(d => !d); setCodeSearch(''); }}
                      className="h-full flex items-center gap-1.5 px-3 border border-mc-border rounded-xl bg-mc-bg text-mc-text text-sm font-body whitespace-nowrap hover:border-mc-secondary transition-colors"
                      data-testid="phone-country-code-btn"
                    >
                      <span>{selectedCountry.flag}</span>
                      <span className="font-medium">{phoneCode}</span>
                      <ChevronDown size={13} className={`text-mc-text-secondary transition-transform ${showCodeDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showCodeDropdown && (
                      <div className="absolute left-0 top-full mt-1 z-50 w-64 bg-white border border-mc-border rounded-xl shadow-xl overflow-hidden animate-fade-in">
                        <div className="p-2 border-b border-mc-border">
                          <input
                            type="text"
                            placeholder="Search country..."
                            value={codeSearch}
                            onChange={e => setCodeSearch(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-mc-border rounded-lg font-body focus:outline-none focus:border-mc-secondary"
                            autoFocus
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {filteredCodes.map((c, i) => (
                            <button
                              key={`${c.country}-${i}`}
                              type="button"
                              onClick={() => { setPhoneCode(c.code); setShowCodeDropdown(false); }}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-body hover:bg-mc-bg transition-colors text-left ${phoneCode === c.code && selectedCountry.country === c.country ? 'bg-mc-primary/10 text-mc-primary font-medium' : 'text-mc-text'}`}
                            >
                              <span className="text-base">{c.flag}</span>
                              <span className="flex-1 truncate">{c.name}</span>
                              <span className="text-mc-text-secondary text-xs font-mono">{c.code}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Phone number input */}
                  <input
                    type="tel" name="phone" value={form.phone} onChange={handleChange}
                    placeholder="98765 43210"
                    className="flex-1 min-w-0 px-4 py-3 border border-mc-border rounded-xl text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary focus:ring-2 focus:ring-mc-secondary/20 transition-all"
                    data-testid="phone-input"
                  />
                </div>
                <p className="text-[11px] text-mc-text-secondary mt-1 font-body">
                  Saved as: {phoneCode} {form.phone || 'XXXXXXXXXX'}
                </p>
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
