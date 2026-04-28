import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, Clock, Award, Calendar, ChevronLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { Calendar as CalendarComp } from '../components/ui/calendar';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const BookingPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/doctors/${id}`)
      .then(res => setDoctor(res.data))
      .catch(() => navigate('/doctors'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => {
    if (selectedDate && doctor) {
      const dateStr = formatDate(selectedDate);
      setSlotsLoading(true);
      setSelectedTime('');
      api.get(`/doctors/${id}/available-slots`, { params: { date: dateStr } })
        .then(res => setAvailableSlots(res.data.available_slots || []))
        .catch(() => setAvailableSlots([]))
        .finally(() => setSlotsLoading(false));
    }
  }, [selectedDate, id, doctor]);

  const isDateDisabled = (date) => {
    if (date < new Date(new Date().setHours(0, 0, 0, 0))) return true;
    if (!doctor?.available_days) return false;
    return !doctor.available_days.includes(DAYS[date.getDay()]);
  };

  const handleBook = async () => {
    if (!user) { navigate('/login'); return; }
    if (!selectedDate || !selectedTime) { setError('Please select date and time'); return; }
    setBookingLoading(true);
    setError('');
    try {
      const apptRes = await api.post('/appointments', {
        doctor_id: id,
        appointment_date: formatDate(selectedDate),
        appointment_time: selectedTime,
        notes: notes || null
      });
      const payRes = await api.post('/payments/initiate', { appointment_id: apptRes.data._id });
      window.location.href = payRes.data.checkout_url;
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.map(d => d.msg).join(' ') : (detail || 'Booking failed. Please try again.'));
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-mc-bg">
        <div className="w-10 h-10 border-4 border-mc-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!doctor) return null;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-mc-bg py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <button onClick={() => navigate('/doctors')} className="flex items-center gap-2 text-mc-text-secondary hover:text-mc-text transition-colors mb-6 font-body text-sm" data-testid="back-to-doctors">
          <ChevronLeft size={18} /> Back to Doctors
        </button>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Doctor Info */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-mc-surface border border-mc-border rounded-2xl overflow-hidden" data-testid="doctor-profile">
              <div className="h-64 overflow-hidden">
                <img
                  src={doctor.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(doctor.name)}&background=2C5545&color=fff&size=200`}
                  alt={doctor.name} className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6">
                <div className="inline-block bg-mc-primary/10 text-mc-primary text-xs font-medium px-2.5 py-1 rounded-full mb-2">{doctor.specialization}</div>
                <h1 className="font-heading text-2xl text-mc-text font-700">{doctor.name}</h1>
                <p className="text-mc-text-secondary text-sm mt-1">{doctor.qualification}</p>
                <div className="flex items-center gap-5 mt-4 text-sm">
                  <div className="flex items-center gap-1.5 text-mc-text-secondary">
                    <Clock size={15} className="text-mc-secondary" />
                    <span>{doctor.experience_years} years exp</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Star size={15} className="text-amber-400 fill-amber-400" />
                    <span className="font-medium text-mc-text">{doctor.rating}</span>
                    <span className="text-mc-text-secondary">({doctor.total_reviews})</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-mc-surface border border-mc-border rounded-2xl p-6">
              <h3 className="font-heading text-base text-mc-text font-600 mb-3">About</h3>
              <p className="text-mc-text-secondary text-sm leading-relaxed">{doctor.bio}</p>
            </div>

            <div className="bg-mc-surface border border-mc-border rounded-2xl p-6">
              <h3 className="font-heading text-base text-mc-text font-600 mb-3">Available Days</h3>
              <div className="flex flex-wrap gap-2">
                {doctor.available_days?.map(day => (
                  <span key={day} className="bg-mc-primary/10 text-mc-primary text-xs font-medium px-3 py-1 rounded-full">{day}</span>
                ))}
              </div>
            </div>

            <div className="bg-mc-primary rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="text-white/70 text-xs">Consultation Fee</p>
                <p className="font-heading text-3xl text-white font-700">₹{doctor.consultation_fee?.toLocaleString()}</p>
              </div>
              <Award size={36} className="text-white/30" />
            </div>
          </div>

          {/* Booking Form */}
          <div className="lg:col-span-3">
            <div className="bg-mc-surface border border-mc-border rounded-2xl p-6 lg:p-8 sticky top-24">
              <h2 className="font-heading text-xl text-mc-text font-700 mb-6 flex items-center gap-2">
                <Calendar size={22} className="text-mc-primary" /> Book Appointment
              </h2>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5 font-body" data-testid="booking-error">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              {!user && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3 mb-5 font-body">
                  Please <button onClick={() => navigate('/login')} className="font-medium underline">login</button> to book an appointment.
                </div>
              )}

              {/* Calendar */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-mc-text mb-3 font-body">Select Date *</label>
                <div className="border border-mc-border rounded-xl overflow-hidden bg-mc-bg flex justify-center p-2">
                  <CalendarComp
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={isDateDisabled}
                    className="font-body"
                    data-testid="booking-calendar"
                  />
                </div>
              </div>

              {/* Time Slots */}
              {selectedDate && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-mc-text mb-3 font-body">
                    Available Time Slots — {selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </label>
                  {slotsLoading ? (
                    <div className="flex justify-center py-6">
                      <div className="w-7 h-7 border-3 border-mc-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="text-center py-6 bg-mc-bg rounded-xl border border-mc-border">
                      <p className="text-mc-text-secondary text-sm font-body">No slots available for this date.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2" data-testid="time-slots-grid">
                      {availableSlots.map(slot => (
                        <button
                          key={slot}
                          onClick={() => setSelectedTime(slot)}
                          className={`py-2 text-sm font-body rounded-lg border transition-all ${
                            selectedTime === slot
                              ? 'bg-mc-primary text-white border-mc-primary shadow-md'
                              : 'border-mc-border text-mc-text hover:border-mc-primary hover:text-mc-primary bg-mc-surface'
                          }`}
                          data-testid={`time-slot-${slot}`}
                        >{slot}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-mc-text mb-1.5 font-body">Notes (Optional)</label>
                <textarea
                  value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Describe your symptoms or reason for consultation..."
                  rows={3}
                  className="w-full px-4 py-3 border border-mc-border rounded-xl text-mc-text text-sm font-body bg-mc-bg focus:outline-none focus:border-mc-secondary focus:ring-2 focus:ring-mc-secondary/20 transition-all resize-none"
                  data-testid="booking-notes-input"
                />
              </div>

              {/* Booking Summary */}
              {selectedDate && selectedTime && (
                <div className="bg-mc-bg border border-mc-border rounded-xl p-4 mb-6" data-testid="booking-summary">
                  <h4 className="text-sm font-medium text-mc-text mb-2 font-body">Booking Summary</h4>
                  <div className="space-y-1.5 text-sm text-mc-text-secondary font-body">
                    <div className="flex justify-between"><span>Doctor</span><span className="text-mc-text font-medium">{doctor.name}</span></div>
                    <div className="flex justify-between"><span>Date</span><span className="text-mc-text font-medium">{selectedDate.toLocaleDateString('en-IN')}</span></div>
                    <div className="flex justify-between"><span>Time</span><span className="text-mc-text font-medium">{selectedTime}</span></div>
                    <div className="flex justify-between border-t border-mc-border pt-2 mt-2"><span className="font-medium text-mc-text">Consultation Fee</span><span className="font-heading text-mc-primary font-700">₹{doctor.consultation_fee?.toLocaleString()}</span></div>
                  </div>
                </div>
              )}

              <button
                onClick={handleBook}
                disabled={!selectedDate || !selectedTime || bookingLoading || !user}
                className="w-full flex items-center justify-center gap-2 bg-mc-primary text-white font-medium rounded-xl py-4 font-body hover:bg-mc-primary-hover transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                data-testid="book-appointment-button"
              >
                {bookingLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><CheckCircle size={18} /> Book & Proceed to Payment</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingPage;
