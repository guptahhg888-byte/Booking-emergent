import React, { useState } from 'react';
import { User, Mail, Phone, MapPin, Save, CheckCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const ProfilePage = () => {
  const { user, setAuthFromToken } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    setSaved(false);
    setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await api.patch('/auth/profile', form);
      // Keep existing token, just refresh user object in context
      const token = localStorage.getItem('mediconsult_token');
      setAuthFromToken(token, {
        id: res.data._id,
        email: res.data.email,
        name: res.data.name,
        role: res.data.role,
        phone: res.data.phone,
        address: res.data.address,
      });
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-mc-bg py-10 px-4" data-testid="profile-page">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-mc-primary rounded-full flex items-center justify-center text-white font-heading font-600 text-xl">
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="font-heading text-2xl text-mc-text font-700">My Profile</h1>
            <p className="text-mc-text-secondary text-sm font-body">Manage your personal details</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="bg-mc-surface border border-mc-border rounded-2xl p-6 lg:p-8 space-y-5">
          {saved && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 font-body" data-testid="profile-saved">
              <CheckCircle size={16} /> Profile updated successfully
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 font-body" data-testid="profile-error">
              {error}
            </div>
          )}

          {/* Email (locked) */}
          <div>
            <label className="block text-sm font-medium text-mc-text mb-1.5 font-body flex items-center gap-2">
              <Mail size={15} className="text-mc-text-secondary" /> Email Address
              <span className="inline-flex items-center gap-1 ml-auto text-xs text-mc-text-secondary font-body">
                <ShieldCheck size={12} /> Locked
              </span>
            </label>
            <input
              type="email" value={user.email} disabled
              className="w-full px-4 py-3 border border-mc-border rounded-xl text-mc-text-secondary text-sm font-body bg-mc-bg cursor-not-allowed"
              data-testid="profile-email-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-mc-text mb-1.5 font-body flex items-center gap-2">
              <User size={15} className="text-mc-text-secondary" /> Full Name
            </label>
            <input
              type="text" name="name" value={form.name} onChange={handleChange} required
              className="w-full px-4 py-3 border border-mc-border rounded-xl text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary focus:ring-2 focus:ring-mc-secondary/20 transition-all"
              data-testid="profile-name-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-mc-text mb-1.5 font-body flex items-center gap-2">
              <Phone size={15} className="text-mc-text-secondary" /> Phone Number
            </label>
            <input
              type="tel" name="phone" value={form.phone} onChange={handleChange}
              placeholder="+91 98765 43210"
              className="w-full px-4 py-3 border border-mc-border rounded-xl text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary focus:ring-2 focus:ring-mc-secondary/20 transition-all"
              data-testid="profile-phone-input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-mc-text mb-1.5 font-body flex items-center gap-2">
              <MapPin size={15} className="text-mc-text-secondary" /> Address
            </label>
            <textarea
              name="address" value={form.address} onChange={handleChange} rows={3}
              placeholder="Street, City, State, PIN"
              className="w-full px-4 py-3 border border-mc-border rounded-xl text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary focus:ring-2 focus:ring-mc-secondary/20 transition-all resize-none"
              data-testid="profile-address-input"
            />
          </div>

          <button
            type="submit" disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-mc-primary text-white font-medium rounded-xl py-3.5 text-sm font-body hover:bg-mc-primary-hover transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
            data-testid="profile-save-button"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Save size={16} /> Save Changes</>
            )}
          </button>
        </form>

        {user.role === 'user' && (
          <p className="text-center text-xs text-mc-text-secondary mt-6 font-body">
            Need to change your email? Contact support — email is used as your account identifier.
          </p>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
