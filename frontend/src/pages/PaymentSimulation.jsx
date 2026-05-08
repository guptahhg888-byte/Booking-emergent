import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CreditCard, Smartphone, X, Shield, CheckCircle } from 'lucide-react';
import api from '../utils/api';

const PaymentSimulation = () => {
  const { txnId } = useParams();
  const navigate = useNavigate();
  const [txn, setTxn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('upi');

  useEffect(() => {
    if (!txnId) { navigate('/'); return; }
    api.get(`/payments/status/${txnId}`)
      .then(res => setTxn(res.data))
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [txnId, navigate]);

  const handlePay = async () => {
    setProcessing(true);
    try {
      await api.post(`/payments/simulate/${txnId}/success`);
      navigate(`/payment/status?txnId=${txnId}`);
    } catch {
      navigate(`/payment/status?txnId=${txnId}`);
    }
  };

  const handleCancel = async () => {
    try {
      await api.post(`/payments/simulate/${txnId}/failure`);
    } catch {}
    navigate(`/payment/status?txnId=${txnId}`);
  };

  if (loading) return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-mc-bg">
      <div className="w-10 h-10 border-4 border-mc-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const amount = txn ? (txn.amount / 100).toLocaleString('en-IN') : '2,000';

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gradient-to-br from-[#2C5545] to-[#8A9A86] px-4 py-12">
      <div className="max-w-sm w-full bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in" data-testid="payment-simulation-card">
        {/* PhonePe-like Header */}
        <div className="bg-[#2C5545] px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white font-heading font-600 text-sm">Dr. MadhumatiSingh Pay</p>
              <p className="text-white/60 text-xs">Secure Payment Gateway</p>
            </div>
          </div>
          <button onClick={handleCancel} className="text-white/60 hover:text-white transition-colors p-1" data-testid="cancel-payment-btn">
            <X size={20} />
          </button>
        </div>

        {/* Amount */}
        <div className="text-center py-8 px-6 bg-mc-bg border-b border-mc-border">
          <p className="text-mc-text-secondary text-sm font-body mb-1">Amount to Pay</p>
          <p className="font-heading text-5xl text-mc-text font-700">₹{amount}</p>
          {txn?.doctor_name && (
            <p className="text-mc-text-secondary text-xs mt-2 font-body">
              Consultation with {txn.doctor_name}
              {txn.appointment_date && ` • ${txn.appointment_date}`}
            </p>
          )}
        </div>

        {/* Payment Methods */}
        <div className="p-6">
          <p className="text-xs uppercase tracking-widest font-medium text-mc-text-secondary mb-3 font-body">Select Payment Method</p>
          <div className="space-y-2 mb-6">
            {[
              { id: 'upi', icon: <Smartphone size={18} />, label: 'UPI / PhonePe', desc: 'Pay using any UPI app' },
              { id: 'card', icon: <CreditCard size={18} />, label: 'Credit / Debit Card', desc: 'Visa, Mastercard, RuPay' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedMethod(m.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all text-left ${selectedMethod === m.id ? 'border-mc-primary bg-mc-primary/5' : 'border-mc-border hover:border-mc-secondary'}`}
                data-testid={`payment-method-${m.id}`}
              >
                <div className={`${selectedMethod === m.id ? 'text-mc-primary' : 'text-mc-text-secondary'}`}>{m.icon}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-mc-text font-body">{m.label}</p>
                  <p className="text-xs text-mc-text-secondary font-body">{m.desc}</p>
                </div>
                {selectedMethod === m.id && <CheckCircle size={18} className="text-mc-primary" />}
              </button>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
            <p className="text-xs text-amber-700 font-body text-center">
              <strong>Sandbox Mode:</strong> This is a simulated payment for testing purposes only.
            </p>
          </div>

          <button
            onClick={handlePay}
            disabled={processing}
            className="w-full flex items-center justify-center gap-2 bg-mc-primary text-white font-medium rounded-xl py-4 text-sm font-body hover:bg-mc-primary-hover transition-all hover:-translate-y-0.5 disabled:opacity-60 shadow-lg"
            data-testid="simulate-pay-button"
          >
            {processing ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Shield size={16} /> Pay ₹{amount} Securely</>
            )}
          </button>

          <button
            onClick={handleCancel}
            className="w-full text-center text-sm text-mc-text-secondary hover:text-red-500 transition-colors mt-3 font-body py-2"
            data-testid="cancel-payment-link"
          >
            Cancel Payment
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSimulation;
