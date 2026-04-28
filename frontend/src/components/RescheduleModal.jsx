import React, { useState, useEffect } from 'react';
import { X, Calendar as CalIcon, CheckCircle, AlertCircle } from 'lucide-react';
import { Calendar as CalendarComp } from './ui/calendar';
import api from '../utils/api';

const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Reschedule modal. Reuses availability endpoint honoring each doctor's
 * configured start_time / end_time / slot_duration_minutes / lunch break.
 */
const RescheduleModal = ({ appointment, onClose, onSuccess }) => {
  const [doctor, setDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/doctors/${appointment.doctor_id}`)
      .then(res => setDoctor(res.data))
      .catch(() => setError('Failed to load doctor details'));
  }, [appointment.doctor_id]);

  useEffect(() => {
    if (!selectedDate) return;
    setSlotsLoading(true);
    setSelectedTime('');
    const dateStr = formatDate(selectedDate);
    api.get(`/doctors/${appointment.doctor_id}/available-slots`, { params: { date: dateStr } })
      .then(res => setAvailableSlots(res.data.available_slots || []))
      .catch(() => setAvailableSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, appointment.doctor_id]);

  const isDateDisabled = (date) => {
    if (date < new Date(new Date().setHours(0, 0, 0, 0))) return true;
    if (!doctor?.available_days) return false;
    return !doctor.available_days.includes(DAYS[date.getDay()]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime) {
      setError('Please select a new date and time');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.put(`/appointments/${appointment._id}/reschedule`, {
        appointment_date: formatDate(selectedDate),
        appointment_time: selectedTime,
      });
      onSuccess({
        ...appointment,
        appointment_date: formatDate(selectedDate),
        appointment_time: selectedTime,
      });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.map(d => d.msg).join(' ') : (detail || 'Reschedule failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="reschedule-modal">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-mc-border sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <CalIcon size={20} className="text-mc-primary" />
            <h2 className="font-heading text-lg text-mc-text font-700">Reschedule Appointment</h2>
          </div>
          <button onClick={onClose} className="text-mc-text-secondary hover:text-mc-text transition-colors p-1" data-testid="reschedule-close">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Current appointment summary */}
          <div className="bg-mc-bg border border-mc-border rounded-xl p-4 font-body text-sm">
            <p className="text-xs text-mc-text-secondary mb-2">Current Appointment</p>
            <p className="font-medium text-mc-text">{appointment.doctor_name}</p>
            <p className="text-mc-text-secondary mt-1">
              {appointment.appointment_date} at {appointment.appointment_time}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 font-body" data-testid="reschedule-error">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-mc-text mb-3 font-body">Select New Date *</label>
            <div className="border border-mc-border rounded-xl overflow-hidden bg-mc-bg flex justify-center p-2">
              <CalendarComp
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={isDateDisabled}
                className="font-body"
                data-testid="reschedule-calendar"
              />
            </div>
          </div>

          {selectedDate && (
            <div>
              <label className="block text-sm font-medium text-mc-text mb-3 font-body">
                New Time — {selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
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
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2" data-testid="reschedule-slots-grid">
                  {availableSlots.map(slot => (
                    <button
                      type="button"
                      key={slot}
                      onClick={() => setSelectedTime(slot)}
                      className={`py-2 text-sm font-body rounded-lg border transition-all ${
                        selectedTime === slot
                          ? 'bg-mc-primary text-white border-mc-primary shadow-md'
                          : 'border-mc-border text-mc-text hover:border-mc-primary hover:text-mc-primary bg-mc-surface'
                      }`}
                      data-testid={`reschedule-slot-${slot}`}
                    >{slot}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-3">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary text-sm py-3" data-testid="reschedule-cancel">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedDate || !selectedTime || saving}
              className="flex-1 btn-primary text-sm py-3 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              data-testid="reschedule-confirm"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <><CheckCircle size={16} /> Confirm Reschedule</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RescheduleModal;
