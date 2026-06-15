import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, ArrowRight, RefreshCw } from 'lucide-react';
import api from '../utils/api';

const PaymentStatus = () => {
  const [searchParams] = useSearchParams();
  const txnId = searchParams.get('txnId');
  const [txn, setTxn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!txnId) { setLoading(false); setError('No transaction ID found.'); return; }
    checkStatus();
  }, [txnId]);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/payments/status/${txnId}`);
      setTxn(res.data);
    } catch (err) {
      setError('Failed to fetch payment status.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-mc-bg">
      <div className="text-center">
        <div className="w-14 h-14 border-4 border-mc-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-mc-text-secondary font-body">Verifying your payment...</p>
      </div>
    </div>
  );

  const state = txn?.payment_state || 'UNKNOWN';
  const isWorkshop = txn?.entity_type === 'workshop_registration';

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-mc-bg px-4 py-12">
      <div className="max-w-md w-full bg-mc-surface border border-mc-border rounded-2xl shadow-sm overflow-hidden animate-fade-in" data-testid="payment-status-card">
        {/* Status Header */}
        <div className={`p-8 text-center ${state === 'COMPLETED' ? 'bg-emerald-50' : state === 'FAILED' ? 'bg-red-50' : 'bg-amber-50'}`}>
          {state === 'COMPLETED' ? (
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={40} className="text-emerald-600" strokeWidth={1.5} />
            </div>
          ) : state === 'FAILED' ? (
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle size={40} className="text-red-500" strokeWidth={1.5} />
            </div>
          ) : (
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock size={40} className="text-amber-600" strokeWidth={1.5} />
            </div>
          )}
          <h2 className="font-heading text-2xl font-700 text-mc-text">
            {state === 'COMPLETED' ? 'Payment Successful!' : state === 'FAILED' ? 'Payment Failed' : 'Payment Pending'}
          </h2>
          <p className="text-mc-text-secondary text-sm mt-2 font-body">
            {state === 'COMPLETED' ? (isWorkshop ? 'Your workshop registration has been confirmed.' : 'Your appointment has been confirmed.') : state === 'FAILED' ? 'Your payment could not be processed.' : 'Your payment is being processed.'}
          </p>
        </div>

        {/* Details */}
        <div className="p-6 space-y-3 font-body">
          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
          {txn && (
            <>
              {[
                { label: 'Transaction ID', value: txn.transaction_id },
                { label: 'Amount', value: `₹${((txn.amount || 0) / 100).toLocaleString()}` },
                { label: 'Doctor', value: txn.doctor_name },
                 { label: isWorkshop ? 'Workshop' : 'Appointment', value: txn.appointment_date && txn.appointment_time ? `${txn.appointment_date} at ${txn.appointment_time}` : null },
                { label: 'Status', value: state },
                txn.provider_reference_id && { label: 'Reference ID', value: txn.provider_reference_id },
              ].filter(Boolean).filter(r => r.value).map((row, i) => (
                <div key={i} className="flex justify-between text-sm border-b border-mc-border pb-2 last:border-0 last:pb-0">
                  <span className="text-mc-text-secondary">{row.label}</span>
                  <span className={`font-medium text-mc-text ${row.label === 'Status' ? (state === 'COMPLETED' ? 'text-emerald-600' : state === 'FAILED' ? 'text-red-500' : 'text-amber-600') : ''}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-3">
          {state === 'COMPLETED' && (
            <a href="/dashboard" className="w-full flex items-center justify-center gap-2 bg-mc-primary text-white font-medium rounded-xl py-3.5 text-sm font-body hover:bg-mc-primary-hover transition-all" data-testid="view-appointments-btn">
              {isWorkshop ? 'View My Workshops' : 'View My Appointments'} <ArrowRight size={16} />
            </a>
          )}
          {state === 'FAILED' && (
            <a href="/doctors" className="w-full flex items-center justify-center gap-2 bg-mc-primary text-white font-medium rounded-xl py-3.5 text-sm font-body hover:bg-mc-primary-hover transition-all" data-testid="try-again-btn">
              Try Again
            </a>
          )}
          {state === 'PENDING' && (
            <button onClick={checkStatus} className="w-full flex items-center justify-center gap-2 bg-mc-primary text-white font-medium rounded-xl py-3.5 text-sm font-body hover:bg-mc-primary-hover transition-all" data-testid="refresh-status-btn">
              <RefreshCw size={16} /> Refresh Status
            </button>
          )}
          <a href="/" className="w-full flex items-center justify-center gap-2 border border-mc-border text-mc-text font-medium rounded-xl py-3 text-sm font-body hover:bg-mc-bg transition-all" data-testid="back-home-btn">
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
};

export default PaymentStatus;
