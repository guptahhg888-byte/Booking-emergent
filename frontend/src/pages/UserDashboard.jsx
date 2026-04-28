import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, CreditCard, XCircle, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const statusConfig = {
  confirmed: { color: 'bg-emerald-100 text-emerald-800', label: 'Confirmed' },
  pending_payment: { color: 'bg-amber-100 text-amber-800', label: 'Pending Payment' },
  completed: { color: 'bg-blue-100 text-blue-800', label: 'Completed' },
  cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' },
};

const paymentConfig = {
  paid: { color: 'bg-emerald-100 text-emerald-800', label: 'Paid' },
  pending: { color: 'bg-amber-100 text-amber-800', label: 'Pending' },
  failed: { color: 'bg-red-100 text-red-800', label: 'Failed' },
};

const UserDashboard = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    api.get('/appointments')
      .then(res => setAppointments(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this appointment?')) return;
    setCancellingId(id);
    try {
      await api.delete(`/appointments/${id}`);
      setAppointments(prev => prev.map(a => a._id === id ? { ...a, status: 'cancelled' } : a));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to cancel');
    } finally {
      setCancellingId(null);
    }
  };

  const filtered = filter === 'all' ? appointments
    : filter === 'upcoming' ? appointments.filter(a => ['confirmed', 'pending_payment'].includes(a.status))
    : appointments.filter(a => ['completed', 'cancelled'].includes(a.status));

  const tabs = [
    { key: 'all', label: 'All', count: appointments.length },
    { key: 'upcoming', label: 'Upcoming', count: appointments.filter(a => ['confirmed', 'pending_payment'].includes(a.status)).length },
    { key: 'past', label: 'Past', count: appointments.filter(a => ['completed', 'cancelled'].includes(a.status)).length },
  ];

  return (
    <div className="min-h-[calc(100vh-64px)] bg-mc-bg py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-mc-primary rounded-full flex items-center justify-center text-white font-heading text-lg font-600">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-heading text-2xl text-mc-text font-700">Hello, {user?.name?.split(' ')[0]}!</h1>
              <p className="text-mc-text-secondary text-sm font-body">Manage your appointments</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total', value: appointments.length, color: 'bg-mc-primary/10 text-mc-primary' },
            { label: 'Confirmed', value: appointments.filter(a => a.status === 'confirmed').length, color: 'bg-emerald-100 text-emerald-700' },
            { label: 'Completed', value: appointments.filter(a => a.status === 'completed').length, color: 'bg-blue-100 text-blue-700' },
          ].map(s => (
            <div key={s.label} className="bg-mc-surface border border-mc-border rounded-xl p-4 text-center" data-testid={`stat-${s.label.toLowerCase()}`}>
              <p className={`font-heading text-3xl font-700 ${s.color.split(' ')[1]}`}>{s.value}</p>
              <p className="text-mc-text-secondary text-xs mt-1 font-body">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-mc-surface border border-mc-border rounded-xl p-1 mb-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all font-body flex items-center justify-center gap-2 ${filter === t.key ? 'bg-mc-primary text-white shadow-sm' : 'text-mc-text-secondary hover:text-mc-text'}`}
              data-testid={`filter-${t.key}`}
            >
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${filter === t.key ? 'bg-white/20 text-white' : 'bg-mc-bg text-mc-text-secondary'}`}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Appointments */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-mc-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-mc-surface border border-mc-border rounded-2xl" data-testid="no-appointments">
            <Calendar size={48} className="mx-auto text-mc-border mb-4" />
            <h3 className="font-heading text-lg text-mc-text mb-2">No appointments found</h3>
            <p className="text-mc-text-secondary text-sm mb-4 font-body">
              {filter === 'all' ? "You haven't booked any appointments yet." : `No ${filter} appointments.`}
            </p>
            <a href="/doctors" className="inline-flex items-center gap-2 btn-primary text-sm px-6 py-2.5">
              Book an Appointment <ChevronRight size={15} />
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(appt => {
              const sc = statusConfig[appt.status] || { color: 'bg-mc-bg text-mc-text-secondary', label: appt.status };
              const pc = paymentConfig[appt.payment_status] || { color: 'bg-mc-bg text-mc-text-secondary', label: appt.payment_status };
              const canCancel = ['pending_payment', 'confirmed'].includes(appt.status);
              return (
                <div key={appt._id} className="bg-mc-surface border border-mc-border rounded-2xl p-5 hover:shadow-md transition-all" data-testid={`appointment-card-${appt._id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-11 h-11 bg-mc-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <User size={20} className="text-mc-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-heading text-base text-mc-text font-600">{appt.doctor_name}</h3>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-mc-text-secondary font-body">
                          <span className="flex items-center gap-1"><Calendar size={13} />{appt.appointment_date}</span>
                          <span className="flex items-center gap-1"><Clock size={13} />{appt.appointment_time}</span>
                          <span className="flex items-center gap-1"><CreditCard size={13} />₹{appt.consultation_fee?.toLocaleString()}</span>
                        </div>
                        {appt.notes && (
                          <p className="text-xs text-mc-text-secondary mt-2 bg-mc-bg rounded-lg px-3 py-2 font-body">
                            {appt.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full font-body ${sc.color}`}>{sc.label}</span>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full font-body ${pc.color}`}>{pc.label}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-mc-border">
                    <p className="text-xs text-mc-text-secondary font-body">
                      Booked {new Date(appt.created_at).toLocaleDateString('en-IN')}
                    </p>
                    <div className="flex gap-2">
                      {appt.payment_status === 'pending' && appt.status === 'pending_payment' && (
                        <a
                          href={`/doctors/${appt.doctor_id}`}
                          className="flex items-center gap-1 text-xs bg-mc-primary text-white rounded-full px-3 py-1.5 hover:bg-mc-primary-hover transition-all font-body"
                          data-testid={`retry-payment-${appt._id}`}
                        >
                          <CreditCard size={12} /> Pay Now
                        </a>
                      )}
                      {canCancel && (
                        <button
                          onClick={() => handleCancel(appt._id)}
                          disabled={cancellingId === appt._id}
                          className="flex items-center gap-1 text-xs border border-red-200 text-red-600 rounded-full px-3 py-1.5 hover:bg-red-50 transition-all font-body disabled:opacity-50"
                          data-testid={`cancel-appointment-${appt._id}`}
                        >
                          {cancellingId === appt._id ? (
                            <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <XCircle size={12} />
                          )}
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDashboard;
