import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Menu, X, Stethoscope, ChevronDown, User, LayoutDashboard, LogOut, ShieldCheck } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-mc-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group" data-testid="navbar-logo">
            <div className="w-9 h-9 bg-mc-primary rounded-xl flex items-center justify-center transition-transform group-hover:scale-105">
              <Stethoscope size={20} className="text-white" strokeWidth={1.5} />
            </div>
            <span className="font-heading font-700 text-xl text-mc-text">Medi<span className="text-mc-primary">Consult</span></span>
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
          </div>

          {/* Auth / User */}
          <div className="hidden md:flex items-center gap-3">
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
          {user ? (
            <>
              {user.role === 'admin' && (
                <Link to="/admin" onClick={() => setMobileOpen(false)} className="block py-2.5 text-sm font-body text-mc-primary font-medium">CRM Dashboard</Link>
              )}
              <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="block py-2.5 text-sm font-body text-mc-text">My Appointments</Link>
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
