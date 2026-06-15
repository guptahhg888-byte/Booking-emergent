import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { Menu, X, Stethoscope, ChevronDown, User, LayoutDashboard, LogOut, ShieldCheck, UserCog, Globe, FileText } from 'lucide-react';
import { POLICY_LINKS } from '../content/siteContent';

const DIAL_TO_COUNTRY = {
  '+91': 'IN', '+44': 'GB', '+49': 'DE', '+33': 'FR', '+971': 'AE',
  '+61': 'AU', '+65': 'SG', '+64': 'NZ', '+81': 'JP', '+82': 'KR',
  '+60': 'MY', '+92': 'PK', '+880': 'BD', '+94': 'LK', '+966': 'SA',
  '+974': 'QA', '+1': 'US' // Defaults to US for +1
};

const Navbar = () => {
  const { user, logout } = useAuth();
  const { countryCode, config, switchCountry, COUNTRY_CONFIG } = useCurrency();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const currencyRef = useRef(null);
  const policiesRef = useRef(null);

  // Close currency dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (currencyRef.current && !currencyRef.current.contains(e.target)) {
        setCurrencyOpen(false);
      }
      if (policiesRef.current && !policiesRef.current.contains(e.target)) {
        setPoliciesOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync user's phone number country code to the currency
  const syncedUserId = useRef(null);
  useEffect(() => {
    if (user && user._id !== syncedUserId.current && user.phone) {
      syncedUserId.current = user._id;
      
      const sortedCodes = Object.keys(DIAL_TO_COUNTRY).sort((a, b) => b.length - a.length);
      for (const code of sortedCodes) {
        if (user.phone.startsWith(code)) {
          const matchedCountry = DIAL_TO_COUNTRY[code];
          if (matchedCountry && COUNTRY_CONFIG[matchedCountry]) {
            switchCountry(matchedCountry);
          }
          break;
        }
      }
    }
    if (!user) {
      syncedUserId.current = null;
    }
  }, [user, switchCountry, COUNTRY_CONFIG]);

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;
  const isPoliciesActive = location.pathname.startsWith('/policies');

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-mc-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group" data-testid="navbar-logo">
            <div className="w-9 h-9 bg-mc-primary rounded-xl flex items-center justify-center transition-transform group-hover:scale-105">
              <Stethoscope size={20} className="text-white" strokeWidth={1.5} />
            </div>
            <span className="font-heading font-700 text-xl text-mc-text">Dr. Madhumati<span className="text-mc-primary">Singh</span></span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className={`font-body text-sm font-medium transition-colors ${isActive('/') ? 'text-mc-primary' : 'text-mc-text-secondary hover:text-mc-text'}`}
              data-testid="nav-home"
            >Home</Link>
            <Link
              to="/doctors"
              className={`font-body text-sm font-medium transition-colors ${isActive('/doctors') ? 'text-mc-primary' : 'text-mc-text-secondary hover:text-mc-text'}`}
              data-testid="nav-doctors"
            >Find Doctors</Link>
            <Link
              to="/workshops"
              className={`font-body text-sm font-medium transition-colors ${isActive('/workshops') ? 'text-mc-primary' : 'text-mc-text-secondary hover:text-mc-text'}`}
              data-testid="nav-workshops"
            >Workshops</Link>
            <Link
              to="/about"
              className={`font-body text-sm font-medium transition-colors ${isActive('/about') ? 'text-mc-primary' : 'text-mc-text-secondary hover:text-mc-text'}`}
              data-testid="nav-about"
            >About</Link>
            <div className="relative" ref={policiesRef}>
              <button
                type="button"
                onClick={() => setPoliciesOpen((o) => !o)}
                className={`flex items-center gap-1 font-body text-sm font-medium transition-colors ${isPoliciesActive ? 'text-mc-primary' : 'text-mc-text-secondary hover:text-mc-text'}`}
                data-testid="nav-policies"
              >
                Policies
                <ChevronDown size={14} className={`transition-transform ${policiesOpen ? 'rotate-180' : ''}`} />
              </button>
              {policiesOpen && (
                <div className="absolute left-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-mc-border overflow-hidden animate-fade-in z-50">
                  <div className="px-3 py-2 border-b border-mc-border flex items-center gap-2">
                    <FileText size={14} className="text-mc-primary" />
                    <p className="text-[11px] text-mc-text-secondary font-body">Legal & policies</p>
                  </div>
                  {POLICY_LINKS.map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setPoliciesOpen(false)}
                      className={`block px-4 py-2.5 text-sm font-body hover:bg-mc-bg transition-colors ${
                        location.pathname === link.path ? 'text-mc-primary font-medium bg-mc-primary/5' : 'text-mc-text'
                      }`}
                      data-testid={`nav-policy-${link.path.split('/').pop()}`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Auth / User */}
          <div className="hidden md:flex items-center gap-3">
            {/* Country/Currency Indicator — read-only for regular users, dropdown only for admin */}
            <div className="relative" ref={currencyRef}>
              {user?.role === 'admin' ? (
                <>
                  <button
                    onClick={() => setCurrencyOpen(o => !o)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-mc-border bg-mc-surface hover:border-mc-secondary transition-all text-sm font-body text-mc-text"
                    data-testid="currency-switcher-btn"
                  >
                    <span className="text-base leading-none">{config.flag}</span>
                    <span className="font-medium text-xs">{config.currency}</span>
                    <ChevronDown size={12} className={`text-mc-text-secondary transition-transform ${currencyOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {currencyOpen && (
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-mc-border overflow-hidden animate-fade-in z-50">
                      <div className="px-3 py-2 border-b border-mc-border">
                        <p className="text-[11px] text-mc-text-secondary font-body">Switch country (Admin)</p>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {Object.entries(COUNTRY_CONFIG).map(([code, cfg]) => (
                          <button
                            key={code}
                            onClick={() => { switchCountry(code); setCurrencyOpen(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-body hover:bg-mc-bg transition-colors text-left ${
                              countryCode === code ? 'bg-mc-primary/10 text-mc-primary font-semibold' : 'text-mc-text'
                            }`}
                            data-testid={`currency-option-${code}`}
                          >
                            <span className="text-base">{cfg.flag}</span>
                            <span className="flex-1">{cfg.name}</span>
                            <span className="text-xs text-mc-text-secondary font-mono">{cfg.currency}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-mc-border bg-mc-surface text-sm font-body text-mc-text cursor-default opacity-80"
                  title="Country auto-detected"
                  data-testid="currency-indicator"
                >
                  <span className="text-base leading-none">{config.flag}</span>
                  <span className="font-medium text-xs">{config.currency}</span>
                </div>
              )}
            </div>

            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-mc-border hover:border-mc-secondary bg-mc-surface transition-all text-sm font-body text-mc-text"
                  data-testid="user-menu-button"
                >
                  <div className="w-7 h-7 bg-mc-primary rounded-full flex items-center justify-center text-white text-xs font-medium">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="max-w-[120px] truncate">{user.name}</span>
                  <ChevronDown size={14} className={`transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-mc-border overflow-hidden animate-fade-in">
                    <div className="px-4 py-3 border-b border-mc-border">
                      <p className="text-xs text-mc-text-secondary font-body">{user.email}</p>
                      <p className="text-xs font-medium text-mc-primary capitalize">{user.role}</p>
                    </div>
                    {user.role === 'admin' && (
                      <Link
                        to="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-mc-text hover:bg-mc-bg transition-colors font-body"
                        data-testid="nav-admin-dashboard"
                      >
                        <ShieldCheck size={15} className="text-mc-primary" />
                        CRM Dashboard
                      </Link>
                    )}
                    <Link
                      to="/dashboard"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-mc-text hover:bg-mc-bg transition-colors font-body"
                      data-testid="nav-user-dashboard"
                    >
                      <LayoutDashboard size={15} className="text-mc-secondary" />
                      My Appointments
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-mc-text hover:bg-mc-bg transition-colors font-body"
                      data-testid="nav-profile"
                    >
                      <UserCog size={15} className="text-mc-secondary" />
                      My Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-body border-t border-mc-border"
                      data-testid="logout-button"
                    >
                      <LogOut size={15} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login" className="btn-secondary text-sm px-5 py-2" data-testid="nav-login">Login</Link>
                <Link to="/register" className="btn-primary text-sm px-5 py-2" data-testid="nav-register">Register</Link>
              </>
            )}
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-mc-bg transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="mobile-menu-toggle"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-mc-border px-4 pb-4 pt-2 space-y-2 animate-fade-in">
          <Link to="/" onClick={() => setMobileOpen(false)} className="block py-2.5 text-sm font-body text-mc-text">Home</Link>
          <Link to="/doctors" onClick={() => setMobileOpen(false)} className="block py-2.5 text-sm font-body text-mc-text">Find Doctors</Link>
          <Link to="/about" onClick={() => setMobileOpen(false)} className="block py-2.5 text-sm font-body text-mc-text">About</Link>
          <Link to="/workshops" onClick={() => setMobileOpen(false)} className="block py-2.5 text-sm font-body text-mc-text">Workshops</Link>
          <p className="pt-2 pb-1 text-xs uppercase tracking-wider text-mc-text-secondary font-body">Policies</p>
          {POLICY_LINKS.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMobileOpen(false)}
              className="block py-2 pl-3 text-sm font-body text-mc-text-secondary"
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <>
              {user.role === 'admin' && (
                <Link to="/admin" onClick={() => setMobileOpen(false)} className="block py-2.5 text-sm font-body text-mc-primary font-medium">CRM Dashboard</Link>
              )}
              <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="block py-2.5 text-sm font-body text-mc-text">My Appointments</Link>
              <Link to="/profile" onClick={() => setMobileOpen(false)} className="block py-2.5 text-sm font-body text-mc-text">My Profile</Link>
              <button onClick={() => { handleLogout(); setMobileOpen(false); }} className="block py-2.5 text-sm text-red-600 font-body">Logout</button>
            </>
          ) : (
            <div className="flex gap-3 pt-2">
              <Link to="/login" onClick={() => setMobileOpen(false)} className="btn-secondary text-sm flex-1 text-center">Login</Link>
              <Link to="/register" onClick={() => setMobileOpen(false)} className="btn-primary text-sm flex-1 text-center">Register</Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;

