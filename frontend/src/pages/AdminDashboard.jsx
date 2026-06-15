import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Users, Stethoscope, Calendar, CreditCard, Activity, Plus, Edit, Trash2,
  TrendingUp, CheckCircle, XCircle, Clock, AlertCircle, ShieldCheck, RefreshCw, CalendarClock, X as XIcon, RotateCcw, Globe
} from 'lucide-react';
import api from '../utils/api';
import { COUNTRY_CONFIG } from '../contexts/CurrencyContext';

const TABS = ['Overview', 'Doctors', 'Workshops', 'Appointments', 'Users', 'Payments'];
const PIE_COLORS = ['#2C5545', '#8A9A86', '#D9734E', '#5C6B64'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const statusBadge = (status) => {
  const map = {
    confirmed: 'bg-emerald-100 text-emerald-800',
    pending_payment: 'bg-amber-100 text-amber-800',
    completed: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
    COMPLETED: 'bg-emerald-100 text-emerald-800',
    PENDING: 'bg-amber-100 text-amber-800',
    FAILED: 'bg-red-100 text-red-800',
    paid: 'bg-emerald-100 text-emerald-800',
    pending: 'bg-amber-100 text-amber-800',
    failed: 'bg-red-100 text-red-800',
  };
  return map[status] || 'bg-mc-bg text-mc-text-secondary';
};

const EMPTY_FORM = {
  name: '', specialization: '', qualification: '', experience_years: '',
  consultation_fee: 2000, bio: '', image_url: '',
  available_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30,
  lunch_start: '13:00', lunch_end: '14:00',
  fee_45min: '', fee_60min: '',
  services: [{ id: 'svc_default', name: 'Consultation', price: 2000, duration_minutes: 30 }],
};

const EMPTY_WORKSHOP_FORM = {
  title: '',
  doctor_id: '',
  workshop_date: '',
  start_time: '18:00',
  duration_minutes: 60,
  price: 0,
  gmeet_link: '',
  capacity: '',
  description: '',
  is_active: true,
};

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('Overview');
  const [stats, setStats] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [workshops, setWorkshops] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Doctor modal
  const [showModal, setShowModal] = useState(false);
  const [editDoctor, setEditDoctor] = useState(null);
  const [docForm, setDocForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Slot management modal
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [slotDoctor, setSlotDoctor] = useState(null);
  const [slotDate, setSlotDate] = useState('');
  const [slotList, setSlotList] = useState([]);
  const [isCustomSlots, setIsCustomSlots] = useState(false);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotSaving, setSlotSaving] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('09:00');
  const [isBlockedDate, setIsBlockedDate] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  // Workshop modal
  const [showWorkshopModal, setShowWorkshopModal] = useState(false);
  const [editWorkshop, setEditWorkshop] = useState(null);
  const [workshopForm, setWorkshopForm] = useState(EMPTY_WORKSHOP_FORM);
  const [workshopSaving, setWorkshopSaving] = useState(false);
  const [workshopError, setWorkshopError] = useState('');

  const fetchStats = useCallback(() => {
    api.get('/admin/stats').then(r => setStats(r.data)).catch(console.error);
  }, []);

  const fetchDoctors = useCallback(() => {
    api.get('/doctors', { params: {} }).then(r => setDoctors(r.data)).catch(console.error);
  }, []);

  const fetchAppointments = useCallback(() => {
    api.get('/appointments').then(r => setAppointments(r.data)).catch(console.error);
  }, []);

  const fetchUsers = useCallback(() => {
    api.get('/admin/users').then(r => setUsers(r.data)).catch(console.error);
  }, []);

  const fetchTransactions = useCallback(() => {
    api.get('/admin/transactions').then(r => setTransactions(r.data)).catch(console.error);
  }, []);

  const fetchWorkshops = useCallback(() => {
    api.get('/workshops/admin/all').then(r => setWorkshops(r.data)).catch(console.error);
  }, []);

  const fetchActivity = useCallback(() => {
    api.get('/admin/activity').then(r => setActivityLogs(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    Promise.all([fetchStats(), fetchDoctors()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'Appointments' && appointments.length === 0) fetchAppointments();
    if (activeTab === 'Users' && users.length === 0) fetchUsers();
    if (activeTab === 'Payments' && transactions.length === 0) fetchTransactions();
    if (activeTab === 'Workshops' && workshops.length === 0) fetchWorkshops();
    if (activeTab === 'Overview' && activityLogs.length === 0) fetchActivity();
  }, [activeTab]);

  // Doctor CRUD
  const openAdd = () => { setEditDoctor(null); setDocForm(EMPTY_FORM); setFormError(''); setShowModal(true); };
  const openEdit = (doc) => {
    setEditDoctor(doc);
    setDocForm({
      name: doc.name, specialization: doc.specialization, qualification: doc.qualification,
      experience_years: doc.experience_years, consultation_fee: doc.consultation_fee,
      bio: doc.bio || '', image_url: doc.image_url || '', available_days: doc.available_days || [],
      start_time: doc.start_time || '09:00',
      end_time: doc.end_time || '17:00',
      slot_duration_minutes: doc.slot_duration_minutes || 30,
      lunch_start: doc.lunch_start || '',
      lunch_end: doc.lunch_end || '',
      fee_45min: doc.fee_45min != null ? doc.fee_45min : '',
      fee_60min: doc.fee_60min != null ? doc.fee_60min : '',
      services: doc.services?.length ? doc.services : [{ id: 'svc_default', name: 'Consultation', price: doc.consultation_fee || 2000, duration_minutes: doc.slot_duration_minutes || 30 }],
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSaveDoctor = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        ...docForm,
        experience_years: parseInt(docForm.experience_years),
        consultation_fee: parseFloat(docForm.consultation_fee),
        slot_duration_minutes: parseInt(docForm.slot_duration_minutes) || 30,
        lunch_start: docForm.lunch_start || null,
        lunch_end: docForm.lunch_end || null,
        fee_45min: docForm.fee_45min !== '' ? parseFloat(docForm.fee_45min) : null,
        fee_60min: docForm.fee_60min !== '' ? parseFloat(docForm.fee_60min) : null,
        services: docForm.services
          .filter(service => service.name && service.price !== '')
          .map((service, index) => ({
            id: service.id || `svc_${Date.now()}_${index}`,
            name: service.name,
            price: parseFloat(service.price),
            duration_minutes: service.duration_minutes ? parseInt(service.duration_minutes) : null,
          })),
      };
      if (editDoctor) {
        await api.put(`/doctors/${editDoctor._id}`, payload);
      } else {
        await api.post('/doctors', payload);
      }
      setShowModal(false);
      fetchDoctors();
      fetchStats();
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to save doctor');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDoctor = async (id, name) => {
    if (!window.confirm(`Delete Dr. ${name}?`)) return;
    try {
      await api.delete(`/doctors/${id}`);
      setDoctors(prev => prev.filter(d => d._id !== id));
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleUpdateAppt = async (id, status) => {
    try {
      await api.put(`/appointments/${id}`, { status });
      setAppointments(prev => prev.map(a => a._id === id ? { ...a, status } : a));
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update');
    }
  };

  const toggleDay = (day) => {
    setDocForm(prev => ({
      ...prev,
      available_days: prev.available_days.includes(day)
        ? prev.available_days.filter(d => d !== day)
        : [...prev.available_days, day]
    }));
  };

  const updateService = (index, key, value) => {
    setDocForm(prev => ({
      ...prev,
      services: prev.services.map((service, i) => i === index ? { ...service, [key]: value } : service),
    }));
  };

  const addService = () => {
    setDocForm(prev => ({
      ...prev,
      services: [...prev.services, { id: `svc_${Date.now()}`, name: '', price: '', duration_minutes: '' }],
    }));
  };

  const removeService = (index) => {
    setDocForm(prev => ({
      ...prev,
      services: prev.services.length > 1 ? prev.services.filter((_, i) => i !== index) : prev.services,
    }));
  };

  const openWorkshopAdd = () => {
    setEditWorkshop(null);
    setWorkshopForm({ ...EMPTY_WORKSHOP_FORM, doctor_id: doctors[0]?._id || '' });
    setWorkshopError('');
    setShowWorkshopModal(true);
  };

  const openWorkshopEdit = (workshop) => {
    setEditWorkshop(workshop);
    setWorkshopForm({
      title: workshop.title || '',
      doctor_id: workshop.doctor_id || '',
      workshop_date: workshop.workshop_date || '',
      start_time: workshop.start_time || '18:00',
      duration_minutes: workshop.duration_minutes || 60,
      price: workshop.price || 0,
      gmeet_link: workshop.gmeet_link || '',
      capacity: workshop.capacity || '',
      description: workshop.description || '',
      is_active: workshop.is_active !== false,
    });
    setWorkshopError('');
    setShowWorkshopModal(true);
  };

  const saveWorkshop = async (e) => {
    e.preventDefault();
    setWorkshopSaving(true);
    setWorkshopError('');
    const payload = {
      ...workshopForm,
      duration_minutes: parseInt(workshopForm.duration_minutes) || 60,
      price: parseFloat(workshopForm.price) || 0,
      capacity: workshopForm.capacity ? parseInt(workshopForm.capacity) : null,
    };
    try {
      if (editWorkshop) {
        await api.put(`/workshops/${editWorkshop._id}`, payload);
      } else {
        await api.post('/workshops', payload);
      }
      setShowWorkshopModal(false);
      fetchWorkshops();
    } catch (err) {
      setWorkshopError(err.response?.data?.detail || 'Failed to save workshop');
    } finally {
      setWorkshopSaving(false);
    }
  };

  const deleteWorkshop = async (workshop) => {
    if (!window.confirm(`Delete workshop "${workshop.title}"?`)) return;
    await api.delete(`/workshops/${workshop._id}`);
    setWorkshops(prev => prev.filter(item => item._id !== workshop._id));
  };

  // Slot management handlers
  const openSlotModal = (doc) => {
    setSlotDoctor(doc);
    setSlotDate('');
    setSlotList([]);
    setIsCustomSlots(false);
    setSlotError('');
    setNewSlotTime('09:00');
    setIsBlockedDate(false);
    setBlockReason('');
    setShowSlotModal(true);
  };

  const fetchSlotsForDate = async (doctorId, date) => {
    if (!date) return;
    setSlotLoading(true);
    setSlotError('');
    try {
      const customRes = await api.get(`/doctors/${doctorId}/slots`, { params: { date } });
      if (customRes.data.is_blocked) {
        setSlotList([]);
        setIsCustomSlots(true);
        setIsBlockedDate(true);
        setBlockReason(customRes.data.block_reason || '');
      } else if (customRes.data.is_custom && customRes.data.custom_slots) {
        setSlotList(customRes.data.custom_slots);
        setIsCustomSlots(true);
        setIsBlockedDate(false);
        setBlockReason('');
      } else {
        const availRes = await api.get(`/doctors/${doctorId}/available-slots`, { params: { date } });
        setSlotList(availRes.data.available_slots || []);
        setIsCustomSlots(false);
        setIsBlockedDate(false);
        setBlockReason('');
      }
    } catch (err) {
      setSlotError('Failed to fetch slots');
      setSlotList([]);
    } finally {
      setSlotLoading(false);
    }
  };

  const handleSlotDateChange = (e) => {
    const date = e.target.value;
    setSlotDate(date);
    if (date && slotDoctor) {
      fetchSlotsForDate(slotDoctor._id, date);
    }
  };

  const addSlot = () => {
    if (!newSlotTime) return;
    const formatted = newSlotTime.slice(0, 5);
    if (slotList.includes(formatted)) {
      setSlotError('This time slot already exists');
      return;
    }
    setSlotError('');
    setSlotList(prev => [...prev, formatted].sort());
  };

  const removeSlot = (time) => {
    setSlotList(prev => prev.filter(s => s !== time));
  };

  const saveCustomSlots = async () => {
    if (!slotDoctor || !slotDate || slotList.length === 0) {
      setSlotError('Please add at least one time slot');
      return;
    }
    setSlotSaving(true);
    setSlotError('');
    try {
      await api.post(`/doctors/${slotDoctor._id}/slots`, { date: slotDate, slots: slotList });
      setIsCustomSlots(true);
      setIsBlockedDate(false);
      setBlockReason('');
      setSlotError('');
    } catch (err) {
      setSlotError(err.response?.data?.detail || 'Failed to save slots');
    } finally {
      setSlotSaving(false);
    }
  };

  const blockDate = async () => {
    if (!slotDoctor || !slotDate) {
      setSlotError('Please select a date to block');
      return;
    }
    setSlotSaving(true);
    setSlotError('');
    try {
      await api.post(`/doctors/${slotDoctor._id}/block-date`, { date: slotDate, reason: blockReason || 'Blocked by admin' });
      setSlotList([]);
      setIsCustomSlots(true);
      setIsBlockedDate(true);
    } catch (err) {
      setSlotError(err.response?.data?.detail || 'Failed to block date');
    } finally {
      setSlotSaving(false);
    }
  };

  const resetToDefault = async () => {
    if (!slotDoctor || !slotDate) return;
    if (!window.confirm('Reset to auto-generated slots for this date?')) return;
    setSlotSaving(true);
    setSlotError('');
    try {
      await api.delete(`/doctors/${slotDoctor._id}/slots`, { params: { date: slotDate } });
      await fetchSlotsForDate(slotDoctor._id, slotDate);
      setIsBlockedDate(false);
      setBlockReason('');
    } catch (err) {
      setSlotError(err.response?.data?.detail || 'Failed to reset slots');
    } finally {
      setSlotSaving(false);
    }
  };

  const formatSlotDisplay = (hm) => {
    const [h, m] = hm.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  };

  const pieData = stats ? [
    { name: 'Confirmed', value: stats.appointment_stats?.confirmed || 0 },
    { name: 'Pending', value: stats.appointment_stats?.pending || 0 },
    { name: 'Cancelled', value: stats.appointment_stats?.cancelled || 0 },
    { name: 'Completed', value: stats.appointment_stats?.completed || 0 },
  ].filter(d => d.value > 0) : [];

  if (loading) return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-mc-bg">
      <div className="w-10 h-10 border-4 border-mc-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-64px)] bg-mc-bg" data-testid="admin-dashboard">
      {/* Header */}
      <div className="bg-mc-primary px-4 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <ShieldCheck size={22} className="text-white" />
            </div>
            <div>
              <h1 className="font-heading text-xl text-white font-700">CRM Dashboard</h1>
              <p className="text-white/60 text-xs font-body">Dr. MadhumatiSingh CRM</p>
            </div>
          </div>
          <button onClick={() => { fetchStats(); fetchDoctors(); }} className="flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm font-body" data-testid="refresh-dashboard">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-mc-border px-4 sm:px-8 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto flex overflow-x-auto scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-5 py-3.5 text-sm font-medium font-body border-b-2 transition-colors ${activeTab === tab ? 'border-mc-primary text-mc-primary' : 'border-transparent text-mc-text-secondary hover:text-mc-text'}`}
              data-testid={`admin-tab-${tab.toLowerCase()}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        {/* OVERVIEW TAB */}
        {activeTab === 'Overview' && (
          <div className="space-y-8">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Doctors', value: stats?.total_doctors ?? 0, icon: <Stethoscope size={22} />, color: 'text-mc-primary', bg: 'bg-mc-primary/10' },
                { label: 'Total Appointments', value: stats?.total_appointments ?? 0, icon: <Calendar size={22} />, color: 'text-blue-600', bg: 'bg-blue-100' },
                { label: 'Total Patients', value: stats?.total_users ?? 0, icon: <Users size={22} />, color: 'text-purple-600', bg: 'bg-purple-100' },
                { label: 'Total Revenue', value: `₹${((stats?.total_revenue ?? 0)).toLocaleString('en-IN')}`, icon: <CreditCard size={22} />, color: 'text-mc-accent', bg: 'bg-mc-accent/10' },
              ].map((s, i) => (
                <div key={i} className="bg-mc-surface border border-mc-border rounded-xl p-5" data-testid={`stat-card-${i}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center ${s.color}`}>{s.icon}</div>
                    <TrendingUp size={16} className="text-mc-border" />
                  </div>
                  <p className="font-heading text-2xl font-700 text-mc-text">{s.value}</p>
                  <p className="text-mc-text-secondary text-xs mt-1 font-body">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Monthly Revenue */}
              <div className="lg:col-span-2 bg-mc-surface border border-mc-border rounded-xl p-6">
                <h3 className="font-heading text-base text-mc-text font-600 mb-5">Monthly Revenue (₹)</h3>
                {stats?.monthly_data?.some(d => d.revenue > 0) ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={stats.monthly_data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8E4" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#5C6B64', fontFamily: 'Manrope' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#5C6B64', fontFamily: 'Manrope' }} />
                      <Tooltip formatter={(v) => [`₹${v.toLocaleString()}`, 'Revenue']} contentStyle={{ fontFamily: 'Manrope', fontSize: 12, borderRadius: 8, border: '1px solid #E2E8E4' }} />
                      <Bar dataKey="revenue" fill="#2C5545" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-mc-text-secondary text-sm font-body">
                    <div className="text-center"><Activity size={32} className="mx-auto text-mc-border mb-2" /><p>No revenue data yet</p></div>
                  </div>
                )}
              </div>

              {/* Pie Chart */}
              <div className="bg-mc-surface border border-mc-border rounded-xl p-6">
                <h3 className="font-heading text-base text-mc-text font-600 mb-5">Appointment Status</h3>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontFamily: 'Manrope', fontSize: 11, color: '#5C6B64' }}>{v}</span>} />
                      <Tooltip contentStyle={{ fontFamily: 'Manrope', fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-mc-text-secondary text-sm font-body">
                    <div className="text-center"><Calendar size={32} className="mx-auto text-mc-border mb-2" /><p>No data yet</p></div>
                  </div>
                )}
              </div>
            </div>

            {/* Activity Logs */}
            <div className="bg-mc-surface border border-mc-border rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-mc-border flex items-center justify-between">
                <h3 className="font-heading text-base text-mc-text font-600">Recent Activity</h3>
                <button onClick={fetchActivity} className="text-mc-text-secondary hover:text-mc-text transition-colors"><RefreshCw size={16} /></button>
              </div>
              {activityLogs.length === 0 ? (
                <div className="py-10 text-center text-mc-text-secondary text-sm font-body"><Activity size={32} className="mx-auto text-mc-border mb-2" /><p>No activity yet</p></div>
              ) : (
                <div className="divide-y divide-mc-border max-h-80 overflow-y-auto">
                  {activityLogs.slice(0, 20).map((log, i) => (
                    <div key={i} className="flex items-center gap-4 px-6 py-3.5">
                      <div className="w-8 h-8 bg-mc-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <Activity size={14} className="text-mc-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-mc-text font-body truncate">{log.action?.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-mc-text-secondary font-body truncate">{log.details || log.user_name}</p>
                      </div>
                      <span className="text-xs text-mc-text-secondary font-body flex-shrink-0">
                        {new Date(log.timestamp).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* DOCTORS TAB */}
        {activeTab === 'Doctors' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-xl text-mc-text font-700">Manage Doctors ({doctors.length})</h2>
              <button onClick={openAdd} className="flex items-center gap-2 btn-primary text-sm px-5 py-2.5" data-testid="add-doctor-button">
                <Plus size={16} /> Add Doctor
              </button>
            </div>
            <div className="bg-mc-surface border border-mc-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full font-body text-sm">
                  <thead className="bg-mc-bg border-b border-mc-border">
                    <tr>
                      {['Doctor', 'Specialization', 'Experience', 'Fee', 'Rating', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3.5 text-left text-xs font-medium text-mc-text-secondary uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mc-border">
                    {doctors.map(doc => (
                      <tr key={doc._id} className="hover:bg-mc-bg transition-colors" data-testid={`doctor-row-${doc._id}`}>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <img src={doc.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(doc.name)}&background=2C5545&color=fff&size=40`} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                            <div><p className="font-medium text-mc-text">{doc.name}</p><p className="text-xs text-mc-text-secondary">{doc.qualification?.split(',')[0]}</p></div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-mc-text-secondary">{doc.specialization}</td>
                        <td className="px-4 py-4 text-mc-text-secondary">{doc.experience_years} yrs</td>
                        <td className="px-4 py-4 font-medium text-mc-primary">₹{doc.consultation_fee?.toLocaleString()}</td>
                        <td className="px-4 py-4 text-amber-600">★ {doc.rating}</td>
                        <td className="px-4 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${doc.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {doc.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openSlotModal(doc)} className="p-2 hover:bg-blue-50 rounded-lg text-mc-text-secondary hover:text-blue-600 transition-colors" title="Manage Slots" data-testid={`slots-doctor-${doc._id}`}>
                              <CalendarClock size={15} />
                            </button>
                            <button onClick={() => openEdit(doc)} className="p-2 hover:bg-mc-bg rounded-lg text-mc-text-secondary hover:text-mc-primary transition-colors" data-testid={`edit-doctor-${doc._id}`}>
                              <Edit size={15} />
                            </button>
                            <button onClick={() => handleDeleteDoctor(doc._id, doc.name)} className="p-2 hover:bg-red-50 rounded-lg text-mc-text-secondary hover:text-red-600 transition-colors" data-testid={`delete-doctor-${doc._id}`}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {doctors.length === 0 && (
                  <div className="py-12 text-center text-mc-text-secondary font-body text-sm">
                    <Stethoscope size={32} className="mx-auto text-mc-border mb-2" /><p>No doctors yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* WORKSHOPS TAB */}
        {activeTab === 'Workshops' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-xl text-mc-text font-700">Workshops ({workshops.length})</h2>
              <button onClick={openWorkshopAdd} className="flex items-center gap-2 btn-primary text-sm px-5 py-2.5">
                <Plus size={16} /> Create Workshop
              </button>
            </div>
            <div className="bg-mc-surface border border-mc-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full font-body text-sm">
                  <thead className="bg-mc-bg border-b border-mc-border">
                    <tr>
                      {['Workshop', 'Doctor', 'Date', 'Price', 'Meet', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3.5 text-left text-xs font-medium text-mc-text-secondary uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mc-border">
                    {workshops.map(workshop => (
                      <tr key={workshop._id} className="hover:bg-mc-bg transition-colors">
                        <td className="px-4 py-4">
                          <p className="font-medium text-mc-text">{workshop.title}</p>
                          <p className="text-xs text-mc-text-secondary max-w-xs truncate">{workshop.description || 'No description'}</p>
                        </td>
                        <td className="px-4 py-4 text-mc-text-secondary">{workshop.doctor_name || '—'}</td>
                        <td className="px-4 py-4 text-mc-text-secondary">{workshop.workshop_date} at {workshop.start_time}</td>
                        <td className="px-4 py-4 font-medium text-mc-primary">₹{Number(workshop.price || 0).toLocaleString()}</td>
                        <td className="px-4 py-4 text-mc-text-secondary max-w-[180px] truncate">{workshop.gmeet_link}</td>
                        <td className="px-4 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${workshop.is_active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                            {workshop.is_active !== false ? 'Active' : 'Hidden'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openWorkshopEdit(workshop)} className="p-2 hover:bg-mc-bg rounded-lg text-mc-text-secondary hover:text-mc-primary transition-colors">
                              <Edit size={15} />
                            </button>
                            <button onClick={() => deleteWorkshop(workshop)} className="p-2 hover:bg-red-50 rounded-lg text-mc-text-secondary hover:text-red-600 transition-colors">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {workshops.length === 0 && (
                  <div className="py-12 text-center text-mc-text-secondary font-body text-sm">
                    <CalendarClock size={32} className="mx-auto text-mc-border mb-2" /><p>No workshops yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* APPOINTMENTS TAB */}
        {activeTab === 'Appointments' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-xl text-mc-text font-700">All Appointments ({appointments.length})</h2>
              <button onClick={fetchAppointments} className="flex items-center gap-2 text-mc-text-secondary hover:text-mc-text transition-colors text-sm font-body">
                <RefreshCw size={15} /> Refresh
              </button>
            </div>
            <div className="bg-mc-surface border border-mc-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full font-body text-sm">
                  <thead className="bg-mc-bg border-b border-mc-border">
                    <tr>
                      {['Patient', 'Doctor', 'Date & Time', 'Fee', 'Status', 'Payment', 'Update'].map(h => (
                        <th key={h} className="px-4 py-3.5 text-left text-xs font-medium text-mc-text-secondary uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mc-border">
                    {appointments.map(appt => (
                      <tr key={appt._id} className="hover:bg-mc-bg transition-colors" data-testid={`appt-row-${appt._id}`}>
                        <td className="px-4 py-4">
                          <p className="font-medium text-mc-text">{appt.patient_name}</p>
                          <p className="text-xs text-mc-text-secondary">{appt.patient_email}</p>
                        </td>
                        <td className="px-4 py-4 text-mc-text-secondary">{appt.doctor_name}</td>
                        <td className="px-4 py-4 text-mc-text-secondary">
                          <p>{appt.appointment_date}</p>
                          <p className="text-xs">{appt.appointment_time}</p>
                        </td>
                        <td className="px-4 py-4 font-medium text-mc-primary">₹{appt.consultation_fee?.toLocaleString()}</td>
                        <td className="px-4 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusBadge(appt.status)}`}>
                            {appt.status?.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusBadge(appt.payment_status)}`}>
                            {appt.payment_status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <select
                            value={appt.status}
                            onChange={e => handleUpdateAppt(appt._id, e.target.value)}
                            className="text-xs border border-mc-border rounded-lg px-2 py-1.5 bg-mc-bg text-mc-text focus:outline-none focus:border-mc-secondary"
                            data-testid={`update-status-${appt._id}`}
                          >
                            {['pending_payment', 'confirmed', 'completed', 'cancelled'].map(s => (
                              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {appointments.length === 0 && (
                  <div className="py-12 text-center text-mc-text-secondary font-body text-sm">
                    <Calendar size={32} className="mx-auto text-mc-border mb-2" /><p>No appointments yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'Users' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-xl text-mc-text font-700">Registered Users ({users.length})</h2>
              <button onClick={fetchUsers} className="flex items-center gap-2 text-mc-text-secondary hover:text-mc-text transition-colors text-sm font-body"><RefreshCw size={15} /> Refresh</button>
            </div>
            <div className="bg-mc-surface border border-mc-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full font-body text-sm">
                  <thead className="bg-mc-bg border-b border-mc-border">
                    <tr>
                      {['Name', 'Email', 'Phone', 'Country', 'Role', 'Joined'].map(h => (
                        <th key={h} className="px-4 py-3.5 text-left text-xs font-medium text-mc-text-secondary uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mc-border">
                    {users.map(u => (
                      <tr key={u._id} className="hover:bg-mc-bg transition-colors" data-testid={`user-row-${u._id}`}>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-mc-primary rounded-full flex items-center justify-center text-white text-xs font-medium">
                              {u.name?.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-mc-text">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-mc-text-secondary">{u.email}</td>
                        <td className="px-4 py-4 text-mc-text-secondary">{u.phone || '—'}</td>
                        <td className="px-4 py-4">
                          <select
                            value={u.country_code || 'IN'}
                            onChange={async (e) => {
                              const newCode = e.target.value;
                              try {
                                await api.put(`/admin/users/${u._id}/country`, { country_code: newCode });
                                setUsers(prev => prev.map(usr => usr._id === u._id ? { ...usr, country_code: newCode } : usr));
                              } catch (err) { console.error('Failed to update country:', err); }
                            }}
                            className="px-2 py-1.5 border border-mc-border rounded-lg text-xs font-body bg-mc-bg text-mc-text focus:outline-none focus:border-mc-secondary"
                            data-testid={`user-country-${u._id}`}
                          >
                            {Object.entries(COUNTRY_CONFIG).map(([code, cfg]) => (
                              <option key={code} value={code}>{cfg.flag} {cfg.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-mc-bg text-mc-text-secondary'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-mc-text-secondary">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <div className="py-12 text-center text-mc-text-secondary font-body text-sm">
                    <Users size={32} className="mx-auto text-mc-border mb-2" /><p>No users yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* PAYMENTS TAB */}
        {activeTab === 'Payments' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-xl text-mc-text font-700">Transactions ({transactions.length})</h2>
              <button onClick={fetchTransactions} className="flex items-center gap-2 text-mc-text-secondary hover:text-mc-text transition-colors text-sm font-body"><RefreshCw size={15} /> Refresh</button>
            </div>
            <div className="bg-mc-surface border border-mc-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full font-body text-sm">
                  <thead className="bg-mc-bg border-b border-mc-border">
                    <tr>
                      {['Transaction ID', 'Doctor', 'Date', 'Amount', 'Mode', 'Status'].map(h => (
                        <th key={h} className="px-4 py-3.5 text-left text-xs font-medium text-mc-text-secondary uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mc-border">
                    {transactions.map(t => (
                      <tr key={t._id} className="hover:bg-mc-bg transition-colors" data-testid={`txn-row-${t._id}`}>
                        <td className="px-4 py-4 font-mono text-xs text-mc-text-secondary">{t.transaction_id}</td>
                        <td className="px-4 py-4 text-mc-text">{t.doctor_name || '—'}</td>
                        <td className="px-4 py-4 text-mc-text-secondary">{t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN') : '—'}</td>
                        <td className="px-4 py-4 font-medium text-mc-primary">₹{((t.amount || 0) / 100).toLocaleString()}</td>
                        <td className="px-4 py-4 text-mc-text-secondary">{t.payment_mode || 'Online'}</td>
                        <td className="px-4 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusBadge(t.payment_state)}`}>
                            {t.payment_state}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {transactions.length === 0 && (
                  <div className="py-12 text-center text-mc-text-secondary font-body text-sm">
                    <CreditCard size={32} className="mx-auto text-mc-border mb-2" /><p>No transactions yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slot Management Modal */}
      {showSlotModal && slotDoctor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="slot-modal">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-mc-border">
              <div>
                <h2 className="font-heading text-lg text-mc-text font-700">Manage Time Slots</h2>
                <p className="text-xs text-mc-text-secondary font-body mt-0.5">{slotDoctor.name}</p>
              </div>
              <button onClick={() => setShowSlotModal(false)} className="text-mc-text-secondary hover:text-mc-text transition-colors p-1" data-testid="close-slot-modal">
                <XCircle size={22} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {slotError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 font-body">{slotError}</div>}

              {/* Date Picker */}
              <div>
                <label className="block text-xs font-medium text-mc-text mb-1.5 font-body">Select Date</label>
                <input
                  type="date"
                  value={slotDate}
                  onChange={handleSlotDateChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary"
                  data-testid="slot-date-picker"
                />
              </div>

              {slotDate && (
                <>
                  {/* Status indicator */}
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-body ${isBlockedDate ? 'bg-red-50 text-red-700' : isCustomSlots ? 'bg-blue-50 text-blue-700' : 'bg-mc-bg text-mc-text-secondary'}`}>
                    {isBlockedDate ? <XCircle size={14} /> : isCustomSlots ? <CalendarClock size={14} /> : <Clock size={14} />}
                    {isBlockedDate ? `Booking disabled${blockReason ? `: ${blockReason}` : ''}` : isCustomSlots ? 'Using custom slots for this date' : 'Using auto-generated default slots'}
                  </div>

                  {slotLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-8 h-8 border-4 border-mc-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <>
                      {/* Add new slot */}
                      <div>
                        <label className="block text-xs font-medium text-mc-text mb-1.5 font-body">Add Time Slot</label>
                        <div className="flex gap-2">
                          <input
                            type="time"
                            value={newSlotTime}
                            onChange={e => setNewSlotTime(e.target.value)}
                            className="flex-1 px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary"
                            data-testid="new-slot-time"
                          />
                          <button
                            type="button"
                            onClick={addSlot}
                            className="btn-primary text-sm px-4 py-2.5 flex items-center gap-1.5"
                            data-testid="add-slot-btn"
                          >
                            <Plus size={14} /> Add
                          </button>
                        </div>
                      </div>

                      <div className="border border-red-100 bg-red-50 rounded-xl p-3">
                        <label className="block text-xs font-medium text-red-800 mb-1.5 font-body">Disable booking for this date</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={blockReason}
                            onChange={e => setBlockReason(e.target.value)}
                            placeholder="Reason shown in CRM"
                            className="flex-1 px-3 py-2.5 border border-red-200 rounded-lg text-mc-text text-sm font-body bg-white focus:outline-none focus:border-red-400"
                          />
                          <button
                            type="button"
                            onClick={blockDate}
                            disabled={slotSaving}
                            className="text-sm px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-body"
                          >
                            Block Date
                          </button>
                        </div>
                      </div>

                      {/* Slot list */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-medium text-mc-text font-body">
                            Time Slots ({slotList.length})
                          </label>
                          {slotList.length > 0 && (
                            <span className="text-[11px] text-mc-text-secondary font-body">Click the X to remove a slot</span>
                          )}
                        </div>
                        {slotList.length === 0 ? (
                          <div className="py-6 text-center text-mc-text-secondary text-sm font-body border border-dashed border-mc-border rounded-lg">
                            <Clock size={24} className="mx-auto text-mc-border mb-2" />
                            <p>{isBlockedDate ? 'Bookings are disabled for this date.' : 'No slots defined. Add time slots above.'}</p>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                            {slotList.map(time => (
                              <div
                                key={time}
                                className="group flex items-center gap-1.5 bg-mc-bg border border-mc-border rounded-lg px-3 py-2 text-sm font-body text-mc-text hover:border-red-300 transition-colors"
                              >
                                <Clock size={12} className="text-mc-text-secondary" />
                                <span>{formatSlotDisplay(time)}</span>
                                <button
                                  onClick={() => removeSlot(time)}
                                  className="ml-0.5 text-mc-text-secondary hover:text-red-600 transition-colors opacity-50 group-hover:opacity-100"
                                  data-testid={`remove-slot-${time}`}
                                >
                                  <XIcon size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-3 pt-2 border-t border-mc-border">
                        {(isCustomSlots || isBlockedDate) && (
                          <button
                            type="button"
                            onClick={resetToDefault}
                            disabled={slotSaving}
                            className="flex items-center gap-2 text-sm px-4 py-2.5 border border-mc-border rounded-lg text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg transition-colors font-body"
                            data-testid="reset-slots-btn"
                          >
                            <RotateCcw size={14} /> Reset to Default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={saveCustomSlots}
                          disabled={slotSaving || slotList.length === 0}
                          className="flex-1 btn-primary text-sm py-2.5 flex items-center justify-center gap-2"
                          data-testid="save-slots-btn"
                        >
                          {slotSaving ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <><CheckCircle size={14} /> Save Custom Slots</>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Workshop Modal */}
      {showWorkshopModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-mc-border">
              <h2 className="font-heading text-lg text-mc-text font-700">{editWorkshop ? 'Edit Workshop' : 'Create Workshop'}</h2>
              <button onClick={() => setShowWorkshopModal(false)} className="text-mc-text-secondary hover:text-mc-text transition-colors p-1">
                <XCircle size={22} />
              </button>
            </div>
            <form onSubmit={saveWorkshop} className="p-6 space-y-4">
              {workshopError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 font-body">{workshopError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-mc-text mb-1.5 font-body">Title *</label>
                  <input type="text" value={workshopForm.title} onChange={e => setWorkshopForm(p => ({ ...p, title: e.target.value }))} required className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mc-text mb-1.5 font-body">Doctor *</label>
                  <select value={workshopForm.doctor_id} onChange={e => setWorkshopForm(p => ({ ...p, doctor_id: e.target.value }))} required className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary">
                    <option value="">Select doctor</option>
                    {doctors.map(doc => <option key={doc._id} value={doc._id}>{doc.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-mc-text mb-1.5 font-body">Date *</label>
                  <input type="date" value={workshopForm.workshop_date} onChange={e => setWorkshopForm(p => ({ ...p, workshop_date: e.target.value }))} required className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mc-text mb-1.5 font-body">Start Time *</label>
                  <input type="time" value={workshopForm.start_time} onChange={e => setWorkshopForm(p => ({ ...p, start_time: e.target.value }))} required className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mc-text mb-1.5 font-body">Duration (min)</label>
                  <input type="number" value={workshopForm.duration_minutes} onChange={e => setWorkshopForm(p => ({ ...p, duration_minutes: e.target.value }))} min="1" className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mc-text mb-1.5 font-body">Price (₹) *</label>
                  <input type="number" value={workshopForm.price} onChange={e => setWorkshopForm(p => ({ ...p, price: e.target.value }))} min="0" required className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-mc-text mb-1.5 font-body">Capacity</label>
                  <input type="number" value={workshopForm.capacity} onChange={e => setWorkshopForm(p => ({ ...p, capacity: e.target.value }))} min="1" placeholder="Optional" className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-mc-text mb-1.5 font-body">Google Meet Link *</label>
                  <input type="url" value={workshopForm.gmeet_link} onChange={e => setWorkshopForm(p => ({ ...p, gmeet_link: e.target.value }))} required placeholder="https://meet.google.com/..." className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-mc-text mb-1.5 font-body">Description</label>
                  <textarea value={workshopForm.description} onChange={e => setWorkshopForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary resize-none" />
                </div>
                <label className="col-span-2 flex items-center gap-2 text-sm text-mc-text font-body">
                  <input type="checkbox" checked={workshopForm.is_active} onChange={e => setWorkshopForm(p => ({ ...p, is_active: e.target.checked }))} />
                  Visible for users
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowWorkshopModal(false)} className="flex-1 btn-secondary text-sm py-3">Cancel</button>
                <button type="submit" disabled={workshopSaving} className="flex-1 btn-primary text-sm py-3 flex items-center justify-center gap-2">
                  {workshopSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><CheckCircle size={16} />Save Workshop</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Doctor Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="doctor-modal">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-mc-border">
              <h2 className="font-heading text-lg text-mc-text font-700">{editDoctor ? 'Edit Doctor' : 'Add New Doctor'}</h2>
              <button onClick={() => setShowModal(false)} className="text-mc-text-secondary hover:text-mc-text transition-colors p-1" data-testid="close-modal-button">
                <XCircle size={22} />
              </button>
            </div>
            <form onSubmit={handleSaveDoctor} className="p-6 space-y-4">
              {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 font-body">{formError}</div>}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'Dr. Name', required: true },
                  { label: 'Specialization *', key: 'specialization', type: 'text', placeholder: 'e.g. Cardiologist', required: true },
                  { label: 'Qualification *', key: 'qualification', type: 'text', placeholder: 'MBBS, MD', required: true },
                  { label: 'Experience (years) *', key: 'experience_years', type: 'number', placeholder: '10', required: true },
                  { label: 'Consultation Fee (₹)', key: 'consultation_fee', type: 'number', placeholder: '2000', required: true },
                  { label: 'Image URL', key: 'image_url', type: 'url', placeholder: 'https://...', required: false },
                ].map(f => (
                  <div key={f.key} className={f.key === 'image_url' ? 'col-span-2' : ''}>
                    <label className="block text-xs font-medium text-mc-text mb-1.5 font-body">{f.label}</label>
                    <input
                      type={f.type} value={docForm[f.key]} onChange={e => setDocForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} required={f.required}
                      className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary"
                      data-testid={`doctor-form-${f.key}`}
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-mc-text mb-1.5 font-body">Bio</label>
                <textarea
                  value={docForm.bio} onChange={e => setDocForm(p => ({ ...p, bio: e.target.value }))} rows={3}
                  placeholder="Doctor's biography..."
                  className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary resize-none"
                  data-testid="doctor-form-bio"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-mc-text mb-2 font-body">Available Days</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(day => (
                    <button type="button" key={day} onClick={() => toggleDay(day)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all font-body ${docForm.available_days.includes(day) ? 'bg-mc-primary text-white border-mc-primary' : 'border-mc-border text-mc-text-secondary hover:border-mc-secondary'}`}
                      data-testid={`day-toggle-${day}`}
                    >{day.slice(0, 3)}</button>
                  ))}
                </div>
              </div>

              {/* Services */}
              <div className="border-t border-mc-border pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block text-xs font-medium text-mc-text font-body">Services & Pricing</label>
                    <p className="text-[11px] text-mc-text-secondary font-body">Add the services users can choose. The backend uses these prices for payment.</p>
                  </div>
                  <button type="button" onClick={addService} className="text-xs px-3 py-1.5 rounded-lg border border-mc-border text-mc-text hover:border-mc-primary font-body">
                    Add Service
                  </button>
                </div>
                <div className="space-y-2">
                  {docForm.services.map((service, index) => (
                    <div key={service.id || index} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <label className="block text-[11px] text-mc-text-secondary mb-1 font-body">Service</label>
                        <input
                          type="text"
                          value={service.name}
                          onChange={e => updateService(index, 'name', e.target.value)}
                          placeholder="Consultation / Therapy / Follow-up"
                          className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-[11px] text-mc-text-secondary mb-1 font-body">Price (₹)</label>
                        <input
                          type="number"
                          value={service.price}
                          onChange={e => updateService(index, 'price', e.target.value)}
                          min="0"
                          className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-[11px] text-mc-text-secondary mb-1 font-body">Duration</label>
                        <input
                          type="number"
                          value={service.duration_minutes || ''}
                          onChange={e => updateService(index, 'duration_minutes', e.target.value)}
                          placeholder="30"
                          min="1"
                          className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary"
                        />
                      </div>
                      <button type="button" onClick={() => removeService(index)} className="col-span-1 p-2.5 rounded-lg text-mc-text-secondary hover:text-red-600 hover:bg-red-50">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Working Hours */}
              <div className="border-t border-mc-border pt-4">
                <label className="block text-xs font-medium text-mc-text mb-3 font-body">Working Hours & Slot Duration</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-mc-text-secondary mb-1 font-body">Start</label>
                    <input
                      type="time" value={docForm.start_time}
                      onChange={e => setDocForm(p => ({ ...p, start_time: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary"
                      data-testid="doctor-form-start_time" required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-mc-text-secondary mb-1 font-body">End</label>
                    <input
                      type="time" value={docForm.end_time}
                      onChange={e => setDocForm(p => ({ ...p, end_time: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary"
                      data-testid="doctor-form-end_time" required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-mc-text-secondary mb-1 font-body">Slot (min)</label>
                    <select
                      value={docForm.slot_duration_minutes}
                      onChange={e => setDocForm(p => ({ ...p, slot_duration_minutes: parseInt(e.target.value) }))}
                      className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary"
                      data-testid="doctor-form-slot_duration"
                    >
                      {[15, 20, 30, 45, 60].map(v => <option key={v} value={v}>{v} min</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-[11px] text-mc-text-secondary mb-1 font-body">Lunch Break Start (optional)</label>
                    <input
                      type="time" value={docForm.lunch_start}
                      onChange={e => setDocForm(p => ({ ...p, lunch_start: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary"
                      data-testid="doctor-form-lunch_start"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-mc-text-secondary mb-1 font-body">Lunch Break End (optional)</label>
                    <input
                      type="time" value={docForm.lunch_end}
                      onChange={e => setDocForm(p => ({ ...p, lunch_end: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary"
                      data-testid="doctor-form-lunch_end"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-mc-text-secondary mt-2 font-body">
                  Leave lunch fields blank for no break. Slots auto-generated from this schedule.
                </p>
              </div>

              {/* Per-Duration Pricing */}
              <div className="border-t border-mc-border pt-4">
                <label className="block text-xs font-medium text-mc-text mb-1 font-body">Per-Duration Pricing (Optional)</label>
                <p className="text-[11px] text-mc-text-secondary mb-3 font-body">
                  Set separate fees for 45-min and 60-min sessions. Leave blank to use the default Consultation Fee for all durations.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-mc-text-secondary mb-1 font-body">Fee for 45 min (₹)</label>
                    <input
                      type="number" value={docForm.fee_45min}
                      onChange={e => setDocForm(p => ({ ...p, fee_45min: e.target.value }))}
                      placeholder="e.g. 1500"
                      min="0"
                      className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary"
                      data-testid="doctor-form-fee_45min"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-mc-text-secondary mb-1 font-body">Fee for 60 min (₹)</label>
                    <input
                      type="number" value={docForm.fee_60min}
                      onChange={e => setDocForm(p => ({ ...p, fee_60min: e.target.value }))}
                      placeholder="e.g. 2000"
                      min="0"
                      className="w-full px-3 py-2.5 border border-mc-border rounded-lg text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary"
                      data-testid="doctor-form-fee_60min"
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 btn-secondary text-sm py-3" data-testid="cancel-doctor-form">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 btn-primary text-sm py-3 flex items-center justify-center gap-2" data-testid="save-doctor-button">
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><CheckCircle size={16} />{editDoctor ? 'Update' : 'Add Doctor'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

