import React, { useEffect, useState } from 'react';
import { Calendar, Clock, CreditCard, User, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const WorkshopsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/workshops')
      .then(res => setWorkshops(res.data))
      .catch(() => setError('Failed to load workshops'))
      .finally(() => setLoading(false));
  }, []);

  const register = async (workshopId) => {
    if (!user) {
      navigate('/login');
      return;
    }
    setPayingId(workshopId);
    setError('');
    try {
      const regRes = await api.post(`/workshops/${workshopId}/register`);
      const payRes = await api.post('/payments/initiate', { workshop_registration_id: regRes.data._id });
      window.location.href = payRes.data.checkout_url;
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to register for workshop');
      setPayingId(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-mc-bg">
      <div className="bg-mc-primary py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm uppercase tracking-[0.2em] font-medium text-emerald-300 mb-3">Live Sessions</p>
          <h1 className="font-heading text-4xl text-white font-700">Doctor Workshops</h1>
          <p className="text-white/70 mt-3">Register and complete payment to unlock the Google Meet link.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {error && <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 font-body">{error}</div>}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-mc-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : workshops.length === 0 ? (
          <div className="text-center py-16 bg-mc-surface border border-mc-border rounded-2xl">
            <Video size={44} className="mx-auto text-mc-border mb-4" />
            <h3 className="font-heading text-xl text-mc-text mb-2">No workshops available</h3>
            <p className="text-mc-text-secondary text-sm">Please check again later.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workshops.map(workshop => (
              <div key={workshop._id} className="bg-mc-surface border border-mc-border rounded-2xl p-6 hover:shadow-lg transition-all">
                <div className="w-11 h-11 bg-mc-primary/10 rounded-xl flex items-center justify-center text-mc-primary mb-4">
                  <Video size={21} />
                </div>
                <h2 className="font-heading text-lg text-mc-text font-700">{workshop.title}</h2>
                <p className="text-sm text-mc-text-secondary mt-2 line-clamp-3 font-body">{workshop.description || 'Interactive doctor-led workshop.'}</p>
                <div className="space-y-2 mt-5 text-sm text-mc-text-secondary font-body">
                  <div className="flex items-center gap-2"><User size={14} />{workshop.doctor_name}</div>
                  <div className="flex items-center gap-2"><Calendar size={14} />{workshop.workshop_date}</div>
                  <div className="flex items-center gap-2"><Clock size={14} />{workshop.start_time} · {workshop.duration_minutes} min</div>
                  <div className="flex items-center gap-2 text-mc-primary font-semibold"><CreditCard size={14} />₹{Number(workshop.price || 0).toLocaleString()}</div>
                </div>
                <button
                  onClick={() => register(workshop._id)}
                  disabled={payingId === workshop._id}
                  className="w-full mt-6 btn-primary text-sm py-3 flex items-center justify-center gap-2"
                >
                  {payingId === workshop._id ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Register & Pay'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkshopsPage;

